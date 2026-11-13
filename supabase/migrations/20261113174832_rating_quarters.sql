-- Quarter mushrooms (F1.8): a rating can be 3¼ or 4¾ mushrooms, not only halves.
--
-- `rating_half` (1 to 10) becomes `rating_quarter` (1 to 20): a quarter of a mushroom per
-- unit, still integers in the database. Every existing rating keeps its value, doubled.
-- Column privileges and the `readings_rating_when_done` constraint follow the rename.

alter table public.readings drop constraint readings_rating_half_check;
alter table public.readings rename column rating_half to rating_quarter;

-- Doubling a rating is not an edit by the reader: `updated_at` stays as it was.
alter table public.readings disable trigger readings_set_updated_at;
update public.readings set rating_quarter = rating_quarter * 2 where rating_quarter is not null;
alter table public.readings enable trigger readings_set_updated_at;

-- Quarter mushrooms, 1 to 20. NULL means no rating, which is not a low rating.
alter table public.readings
add constraint readings_rating_quarter_check check (rating_quarter between 1 and 20);

comment on column public.readings.rating_quarter is 'Rating in quarter mushrooms, 1 (¼) to 20 (5). NULL: no rating.';
