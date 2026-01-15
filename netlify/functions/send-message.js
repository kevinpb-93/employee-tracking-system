import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { 
      userId, 
      senderType, 
      content, 
      messageType = 'text',
      taskId = null,
      replyToMessageId = null,
      conversationId = null 
    } = await req.json();

    // Validar datos requeridos
    if (!userId || !senderType) {
      return new Response(JSON.stringify({ error: 'Faltan datos requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let finalConversationId = conversationId;

    // Si no existe conversación, crear una
    if (!finalConversationId) {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingConv) {
        finalConversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ user_id: userId })
          .select()
          .single();

        if (convError) throw convError;
        finalConversationId = newConv.id;
      }
    }

    // Insertar mensaje
    const messageData = {
      conversation_id: finalConversationId,
      sender_id: userId,
      sender_type: senderType,
      content: content,
      message_type: messageType,
      task_id: taskId,
      reply_to_message_id: replyToMessageId
    };

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (msgError) throw msgError;

    return new Response(JSON.stringify({ 
      success: true, 
      message,
      conversationId: finalConversationId 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};