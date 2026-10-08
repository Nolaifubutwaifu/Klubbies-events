import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type PhotographerLinkProps = { eventName: string; albumTitle: string; organiser: string; url: string; expiresOn: string };

/** The one-time upload link, sent by the organiser from Photographers. */
export default function PhotographerLink({ eventName, albumTitle, organiser, url, expiresOn }: PhotographerLinkProps) {
  return (
    <EmailLayout preview={`Your upload link for ${eventName}`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>Your upload link</Text>
      <Text style={emailStyles.body}>
        {organiser} sent you this link to upload photos and videos from {eventName} into the album {albumTitle}. Open it
        in your browser and drop the files in: no account, no app, full resolution. It works until {expiresOn}.
      </Text>
      <Link href={url} style={emailStyles.button}>
        Open the upload page
      </Link>
      <Text style={{ ...emailStyles.body, marginTop: 16 }}>
        Keep this email to yourself: anyone with the link can upload into that album.
      </Text>
    </EmailLayout>
  );
}
