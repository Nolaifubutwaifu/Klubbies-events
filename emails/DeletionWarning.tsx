import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type DeletionWarningProps = {
  eventName: string;
  deletesOn: string;
  daysLeft: number;
  albums: { title: string; url: string }[];
  billingUrl: string;
};

/** To organisers, 30 and 7 days before an event's photos are deleted. */
export default function DeletionWarning({ eventName, deletesOn, daysLeft, albums, billingUrl }: DeletionWarningProps) {
  return (
    <EmailLayout preview={`Photos from ${eventName} will be deleted on ${deletesOn}`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>
        Photos will be deleted in {daysLeft} {daysLeft === 1 ? "day" : "days"}
      </Text>
      <Text style={emailStyles.body}>
        Every photo and video from {eventName}, the guest list and all face search data will be deleted on{" "}
        <strong>{deletesOn}</strong>, 12 months after the event. After that nothing can be recovered. Download anything
        you want to keep before then:
      </Text>
      {albums.length ? (
        <Text style={emailStyles.body}>
          {albums.map((album) => (
            <span key={album.url}>
              <Link href={album.url}>{album.title}</Link>
              <br />
            </span>
          ))}
        </Text>
      ) : null}
      <Text style={emailStyles.body}>Or keep everything, and the gallery open, for another year for A$29.</Text>
      <Link href={billingUrl} style={emailStyles.button}>
        Keep another year
      </Link>
    </EmailLayout>
  );
}
