"use client";

import {
  Ban,
  Check,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  Download,
  FileImage,
  Gauge,
  ImageIcon,
  Images,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Upload,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  wechatOpenId: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED";
  dailyLimitOverride: number | null;
  maxRefImagesOverride: number | null;
  maxFileMbOverride: number | null;
  createdAt: string;
};

type Quota = {
  usageDate: string;
  dailyLimit: number;
  maxRefImages: number;
  maxFileMb: number;
  maxTotalUploadMb: number;
  used: number;
  reserved: number;
  remaining: number;
};

type Generation = {
  id: string;
  status: "QUEUED" | "SUCCEEDED" | "FAILED";
  mode: "TEXT" | "REFERENCE";
  model: string;
  prompt: string;
  size: string;
  quality: string;
  outputFormat: string;
  imageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type MeResponse = {
  ok: boolean;
  user: User | null;
  quota: Quota | null;
  generations: Generation[];
  error?: string;
};

type AdminUser = User & {
  wechatOpenId: string | null;
  todayUsed: number;
  todayReserved: number;
  generationsCount: number;
};

type AdminInvite = {
  id: string;
  codePreview: string;
  label: string | null;
  role: "USER" | "ADMIN";
  dailyLimitOverride: number | null;
  maxRefImagesOverride: number | null;
  maxFileMbOverride: number | null;
  expiresAt: string | null;
  disabledAt: string | null;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  claimed: boolean;
};

type AdminTab = "invites" | "users";

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

const panelClass =
  "rounded-[8px] border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium tracking-normal transition disabled:cursor-not-allowed";
const primaryButton =
  `${buttonBase} bg-[var(--ink)] text-white shadow-[0_12px_30px_rgba(17,24,39,0.16)] hover:bg-[#2a2f29] disabled:bg-[#9aa39a]`;
const secondaryButton =
  `${buttonBase} border border-[var(--stroke)] bg-white text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--surface-muted)]`;
const inputClass =
  "w-full rounded-[8px] border border-[var(--stroke)] bg-white px-3 text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--focus)]";

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMb(size: number) {
  return `${(size / 1024 / 1024).toFixed(size > 1024 * 1024 ? 1 : 2)} MB`;
}

function getGenerationImageFilename(generation: Generation) {
  const extension = generation.outputFormat === "jpeg" ? "jpg" : generation.outputFormat;
  return `funagent-${generation.id}.${extension || "png"}`;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    }, 2500);

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
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <TopBar user={user} quota={quota} onLogout={logout} />

        {message ? <Notice tone="warn">{message}</Notice> : null}

        {loading ? (
          <div className="grid min-h-[640px] place-items-center">
            <div className="flex items-center gap-3 text-sm text-[var(--muted-strong)]">
              <Loader2 className="animate-spin text-[var(--accent)]" size={22} />
              正在连接工作台
            </div>
          </div>
        ) : user && quota ? (
          <>
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.06fr)_minmax(400px,0.74fr)]">
              <Creator
                quota={quota}
                latest={generations[0] ?? null}
                onDone={(generation, nextQuota) => {
                  setGenerations((items) => [generation, ...items]);
                  setQuota(nextQuota);
                }}
              />
              <SideRail quota={quota} generations={generations} />
            </section>
            {user.role === "ADMIN" ? <AdminPanel /> : null}
          </>
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
    <header className="sticky top-0 z-20 -mx-4 border-b border-[var(--stroke)] bg-[rgba(246,247,242,0.86)] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[var(--ink)] text-white">
            <WandSparkles size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold sm:text-lg">
                FunAgent Image
              </h1>
              <span className="hidden rounded-full bg-[var(--lime)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-normal text-[var(--ink)] sm:inline-flex">
                gpt-image-2
              </span>
            </div>
            <p className="truncate text-xs text-[var(--muted-strong)]">
              image.funagent.app
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {quota ? (
            <div className="hidden h-10 items-center gap-3 rounded-[8px] border border-[var(--stroke)] bg-white px-3 text-sm md:flex">
              <Gauge size={16} className="text-[var(--accent)]" />
              <span className="text-[var(--muted-strong)]">今日额度</span>
              <strong className="font-semibold">
                {quota.remaining}/{quota.dailyLimit}
              </strong>
            </div>
          ) : null}
          {user?.role === "ADMIN" ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[var(--stroke-strong)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--accent)]">
              <ShieldCheck size={16} />
              Admin
            </span>
          ) : null}
          {user ? (
            <button onClick={onLogout} className={cx(secondaryButton, "h-10 px-3 text-sm")}>
              <LogOut size={16} />
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
    <section className="grid min-h-[calc(100vh-96px)] items-center gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="grid gap-5 py-5">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-xs font-semibold uppercase text-[var(--accent)]">
            Invite-only image studio
          </p>
          <h2 className="text-[40px] font-semibold leading-[1.03] tracking-normal text-[var(--ink)] sm:text-[64px]">
            把描述变成能交付的视觉稿
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
            面向公众号、社群和小型团队的 AI 图片工作台。邀请码控制入口，额度、参考图数量和文件大小都能按用户单独设置。
          </p>
        </div>

        <div className={cx(panelClass, "overflow-hidden")}>
          <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="border-b border-[var(--stroke)] p-5 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">Prompt</span>
                <SlidersHorizontal size={17} className="text-[var(--muted)]" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-11/12 rounded-full bg-[var(--line)]" />
                <div className="h-3 w-10/12 rounded-full bg-[var(--line)]" />
                <div className="h-3 w-8/12 rounded-full bg-[var(--line)]" />
              </div>
              <div className="mt-8 grid grid-cols-3 gap-2">
                {["1:1", "2:3", "3:2"].map((item) => (
                  <div
                    key={item}
                    className="rounded-[8px] border border-[var(--stroke)] bg-white px-3 py-3 text-center text-sm font-medium"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid min-h-[300px] place-items-center bg-[#111814] p-5">
              <div className="relative aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-[8px] border border-white/15 bg-[linear-gradient(145deg,#f7efe4_0%,#e9f64a_35%,#53b9a5_58%,#1b4a75_100%)] shadow-2xl">
                <div className="absolute inset-x-4 bottom-4 rounded-[8px] bg-black/70 p-3 text-white backdrop-blur">
                  <div className="mb-2 flex items-center gap-2 text-xs text-white/70">
                    <Sparkles size={13} />
                    Generated preview
                  </div>
                  <div className="h-2 w-11/12 rounded-full bg-white/70" />
                  <div className="mt-2 h-2 w-7/12 rounded-full bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cx(panelClass, "p-5")}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">登录工作台</h3>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">
              访问权限由邀请码绑定
            </p>
          </div>
          <div className="grid size-11 place-items-center rounded-[8px] bg-[var(--surface-muted)] text-[var(--accent)]">
            <LockKeyhole size={21} />
          </div>
        </div>

        <form onSubmit={inviteLogin} className="space-y-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--muted-strong)]">
              邀请码
            </span>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="FA-ABCD-2345"
              className={cx(inputClass, "h-12 font-mono uppercase tracking-normal")}
            />
          </label>
          <button
            disabled={inviteSubmitting}
            className={cx(primaryButton, "h-12 w-full px-4")}
          >
            {inviteSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <KeyRound size={18} />
            )}
            邀请码登录
          </button>
        </form>

        <div className="mt-5 border-t border-[var(--stroke)] pt-4">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--accent)]">
              <span className="inline-flex items-center gap-2">
                <Send size={16} />
                公众号登录备用
              </span>
              <ChevronRight size={16} />
            </summary>
            <div className="mt-3">
              {!command ? (
                <button onClick={start} className={cx(secondaryButton, "h-10 w-full px-3 text-sm")}>
                  <Send size={16} />
                  获取公众号登录码
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
                    <div className="text-xs font-medium uppercase text-[var(--muted)]">
                      发送到公众号
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <code className="break-all text-2xl font-semibold text-[var(--accent)]">
                        {command}
                      </code>
                      <button
                        onClick={copy}
                        className={cx(secondaryButton, "size-10 shrink-0 p-0")}
                        aria-label="复制登录码"
                      >
                        {copied ? <Check size={17} /> : <Clipboard size={17} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
                    {status === "pending" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : null}
                    {status === "expired"
                      ? "登录码已过期"
                      : `有效期至 ${expiresAt ? new Date(expiresAt).toLocaleTimeString() : ""}`}
                  </div>
                  <button onClick={start} className={cx(secondaryButton, "h-10 px-3 text-sm")}>
                    <RefreshCw size={16} />
                    重新获取
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>

        {isLocal ? (
          <button
            onClick={devLogin}
            className={cx(secondaryButton, "mt-4 h-10 w-full px-3 text-sm")}
          >
            <Settings size={16} />
            调试登录
          </button>
        ) : null}

        {error ? (
          <Notice className="mt-4" tone="danger">
            {error}
          </Notice>
        ) : null}
      </div>
    </section>
  );
}

function Creator({
  quota,
  latest,
  onDone,
}: {
  quota: Quota;
  latest: Generation | null;
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
    return Math.min(100, Math.round((quota.used / quota.dailyLimit) * 100));
  }, [quota.dailyLimit, quota.used]);

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
    <section className={cx(panelClass, "overflow-hidden")}>
      <div className="grid xl:min-h-[720px] xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.72fr)]">
        <form onSubmit={submit} className="flex flex-col border-b border-[var(--stroke)] xl:border-b-0 xl:border-r">
          <div className="border-b border-[var(--stroke)] p-3 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">
                  Create
                </p>
                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">图片生成</h2>
              </div>
              <div className="min-w-[180px]">
                <div className="mb-2 flex justify-between text-xs text-[var(--muted-strong)]">
                  <span>{quota.usageDate}</span>
                  <span>
                    {quota.remaining}/{quota.dailyLimit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--line)]">
                  <div
                    className="h-2 rounded-full bg-[var(--lime)]"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-3 p-3 sm:gap-5 sm:p-5">
            <MobileOverview
              quota={quota}
              latest={latest}
              submitting={submitting}
              size={size}
            />
            <label className="block">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--muted-strong)]">
                  描述
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {prompt.length}/1200
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={1200}
                placeholder="一张清晨咖啡店里的产品海报，木质桌面，柔和自然光，干净高级"
                className={cx(
                  inputClass,
                  "min-h-[96px] resize-y p-3 leading-6 sm:min-h-[180px] sm:p-4 sm:leading-7 xl:min-h-[240px]",
                )}
              />
            </label>

            <AspectPicker value={size} onChange={setSize} />

            <div className="grid gap-3">
              <SegmentedControl
                label="格式"
                value={outputFormat}
                onChange={setOutputFormat}
                options={formatOptions}
              />
            </div>

            <div className="rounded-[8px] border border-dashed border-[var(--stroke-strong)] bg-[var(--surface-muted)] p-2.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">参考图</div>
                  <div className="mt-1 truncate text-xs text-[var(--muted-strong)]">
                    {files.length}/{quota.maxRefImages} · 单张 {quota.maxFileMb} MB · 总量{" "}
                    {quota.maxTotalUploadMb} MB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className={cx(secondaryButton, "h-10 shrink-0 px-3 text-sm")}
                >
                  <Upload size={16} />
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
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {files.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex min-w-0 items-center gap-3 rounded-[8px] border border-[var(--stroke)] bg-white p-2"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-[var(--line)] text-[var(--accent)]">
                        <FileImage size={16} />
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
                        className="grid size-8 shrink-0 place-items-center rounded-[6px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                        aria-label="移除参考图"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {error ? <Notice tone="danger">{error}</Notice> : null}
          </div>

          <div className="border-t border-[var(--stroke)] p-3 sm:p-5">
            <button
              disabled={submitting || quota.remaining <= 0}
              className={cx(primaryButton, "h-12 w-full px-4")}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {submitting ? "生成中" : quota.remaining <= 0 ? "今日额度已用完" : "生成图片"}
            </button>
          </div>
        </form>

        <ResultPreview
          latest={latest}
          submitting={submitting}
          size={size}
          className="hidden xl:flex"
        />
      </div>
    </section>
  );
}

