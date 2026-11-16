ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tour_package_price numeric(10, 2)
    CHECK (tour_package_price IS NULL OR tour_package_price >= 0);
