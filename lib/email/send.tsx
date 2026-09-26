import "server-only";
import { render } from "@react-email/render";
import { Resend } from "resend";
import AlbumPublished, { type AlbumPublishedProps } from "@/emails/AlbumPublished";
import FeedPost, { type FeedPostProps } from "@/emails/FeedPost";
import GraceNotice, { type GraceNoticeProps } from "@/emails/GraceNotice";
import SignInCode, { type SignInCodeProps } from "@/emails/SignInCode";
import { serverEnv } from "@/lib/env";

let client: Resend | undefined;

function resend(): Resend {
  client ??= new Resend(serverEnv().RESEND_API_KEY);
  return client;
}

async function send(to: string, subject: string, element: React.ReactElement): Promise<void> {
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.info(`[email dry run] "${subject}" → ${to}`);
    return;
  }
  const env = serverEnv();
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const { error } = await resend().emails.send({ from: env.EMAIL_FROM, to, subject, html, text });
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
}

export function sendSignInCode(to: string, props: SignInCodeProps) {
  return send(to, `${props.code} is your Klubbies code`, <SignInCode {...props} />);
}

export function sendGraceNotice(to: string, props: GraceNoticeProps) {
  return send(to, `Your access to ${props.clubName} ends on ${props.endsOn}`, <GraceNotice {...props} />);
}

export type BatchMessage = {
  to: string;
  subject: string;
  template:
    | { kind: "album"; props: AlbumPublishedProps }
    | { kind: "post"; props: FeedPostProps };
};

/**
 * Club-wide notifications. Each message is rendered on its own because the
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
          <FeedPost {...message.template.props} />
        );
      const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
      const unsubscribe = message.template.props.unsubscribeUrl;
      return {
        from: env.EMAIL_FROM,
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
