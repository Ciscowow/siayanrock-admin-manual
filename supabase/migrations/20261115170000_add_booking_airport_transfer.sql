ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS airport_transfer_vehicle_type text,
  ADD COLUMN IF NOT EXISTS airport_transfer_price numeric(10, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_airport_transfer_vehicle_type_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_airport_transfer_vehicle_type_check
      CHECK (airport_transfer_vehicle_type IS NULL OR airport_transfer_vehicle_type IN ('van', 'tricycle'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_airport_transfer_price_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_airport_transfer_price_check
      CHECK (airport_transfer_price >= 0);
  END IF;
END $$;
