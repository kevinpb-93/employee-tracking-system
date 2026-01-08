const { createClient } = require('@supabase/supabase-js');

// Usar las mismas variables de entorno que las otras funciones
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Manejar preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Método no permitido' })
        };
    }

    try {
        const { taskId, newName, userId } = JSON.parse(event.body);

        console.log('Datos recibidos:', { taskId, newName, userId });

        // Validar datos
        if (!taskId || !newName || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Faltan datos requeridos' 
                })
            };
        }

        // Verificar que el nombre no esté vacío
        if (newName.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'El nombre no puede estar vacío' 
                })
            };
        }

        // Verificar que el usuario sea admin
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

        console.log('Usuario verificado:', user);

        if (userError) {
            console.error('Error verificando usuario:', userError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Error al verificar usuario',
                    details: userError.message
                })
            };
        }

        if (!user || user.role !== 'admin') {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No tienes permisos para realizar esta acción' 
                })
            };
        }

        // Verificar que la tarea existe
        const { data: tasks, error: taskCheckError } = await supabase
            .from('tasks')
            .select('id, name')
            .eq('id', taskId);

        console.log('Búsqueda de tarea:', { tasks, taskCheckError });

        if (taskCheckError) {
            console.error('Error buscando tarea:', taskCheckError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Error al buscar la tarea',
                    details: taskCheckError.message
                })
            };
        }

        if (!tasks || tasks.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: `Tarea no encontrada con ID: ${taskId}` 
                })
            };
        }

        const oldName = tasks[0].name;

        // Actualizar usando RPC (Remote Procedure Call) es más confiable con RLS
        // Primero intentamos con update normal
        const { error: updateError } = await supabase
            .from('tasks')
            .update({ name: newName.trim() })
            .eq('id', taskId);

        console.log('Resultado update:', { updateError });

        if (updateError) {
            console.error('Error actualizando:', updateError);
            throw updateError;
        }

        // Verificar que se actualizó correctamente
        const { data: verifyTask, error: verifyError } = await supabase
            .from('tasks')
            .select('id, name')
            .eq('id', taskId)
            .single();

        console.log('Verificación post-update:', { verifyTask, verifyError });

        if (verifyError || !verifyTask) {
            throw new Error('No se pudo verificar la actualización');
        }

        // Verificar que el nombre cambió
        if (verifyTask.name !== newName.trim()) {
            throw new Error('La tarea no se actualizó correctamente');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    task: verifyTask,
                    oldName: oldName
                },
                message: 'Tarea actualizada exitosamente'
            })
        };

    } catch (error) {
        console.error('Error al actualizar tarea:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error al actualizar la tarea',
                details: error.message
            })
        };
    }
};