"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setClubLogoAction } from "../../actions";

const TYPES: Record<string, string> = { "image/png": "png", "image/svg+xml": "svg", "image/jpeg": "jpg", "image/webp": "webp" };

export function LogoUploader({ clubId, logoUrl }: { clubId: string; logoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext) return setError("Use a PNG, SVG, JPG or WebP file");
    if (file.size > 5 * 1024 * 1024) return setError("Logos must be under 5 MB");
    setBusy(true);
    setError("");
    // A new name per upload: a replaced logo must never be served from a
    // cached URL for the old one. The server clears the previous file.
    const path = `clubs/${clubId}/logo/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await createClient().storage.from("club_media").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError("Upload failed. Try again.");
    }
    const res = await setClubLogoAction(clubId, path);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div
      className="dropzone aspect-[3/2] p-4"
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={logoUrl} alt="Club logo" className="max-h-[60%] max-w-[60%] object-contain" />
      ) : null}
      <span className="soft-display text-[15px] text-ink-70">{busy ? "Uploading…" : logoUrl ? "Replace logo" : "Drop your logo"}</span>
      <span className="text-[14px] text-[color:var(--ink-70)]">PNG or SVG, at least 400px</span>
      {error ? <span className="notice">{error}</span> : null}
      <input ref={input} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
