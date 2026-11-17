import "server-only";
import { createHash } from "node:crypto";
import { render } from "@react-email/render";
import { Resend } from "resend";
import AlbumPublished, { type AlbumPublishedProps } from "@/emails/AlbumPublished";
import AccessEnding, { type AccessEndingProps } from "@/emails/AccessEnding";
import DeletionWarning, { type DeletionWarningProps } from "@/emails/DeletionWarning";
import EventAnnouncement, { type EventAnnouncementProps } from "@/emails/EventAnnouncement";
import LetIn, { type LetInProps } from "@/emails/LetIn";
import PhotographerLink, { type PhotographerLinkProps } from "@/emails/PhotographerLink";
import PlanNotice, { type PlanNoticeProps } from "@/emails/PlanNotice";
import SignInCode, { type SignInCodeProps } from "@/emails/SignInCode";
import { serverEnv } from "@/lib/env";
import { RETRY_ATTEMPTS, emailDelayMs, emailLogLabel, isEmailRetryable, sleep } from "@/lib/retry";
import { supportEmail } from "@/lib/support";

let client: Resend | undefined;

/** Mail is sent from an address nobody reads; replies go to support. */
function replyTo(): { replyTo?: string } {
  const address = supportEmail();
  return address ? { replyTo: address } : {};
}

function resend(): Resend {
  client ??= new Resend(serverEnv().RESEND_API_KEY);
  return client;
}

type ResendFailure = { name?: string; message?: string; statusCode?: number | null };

/** Same key for every try of one message, so a retried 5xx is not a second email. */
function idempotencyKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

function failure(error: ResendFailure): Error {
  const wrapped = new Error(`Resend: ${error.name ?? "Error"}: ${error.message ?? "request failed"}`);
  (wrapped as { statusCode?: number | null }).statusCode = error.statusCode ?? null;
  return wrapped;
}

/**
 * Sends once, and again on 429 or 5xx. A 4xx other than 429 is logged and
 * thrown: retrying a refused address would not deliver it. The subject in
 * the log has a leading sign-in code replaced.
 */
async function deliver(to: string, subject: string, once: () => Promise<{ error: ResendFailure | null }>): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const { error } = await once();
      if (error) throw failure(error);
      return;
    } catch (error) {
      last = error;
      const label = emailLogLabel(subject);
      const again = attempt < RETRY_ATTEMPTS - 1 && isEmailRetryable(error);
      if (!again) {
        console.error(`email failed (attempt ${attempt + 1} of ${RETRY_ATTEMPTS}) to ${to} ("${label}")`, error);
        throw error;
      }
      console.error(`email attempt ${attempt + 1} to ${to} ("${label}") will be retried`, error);
      await sleep(emailDelayMs(attempt));
    }
  }
  throw last;
}

async function send(to: string, subject: string, element: React.ReactElement): Promise<void> {
  if (process.env.EMAIL_DRY_RUN === "1") {
    // Local development has no inbox, so the dry run prints the message. The
    // sign-in code is in it, which is the point; never set this in production.
    const body = process.env.NODE_ENV === "production" ? "" : `\n${await render(element, { plainText: true })}`;
    console.info(`[email dry run] "${subject}" → ${to}${body}`);
    return;
  }
  const env = serverEnv();
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  await deliver(to, subject, () =>
    resend().emails.send({
      from: env.EMAIL_FROM,
      ...replyTo(),
      to,
      subject,
      html,
      text,
      idempotencyKey: idempotencyKey(["send", to, subject]),
    }),
  );
}

export type ContactMessage = { from: string; name?: string; event?: string; topic: string; body: string; userAgent: string };

/** The support page's contact form, to the support inbox. Replying answers the sender. */
export async function sendContactMessage(to: string, message: ContactMessage): Promise<void> {
  const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").slice(0, 120);
  const subject = `[Contact form] ${message.topic}: ${oneLine(message.name || message.from)}`;
  const text = [
    `From: ${message.name ? `${message.name} <${message.from}>` : message.from}`,
    `Topic: ${message.topic}`,
    `Event: ${message.event || "-"}`,
    `Device: ${message.userAgent || "-"}`,
    "",
    message.body,
  ].join("\n");
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.info(`[email dry run] "${subject}" → ${to}\n${text}`);
    return;
  }
  await deliver(to, subject, () =>
    resend().emails.send({
      from: serverEnv().EMAIL_FROM,
      replyTo: message.from,
      to,
      subject,
      text,
      idempotencyKey: idempotencyKey(["contact", to, subject, message.from]),
    }),
  );
}

