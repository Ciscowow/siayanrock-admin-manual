ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS special_requests_noted boolean NOT NULL DEFAULT false;
