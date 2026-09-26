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
          This is the address your clubs have on file. Ask a club admin to change it.
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
          placeholder="Course, year, what you do in the club"
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton className="soft-btn soft-btn-primary self-start" pendingText="Saving…">
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
      .storage.from("club_media")
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
        <img src={avatarUrl} alt="" className="h-[104px] w-[104px] flex-none rounded-full object-cover" />
      ) : (
        <span
          className="flex h-[104px] w-[104px] flex-none items-center justify-center rounded-full text-[14px] text-[color:var(--ink-55)]"
          style={{ background: "var(--tone-support)" }}
        >
          No photo
        </span>
      )}
      <div className="flex min-w-[180px] flex-1 flex-col gap-2">
        <button type="button" className="soft-btn soft-btn-tonal self-start !min-h-[40px] !px-4 !text-[14px]" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
        </button>
        <span className="text-[14px] leading-normal text-ink-70">
          Your photo and display name are visible to other members of clubs you&apos;re in.
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--soft-r-sm)] border border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-3.5">
      <span className="text-[14px]">
        <strong>Password</strong>
        <br />
        <span className="text-[14px] text-ink-70">
          {hasPassword ? "Set. You can sign in with email and password." : "Faster if you sign in often."}
        </span>
      </span>
      {open ? (
        <form action={action} className="flex w-full flex-col gap-2">
          <input className="input" type="password" name="password" placeholder="New password" minLength={10} required autoComplete="new-password" />
          <input className="input" type="password" name="confirm" placeholder="Repeat password" minLength={10} required autoComplete="new-password" />
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton className="btn btn-primary text-[14px]" pendingText="Saving…">
              Save password
            </SubmitButton>
            <button type="button" className="btn btn-ghost text-[14px]" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary text-[14px]" onClick={() => setOpen(true)}>
          {hasPassword ? "Change password" : "Set a password"}
        </button>
      )}
    </div>
  );
}

export function NotificationToggles({
  initial,
}: {
  initial: { notify_new_album: boolean; notify_feed_post: boolean; notify_access_ending: boolean };
}) {
  const [prefs, setPrefs] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const items: [keyof typeof prefs, string][] = [
    ["notify_new_album", "A club shares a new album"],
    ["notify_feed_post", "The committee posts to the club feed"],
    ["notify_access_ending", "My access to a club is ending"],
  ];

  return (
    <div className="mt-3 flex flex-col gap-3">
      {items.map(([key, label]) => (
        <label key={key} className="flex cursor-pointer items-center gap-3 text-[14px]">
          <input
            type="checkbox"
            checked={prefs[key]}
            disabled={pending}
            onChange={(e) => {
              const next = { ...prefs, [key]: e.target.checked };
              setPrefs(next);
              startTransition(async () => {
                const res = await setNotificationsAction(next);
                setMessage(res.error ?? "Saved");
              });
            }}
          />
          {label}
        </label>
      ))}
      {message ? <span className="text-[14px] text-ink-55">{message}</span> : null}
    </div>
  );
}
