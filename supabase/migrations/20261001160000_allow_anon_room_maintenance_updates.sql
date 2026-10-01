GRANT UPDATE (is_active, maintenance_status, maintenance_note)
ON TABLE public.rooms TO anon;

DROP POLICY IF EXISTS "Anon can update room maintenance" ON public.rooms;

CREATE POLICY "Anon can update room maintenance"
ON public.rooms
AS PERMISSIVE
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
