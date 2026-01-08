// netlify/functions/manual-cleanup.js
// Función para limpiar datos manualmente (solo admin puede ejecutarla)

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Método no permitido' });
  }

  try {
    const { userId, daysToKeep = 7 } = JSON.parse(event.body || '{}');

    // Verificar que el usuario sea admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || user.role !== 'admin') {
      return response(403, { error: 'No autorizado. Solo administradores pueden limpiar datos.' });
    }

    // Calcular fecha límite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const dateString = cutoffDate.toISOString().split('T')[0];

    // Contar registros antes de eliminar
    const { count: timeCountBefore } = await supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true })
      .lt('date', dateString);

    const { count: taskCountBefore } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true })
      .lt('date', dateString);

    // Eliminar registros antiguos
    await supabase
      .from('time_records')
      .delete()
      .lt('date', dateString);

    await supabase
      .from('task_completions')
      .delete()
      .lt('date', dateString);

    // Contar registros restantes
    const { count: timeCountAfter } = await supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true });

    const { count: taskCountAfter } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true });

    return response(200, {
      success: true,
      message: `Datos anteriores a ${dateString} eliminados exitosamente`,
      stats: {
        cutoffDate: dateString,
        daysKept: daysToKeep,
        deleted: {
          timeRecords: timeCountBefore,
          taskCompletions: taskCountBefore
        },
        remaining: {
          timeRecords: timeCountAfter,
          taskCompletions: taskCountAfter
        }
      }
    });

  } catch (error) {
    console.error('Error en limpieza manual:', error);
    return response(500, { error: 'Error durante la limpieza', details: error.message });
  }
};