import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const fontFamily = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: "#f7f7f5", color: "#16181d", fontFamily, margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 520, background: "#ffffff", border: "1px solid #e4e4df", borderRadius: 10 }}>
          <Section style={{ padding: "18px 28px", borderBottom: "1px solid #e4e4df" }}>
            <Text style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Klubbies Events</Text>
          </Section>
          <Section style={{ padding: "28px" }}>{children}</Section>
          <Hr style={{ borderColor: "#e4e4df", margin: 0 }} />
          <Section style={{ padding: "16px 28px" }}>
            <Text style={{ fontSize: 14, color: "#6b6e76", margin: 0, lineHeight: 1.5 }}>
              Klubbies Events keeps event photos private to the people the organiser let in. If you weren&apos;t
              expecting this email you can ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  kicker: { fontSize: 14, fontWeight: 600, color: "#2b4acb", margin: 0 },
  heading: { fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "8px 0 12px" },
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
