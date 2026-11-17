alter table public.inquiries
  add column if not exists guest_count integer check (guest_count > 0);
