/** No bytes for this long means the phone has stalled, not that storage refused. */
export const UPLOAD_STALL_MS = 30_000;

/** Resets on each progress event. Calls onStall once, then stops. */
export function watchUploadStall(onStall: () => void, ms = UPLOAD_STALL_MS): { bump: () => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;
  const bump = () => {
    if (fired) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      onStall();
    }, ms);
  };
  bump();
  return {
    bump,
    stop: () => {
      fired = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/** PUT a derivative to a signed upload URL. The token is already in the URL. */
export function putSignedObject(signedUrl: string, blob: Blob, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let stalled = false;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      stall.stop();
      if (error) reject(error);
      else resolve();
    };
    const stall = watchUploadStall(() => {
      stalled = true;
      request.abort();
    });
    request.open("PUT", signedUrl);
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("x-upsert", "true");
    request.upload.onprogress = () => stall.bump();
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? finish()
        : finish(Object.assign(new Error(`${request.status} ${request.responseText.slice(0, 160)}`), { status: request.status }));
    request.onerror = () => finish(Object.assign(new Error("network"), { status: 0 }));
    request.onabort = () => finish(Object.assign(new Error(stalled ? "network" : "aborted"), { status: 0 }));
    request.send(blob);
  });
}
