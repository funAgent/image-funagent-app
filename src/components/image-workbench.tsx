"use client";

import {
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  FileImage,
  Gauge,
  ImageIcon,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  type Generation,
  type MeResponse,
  type Quota,
  type User,
  CompactStat,
  Notice,
  cx,
  formatDate,
  formatMb,
  inputClass,
  panelClass,
  primaryButton,
  secondaryButton,
} from "./shared";

const aspectOptions = [
  { value: "auto", label: "自动", detail: "AI发挥" },
  { value: "1:1", label: "1:1", detail: "头像/方图" },
  { value: "3:4", label: "3:4", detail: "竖版海报" },
  { value: "4:3", label: "4:3", detail: "横版内容" },
  { value: "16:9", label: "16:9", detail: "宽屏封面" },
  { value: "9:16", label: "9:16", detail: "手机竖屏" },
];

const formatOptions = [
  { value: "png", label: "PNG", detail: "Clean" },
  { value: "jpeg", label: "JPG", detail: "Light" },
  { value: "webp", label: "WEBP", detail: "Web" },
];

function getGenerationImageFilename(generation: Generation) {
  const extension = generation.outputFormat === "jpeg" ? "jpg" : generation.outputFormat;
  return `funagent-${generation.id}.${extension || "png"}`;
}

function generationStatusMeta(status: Generation["status"]) {
  if (status === "SUCCEEDED") {
    return {
      label: "已完成",
      textClass: "text-[var(--success)]",
      badgeClass: "border-[rgba(22,130,85,0.22)] bg-[var(--success-soft)] text-[var(--success)]",
      tileClass: "border-[rgba(22,130,85,0.24)] bg-[var(--success-soft)] text-[var(--success)]",
    };
  }

  if (status === "FAILED") {
    return {
      label: "生成失败",
      textClass: "text-[var(--danger)]",
      badgeClass: "border-[rgba(180,35,24,0.22)] bg-[var(--danger-soft)] text-[var(--danger)]",
      tileClass: "border-[rgba(180,35,24,0.22)] bg-[var(--danger-soft)] text-[var(--danger)]",
    };
  }

  return {
    label: "生成中",
    textClass: "text-[var(--warning)]",
    badgeClass: "border-[rgba(180,83,9,0.24)] bg-[var(--warning-soft)] text-[var(--warning)]",
    tileClass: "border-[rgba(180,83,9,0.24)] bg-[var(--warning-soft)] text-[var(--warning)]",
  };
}

const queuedWaitHint = "一般需要等待 10 分钟左右";

export function ImageWorkbench() {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await response.json()) as MeResponse;
    if (data.ok) {
      setUser(data.user);
      setQuota(data.quota);
      setGenerations(data.generations);
      setMessage(null);
    } else {
      setMessage(data.error ?? "加载失败");
    }
    setLoading(false);
  };

  const refreshGenerations = async () => {
    const response = await fetch("/api/generations", { cache: "no-store" });
    const data = await response.json();
    if (!data.ok) {
      setMessage(data.error ?? "加载生成记录失败");
      return;
    }
    setQuota(data.quota);
    setGenerations(data.generations);
  };

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<MeResponse>)
      .then((data) => {
        if (!active) return;
        if (data.ok) {
          setUser(data.user);
          setQuota(data.quota);
          setGenerations(data.generations);
        } else {
          setMessage(data.error ?? "加载失败");
        }
      })
      .catch(() => {
        if (active) setMessage("加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !generations.some((generation) => generation.status === "QUEUED")) {
      return;
    }

    const timer = window.setInterval(() => {
      refreshGenerations().catch(() => setMessage("加载生成记录失败"));
    }, 10000);

    return () => window.clearInterval(timer);
  }, [generations, user]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setQuota(null);
    setGenerations([]);
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2.5 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:px-5">
        <TopBar user={user} quota={quota} onLogout={logout} />

        {message ? <Notice tone="warn">{message}</Notice> : null}

        {loading ? (
          <div className="grid min-h-[400px] place-items-center">
            <div className="flex items-center gap-3 text-sm text-[var(--muted-strong)]">
              <Loader2 className="animate-spin text-[var(--accent)]" size={20} />
              正在连接工作台
            </div>
          </div>
        ) : user && quota ? (
          <section className="grid items-start gap-2.5 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
            <Creator
              quota={quota}
              onDone={(generation, nextQuota) => {
                setGenerations((items) => [generation, ...items]);
                setQuota(nextQuota);
              }}
            />
            <History quota={quota} generations={generations} />
          </section>
        ) : (
          <LoginPanel onLoggedIn={refresh} />
        )}
      </div>
    </main>
  );
}

