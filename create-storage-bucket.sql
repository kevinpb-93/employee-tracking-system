-- Crear bucket público para archivos del chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir subidas autenticadas
CREATE POLICY "Permitir upload de archivos de chat"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-uploads');

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública de archivos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-uploads');

-- Política para permitir actualizaciones
CREATE POLICY "Permitir actualización de archivos de chat"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-uploads');

-- Política para permitir eliminación
CREATE POLICY "Permitir eliminación de archivos de chat"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-uploads');
