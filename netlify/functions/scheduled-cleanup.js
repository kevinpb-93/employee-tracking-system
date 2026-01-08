require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Netlify ejecuta esta función según el schedule definido en netlify.toml
exports.handler = async (event, context) => {
  console.log('🗑️ Iniciando limpieza automática de datos antiguos...');
  
  try {
    // Calcular la fecha límite (hace 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
    
    console.log(`📅 Eliminando registros anteriores a: ${cutoffDate}`);
    
    // Eliminar registros de horarios antiguos
    const { data: deletedTimeRecords, error: timeError } = await supabase
      .from('time_records')
      .delete()
      .lt('date', cutoffDate);
    
    if (timeError) {
      console.error('❌ Error eliminando time_records:', timeError);
    } else {
      console.log('✅ Registros de horarios eliminados');
    }
    
    // Eliminar completaciones de tareas antiguas
    const { data: deletedTaskCompletions, error: taskError } = await supabase
      .from('task_completions')
      .delete()
      .lt('date', cutoffDate);
    
    if (taskError) {
      console.error('❌ Error eliminando task_completions:', taskError);
    } else {
      console.log('✅ Completaciones de tareas eliminadas');
    }
    
    // Contar registros restantes
    const { count: timeCount } = await supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true });
    
    const { count: taskCount } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true });
    
    const summary = {
      success: true,
      cleanupDate: new Date().toISOString(),
      cutoffDate: cutoffDate,
      remainingRecords: {
        timeRecords: timeCount,
        taskCompletions: taskCount
      },
      message: `Limpieza completada. Datos anteriores a ${cutoffDate} eliminados.`
    };
    
    console.log('🎉 Limpieza completada:', summary);
    
    return {
      statusCode: 200,
      body: JSON.stringify(summary)
    };
    
  } catch (error) {
    console.error('💥 Error durante la limpieza:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'Error durante la limpieza automática'
      })
    };
  }
};