-- After the email code is accepted, a new account still has to give a name.
-- That pending join stays in this row, bound to the auth user, until the name
-- is saved. user_id is null while the code itself is still unused.
alter table public.pending_sign_ins
  add column user_id uuid references public.users (id) on delete cascade;

create index pending_sign_ins_user_id_idx
  on public.pending_sign_ins (user_id)
  where user_id is not null;
