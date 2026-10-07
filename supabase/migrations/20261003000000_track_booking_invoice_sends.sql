ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz;
