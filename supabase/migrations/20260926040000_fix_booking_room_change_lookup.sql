CREATE OR REPLACE FUNCTION public.change_booking_room(
  p_booking_id uuid,
  p_new_room_id integer,
  p_new_total numeric,
  p_note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_booking public.bookings%ROWTYPE;
  target_room public.rooms%ROWTYPE;
  paid_total numeric(10, 2);
  change_id uuid;
  note_text text;
BEGIN
  SELECT *
  INTO current_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF lower(current_booking.status) IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Cancelled or completed bookings cannot change rooms';
  END IF;

  IF current_booking.room_id = p_new_room_id THEN
    RAISE EXCEPTION 'Choose a different room';
  END IF;

  SELECT *
  INTO target_room
  FROM public.rooms
  WHERE id = p_new_room_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected room is not active';
  END IF;

  IF COALESCE(target_room.max_guests, target_room.base_guests, 2) < current_booking.num_of_guests THEN
    RAISE EXCEPTION 'The selected room does not have enough guest capacity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings other_booking
    WHERE other_booking.room_id = p_new_room_id
      AND other_booking.id <> p_booking_id
      AND lower(other_booking.status) NOT IN ('cancelled', 'completed')
      AND other_booking.check_in < current_booking.check_out
      AND other_booking.check_out > current_booking.check_in
  ) THEN
    RAISE EXCEPTION 'The selected room is already booked for these dates';
  END IF;

  IF p_new_total < 0 THEN
    RAISE EXCEPTION 'The new booking total cannot be negative';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO paid_total
  FROM public.payments
  WHERE booking_id = p_booking_id
    AND lower(payment_status) = 'paid';

  note_text := NULLIF(trim(COALESCE(p_note, '')), '');

  INSERT INTO public.booking_room_changes (
    booking_id,
    previous_room_id,
    new_room_id,
    previous_total,
    new_total,
    paid_at_change,
    credit_amount,
    note
  )
  VALUES (
    p_booking_id,
    current_booking.room_id,
    p_new_room_id,
    current_booking.total_price,
    p_new_total,
    paid_total,
    GREATEST(paid_total - p_new_total, 0),
    COALESCE(note_text, format('Room changed from booking total %s to %s.', current_booking.total_price, p_new_total))
  )
  RETURNING id INTO change_id;

  UPDATE public.bookings
  SET room_id = p_new_room_id,
      total_price = p_new_total,
      payment_status = CASE
        WHEN p_new_total > 0 AND paid_total >= p_new_total THEN 'fully_paid'
        WHEN paid_total > 0 THEN 'partial'
        ELSE 'unpaid'
      END
  WHERE id = p_booking_id;

  RETURN change_id;
END;
$$;

REVOKE ALL ON FUNCTION public.change_booking_room(uuid, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_booking_room(uuid, integer, numeric, text) TO anon;
