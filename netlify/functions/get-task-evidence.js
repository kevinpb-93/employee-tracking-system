const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { taskId, userId, date } = event.queryStringParameters || {};
        
        console.log('📥 get-task-evidence: Parámetros recibidos:', { taskId, userId, date });
        
        // Validaciones
        if (!taskId || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Se requieren taskId y userId'
                })
            };
        }

        // Convertir taskId a INTEGER
        const taskIdInt = parseInt(taskId);
        if (isNaN(taskIdInt)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'taskId debe ser un número entero válido'
                })
            };
        }

        console.log('✅ taskId convertido:', taskIdInt, 'Tipo:', typeof taskIdInt);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Configuración no encontrada'
                })
            };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Construir query - ahora taskId es INTEGER
        let query = supabase
            .from('task_evidence')
            .select('*')
            .eq('user_id', userId)        // UUID
            .eq('task_id', taskIdInt)     // INTEGER (corregido)
            .order('created_at', { ascending: false });
        
        // Filtrar por fecha si se proporciona
        if (date) {
            query = query
                .gte('created_at', `${date}T00:00:00Z`)
                .lte('created_at', `${date}T23:59:59Z`);
        }
        
        console.log('🔍 Ejecutando query...');
        
        const { data: evidence, error } = await query;
        
        if (error) {
            console.error('❌ Error de Supabase:', error);
            throw error;
        }

        console.log(`✅ Evidencias encontradas: ${evidence?.length || 0}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: evidence || [],
                count: evidence?.length || 0,
                message: evidence?.length > 0 
                    ? `Se encontraron ${evidence.length} evidencia(s)` 
                    : 'No hay evidencias para esta tarea'
            })
        };

    } catch (error) {
        console.error('❌ Error general:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error al obtener evidencias: ' + error.message,
                code: error.code || null,
                details: error.details || null,
                hint: error.hint || null
            })
        };
    }
};