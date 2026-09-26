import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type AlbumPublishedProps = {
  name: string;
  clubName: string;
  albumTitle: string;
  albumMeta: string;
  albumUrl: string;
  unsubscribeUrl: string;
};

export default function AlbumPublished({ name, clubName, albumTitle, albumMeta, albumUrl, unsubscribeUrl }: AlbumPublishedProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`${albumTitle} is up on Klubbies`}>
      <Text style={emailStyles.kicker}>{clubName}</Text>
      <Text style={emailStyles.heading}>{albumTitle}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, the committee has shared a new album{albumMeta ? ` — ${albumMeta}` : ""}. Only people on the
        member list can see it.
      </Text>
      <Link href={albumUrl} style={emailStyles.button}>
        Open the album
      </Link>
      <Text style={{ ...emailStyles.body, fontSize: 14, marginTop: 24 }}>
        Don&apos;t want these? <Link href={unsubscribeUrl}>Turn off new album emails</Link>.
      </Text>
    </EmailLayout>
  );
}
