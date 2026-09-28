import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type LetInProps = { name: string; eventName: string; eventUrl: string };

/** To a paused guest once there's room for them (pricing handoff §5.4). */
export default function LetIn({ name, eventName, eventUrl }: LetInProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`Your photos from ${eventName} are ready`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>Your photos are ready</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, the organiser has made room, so the {eventName} gallery is open to you now. Your selfie and
        saved photos are just as you left them.
      </Text>
      <Link href={eventUrl} style={emailStyles.button}>
        Open the gallery
      </Link>
    </EmailLayout>
  );
}
