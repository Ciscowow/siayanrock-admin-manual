CREATE OR REPLACE FUNCTION public.return_booking_overpayment(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_booking public.bookings%ROWTYPE;
  paid_total numeric(10, 2);
  overpayment_amount numeric(10, 2);
  credit_id uuid;
  returned_at timestamptz := now();
BEGIN
  SELECT *
  INTO current_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT GREATEST(
    COALESCE((
      SELECT SUM(payment.amount)
      FROM public.payments payment
      WHERE payment.booking_id = p_booking_id
        AND lower(payment.payment_status) = 'paid'
    ), 0) - COALESCE((
      SELECT SUM(room_change.credit_amount)
      FROM public.booking_room_changes room_change
      WHERE room_change.booking_id = p_booking_id
        AND room_change.credit_returned = true
    ), 0),
    0
  )
  INTO paid_total;

  overpayment_amount := paid_total - current_booking.total_price;

  IF overpayment_amount <= 0 THEN
    RAISE EXCEPTION 'This booking has no overpayment to return';
  END IF;

  INSERT INTO public.booking_room_changes (
    booking_id,
    previous_room_id,
    new_room_id,
    previous_total,
    new_total,
    paid_at_change,
    credit_amount,
    credit_returned,
    credit_returned_at,
    note,
    created_at
  )
  VALUES (
    p_booking_id,
    current_booking.room_id,
    current_booking.room_id,
    current_booking.total_price,
    current_booking.total_price,
    paid_total,
    overpayment_amount,
    true,
    returned_at,
    'Overpayment returned to guest.',
    returned_at
  )
  RETURNING id INTO credit_id;

  UPDATE public.bookings
  SET payment_status = 'fully_paid'
  WHERE id = p_booking_id;

  RETURN credit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.return_booking_overpayment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_booking_overpayment(uuid) TO anon;
