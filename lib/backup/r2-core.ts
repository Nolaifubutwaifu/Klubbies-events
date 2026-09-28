/**
 * Cloudflare R2, the second copy of every original (docs/handoff-retention-
 * backups.md). R2 speaks the S3 API. Keys are the same paths as in Supabase
 * Storage, so a restore needs no lookup table.
 *
 * No "server-only" here: the local scripts (restore-media, backup-drain) use
 * this too. The app goes through lib/backup/r2.ts.
 */
import { Readable } from "node:stream";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Tests point this at a local S3 stand-in; normally derived from the account. */
  endpoint?: string;
};

/**
 * All four settings, or null. With none set, backup quietly does nothing, the
 * way face search does without AWS keys. Half a configuration is treated as
 * none, and logged, rather than failing uploads.
 */
export function r2ConfigFrom(env: Record<string, string | undefined>): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const set = [accountId, accessKeyId, secretAccessKey, bucket].filter(Boolean).length;
  if (set === 0) return null;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error("R2 is only partly configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET); backup is off");
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint: env.R2_ENDPOINT?.trim() || undefined };
}

export function r2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: Boolean(config.endpoint),
  });
}

/**
 * Streams a file from a URL (a signed Supabase URL) into R2 under `key`, as a
 * multipart upload, so a 500 MB video never sits in memory. Returns its size.
 */
export async function streamUrlToR2(
  client: S3Client,
  config: R2Config,
  url: string,
  key: string,
): Promise<number> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`could not read ${key} from storage (${response.status})`);
  const size = Number(response.headers.get("content-length") ?? 0);
  const upload = new Upload({
    client,
    params: {
      Bucket: config.bucket,
      Key: key,
      Body: Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      ContentType: response.headers.get("content-type") ?? undefined,
    },
    partSize: 16 * 1024 * 1024,
    queueSize: 4,
  });
  await upload.done();
  return size;
}

export async function existsInR2(client: S3Client, config: R2Config, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

/** The object's body as a web stream, or null if it isn't there. */
export async function readFromR2(client: S3Client, config: R2Config, key: string): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    return (out.Body?.transformToWebStream() as ReadableStream<Uint8Array> | undefined) ?? null;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

export async function deleteFromR2(client: S3Client, config: R2Config, keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 1000) {
    const out = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (out.Errors?.length) throw new Error(`R2 delete failed for ${out.Errors.length} keys: ${out.Errors[0].Message ?? ""}`);
  }
}

/** Every key under a prefix. */
export async function listR2Keys(client: S3Client, config: R2Config, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const out = await client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: token }));
    for (const item of out.Contents ?? []) if (item.Key) keys.push(item.Key);
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** The next folder level under a prefix: "events/" gives each event's folder. */
export async function listR2Folders(client: S3Client, config: R2Config, prefix: string): Promise<string[]> {
  const folders: string[] = [];
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, Delimiter: "/", ContinuationToken: token }),
    );
    for (const item of out.CommonPrefixes ?? []) if (item.Prefix) folders.push(item.Prefix);
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return folders;
}

/** A Content-Disposition that keeps non-ASCII filenames intact. */
export function attachmentHeader(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** A short-lived link straight to R2. With `downloadAs`, the browser saves it under that name. */
export async function presignR2(
  client: S3Client,
  config: R2Config,
  key: string,
  seconds: number,
  downloadAs?: string,
): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: downloadAs ? attachmentHeader(downloadAs) : undefined,
    }),
    { expiresIn: seconds },
  );
}

/** Only event files are copied: never selfies, faceprints or avatars. */
export function isBackedUpPath(path: string): boolean {
  return /^events\/[0-9a-f-]{36}\/(albums|logo)\//.test(path);
}
