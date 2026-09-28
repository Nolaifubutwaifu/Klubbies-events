import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type PlanNoticeProps = {
  eventName: string;
  heading: string;
  paragraphs: string[];
  /** "Medium: A$38", one per size the event can move to. */
  offers?: string[];
  buttonLabel: string;
  buttonUrl: string;
};

/**
 * The emails organisers get about their event's limits (pricing handoff
 * §5.5): nearly full, over the limit, 12 hours left, guests paused, photos
 * nearly full, uploads stopped.
 */
export default function PlanNotice({ eventName, heading, paragraphs, offers, buttonLabel, buttonUrl }: PlanNoticeProps) {
  return (
    <EmailLayout preview={heading}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>{heading}</Text>
      {paragraphs.map((text) => (
        <Text key={text} style={emailStyles.body}>
          {text}
        </Text>
      ))}
      {offers?.length ? (
        <Text style={emailStyles.body}>
          {offers.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </Text>
      ) : null}
      <Link href={buttonUrl} style={emailStyles.button}>
        {buttonLabel}
      </Link>
    </EmailLayout>
  );
}
