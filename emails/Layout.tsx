import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const fontFamily = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: "#fff8f4", color: "#2b2228", fontFamily, margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 520, background: "#ffffff", border: "1px solid #eaddd7", borderRadius: 24 }}>
          <Section style={{ padding: "20px 28px", borderBottom: "1px solid #eaddd7" }}>
            <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>klubbies</Text>
          </Section>
          <Section style={{ padding: "28px" }}>{children}</Section>
          <Hr style={{ borderColor: "#eaddd7", margin: 0 }} />
          <Section style={{ padding: "16px 28px" }}>
            <Text style={{ fontSize: 14, color: "#776b70", margin: 0, lineHeight: 1.5 }}>
              Klubbies keeps club photos private to the people on the member list. If you weren&apos;t expecting
              this email you can ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  kicker: { fontSize: 14, fontWeight: 700, color: "#ae1800", margin: 0 },
  heading: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, margin: "8px 0 12px" },
  body: { fontSize: 16, lineHeight: 1.6, color: "#5f545a", margin: "0 0 16px" },
  button: { background: "#cf2e12", color: "#ffffff", fontWeight: 700, fontSize: 16, padding: "15px 26px", borderRadius: 999, textDecoration: "none", display: "inline-block" },
};
