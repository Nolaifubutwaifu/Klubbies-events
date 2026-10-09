"use server";

import { z } from "zod";
import { clientFingerprint } from "@/lib/auth/request";
import { hitRateLimit, LIMITS } from "@/lib/auth/rate-limit";
import { sendContactMessage } from "@/lib/email/send";
import { supportEmail } from "@/lib/support";
import { CONTACT_TOPICS } from "./topics";

export type ContactValues = { email: string; name: string; event: string; topic: string; message: string };
export type ContactState = { ok?: boolean; error?: string; message?: string; values?: ContactValues };

const SENT = "Thanks, we got your message. We reply within two working days, to the email you gave.";

// Bots fill a form the moment it loads; people take longer than this.
const MIN_FILL_MS = 3000;
const MAX_LINKS = 5;

const schema = z.object({
  email: z.email("Enter the email we should reply to.").max(320),
  name: z.string().trim().min(1, "Enter your name").max(200),
  event: z.string().trim().max(200).optional(),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.value) as [string, ...string[]]),
  message: z.string().trim().min(10, "Tell us a little more, at least a sentence.").max(5000, "Keep it under 5,000 characters."),
});

/**
 * The support page's contact form. The support address is never shown on the
 * site (scrapers harvested it), so this is the public way to reach us. The
 * email goes to SUPPORT_EMAIL with Reply-To set to the sender, so replying
 * from the inbox answers them directly.
 */
export async function sendContactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Hidden field people never see. Anything in it is a bot: pretend it worked.
  if (String(formData.get("website") ?? "") !== "") return { ok: true, message: SENT };

  // React clears the form after every submit; an error hands the text back so nothing typed is lost.
  const field = (name: string) => String(formData.get(name) ?? "");
  const values: ContactValues = { email: field("email"), name: field("name"), event: field("event"), topic: field("topic"), message: field("message") };
  const fail = (error: string): ContactState => ({ error, values });

  const started = Number(formData.get("started"));
  if (!Number.isFinite(started) || started <= 0 || Date.now() - started < MIN_FILL_MS) {
    return fail("That was quick. Wait a few seconds, then send again.");
  }

  const parsed = schema.safeParse({
    email: values.email.trim(),
    name: values.name,
    event: values.event || undefined,
    topic: values.topic,
    message: values.message,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const data = parsed.data;

  if ((data.message.match(/https?:\/\//gi) ?? []).length > MAX_LINKS) {
    return fail(`Include at most ${MAX_LINKS} links.`);
  }

  const to = supportEmail();
  if (!to) return fail("The contact form isn't set up yet. Reply to your Stripe receipt instead.");

  const { ip, userAgent } = await clientFingerprint();
  try {
    const [ipOver, emailOver] = await Promise.all([
      hitRateLimit(LIMITS.contactPerIp, ip),
      hitRateLimit(LIMITS.contactPerEmail, data.email.toLowerCase()),
    ]);
    if (ipOver || emailOver) return fail("You've sent a few messages already. We'll reply to those, or try again in an hour.");
  } catch (error) {
    // A broken limiter shouldn't lose someone's support request.
    console.error("contact rate limit failed", error);
  }

  try {
    await sendContactMessage(to, {
      from: data.email,
      name: data.name,
      event: data.event,
      topic: CONTACT_TOPICS.find((t) => t.value === data.topic)?.label ?? "Something else",
      body: data.message,
      userAgent,
    });
  } catch (error) {
    console.error("contact message failed", error);
    return fail("We couldn't send that. Try again in a minute.");
  }

  return { ok: true, message: SENT };
}
