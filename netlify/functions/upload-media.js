import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime']
};

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const senderId = formData.get('senderId');
    const conversationId = formData.get('conversationId');
    const senderType = formData.get('senderType');
    const content = formData.get('content') || null;
    const taskId = formData.get('taskId') || null;
    const replyToMessageId = formData.get('replyToMessageId') || null;

    if (!file || !senderId || !conversationId || !senderType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Faltan datos requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({
        error: `El archivo excede el límite de ${MAX_FILE_SIZE / 1024 / 1024}MB`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar tipo
    const messageType = file.type.startsWith('image/') ? 'image' : 'video';
    if (!ALLOWED_TYPES[messageType].includes(file.type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tipo de archivo no permitido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Subir a Supabase Storage
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `chat-media/${conversationId}/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading to Supabase Storage:', uploadError);
      throw new Error('Error al subir el archivo: ' + uploadError.message);
    }

    // Obtener URL pública del archivo
    const { data: urlData } = supabase.storage
      .from('chat-uploads')
      .getPublicUrl(filePath);

    const mediaUrl = urlData.publicUrl;

    // Crear mensaje con el archivo
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_type: senderType,
        message_type: messageType,
        content: content,
        media_url: mediaUrl,
        media_filename: file.name,
        media_size: file.size,
        task_id: taskId,
        reply_to_message_id: replyToMessageId
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return new Response(JSON.stringify({
      success: true,
      data: {
        message,
        mediaUrl
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error uploading media:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};