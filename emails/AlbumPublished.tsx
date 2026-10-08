import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type AlbumPublishedProps = {
  name: string;
  eventName: string;
  albumTitle: string;
  albumMeta: string;
  albumUrl: string;
  unsubscribeUrl: string;
};

export default function AlbumPublished({ name, eventName, albumTitle, albumMeta, albumUrl, unsubscribeUrl }: AlbumPublishedProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`${albumTitle} from ${eventName} is ready`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>{albumTitle}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, new photos from {eventName} are ready{albumMeta ? `: ${albumMeta}` : ""}. Only people the
        organiser let in can see them.
      </Text>
      <Link href={albumUrl} style={emailStyles.button}>
        See the photos
      </Link>
      <Text style={{ ...emailStyles.body, fontSize: 14, marginTop: 24 }}>
        Don&apos;t want these? <Link href={unsubscribeUrl} style={emailStyles.link}>Turn off new album emails</Link>.
      </Text>
    </EmailLayout>
  );
}
