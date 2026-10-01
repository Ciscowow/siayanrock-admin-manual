CREATE OR REPLACE FUNCTION public.set_room_maintenance(
  p_room_id integer,
  p_maintenance boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_room public.rooms%ROWTYPE;
BEGIN
  IF p_room_id IS NULL OR p_maintenance IS NULL THEN
    RAISE EXCEPTION 'Room and maintenance status are required';
  END IF;

  IF p_note IS NOT NULL AND char_length(p_note) > 300 THEN
    RAISE EXCEPTION 'Maintenance note must be 300 characters or fewer';
  END IF;

  SELECT *
  INTO target_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF p_maintenance AND NOT target_room.is_active AND NOT target_room.maintenance_status THEN
    RAISE EXCEPTION 'This room is already offline';
  END IF;

  IF NOT p_maintenance AND NOT target_room.maintenance_status THEN
    RAISE EXCEPTION 'This room is not under maintenance';
  END IF;

  IF p_maintenance AND EXISTS (
    SELECT 1
    FROM public.bookings booking
    WHERE booking.room_id = p_room_id
      AND lower(booking.status) IN ('confirmed', 'reserved', 'checked_in')
      AND booking.check_in <= CURRENT_DATE
      AND booking.check_out > CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'A guest is currently checked in; maintenance cannot be started yet';
  END IF;

  UPDATE public.rooms
  SET is_active = NOT p_maintenance,
      maintenance_status = p_maintenance,
      maintenance_note = CASE WHEN p_maintenance THEN NULLIF(trim(p_note), '') ELSE NULL END
  WHERE id = p_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_maintenance(integer, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_room_maintenance(integer, boolean, text) TO anon;
