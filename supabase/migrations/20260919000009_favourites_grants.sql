-- Match the rest of the schema: every other public table has its anon grants
-- revoked, and RLS is the only thing standing between a caller and the rows.
-- favourites shipped with Supabase's default grants still attached. RLS
-- already denies anon (it has no policy), so this is defence in depth and
-- consistency rather than a live hole — but a permissive policy added later
-- would otherwise land on a table anon can already reach.
revoke all on table public.favourites from anon;

-- A favourite is insert-or-delete; there is no legitimate update path and no
-- UPDATE policy, so drop the grant that implies one.
revoke update on table public.favourites from authenticated;
