import "server-only";
import { notFound } from "next/navigation";
import { getEventContext } from "./session";

export async function requireAdminContext(handle: string) {
  const ctx = await getEventContext(handle);
  if (!ctx?.isAdmin) notFound();
  return ctx;
}
