const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // Configurar CORS
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
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId es requerido' })
      };
    }

    // Verificar si ya existe una conversación
    const { data: existingConv, error: checkError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingConv) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { conversation: existingConv, isNew: false }
        })
      };
    }

    // Crear nueva conversación
    const { data: newConv, error: insertError } = await supabase
      .from('conversations')
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: { conversation: newConv, isNew: true }
      })
    };

  } catch (error) {
    console.error('Error al crear conversación:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error al crear conversación'
      })
    };
  }
};