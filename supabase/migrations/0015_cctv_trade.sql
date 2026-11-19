-- CCTV is a distinct trade category with its own five approved places per area.
-- Existing home-security applications remain unchanged.
insert into public.trades (slug,name)
values ('cctv-installation','CCTV & security camera installation')
on conflict (slug) do update set name=excluded.name;
