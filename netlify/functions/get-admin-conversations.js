const { createClient } = require('@supabase/supabase-js');

// Fallback: Si no hay SERVICE_KEY, intenta con ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Faltan variables de entorno SUPABASE_URL o Keys');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  console.log('Function get-admin-conversations invoked');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Método no permitido'
      })
    };
  }

  try {
    // Obtener TODOS los usuarios que son empleados
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, name, username, role')
      .eq('role', 'employee')
      .order('name');

    if (usersError) throw usersError;

    // Obtener todas las conversaciones existentes
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        last_message_at,
        unread_count_admin,
        unread_count_user,
        created_at
      `);

    if (convError) throw convError;

    // Crear un mapa de conversaciones por user_id
    const conversationsMap = new Map();
    (conversations || []).forEach(conv => {
      conversationsMap.set(conv.user_id, conv);
    });

    // Para cada usuario, crear o usar la conversación existente
    const allConversations = await Promise.all(
      (allUsers || []).map(async (user) => {
        const existingConv = conversationsMap.get(user.id);

        if (existingConv) {
          // Conversación existente - obtener último mensaje
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('id, content, message_type, sender_type, created_at')
            .eq('conversation_id', existingConv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            id: existingConv.id,
            user_id: user.id,
            last_message_at: existingConv.last_message_at,
            unread_count_admin: existingConv.unread_count_admin || 0,
            unread_count_user: existingConv.unread_count_user || 0,
            created_at: existingConv.created_at,
            user: {
              id: user.id,
              name: user.name,
              username: user.username
            },
            last_message: lastMessage || null
          };
        } else {
          // No existe conversación - crear una virtual
          return {
            id: null, // Será creada cuando envíen el primer mensaje
            user_id: user.id,
            last_message_at: null,
            unread_count_admin: 0,
            unread_count_user: 0,
            created_at: new Date().toISOString(),
            user: {
              id: user.id,
              name: user.name,
              username: user.username
            },
            last_message: null
          };
        }
      })
    );

    // Ordenar: primero los que tienen mensajes recientes, luego por nombre
    allConversations.sort((a, b) => {
      if (a.last_message_at && !b.last_message_at) return -1;
      if (!a.last_message_at && b.last_message_at) return 1;
      if (a.last_message_at && b.last_message_at) {
        return new Date(b.last_message_at) - new Date(a.last_message_at);
      }
      return a.user.name.localeCompare(b.user.name);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          conversations: allConversations
        }
      })
    };

  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error al obtener conversaciones'
      })
    };
  }
};