-- A first-time visitor can create an account before any club has added them.
alter table public.pending_sign_ins drop constraint pending_sign_ins_flow_check;
alter table public.pending_sign_ins add constraint pending_sign_ins_flow_check
  check (flow in ('member', 'create', 'signup'));