function MobileOverview({
  quota,
  latest,
  submitting,
  size,
}: {
  quota: Quota;
  latest: Generation | null;
  submitting: boolean;
  size: string;
}) {
  const aspectClass =
    size === "9:16"
      ? "aspect-[9/16]"
      : size === "3:4"
        ? "aspect-[3/4]"
        : size === "16:9"
          ? "aspect-video"
          : size === "4:3"
            ? "aspect-[4/3]"
            : "aspect-square";

  return (
    <div className="grid gap-3 xl:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2 sm:grid-cols-[minmax(0,1fr)_132px] sm:gap-3">
        <div className="rounded-[8px] border border-[var(--stroke)] bg-white p-2.5 sm:p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-[var(--accent)]">
              今日状态
            </span>
            <Clock size={15} className="text-[var(--muted)]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CompactStat label="剩余" value={quota.remaining.toString()} />
            <CompactStat label="已用" value={quota.used.toString()} />
            <CompactStat label="参考" value={`${quota.maxRefImages}`} />
          </div>
        </div>

        <div className="rounded-[8px] bg-[#111814] p-2 text-white">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase text-white/50">
            <span>预览</span>
            <Images size={14} className="text-[var(--lime)]" />
          </div>
          <div
            className={cx(
              "relative grid w-full place-items-center overflow-hidden rounded-[6px] border border-white/12 bg-[#1b211d]",
              aspectClass,
              size === "9:16" || size === "3:4"
                ? "mx-auto max-h-[86px] w-auto sm:max-h-[118px]"
                : "",
            )}
          >
            {latest?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={latest.imageUrl} alt={latest.prompt} className="size-full object-cover" />
            ) : (
              <div className="grid size-full min-h-20 place-items-center bg-[linear-gradient(135deg,#222b24_0%,#131917_60%,#2f4128_100%)]">
                {submitting ? (
                  <Loader2 className="animate-spin text-[var(--lime)]" size={18} />
                ) : (
                  <ImageIcon size={18} className="text-white/45" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
      <legend className="mb-2 text-sm font-medium text-[var(--muted-strong)]">
        画幅
      </legend>
      <div className="flex gap-1 overflow-x-auto rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-1 sm:grid sm:grid-cols-6 sm:overflow-visible">
        {aspectOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              "min-h-10 min-w-[74px] rounded-[6px] px-2 py-2 text-left transition sm:min-h-14 sm:min-w-0",
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

function ResultPreview({
  latest,
  submitting,
  size,
  className,
}: {
  latest: Generation | null;
  submitting: boolean;
  size: string;
  className?: string;
}) {
  const aspectClass =
    size === "9:16"
      ? "aspect-[9/16]"
      : size === "3:4"
        ? "aspect-[3/4]"
        : size === "16:9"
          ? "aspect-video"
          : size === "4:3"
            ? "aspect-[4/3]"
            : size === "1024x1536"
              ? "aspect-[2/3]"
              : size === "1536x1024"
                ? "aspect-[3/2]"
                : "aspect-square";

  return (
    <div className={cx("flex min-h-[540px] flex-col bg-[#111814] p-5 text-white", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-white/50">
            Output
          </p>
          <h3 className="mt-1 text-xl font-semibold">结果预览</h3>
        </div>
        <Images size={21} className="text-[var(--lime)]" />
      </div>

      <div className="grid flex-1 place-items-center">
        <div
          className={cx(
            "relative grid w-full max-w-[520px] place-items-center overflow-hidden rounded-[8px] border border-white/12 bg-[#1b211d]",
            aspectClass,
          )}
        >
          {latest?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={latest.imageUrl} alt={latest.prompt} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center bg-[linear-gradient(135deg,#222b24_0%,#131917_55%,#2f4128_100%)] p-6">
              <div className="w-full max-w-[260px] text-center">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[8px] bg-white/8 text-[var(--lime)]">
                  {submitting ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <ImageIcon size={22} />
                  )}
                </div>
                <p className="text-sm text-white/72">
                  {submitting ? "正在生成画面" : "生成结果会显示在这里"}
                </p>
              </div>
            </div>
          )}
          {latest?.status === "FAILED" ? (
            <div className="absolute inset-x-4 bottom-4 rounded-[8px] border border-red-300/20 bg-red-950/70 p-3 text-sm text-red-50 backdrop-blur">
              {latest.errorMessage ?? "生成失败"}
            </div>
          ) : null}
        </div>
      </div>

      {latest ? (
        <div className="mt-4 rounded-[8px] border border-white/12 bg-white/[0.06] p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-white/50">
            <span>{latest.mode === "REFERENCE" ? "参考图生成" : "文本生成"}</span>
            <span>{formatDate(latest.createdAt)}</span>
          </div>
          <p className="line-clamp-2 text-sm leading-6 text-white/80">{latest.prompt}</p>
        </div>
      ) : null}
    </div>
  );
}

function SideRail({
  quota,
  generations,
}: {
  quota: Quota;
  generations: Generation[];
}) {
  return (
    <aside className="grid gap-5">
      <section className={cx(panelClass, "p-5")}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">
              Usage
            </p>
            <h2 className="mt-1 text-xl font-semibold">今日状态</h2>
          </div>
          <Clock size={20} className="text-[var(--muted)]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="剩余" value={quota.remaining.toString()} />
          <StatTile label="已用" value={quota.used.toString()} />
          <StatTile label="保留" value={quota.reserved.toString()} />
        </div>
        <div className="mt-4 grid gap-2 text-sm text-[var(--muted-strong)]">
          <InfoLine label="参考图上限" value={`${quota.maxRefImages} 张`} />
          <InfoLine label="单张文件" value={`${quota.maxFileMb} MB`} />
          <InfoLine label="总上传量" value={`${quota.maxTotalUploadMb} MB`} />
        </div>
      </section>

      <History generations={generations} />
    </aside>
  );
}

function History({ generations }: { generations: Generation[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
    <section className={cx(panelClass, "p-5")}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">
            Gallery
          </p>
          <h2 className="mt-1 text-xl font-semibold">历史记录</h2>
        </div>
        <ImageIcon size={20} className="text-[var(--muted)]" />
      </div>

      {generations.length === 0 ? (
        <div className="grid min-h-[240px] place-items-center rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] text-center text-sm text-[var(--muted-strong)]">
          暂无生成记录
        </div>
      ) : (
        <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
          {generations.map((generation) => (
            <article
              key={generation.id}
              className="grid grid-cols-[108px_minmax(0,1fr)] overflow-hidden rounded-[8px] border border-[var(--stroke)] bg-white"
            >
              <div className="aspect-square bg-[var(--line)]">
                {generation.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={generation.imageUrl}
                    alt={generation.prompt}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-[var(--muted)]">
                    {generation.status === "FAILED" ? "失败" : "处理中"}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                  <span>{generation.mode === "REFERENCE" ? "参考图" : "文本"}</span>
                  <span>{formatDate(generation.createdAt)}</span>
                </div>
                <p className="line-clamp-3 text-sm leading-5">{generation.prompt}</p>
                {generation.errorMessage ? (
                  <p className="mt-2 line-clamp-2 text-xs text-[var(--danger)]">
                    {generation.errorMessage}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => copyPrompt(generation)}
                    className={cx(secondaryButton, "h-8 min-w-[68px] px-2.5 text-xs")}
                    title="复制提示词"
                  >
                    {copiedId === generation.id ? <Check size={14} /> : <Copy size={14} />}
                    {copiedId === generation.id ? "已复制" : "复制"}
                  </button>
                  {generation.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => downloadImage(generation)}
                      disabled={downloadingId === generation.id}
                      className={cx(secondaryButton, "h-8 min-w-[68px] px-2.5 text-xs")}
                      title="下载图片"
                    >
                      {downloadingId === generation.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {downloadingId === generation.id ? "下载中" : "下载"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [tab, setTab] = useState<AdminTab>("invites");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [usersResponse, invitesResponse] = await Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/invites", { cache: "no-store" }),
    ]);
    const usersData = await usersResponse.json();
    const invitesData = await invitesResponse.json();
    setLoading(false);

    if (!usersData.ok) {
      setError(usersData.error ?? "加载用户失败");
      return;
    }
    if (!invitesData.ok) {
      setError(invitesData.error ?? "加载邀请码失败");
      return;
    }

    setUsers(usersData.users);
    setInvites(invitesData.invites);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/invites", { cache: "no-store" }),
    ])
      .then(async ([usersResponse, invitesResponse]) => {
        const usersData = await usersResponse.json();
        const invitesData = await invitesResponse.json();
        if (!active) return;
        if (!usersData.ok) {
          setError(usersData.error ?? "加载用户失败");
          return;
        }
        if (!invitesData.ok) {
          setError(invitesData.error ?? "加载邀请码失败");
          return;
        }
        setUsers(usersData.users);
        setInvites(invitesData.invites);
      })
      .catch(() => {
        if (active) setError("加载管理数据失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className={cx(panelClass, "overflow-hidden")}>
      <div className="border-b border-[var(--stroke)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">
              Operations
            </p>
            <h2 className="mt-1 text-2xl font-semibold">运营管理</h2>
          </div>
          <button onClick={load} className={cx(secondaryButton, "h-10 px-3 text-sm")}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            刷新
          </button>
        </div>

        <div className="mt-4 inline-grid rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-1 sm:grid-cols-2">
          <AdminTabButton active={tab === "invites"} onClick={() => setTab("invites")}>
            <Ticket size={16} />
            邀请码
          </AdminTabButton>
          <AdminTabButton active={tab === "users"} onClick={() => setTab("users")}>
            <Users size={16} />
            用户额度
          </AdminTabButton>
        </div>
      </div>

      {error ? (
        <div className="p-5 pb-0">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      {tab === "invites" ? (
        <InviteManager invites={invites} onChanged={load} />
      ) : (
        <UserManager users={users} onChanged={load} />
      )}
    </section>
  );
}

function InviteManager({
  invites,
  onChanged,
}: {
  invites: AdminInvite[];
  onChanged: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<User["role"]>("USER");
  const [dailyLimit, setDailyLimit] = useState("");
  const [maxRefImages, setMaxRefImages] = useState("");
  const [maxFileMb, setMaxFileMb] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreatedCode(null);
    setError(null);

    const response = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: label.trim() || null,
        role,
        dailyLimitOverride: numberOrNull(dailyLimit),
        maxRefImagesOverride: numberOrNull(maxRefImages),
        maxFileMbOverride: numberOrNull(maxFileMb),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    const data = await response.json();
    setCreating(false);

    if (!data.ok) {
      setError(data.error ?? "创建邀请码失败");
      return;
    }

    setCreatedCode(data.code);
    setLabel("");
    setDailyLimit("");
    setMaxRefImages("");
    setMaxFileMb("");
    setExpiresAt("");
    await onChanged();
  };

  const copyCode = async () => {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const toggleInvite = async (invite: AdminInvite) => {
    await fetch(`/api/admin/invites/${invite.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ disabled: !invite.disabledAt }),
    });
    await onChanged();
  };

  return (
    <div className="grid gap-0 lg:grid-cols-[390px_minmax(0,1fr)]">
      <form onSubmit={create} className="border-b border-[var(--stroke)] p-5 lg:border-b-0 lg:border-r">
        <h3 className="text-lg font-semibold">发放邀请码</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--muted-strong)]">
              标签
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="例如：早鸟用户 / 管理员"
              className={cx(inputClass, "h-10")}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--muted-strong)]">
              角色
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as User["role"])}
              className={cx(inputClass, "h-10")}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            <SmallNumberField label="每日" value={dailyLimit} onChange={setDailyLimit} />
            <SmallNumberField label="参考图" value={maxRefImages} onChange={setMaxRefImages} />
            <SmallNumberField label="单张 MB" value={maxFileMb} onChange={setMaxFileMb} />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--muted-strong)]">
              过期时间
            </span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className={cx(inputClass, "h-10")}
            />
          </label>
        </div>

        {createdCode ? (
          <div className="mt-4 rounded-[8px] border border-[var(--stroke-strong)] bg-[var(--lime-soft)] p-4">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--accent)]">
              New code
            </div>
            <div className="flex items-center justify-between gap-3">
              <code className="break-all font-mono text-xl font-semibold">{createdCode}</code>
              <button
                type="button"
                onClick={copyCode}
                className={cx(secondaryButton, "size-10 shrink-0 p-0")}
                aria-label="复制邀请码"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <Notice className="mt-4" tone="danger">
            {error}
          </Notice>
        ) : null}

        <button disabled={creating} className={cx(primaryButton, "mt-4 h-11 w-full px-4")}>
          {creating ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
          创建邀请码
        </button>
      </form>

      <div className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--stroke)] text-[var(--muted-strong)]">
                <th className="py-3 pr-3 font-medium">邀请码</th>
                <th className="py-3 pr-3 font-medium">标签</th>
                <th className="py-3 pr-3 font-medium">角色</th>
                <th className="py-3 pr-3 font-medium">额度</th>
                <th className="py-3 pr-3 font-medium">状态</th>
                <th className="py-3 pr-3 font-medium">使用</th>
                <th className="py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const expired = invite.expiresAt
                  ? new Date(invite.expiresAt) <= new Date()
                  : false;
                return (
                  <tr key={invite.id} className="border-b border-[var(--line)] align-middle">
                    <td className="py-3 pr-3 font-mono text-xs">{invite.codePreview}</td>
                    <td className="max-w-[180px] truncate py-3 pr-3">
                      {invite.label ?? "-"}
                    </td>
                    <td className="py-3 pr-3">
                      <RolePill role={invite.role} />
                    </td>
                    <td className="py-3 pr-3 text-xs text-[var(--muted-strong)]">
                      <div>每日 {invite.dailyLimitOverride ?? "默认"}</div>
                      <div>
                        图 {invite.maxRefImagesOverride ?? "默认"} · MB{" "}
                        {invite.maxFileMbOverride ?? "默认"}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill
                        label={
                          invite.disabledAt
                            ? "停用"
                            : expired
                              ? "过期"
                              : invite.claimed
                                ? "已绑定"
                                : "可用"
                        }
                        tone={invite.disabledAt || expired ? "danger" : invite.claimed ? "neutral" : "success"}
                      />
                    </td>
                    <td className="py-3 pr-3 text-xs text-[var(--muted-strong)]">
                      <div>{invite.useCount} 次</div>
                      <div>{invite.lastUsedAt ? formatDate(invite.lastUsedAt) : formatDate(invite.createdAt)}</div>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleInvite(invite)}
                        className={cx(secondaryButton, "h-9 px-3 text-sm")}
                      >
                        {invite.disabledAt ? <Check size={15} /> : <Ban size={15} />}
                        {invite.disabledAt ? "启用" : "停用"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserManager({
  users,
  onChanged,
}: {
  users: AdminUser[];
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--stroke)] text-[var(--muted-strong)]">
              <th className="py-3 pr-3 font-medium">用户</th>
              <th className="py-3 pr-3 font-medium">角色</th>
              <th className="py-3 pr-3 font-medium">状态</th>
              <th className="py-3 pr-3 font-medium">今日</th>
              <th className="py-3 pr-3 font-medium">总生成</th>
              <th className="py-3 pr-3 font-medium">每日额度</th>
              <th className="py-3 pr-3 font-medium">参考图</th>
              <th className="py-3 pr-3 font-medium">单张 MB</th>
              <th className="py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((adminUser) => (
              <AdminUserRow key={adminUser.id} user={adminUser} onSaved={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUserRow({
  user,
  onSaved,
}: {
  user: AdminUser;
  onSaved: () => Promise<void>;
}) {
  const [dailyLimit, setDailyLimit] = useState(
    user.dailyLimitOverride?.toString() ?? "",
  );
  const [maxRefImages, setMaxRefImages] = useState(
    user.maxRefImagesOverride?.toString() ?? "",
  );
  const [maxFileMb, setMaxFileMb] = useState(user.maxFileMbOverride?.toString() ?? "");
  const [status, setStatus] = useState(user.status);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/admin/users/${user.id}/quota`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dailyLimitOverride: numberOrNull(dailyLimit),
        maxRefImagesOverride: numberOrNull(maxRefImages),
        maxFileMbOverride: numberOrNull(maxFileMb),
        status,
        role,
      }),
    });
    setSaving(false);
    await onSaved();
  };

  return (
    <tr className="border-b border-[var(--line)] align-middle">
      <td className="max-w-[240px] truncate py-3 pr-3">
        <div className="font-mono text-xs">{user.wechatOpenId ?? user.id}</div>
        <div className="mt-1 text-xs text-[var(--muted)]">{formatDate(user.createdAt)}</div>
      </td>
      <td className="py-3 pr-3">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as User["role"])}
          className={cx(inputClass, "h-9 w-28 px-2")}
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </td>
      <td className="py-3 pr-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as User["status"])}
          className={cx(inputClass, "h-9 w-32 px-2")}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </select>
      </td>
      <td className="py-3 pr-3">
        {user.todayUsed}
        {user.todayReserved ? ` + ${user.todayReserved}` : ""}
      </td>
      <td className="py-3 pr-3">{user.generationsCount}</td>
      <td className="py-3 pr-3">
        <SmallNumberInput value={dailyLimit} onChange={setDailyLimit} />
      </td>
      <td className="py-3 pr-3">
        <SmallNumberInput value={maxRefImages} onChange={setMaxRefImages} />
      </td>
      <td className="py-3 pr-3">
        <SmallNumberInput value={maxFileMb} onChange={setMaxFileMb} />
      </td>
      <td className="py-3">
        <button onClick={save} className={cx(primaryButton, "h-9 px-3 text-sm")}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          保存
        </button>
      </td>
    </tr>
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
      <legend className="mb-2 text-sm font-medium text-[var(--muted-strong)]">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              "min-h-11 rounded-[6px] px-2 py-2 text-left transition sm:min-h-14",
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

function SmallNumberInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode="numeric"
      placeholder="默认"
      className={cx(inputClass, "h-9 w-20 px-2")}
    />
  );
}

function SmallNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-[var(--muted-strong)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        placeholder="默认"
        className={cx(inputClass, "h-10 px-2")}
      />
    </label>
  );
}

function AdminTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-[6px] px-3 text-sm font-medium transition",
        active ? "bg-white shadow-sm" : "text-[var(--muted-strong)] hover:bg-white/70",
      )}
    >
      {children}
    </button>
  );
}

function Notice({
  children,
  tone = "warn",
  className,
}: {
  children: React.ReactNode;
  tone?: "warn" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[8px] border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-red-200 bg-red-50 text-[var(--danger)]"
          : "border-amber-200 bg-amber-50 text-amber-900",
        className,
      )}
    >
      {children}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2 first:border-t-0 first:pt-0">
      <span>{label}</span>
      <strong className="font-semibold text-[var(--ink)]">{value}</strong>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--stroke)] bg-white p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1.5 sm:py-2">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none sm:text-lg">{value}</div>
    </div>
  );
}

function RolePill({ role }: { role: User["role"] }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        role === "ADMIN"
          ? "bg-[var(--lime-soft)] text-[var(--accent)]"
          : "bg-[var(--surface-muted)] text-[var(--muted-strong)]",
      )}
    >
      {role}
    </span>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "success"
          ? "bg-emerald-50 text-emerald-700"
          : tone === "danger"
            ? "bg-red-50 text-red-700"
            : "bg-[var(--surface-muted)] text-[var(--muted-strong)]",
      )}
    >
      {label}
    </span>
  );
}
