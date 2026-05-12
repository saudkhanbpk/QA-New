-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  created_at timestamptz default now()
);

-- Test runs table
create table public.test_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  page_url text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  overall_score integer,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Test results table
create table public.test_results (
  id uuid primary key default uuid_generate_v4(),
  test_run_id uuid references public.test_runs(id) on delete cascade not null,
  category text not null,
  check_name text not null,
  status text not null check (status in ('pass','fail','warning')),
  severity text not null check (severity in ('critical','medium','low')),
  message text not null,
  fix_recommendation text,
  screenshot_url text,
  created_at timestamptz default now()
);

-- Note: Category constraint removed to allow flexible category values
-- Current categories: performance, broken_links, compatibility, security, others
-- Application-level validation handles category checking

-- Screenshots table
create table public.screenshots (
  id uuid primary key default uuid_generate_v4(),
  test_run_id uuid references public.test_runs(id) on delete cascade not null,
  viewport text not null check (viewport in ('mobile','tablet','desktop')),
  image_url text not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_results enable row level security;
alter table public.screenshots enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Test runs policies
create policy "Users can view own test runs"
  on public.test_runs for select using (auth.uid() = user_id);

create policy "Users can insert own test runs"
  on public.test_runs for insert with check (auth.uid() = user_id);

create policy "Users can update own test runs"
  on public.test_runs for update using (auth.uid() = user_id);

-- Test results policies
create policy "Users can view own test results"
  on public.test_results for select
  using (exists (
    select 1 from public.test_runs
    where test_runs.id = test_results.test_run_id
    and test_runs.user_id = auth.uid()
  ));

create policy "Users can insert own test results"
  on public.test_results for insert
  with check (exists (
    select 1 from public.test_runs
    where test_runs.id = test_results.test_run_id
    and test_runs.user_id = auth.uid()
  ));

-- Screenshots policies
create policy "Users can view own screenshots"
  on public.screenshots for select
  using (exists (
    select 1 from public.test_runs
    where test_runs.id = screenshots.test_run_id
    and test_runs.user_id = auth.uid()
  ));

create policy "Users can insert own screenshots"
  on public.screenshots for insert
  with check (exists (
    select 1 from public.test_runs
    where test_runs.id = screenshots.test_run_id
    and test_runs.user_id = auth.uid()
  ));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage bucket for screenshots
insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', true)
  on conflict do nothing;

create policy "Anyone can view screenshots"
  on storage.objects for select using (bucket_id = 'screenshots');

create policy "Authenticated users can upload screenshots"
  on storage.objects for insert
  with check (bucket_id = 'screenshots' and auth.role() = 'authenticated');
