-- 0010_list_fields_to_arrays.sql
-- house_rules and local_tips become string arrays (jsonb) to match stocked_items.
-- Existing text is backfilled by splitting on newlines into trimmed, non-empty items.

create or replace function pg_temp.text_to_jsonb_lines(t text)
returns jsonb language sql immutable as $$
  select case
    when t is null or btrim(t) = '' then '[]'::jsonb
    else coalesce(
      (select jsonb_agg(btrim(line))
       from unnest(string_to_array(t, E'\n')) as line
       where btrim(line) <> ''),
      '[]'::jsonb
    )
  end;
$$;

-- properties
alter table public.properties alter column house_rules drop default;
alter table public.properties
  alter column house_rules type jsonb using pg_temp.text_to_jsonb_lines(house_rules);
alter table public.properties
  alter column house_rules set default '[]'::jsonb,
  alter column house_rules set not null;

alter table public.properties alter column local_tips drop default;
alter table public.properties
  alter column local_tips type jsonb using pg_temp.text_to_jsonb_lines(local_tips);
alter table public.properties
  alter column local_tips set default '[]'::jsonb,
  alter column local_tips set not null;

-- trips
alter table public.trips alter column house_rules drop default;
alter table public.trips
  alter column house_rules type jsonb using pg_temp.text_to_jsonb_lines(house_rules);
alter table public.trips
  alter column house_rules set default '[]'::jsonb,
  alter column house_rules set not null;

alter table public.trips alter column local_tips drop default;
alter table public.trips
  alter column local_tips type jsonb using pg_temp.text_to_jsonb_lines(local_tips);
alter table public.trips
  alter column local_tips set default '[]'::jsonb,
  alter column local_tips set not null;
