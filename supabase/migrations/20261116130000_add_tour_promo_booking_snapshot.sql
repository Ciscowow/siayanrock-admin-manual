CREATE TABLE IF NOT EXISTS public.tour_promos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  max_pax int NOT NULL,
  nights int NOT NULL CHECK (nights > 0),
  price_with_lunch numeric(10, 2) NOT NULL CHECK (price_with_lunch >= 0),
  price_without_lunch numeric(10, 2) NOT NULL CHECK (price_without_lunch >= 0),
  starts_on date,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (max_pax, nights),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

INSERT INTO public.tour_promos (max_pax, nights, price_with_lunch, price_without_lunch)
VALUES
  (2, 2, 19525, 16765),
  (2, 3, 20995, 18235),
  (2, 4, 22885, 20125),
  (2, 5, 24775, 22015)
ON CONFLICT (max_pax, nights) DO NOTHING;

ALTER TABLE public.tour_promos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tour_promos TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_promos'
      AND policyname = 'Signed-in users can read promos'
  ) THEN
    CREATE POLICY "Signed-in users can read promos"
      ON public.tour_promos FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_promos'
      AND policyname = 'Admins can manage promos'
  ) THEN
    CREATE POLICY "Admins can manage promos"
      ON public.tour_promos FOR ALL TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;
END
$$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tour_promo_id bigint
    REFERENCES public.tour_promos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tour_promo_price numeric(10, 2)
    CHECK (tour_promo_price IS NULL OR tour_promo_price >= 0),
  ADD COLUMN IF NOT EXISTS tour_promo_with_lunch boolean;
