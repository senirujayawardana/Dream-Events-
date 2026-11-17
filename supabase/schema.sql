create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('concerts', 'festivals', 'corporate', 'weddings', 'other')),
  event_date date not null,
  venue text not null check (char_length(venue) between 1 and 160),
  description text not null check (char_length(description) between 1 and 1200),
  ticket_url text not null default '',
  image_url text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 120),
  organization text not null default '',
  quote text not null check (char_length(quote) between 1 and 1200),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  website_url text not null default '',
  logo_url text not null check (char_length(logo_url) between 1 and 2048),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reservation', 'event', 'sponsor')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text,
  package_name text,
  event_type text,
  event_start_date date,
  event_end_date date,
  preferred_date date,
  venue text,
  guest_count integer check (guest_count > 0),
  organization text,
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.inquiries
  add column if not exists guest_count integer check (guest_count > 0);

create index if not exists events_published_date_idx
  on public.events (event_date)
  where is_published = true;
create index if not exists inquiries_created_at_idx
  on public.inquiries (created_at desc);

alter table public.events enable row level security;
alter table public.testimonials enable row level security;
alter table public.sponsors enable row level security;
alter table public.inquiries enable row level security;

revoke all on public.events, public.testimonials, public.sponsors, public.inquiries from anon, authenticated;
grant usage on schema public to service_role;
grant all on public.events, public.testimonials, public.sponsors, public.inquiries to service_role;
