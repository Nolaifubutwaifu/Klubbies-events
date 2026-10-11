"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { createClient } from "@/lib/supabase/client";
import {
  setAvatarAction,
  setNotificationsAction,
  setPasswordAction,
  updateProfileAction,
  type AccountResult,
} from "./actions";

export function ProfileForm({
  displayName,
  email,
  bio,
}: {
  displayName: string;
  email: string;
  bio: string | null;
}) {
  const [state, action] = useActionState<AccountResult, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="field">
        Display name
        <input className="input" name="displayName" defaultValue={displayName} maxLength={120} required />
      </label>
      <label className="field">
        Email
        <input className="input" value={email} disabled />
        <span className="text-[14px] font-normal leading-normal text-ink-70">
          This is the address your events have on file. Ask the event organiser to change it.
        </span>
      </label>
      <label className="field">
        About you <span className="font-normal text-ink-55">optional</span>
        <textarea
          className="input"
          name="bio"
          rows={3}
          maxLength={500}
          defaultValue={bio ?? ""}
          placeholder="Course, year, what you do in the event"
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary self-start" pendingText="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}

export function AvatarUploader({ userId, avatarUrl }: { userId: string; avatarUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Use a PNG, JPG or WebP image");
    if (file.size > 5 * 1024 * 1024) return setError("Photos must be under 5 MB");
    setBusy(true);
    setError("");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `avatars/${userId}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await createClient()
      .storage.from("event_media")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError("Upload failed. Try again.");
    }
    const res = await setAvatarAction(path);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={avatarUrl} alt="" className="h-16 w-16 flex-none rounded-full object-cover" />
      ) : (
        <span
          className="flex h-16 w-16 flex-none items-center justify-center rounded-full text-[14px] text-[color:var(--ink-55)]"
          style={{ background: "var(--tone-support)" }}
        >
          No photo
        </span>
      )}
      <div className="flex min-w-[180px] flex-1 flex-col gap-2">
        <button type="button" className="btn btn-secondary self-start" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
        </button>
        <span className="text-[14px] leading-normal text-ink-70">
          Your photo and name are visible to the organisers of events you&apos;re in.
        </span>
        {error ? <span className="notice">{error}</span> : null}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AccountResult, FormData>(setPasswordAction, {});

  return (
    <>
      <div className="kb-row">
        <span className="flex min-w-0 flex-1 flex-col">
          <span>Password</span>
          <span className="text-[14px] text-[color:var(--kb-ink-3)]">
            {hasPassword ? "Set. You can sign in with email and password." : "Faster if you sign in often."}
          </span>
        </span>
        {open ? null : (
          <button type="button" className="min-h-[44px] text-[15px] font-medium text-[color:var(--kb-ember)]" onClick={() => setOpen(true)}>
            {hasPassword ? "Change" : "Set one"}
          </button>
        )}
      </div>
      {open ? (
        <form action={action} className="flex flex-col gap-2 border-t border-[color:var(--kb-sand)] p-4">
          <input className="input" type="password" name="password" placeholder="New password" minLength={10} required autoComplete="new-password" aria-label="New password" />
          <input className="input" type="password" name="confirm" placeholder="Repeat password" minLength={10} required autoComplete="new-password" aria-label="Repeat password" />
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton className="btn btn-primary" pendingText="Saving…">
              Save password
            </SubmitButton>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

export function NotificationToggles({
  initial,
}: {
  initial: { notify_new_album: boolean; notify_access_ending: boolean };
}) {
  const [prefs, setPrefs] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const items: [keyof typeof prefs, string][] = [
    ["notify_new_album", "A new album is published"],
    ["notify_access_ending", "A gallery is about to close"],
  ];

  return (
    <>
      {items.map(([key, label]) => (
        <div key={key} className="kb-row">
          <span id={`pref-${key}`} className="flex-1">
            {label}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            aria-labelledby={`pref-${key}`}
            className="kb-switch"
            disabled={pending}
            onClick={() => {
              const next = { ...prefs, [key]: !prefs[key] };
              setPrefs(next);
              startTransition(async () => {
                const res = await setNotificationsAction(next);
                setMessage(res.error ?? "Saved");
              });
            }}
          />
        </div>
      ))}
      {message ? (
        <p className="kb-row !min-h-0 text-[14px] text-[color:var(--kb-ink-3)]" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}

/** Name, photo and a line about you: a row that opens into the form. */
export function ProfileRow({ userId, displayName, email, bio, avatarUrl }: { userId: string; displayName: string; email: string; bio: string | null; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="kb-row">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] text-[color:var(--kb-ink-3)]">Name</span>
          <span className="truncate">{displayName || "Not set"}</span>
        </span>
        <button type="button" className="min-h-[44px] text-[15px] font-medium text-[color:var(--kb-ember)]" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-6 border-t border-[color:var(--kb-sand)] p-4">
          <AvatarUploader userId={userId} avatarUrl={avatarUrl} />
          <ProfileForm displayName={displayName} email={email} bio={bio} />
        </div>
      ) : null}
    </>
  );
}