export function sendSignInCode(to: string, props: SignInCodeProps) {
  // Named after the event when there is one: a first-time guest knows the
  // event, not us, and an unknown sender looks like phishing.
  const subject = props.eventName ? `${props.code} is your code for ${props.eventName}` : `${props.code} is your Klubbies Events code`;
  return send(to, subject, <SignInCode {...props} />);
}

/** About the organiser's own event and its limits: service email, no unsubscribe. */
export function sendPlanNotice(to: string, subject: string, props: PlanNoticeProps) {
  return send(to, subject, <PlanNotice {...props} />);
}

export function sendDeletionWarning(to: string, props: DeletionWarningProps) {
  return send(to, `Photos from ${props.eventName} will be deleted on ${props.deletesOn}`, <DeletionWarning {...props} />);
}

export function sendLetIn(to: string, props: LetInProps) {
  return send(to, `Your photos from ${props.eventName} are ready`, <LetIn {...props} />);
}


export type BatchMessage = {
  to: string;
  subject: string;
  template:
    | { kind: "album"; props: AlbumPublishedProps }
    | { kind: "access_ending"; props: AccessEndingProps };
};

/**
 * Event-wide notifications. Each message is rendered on its own because the
 * unsubscribe link is per person, then sent in batches of 100.
 */
export async function sendBatch(messages: BatchMessage[]): Promise<void> {
  if (messages.length === 0) return;
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.info(`[email dry run] batch of ${messages.length}: "${messages[0].subject}"`);
    return;
  }
  const env = serverEnv();

  const prepared = await Promise.all(
    messages.map(async (message) => {
      const element =
        message.template.kind === "album" ? (
          <AlbumPublished {...message.template.props} />
        ) : (
          <AccessEnding {...message.template.props} />
        );
      const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
      const unsubscribe = message.template.props.unsubscribeUrl;
      return {
        from: env.EMAIL_FROM,
        ...replyTo(),
        to: message.to,
        subject: message.subject,
        html,
        text,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    }),
  );

  for (let i = 0; i < prepared.length; i += 100) {
    const slice = prepared.slice(i, i + 100);
    await deliver(`${slice.length} recipients`, slice[0].subject, () =>
      resend().batch.send(slice, {
        idempotencyKey: idempotencyKey(["batch", ...slice.map((item) => `${item.to}\n${item.subject}`)]),
      }),
    );
  }
}

export function sendPhotographerLink(to: string, props: PhotographerLinkProps) {
  return send(to, `Your upload link for ${props.eventName}`, <PhotographerLink {...props} />);
}

/**
 * The organiser's announcement to their guests, in batches of 100. It comes
 * from our address with the organiser's name on it, and replies go to them.
 */
export async function sendAnnouncements(
  messages: { to: string; subject: string; props: EventAnnouncementProps }[],
  organiserEmail: string | null,
): Promise<void> {
  if (messages.length === 0) return;
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.info(`[email dry run] announcement to ${messages.length}: "${messages[0].subject}"`);
    return;
  }
  const env = serverEnv();
  const address = env.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.EMAIL_FROM;
  const prepared = await Promise.all(
    messages.map(async (message) => {
      const element = <EventAnnouncement {...message.props} />;
      const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
      const sender = message.props.organiser.replace(/["<>]/g, "").slice(0, 60);
      return {
        from: `${sender} via Klubbies Events <${address}>`,
        ...(organiserEmail ? { replyTo: organiserEmail } : replyTo()),
        to: message.to,
        subject: message.subject,
        html,
        text,
        headers: { "List-Unsubscribe": `<${message.props.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    }),
  );
  for (let i = 0; i < prepared.length; i += 100) {
    const slice = prepared.slice(i, i + 100);
    await deliver(`${slice.length} recipients`, slice[0].subject, () =>
      resend().batch.send(slice, {
        idempotencyKey: idempotencyKey(["batch", ...slice.map((item) => `${item.to}\n${item.subject}`)]),
      }),
    );
  }
}
