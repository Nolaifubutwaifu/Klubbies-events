"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Dialog } from "@/components/Dialog";
import { FormMessage } from "@/components/forms";
import {
  endGraceAction,
  removeMembersAction,
  restoreMemberAction,
  setMemberRoleAction,
  type ActionState,
} from "../../actions";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  claimedName: string | null;
  nameMismatch: boolean;
  status: string;
  roleId: string | null;
  roleName: string;
  isAdminRole: boolean;
  since: string;
  firstSeenAt: string | null;
  graceEndsAt: string | null;
  userId: string | null;
};

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "signed_in", label: "Signed in" },
  { key: "invited", label: "Not signed in yet" },
  { key: "grace", label: "Leaving" },
  { key: "revoked", label: "Removed" },
  { key: "mismatch", label: "Name differs" },
] as const;

function statusTag(member: MemberRow) {
  if (member.status === "grace") {
    const ends = member.graceEndsAt ? new Date(member.graceEndsAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "";
    return <span className="tag tag-accent-2">Leaving{ends ? ` · ${ends}` : ""}</span>;
  }
  if (member.status === "revoked") return <span className="tag tag-neutral">Removed</span>;
  if (member.firstSeenAt) return <span className="tag tag-outline">Signed in</span>;
  return <span className="tag tag-neutral">Invited</span>;
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function MemberTable({
  clubId,
  currentUserId,
  members,
  roles,
  canManageRoles,
}: {
  clubId: string;
  currentUserId: string;
  members: MemberRow[];
  roles: { id: string; name: string; manage_club: boolean }[];
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [roleTarget, setRoleTarget] = useState<string>("");
  const [endTarget, setEndTarget] = useState<MemberRow | null>(null);
  const [typedName, setTypedName] = useState("");
  const [result, setResult] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesText = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.roleName.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all"
          ? m.status !== "revoked"
          : filter === "signed_in"
            ? Boolean(m.firstSeenAt) && m.status === "active"
            : filter === "invited"
              ? !m.firstSeenAt && m.status !== "revoked"
              : filter === "grace"
                ? m.status === "grace"
                : filter === "revoked"
                  ? m.status === "revoked"
                  : m.nameMismatch;
      return matchesText && matchesFilter;
    });
  }, [members, query, filter]);

  const selectable = visible.filter((m) => m.userId !== currentUserId && m.status !== "revoked");
  const chosen = members.filter((m) => selected.has(m.id));

  const run = (fn: () => Promise<ActionState>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="btn btn-secondary text-[14px]"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input w-full max-w-[280px] text-[14px]"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or role"
          aria-label="Search members"
        />
      </div>

      <FormMessage state={result} />

      {chosen.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-2 border-ink bg-neutral-100 px-4 py-2 text-[14px]">
          <strong>{chosen.length} selected</strong>
          {canManageRoles ? (
            <>
              <select
                className="input max-w-[200px] text-[14px]"
                value={roleTarget}
                onChange={(e) => setRoleTarget(e.target.value)}
                aria-label="Change role"
              >
                <option value="">Change role to…</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary text-[14px]"
                disabled={!roleTarget || pending}
                onClick={() =>
                  run(
                    () => setMemberRoleAction(clubId, [...selected], roleTarget),
                    () => {
                      setSelected(new Set());
                      setRoleTarget("");
                    },
                  )
                }
              >
                Apply role
              </button>
            </>
          ) : null}
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmRemove(true)}>
            Remove from list
          </button>
          <button type="button" className="btn btn-ghost text-[14px]" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selectable.length > 0 && selectable.every((m) => selected.has(m.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((m) => m.id)) : new Set())}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Member since</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.userId !== currentUserId && member.status !== "revoked" ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${member.name}`}
                      checked={selected.has(member.id)}
                      onChange={() => toggle(member.id)}
                    />
                  ) : null}
                </td>
                <td className="font-semibold">
                  {member.name}
                  {member.nameMismatch && member.claimedName ? (
                    <div className="mt-1">
                      <span className="tag tag-accent-2" title="The name typed at sign-in differs from the list">
                        Signed in as “{member.claimedName}”
                      </span>
                    </div>
                  ) : null}
                </td>
                <td className="text-[color:var(--ink-70)]">{member.email}</td>
                <td>
                  {canManageRoles && member.userId !== currentUserId ? (
                    <select
                      className="input max-w-[160px] text-[14px]"
                      value={member.roleId ?? ""}
                      disabled={pending}
                      aria-label={`Role for ${member.name}`}
                      onChange={(e) => run(() => setMemberRoleAction(clubId, [member.id], e.target.value))}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={member.isAdminRole ? "tag tag-accent" : "tag tag-outline"}>{member.roleName}</span>
                  )}
                </td>
                <td>{statusTag(member)}</td>
                <td className="whitespace-nowrap text-[color:var(--ink-70)]">{shortDate(member.since)}</td>
                <td className="whitespace-nowrap text-right">
                  {member.status === "grace" ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost text-[14px]"
                        onClick={() => {
                          setTypedName("");
                          setEndTarget(member);
                        }}
                      >
                        End access now
                      </button>
                      <button type="button" className="btn btn-ghost text-[14px]" disabled={pending} onClick={() => run(() => restoreMemberAction(clubId, member.id))}>
                        Restore
                      </button>
                    </>
                  ) : member.status === "revoked" ? (
                    <button type="button" className="btn btn-ghost text-[14px]" disabled={pending} onClick={() => run(() => restoreMemberAction(clubId, member.id))}>
                      Restore
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <span className="text-[14px] text-[color:var(--ink-55)]">
        {visible.length.toLocaleString("en-AU")} shown of {members.length.toLocaleString("en-AU")}
      </span>

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} title={`Remove ${chosen.length} ${chosen.length === 1 ? "person" : "people"}?`}>
        <p className="text-[15px] leading-normal">
          They lose access to new albums right away. Anyone who has signed in keeps access to earlier albums for 30 days
          and gets an email about it.
        </p>
        <ul className="max-h-40 overflow-auto text-[14px] text-[color:var(--ink-70)]">
          {chosen.map((m) => (
            <li key={m.id}>
              {m.name} · {m.email}
            </li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmRemove(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() =>
              run(
                () => removeMembersAction(clubId, [...selected]),
                () => {
                  setSelected(new Set());
                  setConfirmRemove(false);
                },
              )
            }
          >
            {pending ? "Removing…" : `Remove ${chosen.length}`}
          </button>
        </div>
      </Dialog>

      <Dialog open={endTarget !== null} onClose={() => setEndTarget(null)} title="End access now?">
        <p className="text-[15px] leading-normal">
          {endTarget?.name} loses access to every album immediately, instead of on the date they were told.
        </p>
        <label className="field">
          Type {endTarget?.name} to confirm
          <input className="input" value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setEndTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending || !endTarget || typedName.trim().toLowerCase() !== endTarget.name.trim().toLowerCase()}
            onClick={() => endTarget && run(() => endGraceAction(clubId, endTarget.id, typedName), () => setEndTarget(null))}
          >
            End access
          </button>
        </div>
      </Dialog>
    </div>
  );
}
