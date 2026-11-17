/** PUT a derivative to a signed upload URL. The token is already in the URL. */
export function putSignedObject(signedUrl: string, blob: Blob, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("x-upsert", "true");
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(Object.assign(new Error(`${request.status} ${request.responseText.slice(0, 160)}`), { status: request.status }));
    request.onerror = () => reject(Object.assign(new Error("network"), { status: 0 }));
    request.send(blob);
  });
}
