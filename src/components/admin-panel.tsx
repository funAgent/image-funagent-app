"use client";

import {
  Ban,
  Check,
  Clock3,
  Copy,
  Edit3,
  History,
  ImageIcon,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  type AdminAuditLog,
  type AdminInvite,
  type AdminUser,
  type AdminUserGenerationsResponse,
  type Generation,
  type User,
  Notice,
  RolePill,
  SmallNumberField,
  StatusPill,
  buttonBase,
  cx,
  formatDate,
  inputClass,
  numberOrNull,
  panelClass,
  primaryButton,
  secondaryButton,
} from "./shared";

export function AdminPanel() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const [invitesResponse, usersResponse, logsResponse] = await Promise.all([
        fetch("/api/admin/invites", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/audit-logs", { cache: "no-store" }),
      ]);
      const invitesData = await invitesResponse.json();
      const usersData = await usersResponse.json();
      const logsData = await logsResponse.json();

      if (!invitesData.ok) {
        setError(invitesData.error ?? "加载邀请码失败");
        return;
      }

      if (!usersData.ok) {
        setError(usersData.error ?? "加载用户列表失败");
        return;
      }

      if (!logsData.ok) {
        setError(logsData.error ?? "加载操作记录失败");
        return;
      }

      setInvites(invitesData.invites);
      setUsers(usersData.users);
      setLogs(logsData.logs);
    } catch {
      setError("加载管理数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void load(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className={cx(panelClass)}>
      <div className="border-b border-[var(--stroke)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">运营管理</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => void load()} className={cx(secondaryButton, "h-9 px-3 text-sm")}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              刷新
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-3 pb-0 sm:p-4 sm:pb-0">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <InviteManager invites={invites} onChanged={load} />
      <UserManager users={users} onViewGenerations={setSelectedUser} />
      <AuditLogPanel logs={logs} />
      {selectedUser ? (
        <UserGenerationsDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      ) : null}
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvite, setEditingInvite] = useState<AdminInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const copyInviteCode = async (invite: AdminInvite) => {
    try {
      await navigator.clipboard.writeText(invite.codePreview);
      setCopiedInviteId(invite.id);
      window.setTimeout(() => setCopiedInviteId(null), 1200);
    } catch {
      setError("复制失败，请手动复制");
    }
  };

  const toggleInvite = async (invite: AdminInvite) => {
    const response = await fetch(`/api/admin/invites/${invite.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ disabled: !invite.disabledAt }),
    });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "操作失败");
      return;
    }
    await onChanged();
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--stroke)] p-3 sm:p-4">
        <h3 className="text-base font-semibold sm:text-lg">邀请码</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className={cx(primaryButton, "h-9 px-3 text-sm")}
        >
          <Plus size={15} />
          发放邀请码
        </button>
      </div>

      {error ? (
        <div className="px-3 pt-3 sm:px-4 sm:pt-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <div className="p-3 sm:p-4">
        {/* 桌面端表格 */}
        <div className="hidden overflow-x-auto lg:block">
          {invites.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无邀请码</p>
          ) : (
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--stroke)] text-[var(--muted-strong)]">
                <th className="py-2.5 pr-3 font-medium">邀请码</th>
                <th className="py-2.5 pr-3 font-medium">标签</th>
                <th className="py-2.5 pr-3 font-medium">角色</th>
                <th className="py-2.5 pr-3 font-medium">额度</th>
                <th className="py-2.5 pr-3 font-medium">状态</th>
                <th className="py-2.5 pr-3 font-medium">记录</th>
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
                          title="复制邀请码（仅预览码，完整码在创建时显示）"
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
                      <div>创建：{formatDate(invite.createdAt)}</div>
                      <div>最近：{invite.lastUsedAt ? formatDate(invite.lastUsedAt) : "-"}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingInvite(invite)}
                          className={cx(secondaryButton, "h-8 px-2.5 text-xs")}
                        >
                          <Edit3 size={14} />
                          额度
                        </button>
                        <button
                          onClick={() => toggleInvite(invite)}
                          className={cx(
                            buttonBase,
                            "h-8 px-2.5 text-xs rounded-[8px] font-medium",
                            invite.disabledAt
                              ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                          )}
                        >
                          {invite.disabledAt ? <Check size={14} /> : <Ban size={14} />}
                          {invite.disabledAt ? "启用" : "停用"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
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
                      title="复制邀请码（仅预览码，完整码在创建时显示）"
                    >
                      {copiedInviteId === invite.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <RolePill role={invite.role} />
                    <StatusPill label={statusLabel} tone={statusTone} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingInvite(invite)}
                      className={cx(secondaryButton, "h-7 shrink-0 px-2 text-xs")}
                    >
                      <Edit3 size={13} />
                      额度
                    </button>
                    <button
                      onClick={() => toggleInvite(invite)}
                      className={cx(
                        buttonBase,
                        "h-7 shrink-0 px-2 text-xs rounded-[8px] font-medium",
                        invite.disabledAt
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                      )}
                    >
                      {invite.disabledAt ? <Check size={13} /> : <Ban size={13} />}
                      {invite.disabledAt ? "启用" : "停用"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[var(--muted-strong)]">
                  {invite.label ? <div>标签：{invite.label}</div> : null}
                  <div>额度：每日 {invite.dailyLimitOverride ?? "默认"} · 图 {invite.maxRefImagesOverride ?? "默认"} · {invite.maxFileMbOverride ?? "默认"}MB</div>
                  <div>创建：{formatDate(invite.createdAt)}</div>
                  <div>最近使用：{invite.lastUsedAt ? formatDate(invite.lastUsedAt) : "-"}</div>
                  <div>使用次数：{invite.useCount} 次</div>
                </div>
              </div>
            );
          })}
          {invites.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无邀请码</p>
          ) : null}
        </div>
      </div>

      {showCreateModal ? (
        <CreateInviteModal
          onCreated={onChanged}
          onClose={() => setShowCreateModal(false)}
        />
      ) : null}

      {editingInvite ? (
        <InviteQuotaModal
          invite={editingInvite}
          onSaved={onChanged}
          onClose={() => setEditingInvite(null)}
        />
      ) : null}
    </div>
  );
}

function UserManager({
  users,
  onViewGenerations,
}: {
  users: AdminUser[];
  onViewGenerations: (user: AdminUser) => void;
}) {
  const totalUsed = users.reduce((sum, user) => sum + user.todayUsed, 0);
  const totalReserved = users.reduce((sum, user) => sum + user.todayReserved, 0);

  return (
    <div className="border-t border-[var(--stroke)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--stroke)] p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[var(--accent)]" />
          <h3 className="text-base font-semibold sm:text-lg">用户</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-[var(--muted-strong)]">
          <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1">用户 {users.length}</span>
          <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1">今日 {totalUsed}</span>
          <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1">生成中 {totalReserved}</span>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="hidden overflow-x-auto lg:block">
          {users.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无用户</p>
          ) : (
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--stroke)] text-[var(--muted-strong)]">
                  <th className="py-2.5 pr-3 font-medium">用户</th>
                  <th className="py-2.5 pr-3 font-medium">角色/状态</th>
                  <th className="py-2.5 pr-3 font-medium">今日</th>
                  <th className="py-2.5 pr-3 font-medium">累计</th>
                  <th className="py-2.5 pr-3 font-medium">来源邀请码</th>
                  <th className="py-2.5 pr-3 font-medium">额度</th>
                  <th className="py-2.5 pr-3 font-medium">创建时间</th>
                  <th className="py-2.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--line)] align-middle">
                    <td className="py-2.5 pr-3">
                      <div className="font-mono text-xs font-medium">{user.wechatOpenId ?? shortId(user.id)}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--muted)]">{shortId(user.id)}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <RolePill role={user.role} />
                        <StatusPill
                          label={user.status === "ACTIVE" ? "正常" : "停用"}
                          tone={user.status === "ACTIVE" ? "success" : "danger"}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--muted-strong)]">
                      <div>已用 {user.todayUsed}</div>
                      <div>生成中 {user.todayReserved}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-sm font-medium">{user.generationsCount}</td>
                    <td className="max-w-[180px] py-2.5 pr-3 text-xs text-[var(--muted-strong)]">
                      {user.inviteCode ? (
                        <div>
                          <code className="font-mono text-[11px] font-medium text-[var(--ink)]">
                            {user.inviteCode.codePreview}
                          </code>
                          <div className="mt-0.5 truncate">
                            {user.inviteCode.label ?? "未设置标签"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--muted-strong)]">
                      <div>每日 {user.dailyLimitOverride ?? "默认"}</div>
                      <div>
                        图 {user.maxRefImagesOverride ?? "默认"} · MB {user.maxFileMbOverride ?? "默认"}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-[var(--muted-strong)]">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => onViewGenerations(user)}
                        className={cx(secondaryButton, "h-8 px-2.5 text-xs")}
                      >
                        <ImageIcon size={14} />
                        生成记录
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid gap-2 lg:hidden">
          {users.map((user) => (
            <div key={user.id} className="rounded-[7px] border border-[var(--stroke)] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-medium">
                    {user.wechatOpenId ?? shortId(user.id)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <RolePill role={user.role} />
                    <StatusPill
                      label={user.status === "ACTIVE" ? "正常" : "停用"}
                      tone={user.status === "ACTIVE" ? "success" : "danger"}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onViewGenerations(user)}
                  className={cx(secondaryButton, "h-8 shrink-0 px-2.5 text-xs")}
                >
                  <ImageIcon size={14} />
                  记录
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1.5">
                  <div className="text-[var(--muted)]">已用</div>
                  <div className="mt-0.5 font-semibold">{user.todayUsed}</div>
                </div>
                <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1.5">
                  <div className="text-[var(--muted)]">生成中</div>
                  <div className="mt-0.5 font-semibold">{user.todayReserved}</div>
                </div>
                <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-1.5">
                  <div className="text-[var(--muted)]">累计</div>
                  <div className="mt-0.5 font-semibold">{user.generationsCount}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-[var(--muted-strong)]">
                {user.inviteCode ? (
                  <div>
                    邀请码：
                    <code className="font-mono text-[11px] text-[var(--ink)]">
                      {user.inviteCode.codePreview}
                    </code>
                    {user.inviteCode.label ? ` · ${user.inviteCode.label}` : ""}
                  </div>
                ) : (
                  <div>邀请码：-</div>
                )}
                <div>额度：每日 {user.dailyLimitOverride ?? "默认"} · 图 {user.maxRefImagesOverride ?? "默认"} · {user.maxFileMbOverride ?? "默认"}MB</div>
                <div>创建：{formatDate(user.createdAt)}</div>
              </div>
            </div>
          ))}
          {users.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无用户</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserGenerationsDrawer({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadGenerations = async () => {
    setLoading(true);
    setError(null);
    setGenerations([]);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/generations`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminUserGenerationsResponse;
      if (!data.ok) {
        setError(data.error ?? "加载生成记录失败");
        return;
      }
      setGenerations(data.generations ?? []);
    } catch {
      setError("加载生成记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadGenerations();
    });

    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const copyPrompt = async (generation: Generation) => {
    await navigator.clipboard.writeText(generation.prompt);
    setCopiedId(generation.id);
    window.setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[760px] flex-col border-l border-[var(--stroke)] bg-[var(--surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">生成记录</h3>
              <RolePill role={user.role} />
              <StatusPill
                label={user.status === "ACTIVE" ? "正常" : "停用"}
                tone={user.status === "ACTIVE" ? "success" : "danger"}
              />
            </div>
            <p className="mt-1 truncate font-mono text-xs text-[var(--muted-strong)]">
              {user.wechatOpenId ?? user.id}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void loadGenerations()}
              className={cx(secondaryButton, "size-9 p-0")}
              aria-label="刷新生成记录"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-[var(--stroke)] p-3 text-center text-xs sm:p-4">
          <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-2">
            <div className="text-[var(--muted)]">今日已用</div>
            <div className="mt-1 text-base font-semibold">{user.todayUsed}</div>
          </div>
          <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-2">
            <div className="text-[var(--muted)]">生成中</div>
            <div className="mt-1 text-base font-semibold">{user.todayReserved}</div>
          </div>
          <div className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-2">
            <div className="text-[var(--muted)]">累计</div>
            <div className="mt-1 text-base font-semibold">{user.generationsCount}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {loading ? (
            <div className="grid min-h-[260px] place-items-center text-sm text-[var(--muted-strong)]">
              <div className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
                正在加载生成记录
              </div>
            </div>
          ) : generations.length === 0 && !error ? (
            <div className="grid min-h-[260px] place-items-center text-center">
              <div>
                <div className="mx-auto mb-3 grid size-11 place-items-center rounded-[8px] border border-[var(--stroke)] bg-white text-[var(--accent)]">
                  <ImageIcon size={20} />
                </div>
                <p className="font-medium">该用户暂无生成记录</p>
                <p className="mt-1 text-sm text-[var(--muted-strong)]">生成图片后会出现在这里</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {generations.map((generation) => (
                <GenerationAuditCard
                  key={generation.id}
                  generation={generation}
                  copied={copiedId === generation.id}
                  onCopy={() => copyPrompt(generation)}
                  onPreview={(url) => setPreviewUrl(url)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={(event) => {
            event.stopPropagation();
            setPreviewUrl(null);
          }}
        >
          <button
            type="button"
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewUrl(null);
            }}
            aria-label="关闭预览"
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="生成图片预览"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

function GenerationAuditCard({
  generation,
  copied,
  onCopy,
  onPreview,
}: {
  generation: Generation;
  copied: boolean;
  onCopy: () => void;
  onPreview: (url: string) => void;
}) {
  const status = generationStatus(generation.status);

  return (
    <article className="overflow-hidden rounded-[8px] border border-[var(--stroke)] bg-white">
      <div className="grid gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <button
          type="button"
          disabled={!generation.imageUrl}
          onClick={() => generation.imageUrl && onPreview(generation.imageUrl)}
          className={cx(
            "relative aspect-[4/3] overflow-hidden rounded-[7px] border border-[var(--line)] bg-[var(--surface-muted)] text-left",
            generation.imageUrl ? "cursor-zoom-in" : "cursor-default",
          )}
        >
          {generation.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={generation.imageUrl} alt={generation.prompt} className="size-full object-cover" />
              <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
                <Maximize2 size={14} />
              </span>
            </>
          ) : (
            <div className={cx("grid size-full place-items-center", status.tileClass)}>
              <div className="text-center text-xs font-semibold">
                {generation.status === "QUEUED" ? (
                  <Loader2 size={18} className="mx-auto mb-1.5 animate-spin" />
                ) : (
                  <X size={18} className="mx-auto mb-1.5" />
                )}
                {status.label}
              </div>
            </div>
          )}
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill label={status.label} tone={status.tone} />
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--muted-strong)]">
                {generation.mode === "REFERENCE" ? "参考图" : "文本"}
              </span>
            </div>
            <span className="text-xs text-[var(--muted-strong)]">{formatDate(generation.createdAt)}</span>
          </div>

          <div className="mt-2 max-h-24 overflow-y-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface-muted)] p-2 text-xs leading-5 text-[var(--ink)]">
            {generation.prompt}
          </div>

          {generation.errorMessage ? (
            <p className="mt-2 rounded-[6px] bg-red-50 px-2 py-1.5 text-xs leading-4 text-[var(--danger)]">
              {generation.errorMessage}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-strong)]">
            <span>{generation.size}</span>
            <span>·</span>
            <span>{generation.quality}</span>
            <span>·</span>
            <span>{generation.outputFormat.toUpperCase()}</span>
            <span>·</span>
            <span>{generation.model}</span>
            {generation.completedAt ? (
              <>
                <span>·</span>
                <span>完成 {formatDate(generation.completedAt)}</span>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onCopy}
            className={cx(secondaryButton, "mt-2 h-8 px-2.5 text-xs")}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "已复制" : "复制提示词"}
          </button>
        </div>
      </div>
    </article>
  );
}

function generationStatus(status: Generation["status"]) {
  if (status === "SUCCEEDED") {
    return {
      label: "已完成",
      tone: "success" as const,
      tileClass: "bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "FAILED") {
    return {
      label: "生成失败",
      tone: "danger" as const,
      tileClass: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "生成中",
    tone: "neutral" as const,
    tileClass: "bg-amber-50 text-amber-800",
  };
}

function AuditLogPanel({ logs }: { logs: AdminAuditLog[] }) {
  return (
    <div className="border-t border-[var(--stroke)]">
      <div className="border-b border-[var(--stroke)] p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Clock3 size={16} className="text-[var(--accent)]" />
          <h3 className="text-base font-semibold sm:text-lg">最近操作记录</h3>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted-strong)]">暂无操作记录</p>
        ) : (
          <div className="grid gap-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-[8px] border border-[var(--stroke)] bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-[var(--ink)]">
                    {log.summary ?? actionLabel(log.action)}
                  </div>
                  <div className="text-xs text-[var(--muted-strong)]">
                    {formatDate(log.createdAt)}
                  </div>
                </div>
                <div className="mt-1.5 text-xs text-[var(--muted-strong)]">
                  <span>操作人：{log.actorUser?.wechatOpenId ?? shortId(log.actorUser?.id)}</span>
                  {log.targetUser ? (
                    <span> · 用户：{log.targetUser.wechatOpenId ?? shortId(log.targetUser.id)}</span>
                  ) : null}
                  {log.targetInvite ? (
                    <span> · 邀请码：{log.targetInvite.codePreview}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function actionLabel(action: AdminAuditLog["action"]) {
  switch (action) {
    case "INVITE_CREATED":
      return "创建邀请码";
    case "INVITE_STATUS_CHANGED":
      return "修改邀请码状态";
    case "INVITE_QUOTA_CHANGED":
      return "修改邀请码额度";
    case "USER_STATUS_CHANGED":
      return "修改用户状态";
    case "USER_QUOTA_CHANGED":
      return "修改用户额度";
    case "USER_ROLE_CHANGED":
      return "修改用户角色";
  }
}

function shortId(value?: string | null) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function CreateInviteModal({
  onCreated,
  onClose,
}: {
  onCreated: () => Promise<void>;
  onClose: () => void;
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
    await onCreated();
  };

  const copyCode = async () => {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("复制失败");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[12px] border border-[var(--stroke)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--stroke)] p-4">
          <h3 className="text-lg font-semibold">发放邀请码</h3>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={create} className="p-4">
          <div className="space-y-2.5">
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
      </div>
    </div>
  );
}

function InviteQuotaModal({
  invite,
  onSaved,
  onClose,
}: {
  invite: AdminInvite;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [dailyLimit, setDailyLimit] = useState(invite.dailyLimitOverride?.toString() ?? "");
  const [maxRefImages, setMaxRefImages] = useState(invite.maxRefImagesOverride?.toString() ?? "");
  const [maxFileMb, setMaxFileMb] = useState(invite.maxFileMbOverride?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/invites/${invite.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dailyLimitOverride: numberOrNull(dailyLimit),
          maxRefImagesOverride: numberOrNull(maxRefImages),
          maxFileMbOverride: numberOrNull(maxFileMb),
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("网络异常");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[12px] border border-[var(--stroke)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--stroke)] p-4">
          <h3 className="text-lg font-semibold">
            编辑额度
            <code className="ml-2 font-mono text-sm font-normal text-[var(--muted-strong)]">{invite.codePreview}</code>
          </h3>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-3">
            <SmallNumberField label="每日额度" value={dailyLimit} onChange={setDailyLimit} />
            <SmallNumberField label="参考图上限" value={maxRefImages} onChange={setMaxRefImages} />
            <SmallNumberField label="单张 MB 上限" value={maxFileMb} onChange={setMaxFileMb} />
          </div>

          {error ? (
            <Notice className="mt-3" tone="danger">{error}</Notice>
          ) : null}

          <button
            onClick={save}
            disabled={saving}
            className={cx(primaryButton, "mt-4 h-10 w-full px-4 text-sm")}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
