-- Generated Nob profile pictures, scoped to the signed-in user.
create table if not exists pfps (
  id serial primary key,
  user_id text not null,
  source_url text,
  image_data text not null,
  created_at timestamptz not null default now()
);
create index if not exists pfps_user_id_idx on pfps (user_id);
