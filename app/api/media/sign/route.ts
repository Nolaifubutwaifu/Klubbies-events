import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  mediaIds: z.array(z.uuid()).min(1).max(200),
  variant: z.enum(["thumb", "display", "video"]).default("thumb"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await getSessionUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const supabase = await createClient();
  // RLS decides which of the requested items this user may see.
  const { data, error } = await supabase
    .from("media")
    .select("id, kind, storage_path, thumb_path, display_path, poster_path")
    .in("id", parsed.data.mediaIds);
  if (error) return NextResponse.json({ error: "Could not load media" }, { status: 500 });

  const { variant } = parsed.data;
  const pathFor = (m: NonNullable<typeof data>[number]) => {
    if (variant === "thumb") return m.thumb_path ?? m.poster_path;
    if (variant === "video") return m.kind === "video" ? m.storage_path : null;
    return m.kind === "video" ? m.poster_path : (m.display_path ?? m.storage_path);
  };
  const ttl = variant === "video" ? SIGNED_URL_TTL.video : variant === "display" ? SIGNED_URL_TTL.display : SIGNED_URL_TTL.thumb;

  const rows = data ?? [];
  const urls = await signPaths(
    supabase,
    rows.map(pathFor).filter((p): p is string => Boolean(p)),
    ttl,
  );

  const result: Record<string, string> = {};
  for (const m of rows) {
    const path = pathFor(m);
    const url = path ? urls.get(path) : undefined;
    if (url) result[m.id] = url;
  }
  return NextResponse.json({ urls: result, expiresIn: ttl });
}
