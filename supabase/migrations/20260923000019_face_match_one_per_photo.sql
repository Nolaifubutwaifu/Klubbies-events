-- One member, one photo, one match row — as a constraint rather than a habit.
--
-- The uniqueness that existed was (media_face_id, profile_id), which stops the
-- same face matching the same member twice but allows two rows for one member
-- in one photo if two faces in it both match them. The product rule has always
-- been one row per member per photo — matchClubMedia keeps only the best face
-- — but it was enforced in application code, and queries were written trusting
-- it. matchForMedia used maybeSingle(), which quietly returns nothing at all
-- when a second row appears, so the "Not me" button would vanish exactly when
-- somebody most wanted it.
--
-- No duplicates exist today, so this is a tightening, not a repair.

alter table public.face_matches drop constraint face_matches_media_face_id_profile_id_key;

alter table public.face_matches
  add constraint face_matches_one_per_photo unique (profile_id, media_id);

comment on constraint face_matches_one_per_photo on public.face_matches is
  'A member appears once in a photo. Where several faces match them, the matcher keeps the best.';
