import { Body, Column, Container, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const fontFamily = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif";

// The credit line's links (pricing handoff §5.7), tagged so sign ups from
// email can be counted.
const site = (process.env.APP_URL ?? "https://events.klubbies.app").replace(/\/$/, "");

// Hosted PNG, not inline SVG: email clients drop SVG. Flattened on white in
// public/email-mark.png so a client that ignores PNG alpha still shows the
// rounded tile on this white card. icon-192.png is the same drawing with a
// transparent surround, for home screens.
const markUrl = `${site}/email-mark.png`;

/** "Brisbane Product Summit 2026" → "BPS", for the event's tile in the header. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /[a-z]/i.test(word))
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** 32px hosted mark. Alt and the width/height attributes stay when images are blocked. */
function Mark() {
  return <Img src={markUrl} width="32" height="32" alt="Klubbies Events" style={{ display: "block", width: 32, height: 32 }} />;
}

const credit = (
  <>
    <Link href={`${site}/?src=credit-email`} style={{ color: "#4b4e56", textDecoration: "underline" }}>
      Photos by Klubbies Events
    </Link>
    {" · "}
    <Link href={`${site}/start?src=credit-email`} style={{ color: "#4b4e56", textDecoration: "underline" }}>
      Run your own event
    </Link>
  </>
);

/**
 * Every email: the event it's about at the top (its tile and name) when there
 * is one, otherwise the Klubbies Events name with the mark. The product mark
 * sits on the "Photos by Klubbies Events" line for event mail, so it isn't a
 * second logo beside the event's tile. Then the message, the privacy line and
 * the credit.
 */
export function EmailLayout({ preview, eventName = null, children }: { preview: string; eventName?: string | null; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: "#f7f7f5", color: "#16181d", fontFamily, margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 520, background: "#ffffff", border: "1px solid #e4e4df", borderRadius: 10 }}>
          <Section style={{ padding: "16px 28px", borderBottom: "1px solid #e4e4df" }}>
            {eventName ? (
              <Text style={{ fontSize: 15, fontWeight: 600, margin: 0, lineHeight: "28px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 28,
                    height: 28,
                    lineHeight: "28px",
                    borderRadius: 7,
                    background: "#16181d",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                    verticalAlign: "middle",
                    marginRight: 10,
                  }}
                >
                  {initials(eventName)}
                </span>
                <span style={{ verticalAlign: "middle" }}>{eventName}</span>
              </Text>
            ) : (
              <Row>
                <Column style={{ width: 44, verticalAlign: "middle" }}>
                  <Mark />
                </Column>
                <Column style={{ verticalAlign: "middle" }}>
                  <Text style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, lineHeight: "32px" }}>Klubbies Events</Text>
                </Column>
              </Row>
            )}
          </Section>
          <Section style={{ padding: "28px" }}>{children}</Section>
          <Hr style={{ borderColor: "#e4e4df", margin: 0 }} />
          <Section style={{ padding: "16px 28px" }}>
            <Text style={{ fontSize: 14, color: "#6b6e76", margin: 0, lineHeight: 1.5 }}>
              Klubbies Events keeps event photos private to the people the organiser let in. If you weren&apos;t
              expecting this email you can ignore it.
            </Text>
            {eventName ? (
              <Row>
                <Column style={{ width: 44, verticalAlign: "middle", paddingTop: 12 }}>
                  <Mark />
                </Column>
                <Column style={{ verticalAlign: "middle", paddingTop: 12 }}>
                  <Text style={{ fontSize: 14, color: "#6b6e76", margin: 0, lineHeight: "32px" }}>{credit}</Text>
                </Column>
              </Row>
            ) : (
              <Text style={{ fontSize: 14, color: "#6b6e76", margin: "8px 0 0", lineHeight: 1.5 }}>{credit}</Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  /** Inline links: underlined and dark enough (7:1), not told apart by colour alone. */
  link: { color: "#1f379b", textDecoration: "underline" },
  kicker: { fontSize: 14, fontWeight: 600, color: "#2b4acb", margin: 0 },
  heading: { fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "8px 0 14px" },
  body: { fontSize: 16, lineHeight: 1.6, color: "#4a4d55", margin: "0 0 16px" },
  button: {
    background: "#16181d",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 15,
    padding: "14px 24px",
    borderRadius: 8,
    textDecoration: "none",
    display: "inline-block",
  },
};
