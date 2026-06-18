-- 0011_packing_claim_note.sql
-- Packing list: let a claimer attach a short note to their claim ("Catan +
-- Codenames") so the group can avoid duplicates on open-ended items like Games.
-- One note per claim row; nothing else about the claim model changes.

alter table public.packing_claims
  add column if not exists note text check (note is null or char_length(note) <= 140);

-- No new RLS needed: note lives on packing_claims, already covered by the
-- packing_claims_own_update policy (user_id = auth.uid()).
