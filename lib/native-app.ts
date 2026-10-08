/**
 * The iPhone app (ios/) is a native shell around this site. It identifies
 * itself by adding this token to the browser's user agent, and gives pages
 * one native call, `klubbiesSaveToPhotos`, through WebKit's message handlers.
 *
 * Shared by server and client code, so nothing here may import server-only
 * modules.
 */
// Klubbies (the club app) sends "KlubbiesApp/". The two must never overlap,
// or each site would treat the other app as its own.
export const NATIVE_APP_TOKEN = "KlubbiesEventsApp/";

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.includes(NATIVE_APP_TOKEN));
}

/**
 * Instagram, Facebook, TikTok and Snapchat open links in their own browser,
 * which can't save files: a download there just does nothing. Pages say so
 * and point people to a real browser instead.
 */
export function socialInAppBrowser(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  if (/Instagram/i.test(userAgent)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(userAgent)) return "Facebook";
  if (/musical_ly|TikTok|BytedanceWebview/i.test(userAgent)) return "TikTok";
  if (/Snapchat/i.test(userAgent)) return "Snapchat";
  return null;
}

type ReplyHandler = { postMessage(body: unknown): Promise<unknown> };

/** The app's Save to Photos handler, or null in a normal browser. */
export function nativeSaveToPhotos(): ReplyHandler | null {
  if (typeof window === "undefined") return null;
  const handlers = (window as unknown as { webkit?: { messageHandlers?: Record<string, ReplyHandler> } }).webkit?.messageHandlers;
  return handlers?.klubbiesSaveToPhotos ?? null;
}

export type PushState = {
  permission: "granted" | "denied" | "notDetermined" | "provisional";
  token: string | null;
  environment: "sandbox" | "production";
};

/** The app's notifications handler, or null in a normal browser. */
export function nativePush(): ReplyHandler | null {
  if (typeof window === "undefined") return null;
  const handlers = (window as unknown as { webkit?: { messageHandlers?: Record<string, ReplyHandler> } }).webkit?.messageHandlers;
  return handlers?.klubbiesPush ?? null;
}

/**
 * Asks the app for its notification state ("status"), asks iOS for
 * permission ("enable"), or opens the app's page in Settings ("openSettings").
 * A token that comes back is saved against whoever is signed in.
 */
export async function pushAction(action: "status" | "enable" | "openSettings"): Promise<PushState | null> {
  const bridge = nativePush();
  if (!bridge) return null;
  const state = (await bridge.postMessage({ action })) as PushState | null;
  if (state?.token && state.permission !== "denied" && action !== "openSettings") {
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: state.token, environment: state.environment }),
    }).catch(() => undefined);
  }
  return state;
}

type PostHandler = { postMessage(body: unknown): void };

/** The app's QR scanner, or null in a normal browser. */
export function nativeScanner(): PostHandler | null {
  if (typeof window === "undefined") return null;
  const handlers = (window as unknown as { webkit?: { messageHandlers?: Record<string, PostHandler> } }).webkit?.messageHandlers;
  return handlers?.klubbiesEventsScan ?? null;
}

/** Tells the app the page is uploading, so it won't reload it (pull to refresh). */
export function tellAppBusy(busy: boolean): void {
  if (typeof window === "undefined") return;
  const handlers = (window as unknown as { webkit?: { messageHandlers?: Record<string, PostHandler> } }).webkit?.messageHandlers;
  handlers?.klubbiesBusy?.postMessage({ busy });
}
