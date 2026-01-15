const { createClient } = require('@supabase/supabase-js');
const { schedule } = require('@netlify/functions');

const supabaseUrl = process.env.SUPABASE_URL;
// IMPORTANTE: Usar SERVICE_KEY para tener permisos de administración (borrar archivos y registros de otros)
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler = async (event, context) => {
  console.log('🗑️ Iniciando limpieza automática diaria...');

  try {
    const now = new Date();

    // --- LIMPIEZA DE REGISTROS ANTIGUOS (7 DÍAS) ---
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDateRecords = sevenDaysAgo.toISOString().split('T')[0];

    // Eliminar registros de horarios antiguos
    await supabase.from('time_records').delete().lt('date', cutoffDateRecords);
    // Eliminar completaciones de tareas antiguas
    await supabase.from('task_completions').delete().lt('date', cutoffDateRecords);

    console.log(`✅ Registros operativos anteriores a ${cutoffDateRecords} eliminados.`);


    // --- LIMPIEZA DE CHAT (2 DÍAS) ---
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    // Para timestamps completos (created_at es timestampz)
    const cutoffTimestampChat = twoDaysAgo.toISOString();

    console.log(`📅 Buscando mensajes de chat anteriores a: ${cutoffTimestampChat}`);

    // 1. Encontrar mensajes antiguos que tengan archivos multimedia para borrarlos del Storage
    // Seleccionamos solo los que tienen media_url NO nulo y son viejos
    const { data: oldMediaMessages, error: findError } = await supabase
      .from('messages')
      .select('media_url')
      .lt('created_at', cutoffTimestampChat)
      .not('media_url', 'is', null);

    if (findError) {
      console.error('❌ Error buscando mensajes antiguos:', findError);
    } else if (oldMediaMessages && oldMediaMessages.length > 0) {
      console.log(`📎 Encontrados ${oldMediaMessages.length} archivos para eliminar.`);

      // Extraer los paths de los archivos desde la URL pública
      // Formato típico URL: .../storage/v1/object/public/chat-uploads/chat-media/123/file.jpg
      const filesToDelete = oldMediaMessages.map(msg => {
        // Buscamos la parte después de 'chat-uploads/'
        const urlParts = msg.media_url.split('/chat-uploads/');
        if (urlParts.length > 1) {
          return urlParts[1]; // Retorna ej: "chat-media/123/file.jpg"
        }
        return null;
      }).filter(path => path !== null);

      if (filesToDelete.length > 0) {
        // Borrar archivos del bucket 'chat-uploads'
        const { error: storageError } = await supabase
          .storage
          .from('chat-uploads')
          .remove(filesToDelete);

        if (storageError) {
          console.error('❌ Error eliminando archivos del Storage:', storageError);
        } else {
          console.log(`🗑️ ${filesToDelete.length} archivos eliminados físicamente del Storage.`);
        }
      }
    }

    // 2. Eliminar TODOS los mensajes antiguos de la base de datos
    const { count: deletedMessagesCount, error: deleteMsgError } = await supabase
      .from('messages')
      .delete({ count: 'exact' }) // Pedir conteo de eliminados
      .lt('created_at', cutoffTimestampChat);

    if (deleteMsgError) {
      console.error('❌ Error eliminando registros de mensajes:', deleteMsgError);
    } else {
      console.log(`✅ ${deletedMessagesCount || 'Varios'} mensajes eliminados de la base de datos.`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Limpieza diaria completada exitosamente'
      })
    };

  } catch (error) {
    console.error('💥 Error crítico durante la limpieza:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

// Programar para ejecutarse diariamente (medianoche)
exports.handler = schedule('@daily', handler);