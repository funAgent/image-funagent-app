"use client";

import {
  Ban,
  Check,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  type AdminInvite,
  type AdminTab,
  type AdminUser,
  type User,
  AdminTabButton,
  Notice,
  RolePill,
  SmallNumberField,
  SmallNumberInput,
  StatusPill,
  cx,
  formatDate,
  inputClass,
  numberOrNull,
  panelClass,
  primaryButton,
  secondaryButton,
} from "./shared";

export function AdminPanel() {
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
    <section className={cx(panelClass)}>
      <div className="border-b border-[var(--stroke)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">
              Operations
            </p>
            <h2 className="mt-0.5 text-lg font-semibold sm:text-xl">运营管理</h2>
          </div>
          <button onClick={load} className={cx(secondaryButton, "h-9 px-3 text-sm")}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            刷新
          </button>
        </div>

        <div className="mt-3 inline-grid rounded-[7px] border border-[var(--stroke)] bg-[var(--surface-muted)] p-1 grid-cols-2">
          <AdminTabButton active={tab === "invites"} onClick={() => setTab("invites")}>
            <Ticket size={15} />
            邀请码
          </AdminTabButton>
          <AdminTabButton active={tab === "users"} onClick={() => setTab("users")}>
            <Users size={15} />
            用户额度
          </AdminTabButton>
        </div>
      </div>

      {error ? (
        <div className="p-3 pb-0 sm:p-4 sm:pb-0">
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
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

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

  const copyInviteCode = async (invite: AdminInvite) => {
    await navigator.clipboard.writeText(invite.codePreview);
    setCopiedInviteId(invite.id);
    window.setTimeout(() => setCopiedInviteId(null), 1200);
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
    <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
      <form onSubmit={create} className="border-b border-[var(--stroke)] p-3 sm:p-4 lg:border-b-0 lg:border-r">
        <h3 className="text-base font-semibold sm:text-lg">发放邀请码</h3>
        <div className="mt-3 space-y-2.5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted-strong)]">
              标签
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="例如：早鸟用户 / 管理员"
              className={cx(inputClass, "h-9")}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted-strong)]">
              角色
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as User["role"])}
              className={cx(inputClass, "h-9")}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <SmallNumberField label="每日" value={dailyLimit} onChange={setDailyLimit} />
            <SmallNumberField label="参考图" value={maxRefImages} onChange={setMaxRefImages} />
            <SmallNumberField label="单张MB" value={maxFileMb} onChange={setMaxFileMb} />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted-strong)]">
              过期时间
            </span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className={cx(inputClass, "h-9")}
            />
          </label>
        </div>

        {createdCode ? (
          <div className="mt-3 rounded-[7px] border border-[var(--stroke-strong)] bg-[var(--lime-soft)] p-3">
            <div className="mb-1.5 text-xs font-semibold uppercase text-[var(--accent)]">
              New code
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="break-all font-mono text-lg font-semibold">{createdCode}</code>
              <button
                type="button"
                onClick={copyCode}
                className={cx(secondaryButton, "size-9 shrink-0 p-0")}
                aria-label="复制邀请码"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <Notice className="mt-3" tone="danger">
            {error}
          </Notice>
        ) : null}

        <button disabled={creating} className={cx(primaryButton, "mt-3 h-10 w-full px-4 text-sm")}>
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          创建邀请码
        </button>
      </form>

      <div className="p-3 sm:p-4">
        {/* 桌面端表格 */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--stroke)] text-[var(--muted-strong)]">
                <th className="py-2.5 pr-3 font-medium">邀请码</th>
                <th className="py-2.5 pr-3 font-medium">标签</th>
                <th className="py-2.5 pr-3 font-medium">角色</th>
                <th className="py-2.5 pr-3 font-medium">额度</th>
                <th className="py-2.5 pr-3 font-medium">状态</th>
                <th className="py-2.5 pr-3 font-medium">使用</th>
                <th className="py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const expired = invite.expiresAt
                  ? new Date(invite.expiresAt) <= new Date()
                  : false;
                return (
                  <tr key={invite.id} className="border-b border-[var(--line)] align-middle">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-xs font-medium">{invite.codePreview}</code>
                        <button
                          type="button"
                          onClick={() => copyInviteCode(invite)}
                          className="grid size-6 shrink-0 place-items-center rounded-[4px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                          title="复制邀请码"
                        >
                          {copiedInviteId === invite.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate py-2.5 pr-3">
                      {invite.label ?? "-"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <RolePill role={invite.role} />
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--muted-strong)]">
                      <div>每日 {invite.dailyLimitOverride ?? "默认"}</div>
                      <div>
                        图 {invite.maxRefImagesOverride ?? "默认"} · MB{" "}
                        {invite.maxFileMbOverride ?? "默认"}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
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
                    <td className="py-2.5 pr-3 text-xs text-[var(--muted-strong)]">
                      <div>{invite.useCount} 次</div>
                      <div>{invite.lastUsedAt ? formatDate(invite.lastUsedAt) : formatDate(invite.createdAt)}</div>
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => toggleInvite(invite)}
                        className={cx(secondaryButton, "h-8 px-2.5 text-xs")}
                      >
                        {invite.disabledAt ? <Check size={14} /> : <Ban size={14} />}
                        {invite.disabledAt ? "启用" : "停用"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 移动端卡片列表 */}
        <div className="grid gap-2 lg:hidden">
          {invites.map((invite) => {
            const expired = invite.expiresAt
              ? new Date(invite.expiresAt) <= new Date()
              : false;
            const statusLabel = invite.disabledAt
              ? "停用"
              : expired
                ? "过期"
                : invite.claimed
                  ? "已绑定"
                  : "可用";
            const statusTone = invite.disabledAt || expired ? "danger" : invite.claimed ? "neutral" : "success";
            return (
              <div key={invite.id} className="rounded-[7px] border border-[var(--stroke)] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="font-mono text-xs font-medium">{invite.codePreview}</code>
                    <button
                      type="button"
                      onClick={() => copyInviteCode(invite)}
                      className="grid size-6 shrink-0 place-items-center rounded-[4px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                      title="复制邀请码"
                    >
                      {copiedInviteId === invite.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <RolePill role={invite.role} />
                    <StatusPill label={statusLabel} tone={statusTone} />
                  </div>
                  <button
                    onClick={() => toggleInvite(invite)}
                    className={cx(secondaryButton, "h-7 shrink-0 px-2 text-xs")}
                  >
                    {invite.disabledAt ? <Check size={13} /> : <Ban size={13} />}
                    {invite.disabledAt ? "启用" : "停用"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-[var(--muted-strong)]">
                  {invite.label ? <div>标签：{invite.label}</div> : null}
                  <div>额度：每日 {invite.dailyLimitOverride ?? "默认"} · 图 {invite.maxRefImagesOverride ?? "默认"} · {invite.maxFileMbOverride ?? "默认"}MB</div>
                  <div>使用：{invite.useCount} 次 · {invite.lastUsedAt ? formatDate(invite.lastUsedAt) : formatDate(invite.createdAt)}</div>
                </div>
              </div>
            );
          })}
          {invites.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无邀请码</p>
          ) : null}
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
    <div className="p-3 sm:p-4">
      {/* 桌面端表格 */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--stroke)] text-[var(--muted-strong)]">
              <th className="py-2.5 pr-3 font-medium">用户</th>
              <th className="py-2.5 pr-3 font-medium">角色</th>
              <th className="py-2.5 pr-3 font-medium">状态</th>
              <th className="py-2.5 pr-3 font-medium">今日</th>
              <th className="py-2.5 pr-3 font-medium">总生成</th>
              <th className="py-2.5 pr-3 font-medium">每日额度</th>
              <th className="py-2.5 pr-3 font-medium">参考图</th>
              <th className="py-2.5 pr-3 font-medium">单张 MB</th>
              <th className="py-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((adminUser) => (
              <AdminUserRow key={adminUser.id} user={adminUser} onSaved={onChanged} />
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片列表 */}
      <div className="grid gap-2 lg:hidden">
        {users.map((adminUser) => (
          <AdminUserCard key={adminUser.id} user={adminUser} onSaved={onChanged} />
        ))}
        {users.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无用户</p>
        ) : null}
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
      <td className="max-w-[240px] truncate py-2.5 pr-3">
        <div className="font-mono text-xs">{user.wechatOpenId ?? user.id}</div>
        <div className="mt-1 text-xs text-[var(--muted)]">{formatDate(user.createdAt)}</div>
      </td>
      <td className="py-2.5 pr-3">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as User["role"])}
          className={cx(inputClass, "h-9 w-28 px-2")}
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </td>
      <td className="py-2.5 pr-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as User["status"])}
          className={cx(inputClass, "h-9 w-32 px-2")}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </select>
      </td>
      <td className="py-2.5 pr-3">
        {user.todayUsed}
        {user.todayReserved ? ` + ${user.todayReserved}` : ""}
      </td>
      <td className="py-2.5 pr-3">{user.generationsCount}</td>
      <td className="py-2.5 pr-3">
        <SmallNumberInput value={dailyLimit} onChange={setDailyLimit} />
      </td>
      <td className="py-2.5 pr-3">
        <SmallNumberInput value={maxRefImages} onChange={setMaxRefImages} />
      </td>
      <td className="py-2.5 pr-3">
        <SmallNumberInput value={maxFileMb} onChange={setMaxFileMb} />
      </td>
      <td className="py-2.5">
        <button onClick={save} className={cx(primaryButton, "h-9 px-3 text-sm")}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          保存
        </button>
      </td>
    </tr>
  );
}

