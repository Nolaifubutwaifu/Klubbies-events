import type { Metadata } from "next";
import { AlbumScreen, loadAlbum } from "./AlbumScreen";

type Props = PageProps<"/e/[handle]/a/[albumId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { handle, albumId } = await props.params;
  const data = await loadAlbum(handle, albumId);
  return { title: data?.album.title ?? "Album" };
}

export default async function AlbumPage(props: Props) {
  const { handle, albumId } = await props.params;
  return <AlbumScreen handle={handle} albumId={albumId} search={await props.searchParams} />;
}
