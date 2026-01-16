-- Create a storage bucket for products if it doesn't exist
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Set up access policies for the products bucket
-- 1. Allow public read access to all files in the products bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'products' );

-- 2. Allow authenticated users to upload files to the products bucket
create policy "Authenticated Upload"
on storage.objects for insert
with check (
  bucket_id = 'products' 
  and auth.role() = 'authenticated'
);

-- 3. Allow users to update/delete their own uploads (or admins to manage everything)
create policy "Manage Own Objects"
on storage.objects for all
using (
  bucket_id = 'products' 
  and (auth.uid() = owner or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'founder'
  ))
);
