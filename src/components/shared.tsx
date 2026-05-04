// Shared types, constants, utilities, and small UI components
// Icons are imported by consumers directly

export type User = {
  id: string;
  wechatOpenId: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED";
  dailyLimitOverride: number | null;
  maxRefImagesOverride: number | null;
  maxFileMbOverride: number | null;
  createdAt: string;
};

export type Quota = {
  usageDate: string;
  dailyLimit: number;
  maxRefImages: number;
  maxFileMb: number;
  maxTotalUploadMb: number;
  used: number;
  reserved: number;
  remaining: number;
};

export type Generation = {
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

export type MeResponse = {
  ok: boolean;
  user: User | null;
  quota: Quota | null;
  generations: Generation[];
  error?: string;
};

export type AdminUser = User & {
  todayUsed: number;
  todayReserved: number;
  generationsCount: number;
};

export type AdminInvite = {
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

export type AdminTab = "invites" | "users";

export const panelClass =
  "rounded-[8px] border border-[var(--stroke)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium tracking-normal transition disabled:cursor-not-allowed";
export const primaryButton =
  `${buttonBase} bg-[var(--accent)] text-white shadow-[0_12px_28px_rgba(15,118,110,0.22)] hover:bg-[var(--accent-strong)] disabled:bg-[#98a6b3]`;
export const secondaryButton =
  `${buttonBase} border border-[var(--stroke)] bg-white text-[var(--ink)] hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]`;
export const inputClass =
  "w-full rounded-[8px] border border-[var(--stroke)] bg-white px-3 text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--focus)]";

export function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

export function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMb(size: number) {
  return `${(size / 1024 / 1024).toFixed(size > 1024 * 1024 ? 1 : 2)} MB`;
}

export function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- Small UI components ---

export function Notice({
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

export function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1.5 sm:py-2">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none sm:text-lg">{value}</div>
    </div>
  );
}

export function RolePill({ role }: { role: User["role"] }) {
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

export function StatusPill({
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

export function SmallNumberInput({
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

export function SmallNumberField({
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

export function AdminTabButton({
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
