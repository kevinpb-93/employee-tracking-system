import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async (req, context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const conversationId = url.searchParams.get('conversationId');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let finalConversationId = conversationId;

    // Si no se proporciona conversationId, buscar la conversación del usuario
    if (!finalConversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!conv) {
        return new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      finalConversationId = conv.id;
    }

    // Obtener mensajes
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        task:tasks(id, name),
        reply_to:reply_to_message_id(id, content, sender_type),
        sender:users(id, name)
      `)
      .eq('conversation_id', finalConversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};