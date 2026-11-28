-- Never promise more vacancy offers than physical unoccupied places.
-- Advisory locking serializes all offer/activation operations per trade-area.
begin;
create or replace function public.offer_next_professional(p_trade uuid,p_area uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_app uuid; v_offer uuid; v_slots integer; v_reserved integer;
begin
 if not public.is_trustfive_admin() then
  raise exception 'Not authorised' using errcode='42501';
 end if;
 if p_trade is null or p_area is null then
  raise exception 'Trade and area are required';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_trade::text || ':' || p_area::text,0));
 update public.vacancy_offers
  set status='expired'
  where trade_id=p_trade and area_id=p_area and status in ('offered','accepted')
    and expires_at<=now();
 select count(*) into v_slots from public.active_allocations
  where trade_id=p_trade and area_id=p_area;
 select count(*) into v_reserved from public.vacancy_offers
  where trade_id=p_trade and area_id=p_area
    and status in ('offered','accepted') and expires_at>now();
 if v_slots+v_reserved>=5 then
  raise exception 'No vacancy available: all five slots are active or reserved';
 end if;
 select a.id into v_app
 from public.professional_applications a
 join public.professional_assessments qa on qa.application_id=a.id
 where a.trade_id=p_trade and a.area_id=p_area and a.status='eligible'
   and qa.verification_state='verified'
   and not exists(
    select 1 from public.active_allocations alloc where alloc.application_id=a.id
   )
   and not exists(
    select 1 from public.vacancy_offers prev
    where prev.application_id=a.id and prev.status in ('offered','accepted')
      and prev.expires_at>now()
   )
 order by qa.quality_score desc,a.submitted_at asc,a.id asc
 limit 1;
 if v_app is null then raise exception 'No eligible waiting-list applicant'; end if;
 update public.vacancy_offers set status='expired'
  where application_id=v_app and status='offered' and expires_at<=now();
 insert into public.vacancy_offers(application_id,trade_id,area_id)
 values(v_app,p_trade,p_area)
 returning id into v_offer;
 insert into public.network_audit_events(actor_id,action,application_id,detail)
 values(auth.uid(),'vacancy_offered',v_app,
  jsonb_build_object('offer_id',v_offer,'active_slots',v_slots,'reserved_slots_before',v_reserved));
 return v_offer;
end $$;
revoke all on function public.offer_next_professional(uuid,uuid) from public,anon;
grant execute on function public.offer_next_professional(uuid,uuid) to authenticated;
commit;