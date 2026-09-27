"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Dialog } from "@/components/Dialog";
import { FormMessage } from "@/components/forms";
import { formatDate } from "@/lib/format";
import {
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
  userId: string | null;
  /** Found themselves with a selfie. */
  findable: boolean;
};

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "team", label: "Organisers and photographers" },
  { key: "signed_in", label: "Joined" },
  { key: "invited", label: "Not joined yet" },
  { key: "revoked", label: "Removed" },
] as const;

function statusTag(member: MemberRow) {
  if (member.status === "revoked") return <span className="tag tag-neutral">Removed</span>;
  if (member.firstSeenAt) return <span className="tag">Joined</span>;
  return <span className="tag tag-neutral">Not joined yet</span>;
}

function shortDate(value: string): string {
  return formatDate(value);
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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [roleTarget, setRoleTarget] = useState<string>("");
  const [result, setResult] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesText = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.roleName.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all"
          ? m.status !== "revoked"
          : filter === "team"
            ? m.status !== "revoked" && m.roleName !== "Attendee"
            : filter === "signed_in"
              ? Boolean(m.firstSeenAt) && m.status === "active"
              : filter === "invited"
                ? !m.firstSeenAt && m.status !== "revoked"
                : m.status === "revoked";
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
              className="btn btn-sm btn-secondary"
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
          aria-label="Search attendees"
        />
      </div>

      <FormMessage state={result} />

      {chosen.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line-strong)] bg-[color:var(--kb-white)] px-4 py-2 text-[14px]">
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
              <th>Selfie</th>
              <th>Added</th>
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
                <td className="font-medium">
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
                      onChange={(e) => run(() => setMemberRoleAction(eventId, [member.id], e.target.value))}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={member.isAdminRole ? "tag" : "tag tag-neutral"}>{member.roleName}</span>
                  )}
                </td>
                <td>{statusTag(member)}</td>
                <td className="text-[color:var(--ink-70)]">{member.findable ? "Added" : "–"}</td>
                <td className="whitespace-nowrap text-[color:var(--ink-70)]">{shortDate(member.since)}</td>
                <td className="whitespace-nowrap text-right">
                  {member.status === "revoked" ? (
                    <button type="button" className="btn btn-sm btn-secondary" disabled={pending} onClick={() => run(() => restoreMemberAction(eventId, member.id))}>
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
