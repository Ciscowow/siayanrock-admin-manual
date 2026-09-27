CREATE OR REPLACE FUNCTION public.delete_guest_with_history(p_guest_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_guest_id uuid;
  booking_ids uuid[];
BEGIN
  SELECT id
  INTO target_guest_id
  FROM public.guests
  WHERE id = p_guest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest not found';
  END IF;

  SELECT array_agg(id)
  INTO booking_ids
  FROM public.bookings
  WHERE guest_id = p_guest_id;

  IF booking_ids IS NOT NULL THEN
    DELETE FROM public.payments
    WHERE booking_id = ANY(booking_ids);

    DELETE FROM public.booking_room_changes
    WHERE booking_id = ANY(booking_ids);

    DELETE FROM public.bookings
    WHERE id = ANY(booking_ids);
  END IF;

  DELETE FROM public.guests
  WHERE id = target_guest_id;

  RETURN target_guest_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_guest_with_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_guest_with_history(uuid) TO anon;
