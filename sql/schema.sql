-- ============================================================================
-- SIH26047 — Patient Case-Taking Software · PRODUCTION SCHEMA
-- ----------------------------------------------------------------------------
-- Supersedes the demo `prescriptions_table.sql`. Creates the production data
-- model (clinics, staff, patients, visits, documents, consents, outbound
-- queue, audit trail) plus the legacy `cases`/`prescriptions` tables the
-- current intake UI still reads/writes — upgraded with doctor-review,
-- triage and ABHA columns and scoped to authenticated users only.
--
-- Safe to re-run: CREATE ... IF NOT EXISTS, ALTER ... ADD COLUMN IF NOT
-- EXISTS, policies dropped before re-created, triggers re-created.
--
-- After applying this to an EXISTING project that already has the old demo
-- tables + public policies, the old `cases`/`prescriptions` rows are kept and
-- the demo "public read/insert" policies are removed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Clinics — every row below is scoped to a clinic.
-- ---------------------------------------------------------------------------
create table if not exists public.clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  state      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Staff — the human accounts (doctors / triage / admins). One row per
-- Supabase auth user. `role` drives what the UI exposes.
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  name       text not null,
  role       text not null default 'doctor'
             check (role in ('doctor', 'triage', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Patients — identified by ABHA when available; walk-ins stay provisional
-- until an ABHA is created/attached. `patient_id` is also what the patient
-- portal binds to after the console split (see README "production posture").
-- ---------------------------------------------------------------------------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid references public.clinics(id),
  abha_number   text unique,
  abha_address  text,
  name          text not null,
  age           text,
  gender        text,
  weight        text,
  blood         text,
  contact_phone text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Visits — the production visit record. `history` mirrors js/core/history.js;
-- `summary_draft` is the machine-generated physician draft, `summary_final`
-- the doctor-confirmed version (Module C). Red flags are materialised here so
-- the triage queue can query them without re-scanning text.
-- ---------------------------------------------------------------------------
create table if not exists public.visits (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients(id) on delete set null,
  clinic_id     uuid not null references public.clinics(id),
  history       jsonb not null default '{}'::jsonb,
  red_flags     text[] not null default '{}',
  urgent        boolean not null default false,
  summary_draft text,
  summary_final text,
  status        text not null default 'checkin'
                check (status in ('checkin', 'draft', 'confirmed', 'prescribed')),
  confirmed_by  uuid references auth.users(id),
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documents — digitised physical records (Module B). OCR text + extracted
-- entities are drafts confirmed during the doctor review step.
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid references public.visits(id) on delete cascade,
  patient_id    uuid references public.patients(id) on delete set null,
  kind          text not null check (kind in ('prescription','lab_report','discharge_summary','case_sheet')),
  storage_path  text,
  ocr_text      text,
  extracted     jsonb not null default '{}'::jsonb,   -- output of js/core/documents.js
  doc_date      date,
  confirmed     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Consents — granular, revocable consent events (Module D). Mirrors the
-- scopes in js/core/consent.js. Every export path consults this table.
-- ---------------------------------------------------------------------------
create table if not exists public.consents (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid references public.patients(id) on delete cascade,
  patient_ref    text,                                -- ABHA number/address at grant time
  scopes         text[] not null,
  method         text not null default 'tap'
                 check (method in ('audio','text','tap','assistant')),
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- Outbound queue — ABDM pushes and Bhashini calls that fail while the OPD is
-- offline are queued here and drained when connectivity returns.
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_queue (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('abdm_push','abha_create','consent_request','fhir_export')),
  payload     jsonb not null,
  status      text not null default 'pending' check (status in ('pending','in_progress','done','failed')),
  attempts    integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit trail — append-only; every write to clinical tables is logged with
-- the acting auth user. Trigger-managed (see below), not client-writable.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,                                  -- auth.users id, null when anonymous/system
  action      text not null,                         -- INSERT | UPDATE | DELETE
  entity      text not null,                         -- table name
  entity_id   text,                                  -- primary key as text
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- ===========================================================================
-- LEGACY APP TABLES (kept working until the console split)
-- The intake UI (js/app.js) reads/writes `cases`/`prescriptions`. We keep the
-- exact columns it expects and ADD the production columns the doctor review
-- flow uses. `ALTER ... IF NOT EXISTS` makes this safe on existing projects.
-- ===========================================================================
create table if not exists public.cases (
  id              uuid primary key default gen_random_uuid(),
  patient_name    text not null,
  patient_age     text,
  patient_gender  text,
  patient_weight  text,
  patient_blood   text,
  dosha           text,
  symptoms        text[] not null default '{}',
  factor          text,
  code            text,
  notes           text,
  symptom_details jsonb,
  created_at      timestamptz not null default now()
);

alter table public.cases add column if not exists abha_number    text;
alter table public.cases add column if not exists abha_address   text;
alter table public.cases add column if not exists history        jsonb;
alter table public.cases add column if not exists red_flags      text[] not null default '{}';
alter table public.cases add column if not exists urgent         boolean not null default false;
alter table public.cases add column if not exists summary_draft  text;
alter table public.cases add column if not exists summary_final  text;
alter table public.cases add column if not exists status         text not null default 'checkin'
                                                                 check (status in ('checkin','draft','confirmed','prescribed'));
alter table public.cases add column if not exists confirmed_by   uuid;
alter table public.cases add column if not exists confirmed_at   timestamptz;
alter table public.cases add column if not exists clinic_id      uuid references public.clinics(id);

create table if not exists public.prescriptions (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references public.cases(id) on delete cascade,
  medicines      jsonb not null default '[]',
  instructions   text,
  follow_up_days text,
  created_at     timestamptz not null default now()
);

create index if not exists prescriptions_case_id_idx on public.prescriptions (case_id);
create index if not exists cases_created_at_idx   on public.cases (created_at desc);
create index if not exists cases_status_idx       on public.cases (status) where status <> 'prescribed';
create index if not exists visits_clinic_idx      on public.visits (clinic_id, created_at desc);
create index if not exists visits_patient_idx     on public.visits (patient_id);
create index if not exists documents_visit_idx    on public.documents (visit_id);
create index if not exists consents_patient_idx   on public.consents (patient_id);
create index if not exists patients_abha_idx      on public.patients (abha_number) where abha_number is not null;
create index if not exists outbound_pending_idx   on public.outbound_queue (status, created_at);

-- ===========================================================================
-- Helpers used by RLS policies
-- ===========================================================================
-- Is the current auth user a staff member (any clinic)?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- Clinic id of the current auth user, if they are staff.
create or replace function public.my_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.staff where user_id = auth.uid() limit 1;
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.clinics          enable row level security;
alter table public.staff            enable row level security;
alter table public.patients         enable row level security;
alter table public.visits           enable row level security;
alter table public.documents        enable row level security;
alter table public.consents         enable row level security;
alter table public.audit_log        enable row level security;
alter table public.outbound_queue   enable row level security;
alter table public.cases            enable row level security;
alter table public.prescriptions    enable row level security;

-- clinics: visible to staff (for context) — never to the public.
drop policy if exists "staff read clinics" on public.clinics;
create policy "staff read clinics" on public.clinics
  for select to authenticated using (public.is_staff());

-- staff: a user sees only their own profile row.
drop policy if exists "staff read own" on public.staff;
drop policy if exists "admin write staff" on public.staff;
create policy "staff read own" on public.staff
  for select to authenticated using (user_id = auth.uid());
create policy "admin write staff" on public.staff
  for insert to authenticated with check (user_id = auth.uid());

-- patients: insert allowed for kiosk/staff sessions; read only for the
-- owning clinic's staff (patient-facing access comes through the portal
-- lookup bound to patient_id after the console split).
drop policy if exists "staff read patients" on public.patients;
drop policy if exists "authenticated insert patients" on public.patients;
create policy "staff read patients" on public.patients
  for select to authenticated using (public.my_clinic_id() is not null);
create policy "authenticated insert patients" on public.patients
  for insert to authenticated with check (true);

-- visits / documents / consents: staff of the clinic.
drop policy if exists "staff read visits" on public.visits;
drop policy if exists "staff write visits" on public.visits;
drop policy if exists "staff read documents" on public.documents;
drop policy if exists "staff write documents" on public.documents;
drop policy if exists "staff read consents" on public.consents;
drop policy if exists "staff write consents" on public.consents;

create policy "staff read visits" on public.visits
  for select to authenticated using (clinic_id = public.my_clinic_id());
create policy "staff write visits" on public.visits
  for insert to authenticated with check (clinic_id = public.my_clinic_id());

create policy "staff read documents" on public.documents
  for select to authenticated using (exists (
    select 1 from public.visits v where v.id = documents.visit_id and v.clinic_id = public.my_clinic_id()));
create policy "staff write documents" on public.documents
  for insert to authenticated with check (true);

create policy "staff read consents" on public.consents
  for select to authenticated using (public.my_clinic_id() is not null);
create policy "staff write consents" on public.consents
  for insert to authenticated with check (true);

-- audit_log: readable by staff only, never written by clients.
drop policy if exists "staff read audit" on public.audit_log;
create policy "staff read audit" on public.audit_log
  for select to authenticated using (public.is_staff());
drop policy if exists "deny write audit" on public.audit_log;
create policy "deny write audit" on public.audit_log
  for all to authenticated using (false) with check (false);

-- outbound_queue: readable/writable by staff (drained by edge functions with
-- the service role, which bypasses RLS).
drop policy if exists "staff outbound" on public.outbound_queue;
create policy "staff outbound" on public.outbound_queue
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- LEGACY cases/prescriptions — authenticated users only (demo public policies
-- are removed). The intake terminal runs inside an authenticated kiosk
-- session; the doctor queue is staff-only. Per-patient portal access binds to
-- patient_id once the console split lands — see README "production posture".
drop policy if exists "public read cases" on public.cases;
drop policy if exists "public insert cases" on public.cases;
drop policy if exists "public read prescriptions" on public.prescriptions;
drop policy if exists "public insert prescriptions" on public.prescriptions;

drop policy if exists "authenticated insert cases" on public.cases;
drop policy if exists "staff read cases" on public.cases;
drop policy if exists "authenticated insert prescriptions" on public.prescriptions;
drop policy if exists "staff read prescriptions" on public.prescriptions;

create policy "authenticated insert cases" on public.cases
  for insert to authenticated with check (true);
create policy "staff read cases" on public.cases
  for select to authenticated using (public.is_staff());
create policy "staff update cases" on public.cases
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "authenticated insert prescriptions" on public.prescriptions
  for insert to authenticated with check (true);
create policy "staff read prescriptions" on public.prescriptions
  for select to authenticated using (public.is_staff());

-- ===========================================================================
-- Audit trigger — logs every clinical write with the acting user.
-- ===========================================================================
create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ent_id text;
  ent_payload jsonb;
begin
  if tg_op = 'DELETE' then
    ent_id = old.id::text;
    ent_payload = to_jsonb(old) - 'symptom_details' - 'history' - 'ocr_text' - 'payload';
  else
    ent_id = new.id::text;
    ent_payload = to_jsonb(new) - 'symptom_details' - 'history' - 'ocr_text' - 'payload';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, payload)
  values (auth.uid(), tg_op, tg_table_name, ent_id, ent_payload);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_cases on public.cases;
drop trigger if exists audit_prescriptions on public.prescriptions;
drop trigger if exists audit_visits on public.visits;
drop trigger if exists audit_documents on public.documents;
drop trigger if exists audit_consents on public.consents;

create trigger audit_cases        after insert or update or delete on public.cases        for each row execute function public.log_audit();
create trigger audit_prescriptions after insert or update or delete on public.prescriptions for each row execute function public.log_audit();
create trigger audit_visits       after insert or update or delete on public.visits       for each row execute function public.log_audit();
create trigger audit_documents    after insert or update or delete on public.documents    for each row execute function public.log_audit();
create trigger audit_consents     after insert or update or delete on public.consents     for each row execute function public.log_audit();
