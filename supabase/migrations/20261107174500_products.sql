create table if not exists public.products (
  id text primary key
    check (char_length(id) between 1 and 80),
  name jsonb not null
    check (
      jsonb_typeof(name) = 'object'
      and jsonb_typeof(name -> 'ar') = 'string'
      and jsonb_typeof(name -> 'en') = 'string'
      and char_length(name ->> 'ar') between 1 and 240
      and char_length(name ->> 'en') between 1 and 240
    ),
  origin jsonb not null
    check (
      jsonb_typeof(origin) = 'object'
      and jsonb_typeof(origin -> 'ar') = 'string'
      and jsonb_typeof(origin -> 'en') = 'string'
      and char_length(origin ->> 'ar') between 1 and 240
      and char_length(origin ->> 'en') between 1 and 240
    ),
  price numeric(10, 3) not null check (price >= 0),
  roast jsonb not null
    check (
      jsonb_typeof(roast) = 'object'
      and jsonb_typeof(roast -> 'ar') = 'string'
      and jsonb_typeof(roast -> 'en') = 'string'
    ),
  category text not null
    check (category in ('espresso', 'single', 'blend', 'drip')),
  tag jsonb not null
    check (
      jsonb_typeof(tag) = 'object'
      and jsonb_typeof(tag -> 'ar') = 'string'
      and jsonb_typeof(tag -> 'en') = 'string'
    ),
  bag_name text not null
    check (char_length(bag_name) between 1 and 40),
  weight_grams integer not null
    check (weight_grams between 1 and 10000),
  image_url text not null
    check (char_length(image_url) between 1 and 2048),
  is_best_seller boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
revoke all on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;

drop policy if exists products_read_active on public.products;
create policy products_read_active
  on public.products
  for select to anon, authenticated
  using (is_active);

create index if not exists products_active_sort_order_idx
  on public.products (sort_order, id)
  where is_active;
