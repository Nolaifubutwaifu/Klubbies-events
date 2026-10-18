"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Dialog } from "@/components/Dialog";
import { FormMessage } from "@/components/forms";
import { formatDateTime } from "@/lib/format";
import {
  approveNameAction,
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
  /** Signed in under a name that doesn't match the list; waits for approval. */
  nameReview: boolean;
  status: string;
  roleId: string | null;
  roleName: string;
  isAdminRole: boolean;
  since: string;
  firstSeenAt: string | null;
  /** Joined after the event filled up and its overflow window closed. */
  paused: boolean;
  userId: string | null;
  /** Found themselves with a selfie. */
  findable: boolean;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "To approve" },
  { key: "signed_in", label: "Joined" },
  { key: "invited", label: "Not joined yet" },
  { key: "team", label: "Organisers" },
  { key: "revoked", label: "Removed" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function matches(m: MemberRow, filter: FilterKey): boolean {
  return filter === "all"
    ? m.status !== "revoked"
    : filter === "review"
      ? m.nameReview && m.status !== "revoked"
      : filter === "team"
      ? m.status !== "revoked" && m.roleName !== "Attendee"
      : filter === "signed_in"
        ? Boolean(m.firstSeenAt) && m.status === "active"
        : filter === "invited"
          ? !m.firstSeenAt && m.status !== "revoked"
          : m.status === "revoked";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function MemberTable({
  eventId,
  currentUserId,
  members,
  roles,
  canManageRoles,
}: {
  eventId: string;
  currentUserId: string;
  members: MemberRow[];
  roles: { id: string; name: string; manage_event: boolean }[];
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [roleTarget, setRoleTarget] = useState<string>("");
  const [result, setResult] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesText = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.roleName.toLowerCase().includes(q);
      return matchesText && matches(m, filter);
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
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-[1_1_260px] items-center sm:max-w-[320px]">
          <span className="sr-only">Search attendees</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ink-3)" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input className="input !pl-10" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" />
        </label>
        {FILTERS.map((f) => {
          const count = members.filter((m) => matches(m, f.key)).length;
          if ((f.key === "revoked" || f.key === "review") && count === 0) return null;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`flex min-h-[40px] items-center gap-2 rounded-[8px] border px-3.5 text-[14px] font-medium ${
                filter === f.key
                  ? "border-[color:var(--kb-ink)] bg-[color:var(--kb-ink)] text-white"
                  : "border-[color:var(--kb-line)] bg-white text-[color:var(--kb-ink-2)] hover:border-[color:var(--kb-line-strong)]"
              }`}
            >
              {f.label} <span className="mono">{count.toLocaleString("en-AU")}</span>
            </button>
          );
        })}
      </div>

      <FormMessage state={result} />

      {chosen.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] bg-[color:var(--kb-ink)] px-4 py-2 text-[14px] text-white [&_.btn-secondary]:border-white/30 [&_.btn-secondary]:bg-transparent [&_.btn-secondary]:text-white">
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
                className="btn btn-sm btn-secondary"
                disabled={!roleTarget || pending}
                onClick={() =>
                  run(
                    () => setMemberRoleAction(eventId, [...selected], roleTarget),
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
            Remove
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {/* Wider than a phone: the scroller takes focus so the keyboard can reach it. */}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white" tabIndex={0} role="region" aria-label="Attendee list">
        <table className="kb-table min-w-[760px]">
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
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Joined</th>
              <th scope="col">Photos found</th>
              <th scope="col">Role</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.userId !== currentUserId && member.status !== "revoked" ? (
                    <input type="checkbox" aria-label={`Select ${member.name}`} checked={selected.has(member.id)} onChange={() => toggle(member.id)} />
                  ) : null}
                </td>
                <td>
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[13px] font-semibold text-[color:var(--kb-ink-2)]" aria-hidden>
                      {initials(member.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{member.name}</span>
                      {member.nameMismatch && member.claimedName ? (
                        <span className="text-[14px] text-[color:var(--kb-ink-3)]" title="The name typed at sign-in differs from the list">
                          Signed in as “{member.claimedName}”
                        </span>
                      ) : null}
                    </span>
                    {member.nameReview && member.status !== "revoked" ? (
                      <span className="kb-chip bg-[color:var(--kb-warn-tint)] text-[color:var(--kb-warn)]">To approve</span>
                    ) : member.status === "revoked" ? (
                      <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Removed</span>
                    ) : member.paused ? (
                      <span className="kb-chip bg-[color:var(--kb-warn-tint)] text-[color:var(--kb-warn)]">Paused</span>
                    ) : null}
                  </span>
                </td>
                <td className="text-[color:var(--kb-ink-2)]">{member.email}</td>
                <td className="whitespace-nowrap text-[color:var(--kb-ink-2)]">{member.firstSeenAt ? formatDateTime(member.firstSeenAt) : "Not yet"}</td>
                <td className="text-[color:var(--kb-ink-2)]">{member.findable ? "Selfie added" : "No selfie"}</td>
                <td>
                  {canManageRoles && member.userId !== currentUserId && member.status !== "revoked" ? (
                    <select
                      className="input !min-h-[38px] max-w-[170px] !py-1 text-[14px]"
                      value={member.roleId ?? ""}
                      disabled={pending}
                      aria-label={`Role for ${member.name}`}
                      onChange={(e) => run(() => setMemberRoleAction(eventId, [member.id], e.target.value))}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`kb-chip ${member.isAdminRole ? "bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]" : "bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]"}`}
                    >
                      {member.roleName}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  {member.status === "revoked" ? (
                    <button type="button" className="btn btn-sm btn-secondary" disabled={pending} onClick={() => run(() => restoreMemberAction(eventId, member.id))}>
                      Restore
                    </button>
                  ) : member.nameReview ? (
                    // Signed in under another name: the organiser decides if it's them.
                    <span className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={pending}
                        aria-label={`Approve ${member.name}, signed in as ${member.claimedName ?? ""}`}
                        onClick={() => run(() => approveNameAction(eventId, member.id))}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={pending}
                        aria-label={`Remove ${member.name}`}
                        onClick={() => run(() => removeMembersAction(eventId, [member.id]))}
                      >
                        Remove
                      </button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-[color:var(--kb-sand)] px-4 py-3 text-[14px] text-[color:var(--kb-ink-3)]">
          <span>
            Showing {visible.length.toLocaleString("en-AU")} of {members.filter((m) => m.status !== "revoked").length.toLocaleString("en-AU")}
          </span>
        </div>
      </div>

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} title={`Remove ${chosen.length} ${chosen.length === 1 ? "person" : "people"}?`}>
        <p className="text-[15px] leading-normal">
          They lose access to the event straight away. In link mode they can&apos;t rejoin with the same email; you can
          restore them from the Removed filter.
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
                () => removeMembersAction(eventId, [...selected]),
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

    </div>
  );
}
