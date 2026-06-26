-- 0013_invite_role.sql
-- Let a host choose the role an invitee lands in. Until now every consumed
-- invite created a 'guest' membership; co-hosts could only be made by promoting
-- an existing member after the fact. This carries the intended role on the
-- invite so "invite as co-host" works in one step.

alter table public.trip_invites
  add column if not exists role text not null default 'guest'
    check (role in ('co-host', 'guest'));

-- 'host' is intentionally excluded: the primary host is a single, transfer-only
-- title (see transfer_trip_host). An invite can only ever grant co-host or guest.
