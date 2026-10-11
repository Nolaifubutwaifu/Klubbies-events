import type { Metadata } from "next";
import { AlbumScreen, loadAlbum } from "@/app/(app)/e/[handle]/a/[albumId]/AlbumScreen";

type Props = PageProps<"/admin/[handle]/albums/[albumId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { handle, albumId } = await props.params;
  const data = await loadAlbum(handle, albumId);
  return { title: data?.album.title ?? "Album" };
}

/** An album inside the organiser layout: the same screen attendees get, plus its figures and settings. */
export default async function OrganiserAlbumPage(props: Props) {
  const { handle, albumId } = await props.params;
  return <AlbumScreen organiser handle={handle} albumId={albumId} search={await props.searchParams} />;
}
