ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS occupancy_status text NOT NULL DEFAULT 'vacant'
CHECK (occupancy_status IN ('occupied', 'vacant'));

GRANT UPDATE (occupancy_status) ON TABLE public.rooms TO anon;

DROP POLICY IF EXISTS "Anon can update room occupancy" ON public.rooms;

CREATE POLICY "Anon can update room occupancy"
ON public.rooms
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
