import "server-only";
import { render } from "@react-email/render";
import { Resend } from "resend";
import AlbumPublished, { type AlbumPublishedProps } from "@/emails/AlbumPublished";
import AccessEnding, { type AccessEndingProps } from "@/emails/AccessEnding";
import DeletionWarning, { type DeletionWarningProps } from "@/emails/DeletionWarning";
import LetIn, { type LetInProps } from "@/emails/LetIn";
import PlanNotice, { type PlanNoticeProps } from "@/emails/PlanNotice";
import SignInCode, { type SignInCodeProps } from "@/emails/SignInCode";
import { serverEnv } from "@/lib/env";
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
  const { error } = await resend().emails.send({ from: env.EMAIL_FROM, ...replyTo(), to, subject, html, text });
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
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
  const { error } = await resend().emails.send({ from: serverEnv().EMAIL_FROM, replyTo: message.from, to, subject, text });
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
}

export function sendSignInCode(to: string, props: SignInCodeProps) {
  return send(to, `${props.code} is your Klubbies Events code`, <SignInCode {...props} />);
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
    const { error } = await resend().batch.send(prepared.slice(i, i + 100));
    if (error) throw new Error(`Resend batch: ${error.name}: ${error.message}`);
  }
}
