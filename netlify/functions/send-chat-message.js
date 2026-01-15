const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB por archivo

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  try {
    const {
      conversationId,
      senderId,
      senderType,
      content,
      messageType = 'text',
      mediaData,
      mediaFilename,
      replyToMessageId,
      taskId
    } = JSON.parse(event.body);

    // Validaciones
    if (!conversationId || !senderId || !senderType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Faltan campos requeridos'
        })
      };
    }

    if (!['text', 'image', 'video'].includes(messageType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Tipo de mensaje inválido'
        })
      };
    }

    // Objeto del mensaje
    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      sender_type: senderType,
      message_type: messageType,
      content: content || null,
      reply_to_message_id: replyToMessageId || null,
      task_id: taskId || null
    };

    // Si hay archivo multimedia
    if (mediaData && (messageType === 'image' || messageType === 'video')) {
      // Validar tamaño
      const mediaSize = Buffer.byteLength(mediaData, 'base64');
      
      if (mediaSize > MAX_FILE_SIZE) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`
          })
        };
      }

      // Generar nombre único
      const timestamp = Date.now();
      const ext = messageType === 'image' ? 'jpg' : 'mp4';
      const filename = mediaFilename || `${messageType}_${timestamp}.${ext}`;
      const filepath = `chat/${conversationId}/${filename}`;

      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filepath, Buffer.from(mediaData, 'base64'), {
          contentType: messageType === 'image' ? 'image/jpeg' : 'video/mp4',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filepath);

      messageData.media_url = urlData.publicUrl;
      messageData.media_filename = filename;
      messageData.media_size = mediaSize;
    }

    // Insertar mensaje
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert([messageData])
      .select(`
        *,
        reply_to:reply_to_message_id(id, content, sender_type),
        task:task_id(id, name)
      `)
      .single();

    if (insertError) throw insertError;

    // El trigger de la BD actualiza automáticamente la conversación

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: { message }
      })
    };

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error al enviar mensaje'
      })
    };
  }
};