function TopBar({
  user,
  quota,
  onLogout,
}: {
  user: User | null;
  quota: Quota | null;
  onLogout: () => Promise<void>;
}) {
  return (
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
          {quota ? (
            <div className="hidden h-9 items-center gap-2 rounded-[7px] border border-[var(--stroke)] bg-white px-2.5 text-sm md:flex">
              <Gauge size={15} className="text-[var(--accent)]" />
              <span className="text-[var(--muted-strong)]">今日额度</span>
              <strong className="font-semibold">
                {quota.remaining}/{quota.dailyLimit}
              </strong>
            </div>
          ) : null}
          {user?.role === "ADMIN" ? (
            <a href="/admin" className={cx(secondaryButton, "h-9 px-2.5 text-sm")}>
              <ShieldCheck size={15} />
              管理
            </a>
          ) : null}
          {user ? (
            <button onClick={onLogout} className={cx(secondaryButton, "h-9 px-2.5 text-sm")}>
              <LogOut size={15} />
              退出
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function LoginPanel({ onLoggedIn }: { onLoggedIn: () => Promise<void> }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "expired">("idle");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocal] = useState(
    () =>
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname),
  );

  useEffect(() => {
    if (!attemptId || status !== "pending") return;

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/auth/login-status?attemptId=${attemptId}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.status === "CONFIRMED") {
        window.clearInterval(timer);
        await onLoggedIn();
      }

      if (data.status === "EXPIRED") {
        setStatus("expired");
        window.clearInterval(timer);
      }
    }, 1800);

    return () => window.clearInterval(timer);
  }, [attemptId, onLoggedIn, status]);

  const start = async () => {
    setError(null);
    const response = await fetch("/api/auth/login-code", { method: "POST" });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "登录码创建失败");
      return;
    }
    setAttemptId(data.attemptId);
    setCommand(data.command);
    setExpiresAt(data.expiresAt);
    setStatus("pending");
  };

  const copy = async () => {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const devLogin = async () => {
    const response = await fetch("/api/auth/dev-login", { method: "POST" });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "调试登录失败");
      return;
    }
    await onLoggedIn();
  };

  const inviteLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteSubmitting(true);
    setError(null);
    const response = await fetch("/api/auth/invite-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: inviteCode }),
    });
    const data = await response.json();
    setInviteSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "邀请码登录失败");
      return;
    }
    await onLoggedIn();
  };

  return (
    <section className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4 px-4 py-4 sm:min-h-[calc(100vh-72px)] sm:gap-5 lg:min-h-[calc(100vh-80px)] lg:gap-6">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center lg:mb-5 lg:text-center">
          <div className="mb-2 inline-flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-[8px] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(15,118,110,0.24)]">
              <WandSparkles size={18} />
            </div>
            <span className="rounded-full bg-[var(--lime-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase text-[var(--warning)]">
              gpt-image-2
            </span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            AI 图片生成
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted-strong)]">
            使用 gpt-image-2 模型，每天免费使用，输入描述即可生成高质量图片
          </p>
        </div>

        <div className={cx(panelClass, "p-4 sm:p-5")}>
          <form onSubmit={inviteLogin} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--muted-strong)]">
                邀请码
              </span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="FA-ABCD-2345"
                className={cx(inputClass, "h-11 font-mono uppercase tracking-normal")}
              />
            </label>
            <button
              disabled={inviteSubmitting}
              className={cx(primaryButton, "h-11 w-full px-4")}
            >
              {inviteSubmitting ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <KeyRound size={17} />
              )}
              邀请码登录
            </button>
          </form>

          <div className="mt-4 border-t border-[var(--stroke)] pt-4">
            <p className="mb-3 text-center text-sm text-[var(--muted-strong)]">
              扫码关注，选任意一篇文章「一键三连」，联系我获取邀请码即可免费使用
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <img
                  src="/wechat-qr.jpg"
                  alt="微信公众号"
                  className="h-[140px] w-[140px] rounded-[8px] border border-[var(--stroke)] object-cover"
                />
                <span className="text-xs font-medium text-[var(--muted-strong)]">微信公众号</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <img
                  src="/xhs-qr.jpg"
                  alt="小红书"
                  className="h-[140px] w-[140px] rounded-[8px] border border-[var(--stroke)] object-cover"
                />
                <span className="text-xs font-medium text-[var(--muted-strong)]">小红书</span>
              </div>
            </div>
          </div>

          {/* 公众号登录备用 - 暂时隐藏 */}
          <div className="hidden">
            <div className="mt-4 border-t border-[var(--stroke)] pt-3">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--accent)]">
                  <span className="inline-flex items-center gap-2">
                    <Send size={15} />
                    公众号登录备用
                  </span>
                  <ChevronRight size={15} />
                </summary>
                <div className="mt-3">
                  {!command ? (
                    <button onClick={start} className={cx(secondaryButton, "h-9 w-full px-3 text-sm")}>
                      <Send size={15} />
                      获取公众号登录码
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-3">
                        <div className="text-xs font-medium uppercase text-[var(--muted)]">
                          发送到公众号
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <code className="break-all text-xl font-semibold text-[var(--accent)]">
                            {command}
                          </code>
                          <button
                            onClick={copy}
                            className={cx(secondaryButton, "size-9 shrink-0 p-0")}
                            aria-label="复制登录码"
                          >
                            {copied ? <Check size={15} /> : <Clipboard size={15} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
                        {status === "pending" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        {status === "expired"
                          ? "登录码已过期"
                          : `有效期至 ${expiresAt ? new Date(expiresAt).toLocaleTimeString() : ""}`}
                      </div>
                      <button onClick={start} className={cx(secondaryButton, "h-9 px-3 text-sm")}>
                        <RefreshCw size={14} />
                        重新获取
                      </button>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>

          {isLocal ? (
            <button
              onClick={devLogin}
              className={cx(secondaryButton, "mt-3 h-9 w-full px-3 text-sm")}
            >
              <Settings size={15} />
              调试登录
            </button>
          ) : null}

          {error ? (
            <Notice className="mt-3" tone="danger">
              {error}
            </Notice>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Creator({
  quota,
  onDone,
}: {
  quota: Quota;
  onDone: (generation: Generation, quota: Quota) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("auto");
  const [outputFormat, setOutputFormat] = useState("png");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);

  const usagePercent = useMemo(() => {
    if (!quota.dailyLimit) return 0;
    return Math.min(
      100,
      Math.round(((quota.used + quota.reserved) / quota.dailyLimit) * 100),
    );
  }, [quota.dailyLimit, quota.reserved, quota.used]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("prompt", prompt);
      formData.set("size", size);
      formData.set("quality", "medium");
      formData.set("outputFormat", outputFormat);
      files.forEach((file) => formData.append("images", file));

      const response = await fetch("/api/generations", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!data.ok) {
        setError(data.error ?? "生成失败");
        return;
      }

      onDone(data.generation, data.quota);
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className={cx(panelClass, "overflow-hidden lg:sticky lg:top-[72px]")}>
      <form onSubmit={submit} className="flex flex-col">
        <div className="border-b border-[var(--stroke)] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold sm:text-lg">图片生成</h2>
            <div className="rounded-full border border-[var(--stroke)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-strong)]">
              medium · {outputFormat.toUpperCase()}
            </div>
          </div>

          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[11px] text-[var(--muted-strong)]">
              <span>{quota.usageDate}</span>
              <span>
                剩余 {quota.remaining}/{quota.dailyLimit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--line)]">
              <div
                className="h-1.5 rounded-full bg-[var(--accent)]"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-[var(--muted-strong)]">剩余 <strong className="text-[var(--ink)]">{quota.remaining}</strong></span>
            <span className="text-[var(--muted-strong)]">已用 <strong className="text-[var(--ink)]">{quota.used}</strong></span>
            <span className="text-[var(--muted-strong)]">生成中 <strong className="text-[var(--ink)]">{quota.reserved}</strong></span>
          </div>
        </div>

        <div className="grid flex-1 gap-3 p-3 sm:gap-3.5 sm:p-4">
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--muted-strong)]">
                描述
              </span>
              <span className={cx("text-xs", prompt.length > 3200 ? "text-[var(--danger)] font-medium" : "text-[var(--muted)]")}>
                {prompt.length}/3200
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="一张清晨咖啡店里的产品海报，木质桌面，柔和自然光，干净高级"
              className={cx(
                inputClass,
                prompt.length > 3200 && "border-[var(--danger)] focus:border-[var(--danger)]",
                "min-h-[80px] resize-y p-2.5 text-sm leading-5 sm:min-h-[140px]",
              )}
            />
            {prompt.length > 3200 ? (
              <p className="mt-1.5 text-xs text-[var(--danger)]">
                描述超过 3200 字上限，请精简后再提交
              </p>
            ) : null}
          </label>

          <AspectPicker value={size} onChange={setSize} />

          <SegmentedControl
            label="格式"
            value={outputFormat}
            onChange={setOutputFormat}
            options={formatOptions}
          />

          <div className="rounded-[8px] border border-dashed border-[var(--stroke-strong)] bg-[var(--surface-muted)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">参考图</div>
                <div className="mt-0.5 text-xs text-[var(--muted-strong)]">
                  {files.length}/{quota.maxRefImages} · 单张≤{quota.maxFileMb}MB · 总量≤{quota.maxTotalUploadMb}MB
                </div>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cx(secondaryButton, "h-9 shrink-0 px-3 text-sm")}
              >
                <Upload size={15} />
                上传
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                setFiles(selected.slice(0, quota.maxRefImages));
              }}
            />
            {files.length > 0 ? (
              <div className="mt-2 grid gap-1.5">
                {files.map((file) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    className="flex min-w-0 items-center gap-2 rounded-[6px] border border-[var(--stroke)] bg-white p-2"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-[5px] bg-[var(--line)] text-[var(--accent)]">
                      <FileImage size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{file.name}</div>
                      <div className="text-xs text-[var(--muted)]">{formatMb(file.size)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((items) => items.filter((item) => item !== file))
                      }
                      className="grid size-7 shrink-0 place-items-center rounded-[5px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                      aria-label="移除参考图"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <Notice tone="danger">{error}</Notice> : null}
        </div>

        <div className="border-t border-[var(--stroke)] bg-[var(--surface)] p-3 sm:p-4">
          <button
            disabled={submitting || quota.remaining <= 0 || prompt.length > 3200}
            className={cx(primaryButton, "h-11 w-full px-4")}
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            {submitting ? "已加入生成队列" : prompt.length > 3200 ? "描述超出字数上限" : quota.remaining <= 0 ? "今日额度已用完" : "生成图片"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AspectPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-[var(--muted-strong)]">
        画幅
      </legend>
      <div className="grid grid-cols-6 gap-1 rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-1">
        {aspectOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-[6px] px-1 py-1.5 text-center transition sm:py-2",
              value === option.value
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--muted-strong)] hover:bg-white/70",
            )}
          >
            <span className="block text-xs font-semibold sm:text-sm">{option.label}</span>
            <span className="hidden text-[10px] text-[var(--muted)] sm:block">
              {option.detail}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function History({ quota, generations }: { quota: Quota; generations: Generation[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const copyPrompt = async (generation: Generation) => {
    await navigator.clipboard.writeText(generation.prompt);
    setCopiedId(generation.id);
    window.setTimeout(() => setCopiedId(null), 1200);
  };

  const downloadImage = async (generation: Generation) => {
    if (!generation.imageUrl) return;

    setDownloadingId(generation.id);
    try {
      const response = await fetch(generation.imageUrl);
      if (!response.ok) throw new Error("Image download failed");

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getGenerationImageFilename(generation);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(generation.imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className={cx(panelClass, "overflow-hidden")}>
      <div className="border-b border-[var(--stroke)] p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">
              Gallery
            </p>
            <h2 className="mt-0.5 text-lg font-semibold sm:text-xl">生成记录</h2>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <CompactStat label="剩余" value={quota.remaining.toString()} />
            <CompactStat label="已用" value={quota.used.toString()} />
            <CompactStat label="队列" value={quota.reserved.toString()} />
          </div>
        </div>
      </div>

      {generations.length === 0 ? (
        <div className="grid min-h-[280px] place-items-center bg-[var(--surface-muted)] p-6 text-center">
          <div>
            <div className="mx-auto mb-3 grid size-11 place-items-center rounded-[8px] border border-[var(--stroke)] bg-white text-[var(--accent)]">
              <ImageIcon size={20} />
            </div>
            <p className="font-medium">暂无生成记录</p>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">
              提交后会在这里查看进度、复制提示词和下载图片
            </p>
          </div>
        </div>
      ) : (
        <div className="grid max-h-none gap-2 overflow-y-auto p-2.5 sm:grid-cols-2 sm:p-3 lg:max-h-[calc(100vh-100px)] xl:grid-cols-2">
          {generations.map((generation) => {
            const statusMeta = generationStatusMeta(generation.status);
            return (
              <article
                key={generation.id}
                className="overflow-hidden rounded-[8px] border border-[var(--stroke)] bg-white shadow-[0_10px_26px_rgba(17,24,39,0.05)]"
              >
                <div
                  className="relative aspect-[4/3] cursor-pointer bg-[var(--line)]"
                  onClick={() => generation.imageUrl && setPreviewUrl(generation.imageUrl)}
                >
                  {generation.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={generation.imageUrl}
                      alt={generation.prompt}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className={cx("grid size-full place-items-center border-b", statusMeta.tileClass)}>
                      <div className="text-center">
                        <div className="mx-auto mb-2 grid size-10 place-items-center rounded-[8px] bg-white/70">
                          {generation.status === "QUEUED" ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : generation.status === "FAILED" ? (
                            <X size={20} />
                          ) : (
                            <Check size={20} />
                          )}
                        </div>
                        <p className="text-sm font-semibold">{statusMeta.label}</p>
                        {generation.status === "QUEUED" ? (
                          <p className="mt-1 text-xs text-[color:rgba(120,53,15,0.82)]">{queuedWaitHint}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <div
                    className={cx(
                      "absolute left-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm backdrop-blur",
                      statusMeta.badgeClass,
                    )}
                  >
                    {generation.status === "QUEUED" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : generation.status === "FAILED" ? (
                      <X size={12} />
                    ) : (
                      <Check size={12} />
                    )}
                    {statusMeta.label}
                  </div>
                </div>

                <div className="flex flex-col p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span className={cx("font-medium", statusMeta.textClass)}>
                      {generation.mode === "REFERENCE" ? "参考图生成" : "文本生成"}
                    </span>
                    <span>{formatDate(generation.createdAt)}</span>
                  </div>
                  <div className="max-h-20 overflow-y-auto text-sm leading-5 text-[var(--ink)]">
                    {generation.prompt}
                  </div>
                  {generation.status === "QUEUED" ? (
                    <p className="mt-1.5 rounded-[6px] bg-[var(--warning-soft)] px-2 py-1.5 text-xs leading-4 text-[var(--warning)]">
                      {queuedWaitHint}
                    </p>
                  ) : null}
                  {generation.errorMessage ? (
                    <p className="mt-1.5 line-clamp-2 rounded-[6px] bg-[var(--danger-soft)] px-2 py-1.5 text-xs leading-4 text-[var(--danger)]">
                      {generation.errorMessage}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyPrompt(generation)}
                      className={cx(secondaryButton, "h-8 min-w-[68px] px-2.5 text-xs")}
                      title="复制提示词"
                    >
                      {copiedId === generation.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === generation.id ? "已复制" : "复制"}
                    </button>
                    {generation.imageUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() => downloadImage(generation)}
                          disabled={downloadingId === generation.id}
                          className={cx(primaryButton, "h-8 min-w-[68px] px-2.5 text-xs hidden sm:inline-flex")}
                          title="下载图片"
                        >
                          {downloadingId === generation.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                          {downloadingId === generation.id ? "下载中" : "下载"}
                        </button>
                        <span className="text-[11px] text-[var(--muted)] sm:hidden">
                          点击预览，长按图片保存
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            onClick={() => setPreviewUrl(null)}
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}

function SegmentedControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; detail: string }[];
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-[var(--muted-strong)]">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-[6px] px-2 py-2 text-center transition sm:py-2.5",
              value === option.value
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--muted-strong)] hover:bg-white/70",
            )}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="hidden text-[11px] text-[var(--muted)] sm:block">
              {option.detail}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
