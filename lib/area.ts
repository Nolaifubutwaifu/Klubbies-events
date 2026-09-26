import "server-only";
import { cookies } from "next/headers";

export const AREA_COOKIE = "kb_area";
export type Area = "member" | "admin";

/** Which view the user last chose. Admin pages force the admin area. */
export async function currentArea(pathname?: string): Promise<Area> {
  if (pathname?.startsWith("/admin/")) return "admin";
  const cookie = (await cookies()).get(AREA_COOKIE)?.value;
  return cookie === "admin" ? "admin" : "member";
}
