import "server-only";
import { notFound } from "next/navigation";
import { getClubContext } from "./session";

export async function requireAdminContext(handle: string) {
  const ctx = await getClubContext(handle);
  if (!ctx?.isAdmin) notFound();
  return ctx;
}
