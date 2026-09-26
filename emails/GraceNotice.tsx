import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type GraceNoticeProps = {
  name: string;
  clubName: string;
  endsOn: string;
  clubUrl: string;
  finalNotice: boolean;
};

export default function GraceNotice({ name, clubName, endsOn, clubUrl, finalNotice }: GraceNoticeProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`Your access to ${clubName} ends on ${endsOn}`}>
      <Text style={emailStyles.kicker}>{clubName}</Text>
      <Text style={emailStyles.heading}>{finalNotice ? "Your access ends tomorrow" : `Access ends ${endsOn}`}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, the committee has taken you off the {clubName} member list. You can still open and download
        everything shared before that until <strong>{endsOn}</strong>. After that the club&apos;s albums close for
        you.
      </Text>
      <Link href={clubUrl} style={emailStyles.button}>
        Open the club albums
      </Link>
    </EmailLayout>
  );
}
