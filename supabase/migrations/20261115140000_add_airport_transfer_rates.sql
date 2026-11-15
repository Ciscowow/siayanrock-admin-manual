CREATE TABLE IF NOT EXISTS public.airport_transfer_rates (
  vehicle_type text PRIMARY KEY CHECK (vehicle_type IN ('van', 'tricycle')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0)
);

INSERT INTO public.airport_transfer_rates (vehicle_type, price)
VALUES ('van', 1170), ('tricycle', 480)
ON CONFLICT (vehicle_type) DO NOTHING;

ALTER TABLE public.airport_transfer_rates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.airport_transfer_rates TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'airport_transfer_rates'
      AND policyname = 'Authenticated admins can read airport transfer rates'
  ) THEN
    CREATE POLICY "Authenticated admins can read airport transfer rates"
      ON public.airport_transfer_rates
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'airport_transfer_rates'
      AND policyname = 'Authenticated admins can insert airport transfer rates'
  ) THEN
    CREATE POLICY "Authenticated admins can insert airport transfer rates"
      ON public.airport_transfer_rates
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'airport_transfer_rates'
      AND policyname = 'Authenticated admins can update airport transfer rates'
  ) THEN
    CREATE POLICY "Authenticated admins can update airport transfer rates"
      ON public.airport_transfer_rates
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;
