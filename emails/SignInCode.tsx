import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type SignInCodeProps = { code: string; name: string; clubName: string | null };

export default function SignInCode({ code, name, clubName }: SignInCodeProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`Your Klubbies code is ${code}`}>
      <Text style={emailStyles.kicker}>{clubName ?? "Klubbies"}</Text>
      <Text style={emailStyles.heading}>Your sign-in code</Text>
      <Text style={emailStyles.body}>Hi {firstName}, enter this code to open your club&apos;s photos.</Text>
      <Text
        style={{
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: "0.18em",
          background: "#fff8f4",
          border: "1px solid #eaddd7",
          borderRadius: 16,
          padding: "14px 18px",
          margin: "0 0 16px",
          textAlign: "center",
        }}
      >
        {code}
      </Text>
      <Text style={emailStyles.body}>It works once and expires in 10 minutes.</Text>
    </EmailLayout>
  );
}
