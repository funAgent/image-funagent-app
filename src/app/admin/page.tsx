"use client";

import Link from "next/link";
import { Gauge, Loader2, LogOut, ShieldCheck, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/admin-panel";
import {
  type MeResponse,
  type Quota,
  type User,
  cx,
  Notice,
  primaryButton,
  secondaryButton,
} from "@/components/shared";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<MeResponse>)
      .then((data) => {
        if (!active) return;
        if (data.ok && data.user) {
          if (data.user.role !== "ADMIN") {
            setError("需要管理员权限");
          } else {
            setUser(data.user);
            setQuota(data.quota);
          }
        } else {
          setError(data.error ?? "请先登录");
        }
      })
      .catch(() => {
        if (active) setError("加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2.5 px-3 py-2 sm:px-4 sm:py-3 lg:px-5">
          <header className="sticky top-0 z-20 -mx-3 border-b border-[var(--stroke)] bg-[rgba(246,247,251,0.88)] px-3 py-2.5 backdrop-blur-xl sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
            <div className="mx-auto flex max-w-[1240px] items-center gap-2.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-[7px] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(15,118,110,0.24)]">
                <WandSparkles size={18} />
              </div>
              <h1 className="text-sm font-semibold sm:text-base">FunAgent Image</h1>
            </div>
          </header>
          <div className="grid min-h-[400px] place-items-center">
            <div className="flex items-center gap-3 text-sm text-[var(--muted-strong)]">
              <Loader2 className="animate-spin text-[var(--accent)]" size={20} />
              正在验证权限
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="min-h-screen bg-[var(--background)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2.5 px-3 py-2 sm:px-4 sm:py-3 lg:px-5">
          <header className="sticky top-0 z-20 -mx-3 border-b border-[var(--stroke)] bg-[rgba(246,247,251,0.88)] px-3 py-2.5 backdrop-blur-xl sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-[7px] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(15,118,110,0.24)]">
                  <WandSparkles size={18} />
                </div>
                <h1 className="text-sm font-semibold sm:text-base">FunAgent Image</h1>
              </div>
              <Link href="/" className={cx(secondaryButton, "h-9 px-3 text-sm")}>
                返回主页
              </Link>
            </div>
          </header>
          <div className="grid min-h-[400px] place-items-center">
            <div className="text-center">
              <Notice tone="danger">{error ?? "无权限访问"}</Notice>
              <Link href="/" className={cx(primaryButton, "mt-4 inline-flex h-10 px-4 text-sm")}>
                返回主页
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2.5 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:px-5">
        <header className="sticky top-0 z-20 -mx-3 border-b border-[var(--stroke)] bg-[rgba(246,247,251,0.88)] px-3 py-2.5 backdrop-blur-xl sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-[7px] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(15,118,110,0.24)]">
                <WandSparkles size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-semibold sm:text-base">
                    FunAgent Image
                  </h1>
                  <span className="hidden rounded-full bg-[var(--lime-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-[var(--warning)] sm:inline-flex">
                    gpt-image-2
                  </span>
                </div>
                <p className="truncate text-[11px] text-[var(--muted-strong)]">
                  image.funagent.app
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-[var(--stroke-strong)] bg-[var(--surface)] px-2.5 text-sm font-medium text-[var(--accent)]">
                <ShieldCheck size={15} />
                Admin
              </span>
              {quota ? (
                <div className="hidden h-9 items-center gap-2 rounded-[7px] border border-[var(--stroke)] bg-white px-2.5 text-sm md:flex">
                  <Gauge size={15} className="text-[var(--accent)]" />
                  <span className="text-[var(--muted-strong)]">今日额度</span>
                  <strong className="font-semibold">
                    {quota.remaining}/{quota.dailyLimit}
                  </strong>
                </div>
              ) : null}
              <Link href="/" className={cx(secondaryButton, "h-9 px-2.5 text-sm")}>
                返回主页
              </Link>
              <button onClick={logout} className={cx(secondaryButton, "h-9 px-2.5 text-sm")}>
                <LogOut size={15} />
                退出
              </button>
            </div>
          </div>
        </header>

        <AdminPanel />
      </div>
    </main>
  );
}
