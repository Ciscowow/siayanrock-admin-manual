CREATE TABLE IF NOT EXISTS public.booking_room_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_room_id integer NOT NULL REFERENCES public.rooms(id),
  new_room_id integer NOT NULL REFERENCES public.rooms(id),
  previous_total numeric(10, 2) NOT NULL CHECK (previous_total >= 0),
  new_total numeric(10, 2) NOT NULL CHECK (new_total >= 0),
  paid_at_change numeric(10, 2) NOT NULL DEFAULT 0 CHECK (paid_at_change >= 0),
  credit_amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  credit_returned boolean NOT NULL DEFAULT false,
  credit_returned_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_room_changes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.booking_room_changes TO anon;
GRANT UPDATE (credit_returned, credit_returned_at) ON public.booking_room_changes TO anon;

DROP POLICY IF EXISTS "Anon can read booking room changes" ON public.booking_room_changes;
CREATE POLICY "Anon can read booking room changes"
ON public.booking_room_changes
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon can record booking room changes" ON public.booking_room_changes;
CREATE POLICY "Anon can record booking room changes"
ON public.booking_room_changes
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update booking room change credits" ON public.booking_room_changes;
CREATE POLICY "Anon can update booking room change credits"
ON public.booking_room_changes
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.change_booking_room(
  p_booking_id uuid,
  p_new_room_id integer,
  p_new_total numeric,
  p_note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.change_booking_room(uuid, integer, numeric, text) TO anon;
