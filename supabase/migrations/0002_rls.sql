-- CityBee RLS policies — Phase 3 (security)
-- Public/guest reads of approved content; users own their rows; owners manage
-- their businesses; admins manage everything. The NestJS API uses the
-- service-role key (bypasses RLS) for admin and cross-user operations.

-- Helper: is the current user an admin?
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- Helper: does the current user own this business?
create or replace function public.owns_business(b uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses b2
    where b2.id = b and b2.owner_id = auth.uid()
  );
$$;

-- ── users ────────────────────────────────────────────────────────────────
create policy users_read_self on public.users
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

-- ── cities / categories ──────────────────────────────────────────────────
create policy cities_public_read on public.cities
  for select to anon, authenticated using (true);
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin_write on public.categories
  for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.categories
  for update to authenticated using (public.is_admin());

-- ── businesses + relations ───────────────────────────────────────────────
create policy businesses_public_read on public.businesses
  for select to anon, authenticated
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());
create policy businesses_owner_insert on public.businesses
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());
create policy businesses_owner_update on public.businesses
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy businesses_owner_delete on public.businesses
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

create policy business_categories_public_read on public.business_categories
  for select to anon, authenticated using (true);
create policy business_categories_owner_write on public.business_categories
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy business_categories_owner_delete on public.business_categories
  for delete to authenticated using (public.owns_business(business_id) or public.is_admin());

-- Images are visible whenever their business is approved (kept simple: read
-- for all; write requires ownership).
create policy business_images_public_read on public.business_images
  for select to anon, authenticated using (true);
create policy business_images_owner_write on public.business_images
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy business_images_owner_delete on public.business_images
  for delete to authenticated using (public.owns_business(business_id) or public.is_admin());

-- ── offers + images ──────────────────────────────────────────────────────
create policy offers_public_read on public.offers
  for select to anon, authenticated using (
    status = 'active'
    or public.owns_business(business_id)
    or public.is_admin()
  );
create policy offers_owner_insert on public.offers
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy offers_owner_update on public.offers
  for update to authenticated
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());
create policy offers_owner_delete on public.offers
  for delete to authenticated using (public.owns_business(business_id) or public.is_admin());

create policy offer_images_public_read on public.offer_images
  for select to anon, authenticated using (true);
create policy offer_images_owner_write on public.offer_images
  for insert to authenticated with check (
    public.owns_business((select business_id from public.offers o where o.id = offer_id))
    or public.is_admin()
  );
create policy offer_images_owner_delete on public.offer_images
  for delete to authenticated using (
    public.owns_business((select business_id from public.offers o where o.id = offer_id))
    or public.is_admin()
  );

-- ── business extension tables (doctors/restaurants/hotels) ───────────────
create policy doctors_public_read on public.doctors
  for select to anon, authenticated using (true);
create policy doctors_owner_write on public.doctors
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy doctors_owner_update on public.doctors
  for update to authenticated
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

create policy restaurants_public_read on public.restaurants
  for select to anon, authenticated using (true);
create policy restaurants_owner_write on public.restaurants
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy restaurants_owner_update on public.restaurants
  for update to authenticated
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

create policy hotels_public_read on public.hotels
  for select to anon, authenticated using (true);
create policy hotels_owner_write on public.hotels
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy hotels_owner_update on public.hotels
  for update to authenticated
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

create policy hotel_amenities_public_read on public.hotel_amenities
  for select to anon, authenticated using (true);
create policy hotel_amenities_owner_write on public.hotel_amenities
  for insert to authenticated with check (
    public.owns_business((select business_id from public.hotels h where h.id = hotel_id))
    or public.is_admin()
  );
create policy hotel_amenities_owner_delete on public.hotel_amenities
  for delete to authenticated using (
    public.owns_business((select business_id from public.hotels h where h.id = hotel_id))
    or public.is_admin()
  );

-- ── menu items ───────────────────────────────────────────────────────────
create policy menu_items_public_read on public.menu_items
  for select to anon, authenticated using (true);
create policy menu_items_owner_write on public.menu_items
  for insert to authenticated with check (public.owns_business(business_id) or public.is_admin());
create policy menu_items_owner_delete on public.menu_items
  for delete to authenticated using (public.owns_business(business_id) or public.is_admin());

-- ── places + images ──────────────────────────────────────────────────────
create policy places_public_read on public.places
  for select to anon, authenticated using (is_active or public.is_admin());
create policy places_admin_write on public.places
  for insert to authenticated with check (public.is_admin());
create policy places_admin_update on public.places
  for update to authenticated using (public.is_admin());

create policy place_images_public_read on public.place_images
  for select to anon, authenticated using (true);
create policy place_images_admin_write on public.place_images
  for insert to authenticated with check (public.is_admin());
create policy place_images_admin_delete on public.place_images
  for delete to authenticated using (public.is_admin());

-- ── favorites (own rows only) ────────────────────────────────────────────
create policy favorites_own_read on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy favorites_own_insert on public.favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy favorites_own_delete on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- ── reviews ──────────────────────────────────────────────────────────────
create policy reviews_public_read on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy reviews_own_insert on public.reviews
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy reviews_own_update on public.reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── notifications (own rows; broadcast rows readable by all) ──────────────
create policy notifications_own_read on public.notifications
  for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy notifications_own_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── business claims ──────────────────────────────────────────────────────
create policy business_claims_own_insert on public.business_claims
  for insert to authenticated with check (user_id = auth.uid());
create policy business_claims_own_read on public.business_claims
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
