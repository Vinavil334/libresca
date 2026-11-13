-- Removes invisible control characters from the catalog (F1.8 fix).
--
-- OPAC SBN wraps a leading article in U+0098 and U+009C ("non-sorting" markers) so that
-- "Le origini del male" sorts under O. The Goodreads import saved them as they came, and
-- they show up as boxes. `cleanText` in packages/domain now drops them; this cleans what
-- is already stored. Tabs and line breaks stay, so descriptions keep their paragraphs.

create function pg_temp.without_controls(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(value, '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', 'g');
$$;

create function pg_temp.clean_line(value text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(pg_temp.without_controls(value), '\s+', ' ', 'g'));
$$;

-- Only rows that hold such a character change, so `updated_at` moves only for them.
update public.works
set title = pg_temp.clean_line(title)
where title ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.works
set original_title = pg_temp.clean_line(original_title)
where original_title ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.works
set description = pg_temp.without_controls(description)
where description ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.editions
set title = pg_temp.clean_line(title)
where title ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.editions
set publisher = pg_temp.clean_line(publisher)
where publisher ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.authors
set name = pg_temp.clean_line(name), sort_name = pg_temp.clean_line(sort_name)
where name ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]' or sort_name ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.authors
set alternate_names = array(select pg_temp.clean_line(alias) from unnest(alternate_names) as alias)
where array_to_string(alternate_names, ' ') ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';

update public.contributors
set name = pg_temp.clean_line(name)
where name ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]';
