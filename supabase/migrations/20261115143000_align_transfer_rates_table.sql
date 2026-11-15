DO $$
BEGIN
  IF to_regclass('public.transfer_rates') IS NULL
     AND to_regclass('public.airport_transfer_rates') IS NOT NULL THEN
    ALTER TABLE public.airport_transfer_rates RENAME TO transfer_rates;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transfer_rates (
  vehicle_type text PRIMARY KEY CHECK (vehicle_type IN ('van', 'tricycle')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS transfer_rates_vehicle_type_uidx
  ON public.transfer_rates (vehicle_type);

INSERT INTO public.transfer_rates (vehicle_type, price)
VALUES ('van', 1170), ('tricycle', 480)
ON CONFLICT (vehicle_type) DO NOTHING;

ALTER TABLE public.transfer_rates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transfer_rates TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transfer_rates'
      AND policyname = 'Authenticated admins can read transfer rates'
  ) THEN
    CREATE POLICY "Authenticated admins can read transfer rates"
      ON public.transfer_rates
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transfer_rates'
      AND policyname = 'Authenticated admins can insert transfer rates'
  ) THEN
    CREATE POLICY "Authenticated admins can insert transfer rates"
      ON public.transfer_rates
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transfer_rates'
      AND policyname = 'Authenticated admins can update transfer rates'
  ) THEN
    CREATE POLICY "Authenticated admins can update transfer rates"
      ON public.transfer_rates
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
