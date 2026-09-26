"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { createRoleAction, deleteRoleAction, updateRoleAction, type ActionState } from "../../actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";

type Role = {
  id: string;
  name: string;
  key: string;
  is_builtin: boolean;
  is_default: boolean;
  memberCount: number;
} & Record<Permission, boolean>;

function PermissionFields({ role }: { role?: Role }) {
  return (
    <div className="flex flex-col gap-2">
      {PERMISSIONS.map((perm) => (
        <label key={perm} className="flex items-start gap-3 text-[14px]">
          <input
            type="checkbox"
            name={perm}
            defaultChecked={role?.[perm] ?? false} style={{ marginTop: 2 }}
          />
          <span>
            <span className="font-semibold">{PERMISSION_LABELS[perm].label}</span>
            <span className="block text-[14px] text-[color:var(--ink-70)]">{PERMISSION_LABELS[perm].hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function RoleCard({ clubId, role }: { clubId: string; role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(updateRoleAction.bind(null, clubId, role.id), {});
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 soft-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="soft-display text-[18px]">{role.name}</span>
          <span className="ml-2 text-[14px] text-[color:var(--ink-70)]">
            {role.memberCount.toLocaleString("en-AU")} {role.memberCount === 1 ? "member" : "members"}
            {role.is_default ? " · given to new members" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary text-[14px]" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Edit"}
          </button>
          {!role.is_builtin ? (
            <button
              type="button"
              className="btn btn-ghost text-[14px]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteRoleAction(clubId, role.id);
                  router.refresh();
                })
              }
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERMISSIONS.filter((p) => role[p]).map((p) => (
          <span key={p} className="tag tag-outline">
            {PERMISSION_LABELS[p].label}
          </span>
        ))}
        {PERMISSIONS.every((p) => !role[p]) ? <span className="tag tag-neutral">View and download only</span> : null}
      </div>

      {open ? (
        <form action={action} className="flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] pt-4">
          <label className="field max-w-[280px]">
            Role name
            <input className="input" name="name" defaultValue={role.name} maxLength={40} required />
          </label>
          <PermissionFields role={role} />
          <label className="flex items-center gap-3 text-[14px]">
            <input
              type="checkbox"
              name="is_default"
              defaultChecked={role.is_default}
            />
            Give this role to new members
          </label>
          <FormMessage state={state} />
          <SubmitButton className="btn btn-primary self-start text-[14px]" pendingText="Saving…">
            Save role
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export function RoleEditor({ clubId, roles }: { clubId: string; roles: Role[] }) {
  const [adding, setAdding] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(createRoleAction.bind(null, clubId), {});

  return (
    <div className="flex flex-col gap-4">
      {roles.map((role) => (
        <RoleCard key={role.id} clubId={clubId} role={role} />
      ))}

      {adding ? (
        <form action={action} className="flex flex-col gap-4 border-2 border-accent p-4">
          <span className="kicker">New role</span>
          <label className="field max-w-[280px]">
            Role name
            <input className="input" name="name" placeholder="Treasurer" maxLength={40} required autoFocus />
          </label>
          <PermissionFields />
          <label className="flex items-center gap-3 text-[14px]">
            <input type="checkbox" name="is_default" />
            Give this role to new members
          </label>
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton className="btn btn-primary text-[14px]" pendingText="Creating…">
              Create role
            </SubmitButton>
            <button type="button" className="btn btn-ghost text-[14px]" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary self-start" onClick={() => setAdding(true)}>
          Add a role
        </button>
      )}
    </div>
  );
}
