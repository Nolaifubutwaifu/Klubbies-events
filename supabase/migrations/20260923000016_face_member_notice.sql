-- Every member of a club with face recognition on has a faceprint made of
-- their face, enrolled or not. Telling them that is a separate obligation
-- from asking them to enrol, and it was only being met by a dismissible
-- banner nobody had to read.
--
-- This records that a member has seen the notice, on the membership rather
-- than the profile, because it applies to members who never create a profile
-- — which is most of them.
--
-- It is an acknowledgement, not consent, and the column names say so. Consent
-- is the enrolment step, where a member chooses to become identifiable, and
-- it stays entirely optional.

alter table public.memberships
  add column face_notice_ack_at timestamptz,
  add column face_notice_version text;

comment on column public.memberships.face_notice_ack_at is
  'When this member acknowledged that faces in the club''s photos are analysed. Not consent: enrolment is where consent is given.';

-- A member may record their own acknowledgement, and nothing else about their
-- membership. The existing memberships_update policy is admin-only, so this
-- adds a narrow second path rather than widening that one.
create policy memberships_ack_face_notice on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant update (face_notice_ack_at, face_notice_version) on public.memberships to authenticated;