function AdminUserCard({
  user,
  onSaved,
}: {
  user: AdminUser;
  onSaved: () => Promise<void>;
}) {
  const [dailyLimit, setDailyLimit] = useState(user.dailyLimitOverride?.toString() ?? "");
  const [maxRefImages, setMaxRefImages] = useState(user.maxRefImagesOverride?.toString() ?? "");
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
    <div className="rounded-[7px] border border-[var(--stroke)] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-xs">{user.wechatOpenId ?? user.id}</div>
        <div className="flex items-center gap-1.5">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as User["role"])}
            className={cx(inputClass, "h-7 w-20 px-1.5 text-xs")}
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as User["status"])}
            className={cx(inputClass, "h-7 w-24 px-1.5 text-xs")}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>
      </div>
      <div className="mt-2 text-xs text-[var(--muted-strong)]">
        今日 {user.todayUsed}{user.todayReserved ? ` +${user.todayReserved}` : ""} · 总计 {user.generationsCount} · {formatDate(user.createdAt)}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex-1">
          <span className="text-[10px] text-[var(--muted)]">额度</span>
          <input
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
            inputMode="numeric"
            placeholder="默认"
            className={cx(inputClass, "h-7 w-full px-1.5 text-xs")}
          />
        </div>
        <div className="flex-1">
          <span className="text-[10px] text-[var(--muted)]">参考图</span>
          <input
            value={maxRefImages}
            onChange={(event) => setMaxRefImages(event.target.value)}
            inputMode="numeric"
            placeholder="默认"
            className={cx(inputClass, "h-7 w-full px-1.5 text-xs")}
          />
        </div>
        <div className="flex-1">
          <span className="text-[10px] text-[var(--muted)]">单张MB</span>
          <input
            value={maxFileMb}
            onChange={(event) => setMaxFileMb(event.target.value)}
            inputMode="numeric"
            placeholder="默认"
            className={cx(inputClass, "h-7 w-full px-1.5 text-xs")}
          />
        </div>
        <button onClick={save} className={cx(primaryButton, "mt-3 h-7 shrink-0 px-2 text-xs")}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          保存
        </button>
      </div>
    </div>
  );
}
