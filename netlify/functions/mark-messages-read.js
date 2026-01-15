const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    const { conversationId, readerType } = JSON.parse(event.body);

    if (!conversationId || !readerType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Faltan campos requeridos'
        })
      };
    }

    // Marcar mensajes como leídos
    const oppositeType = readerType === 'admin' ? 'user' : 'admin';

    const { error: updateError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('sender_type', oppositeType)
      .eq('is_read', false);

    if (updateError) throw updateError;

    // Resetear contador de no leídos
    const updateField = readerType === 'admin'
      ? 'unread_count_admin'
      : 'unread_count_user';

    const { error: convError } = await supabase
      .from('conversations')
      .update({ [updateField]: 0 })
      .eq('id', conversationId);

    if (convError) throw convError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Mensajes marcados como leídos'
      })
    };

  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error al marcar mensajes'
      })
    };
  }
};