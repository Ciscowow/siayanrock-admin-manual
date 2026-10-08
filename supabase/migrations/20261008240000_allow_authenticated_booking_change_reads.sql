GRANT SELECT ON TABLE public.booking_room_changes TO authenticated;

DROP POLICY IF EXISTS "Authenticated admins can read booking room changes"
  ON public.booking_room_changes;

CREATE POLICY "Authenticated admins can read booking room changes"
  ON public.booking_room_changes
  FOR SELECT
  TO authenticated
  USING (true);
