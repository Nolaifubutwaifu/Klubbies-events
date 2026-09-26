import { redirect } from "next/navigation";

// Album editing now happens in the member view, with the edit panel opened on
// top, so admins see exactly what members see.
export default async function AdminAlbumRedirect(props: PageProps<"/admin/[handle]/albums/[albumId]">) {
  const { handle, albumId } = await props.params;
  redirect(`/c/${handle}/a/${albumId}?edit=1`);
}
