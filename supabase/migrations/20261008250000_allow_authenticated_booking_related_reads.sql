GRANT SELECT ON TABLE public.guests, public.rooms, public.payments TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guests'
      AND policyname = 'Authenticated admins can read guests'
  ) THEN
    CREATE POLICY "Authenticated admins can read guests"
      ON public.guests
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rooms'
      AND policyname = 'Authenticated admins can read rooms'
  ) THEN
    CREATE POLICY "Authenticated admins can read rooms"
      ON public.rooms
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payments'
      AND policyname = 'Authenticated admins can read payments'
  ) THEN
    CREATE POLICY "Authenticated admins can read payments"
      ON public.payments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;
