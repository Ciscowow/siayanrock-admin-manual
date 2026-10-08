CREATE OR REPLACE FUNCTION public.delete_booking_with_history(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_booking_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in as an admin to delete a booking'
      USING ERRCODE = '42501';
  END IF;

  SELECT id
  INTO target_booking_id
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  DELETE FROM public.payments
  WHERE booking_id = target_booking_id;

  DELETE FROM public.booking_room_changes
  WHERE booking_id = target_booking_id;

  DELETE FROM public.bookings
  WHERE id = target_booking_id;

  RETURN target_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_booking_with_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_booking_with_history(uuid) TO authenticated;
