-- Confirming a match promotes that face to a reference, which is the whole
-- mechanism behind recognition improving with use. The cheap way to do that
-- is to reuse the faceprint already in the collection rather than index a
-- second one from a crop: strictly less biometric data for the same result.
--
-- That leaves a lifetime problem. The promoted faceprint belongs to a photo,
-- and when the photo goes the face goes with it — so the reference row has to
-- go too, or it points at an id AWS no longer knows. A plain FK with cascade
-- says that once, where the database can enforce it.

alter table public.member_face_references
  add column media_face_id uuid references public.media_faces (id) on delete cascade;

create index member_face_references_media_face_idx
  on public.member_face_references (media_face_id)
  where media_face_id is not null;

-- The selfie reference has no media_face_id; a promoted one always does.
alter table public.member_face_references
  add constraint member_face_references_source_shape check (
    (source = 'selfie' and media_face_id is null)
    or (source = 'confirmed_match' and media_face_id is not null)
  );
