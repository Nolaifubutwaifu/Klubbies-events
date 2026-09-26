import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type SignInCodeProps = { code: string; name: string; eventName: string | null };

export default function SignInCode({ code, name, eventName }: SignInCodeProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`Your Klubbies Events code is ${code}`}>
      <Text style={emailStyles.kicker}>{eventName ?? "Klubbies Events"}</Text>
      <Text style={emailStyles.heading}>Your sign-in code</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, enter this code to {eventName ? `open the photos from ${eventName}` : "sign in"}.
      </Text>
      <Text
        style={{
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "0.18em",
          background: "#f7f7f5",
          border: "1px solid #e4e4df",
          borderRadius: 8,
          padding: "14px 18px",
          margin: "0 0 16px",
          textAlign: "center",
          fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace",
        }}
      >
        {code}
      </Text>
      <Text style={emailStyles.body}>It works once and expires in 10 minutes.</Text>
    </EmailLayout>
  );
}
