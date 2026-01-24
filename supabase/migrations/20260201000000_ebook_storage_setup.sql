-- Create a storage bucket for ebooks if it doesn't exist
insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false) -- Ebooks should be private
on conflict (id) do nothing;

-- Set up access policies for the ebooks bucket
-- 1. Only admins and founders can view/manage all ebooks
create policy "Admins can manage all ebooks"
on storage.objects for all
using (
  bucket_id = 'ebooks' 
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'founder')
  )
);

-- 2. Allow authenticated users to upload files to the ebooks bucket (for authors potentially)
-- But for now, let's keep it to admins only for safety unless role = 'author'
create policy "Authors can upload ebooks"
on storage.objects for insert
with check (
  bucket_id = 'ebooks' 
  and (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'founder', 'author')
    )
  )
);

-- 3. Users can only read ebooks they have purchased
-- This is complex to do purely in storage policies if we want fine-grained access.
-- Usually, we'd use a signed URL from the backend.
-- For now, let's allow read if the user is an admin or has purchased the product.
create policy "Purchasers can read ebooks"
on storage.objects for select
using (
  bucket_id = 'ebooks'
  and (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'founder')
    )
    or
    exists (
      select 1 from public.ebook_metadata em
      join public.order_items oi on oi.product_id = em.product_id
      join public.orders o on o.id = oi.order_id
      where o.user_id = auth.uid() 
      and o.status = 'completed'
      and em.file_path = storage.objects.name
    )
  )
);
