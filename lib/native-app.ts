/**
 * The iPhone app (ios/) is a native shell around this site. It identifies
 * itself by adding this token to the browser's user agent, and gives pages
 * one native call, `klubbiesSaveToPhotos`, through WebKit's message handlers.
 *
 * Shared by server and client code, so nothing here may import server-only
 * modules.
 */
export const NATIVE_APP_TOKEN = "KlubbiesApp/";

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.includes(NATIVE_APP_TOKEN));
}

type ReplyHandler = { postMessage(body: unknown): Promise<unknown> };

/** The app's Save to Photos handler, or null in a normal browser. */
export function nativeSaveToPhotos(): ReplyHandler | null {
  if (typeof window === "undefined") return null;
  const handlers = (window as unknown as { webkit?: { messageHandlers?: Record<string, ReplyHandler> } }).webkit?.messageHandlers;
  return handlers?.klubbiesSaveToPhotos ?? null;
}
