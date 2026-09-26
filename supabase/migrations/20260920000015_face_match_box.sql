-- "Is this you?" shows the cropped face, so the browser needs its bounding
-- box. The box lives on media_faces, and media_faces has no member policy at
-- all — that is the thing stopping a member correlating face ids across
-- photos to work out who else is in them, so it is not a policy to relax.
--
-- The box itself discloses nothing: it says where, in a photo already shown
-- to this member, their own face is. Copying it onto the match keeps "Photos
-- of you" a plain RLS query and keeps a service-role read out of a page,
-- which is the sort of shortcut that goes wrong quietly later.

alter table public.face_matches add column bounding_box jsonb;

comment on column public.face_matches.bounding_box is
  'Copy of media_faces.bounding_box (Left/Top/Width/Height, 0..1), so the suggestion strip can crop client-side without media_faces being readable.';
