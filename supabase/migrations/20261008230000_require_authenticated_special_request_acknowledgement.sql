CREATE OR REPLACE FUNCTION public.require_authenticated_special_request_acknowledgement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.special_requests_noted IS DISTINCT FROM OLD.special_requests_noted
    AND auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Sign in as an admin to update special request acknowledgement'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_authenticated_special_request_acknowledgement
  ON public.bookings;

CREATE TRIGGER require_authenticated_special_request_acknowledgement
  BEFORE UPDATE OF special_requests_noted ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.require_authenticated_special_request_acknowledgement();

GRANT SELECT, UPDATE ON TABLE public.bookings TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND policyname = 'Authenticated admins can read bookings'
  ) THEN
    CREATE POLICY "Authenticated admins can read bookings"
      ON public.bookings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND policyname = 'Authenticated admins can update bookings'
  ) THEN
    CREATE POLICY "Authenticated admins can update bookings"
      ON public.bookings
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;
