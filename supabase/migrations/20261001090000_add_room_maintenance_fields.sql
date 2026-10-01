ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS maintenance_status boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS maintenance_note text;

GRANT UPDATE (room_name, room_type, room_price, max_guests, description)
ON TABLE public.rooms TO anon;

GRANT UPDATE (is_active, maintenance_status, maintenance_note)
ON TABLE public.rooms TO anon;
