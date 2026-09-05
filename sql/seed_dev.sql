-- ============================================================================
-- SIH26047 — dev seed (run AFTER sql/schema.sql in a Supabase SQL editor)
-- ----------------------------------------------------------------------------
-- Creates one demo clinic and links the auth user whose email you provide to
-- it as a doctor. Replace 'doctor@example.com' with a real Supabase auth user
-- email (create the user through the app's login screen first). Safe to re-run.
-- ============================================================================

insert into public.clinics (name, state)
select 'AIIA OPD Demo Clinic', 'Delhi'
where not exists (select 1 from public.clinics where name = 'AIIA OPD Demo Clinic');

insert into public.staff (user_id, clinic_id, name, role)
select
  u.id,
  c.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', 'Demo Doctor'),
  'doctor'
from auth.users u
cross join public.clinics c
where u.email = 'dynamoaditya.m716@gmail.com'          -- ← replace with your auth email
  and c.name = 'AIIA OPD Demo Clinic'
on conflict (user_id) do nothing;
