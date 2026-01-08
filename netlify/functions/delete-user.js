const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

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
        const { userId, adminId } = JSON.parse(event.body);

        console.log('Solicitud de eliminación:', { userId, adminId });

        // Validar datos requeridos
        if (!userId || !adminId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Faltan datos requeridos' 
                })
            };
        }

        // Verificar que el usuario que hace la petición sea admin
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('role')
            .eq('id', adminId)
            .maybeSingle();

        if (adminError || !admin || admin.role !== 'admin') {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No tienes permisos para realizar esta acción' 
                })
            };
        }

        // Verificar que el usuario a eliminar existe
        const { data: userToDelete, error: userCheckError } = await supabase
            .from('users')
            .select('id, name, username, role')
            .eq('id', userId)
            .maybeSingle();

        if (userCheckError || !userToDelete) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Usuario no encontrado' 
                })
            };
        }

        // Prevenir que el admin se elimine a sí mismo
        if (userId === adminId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No puedes eliminar tu propia cuenta' 
                })
            };
        }

        // Eliminar registros relacionados primero (time_records)
        const { error: deleteTimeRecordsError } = await supabase
            .from('time_records')
            .delete()
            .eq('user_id', userId);

        if (deleteTimeRecordsError) {
            console.error('Error eliminando time_records:', deleteTimeRecordsError);
        }

        // Eliminar registros relacionados (task_completions)
        const { error: deleteTaskCompletionsError } = await supabase
            .from('task_completions')
            .delete()
            .eq('user_id', userId);

        if (deleteTaskCompletionsError) {
            console.error('Error eliminando task_completions:', deleteTaskCompletionsError);
        }

        // Eliminar el usuario
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (deleteError) {
            console.error('Error eliminando usuario:', deleteError);
            throw deleteError;
        }

        console.log('Usuario eliminado:', userToDelete);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    deletedUser: {
                        id: userToDelete.id,
                        name: userToDelete.name,
                        username: userToDelete.username,
                        role: userToDelete.role
                    }
                },
                message: 'Usuario eliminado exitosamente'
            })
        };

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error al eliminar el usuario',
                details: error.message
            })
        };
    }
};