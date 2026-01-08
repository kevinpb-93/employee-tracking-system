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
        const { taskName, period, deadline, adminId } = JSON.parse(event.body);

        console.log('Datos recibidos:', { taskName, period, deadline, adminId });

        // Validar datos requeridos
        if (!taskName || !period || !deadline || !adminId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Todos los campos son requeridos (taskName, period, deadline, adminId)' 
                })
            };
        }

        // Verificar que el nombre no esté vacío
        if (taskName.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'El nombre de la tarea no puede estar vacío' 
                })
            };
        }

        // Validar longitud mínima
        if (taskName.trim().length < 3) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'El nombre de la tarea debe tener al menos 3 caracteres' 
                })
            };
        }

        // Validar periodo - ACTUALIZADO PARA USAR entry, midday, exit
        const validPeriods = ['entry', 'midday', 'exit'];
        if (!validPeriods.includes(period)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Periodo inválido. Debe ser: entry, midday o exit' 
                })
            };
        }

        // Validar formato de deadline (HH:MM:SS o HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
        if (!timeRegex.test(deadline)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Formato de hora inválido. Debe ser HH:MM' 
                })
            };
        }

        // Asegurar formato HH:MM:SS
        const formattedDeadline = deadline.length === 5 ? `${deadline}:00` : deadline;

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

        // Verificar que el nombre de la tarea no exista ya
        const { data: existingTask, error: checkError } = await supabase
            .from('tasks')
            .select('name')
            .eq('name', taskName.trim());

        if (checkError) {
            console.error('Error verificando tarea:', checkError);
            throw checkError;
        }

        if (existingTask && existingTask.length > 0) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Ya existe una tarea con ese nombre' 
                })
            };
        }

        // Crear la nueva tarea
        const { data: newTask, error: insertError } = await supabase
            .from('tasks')
            .insert([
                {
                    name: taskName.trim(),
                    period: period,
                    deadline: formattedDeadline
                }
            ])
            .select();

        if (insertError) {
            console.error('Error insertando tarea:', insertError);
            throw insertError;
        }

        console.log('Tarea creada:', newTask);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    task: {
                        id: newTask[0].id,
                        name: newTask[0].name,
                        period: newTask[0].period,
                        deadline: newTask[0].deadline
                    }
                },
                message: 'Tarea creada exitosamente'
            })
        };

    } catch (error) {
        console.error('Error al crear tarea:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error al crear la tarea',
                details: error.message
            })
        };
    }
};