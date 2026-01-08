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
        const { name, username, password, role, adminId } = JSON.parse(event.body);

        console.log('Datos recibidos:', { name, username, role, adminId });

        // Validar datos requeridos
        if (!name || !username || !password || !role || !adminId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Todos los campos son requeridos' 
                })
            };
        }

        // Validar que el nombre no esté vacío
        if (name.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'El nombre no puede estar vacío' 
                })
            };
        }

        // Validar username (sin espacios, mínimo 3 caracteres)
        if (username.trim().length < 3 || username.includes(' ')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'El usuario debe tener al menos 3 caracteres y no contener espacios' 
                })
            };
        }

        // Validar contraseña (mínimo 4 caracteres)
        if (password.length < 4) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'La contraseña debe tener al menos 4 caracteres' 
                })
            };
        }

        // Validar rol
        if (!['admin', 'employee'].includes(role)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Rol inválido. Debe ser "admin" o "employee"' 
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

        // Verificar que el username no exista ya
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('username')
            .eq('username', username.trim().toLowerCase());

        if (checkError) {
            console.error('Error verificando username:', checkError);
            throw checkError;
        }

        if (existingUser && existingUser.length > 0) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'El nombre de usuario ya existe' 
                })
            };
        }

        // Crear el nuevo usuario
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([
                {
                    name: name.trim(),
                    username: username.trim().toLowerCase(),
                    password: password,
                    role: role
                }
            ])
            .select();

        if (insertError) {
            console.error('Error insertando usuario:', insertError);
            throw insertError;
        }

        console.log('Usuario creado:', newUser);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    user: {
                        id: newUser[0].id,
                        name: newUser[0].name,
                        username: newUser[0].username,
                        role: newUser[0].role
                    }
                },
                message: 'Usuario creado exitosamente'
            })
        };

    } catch (error) {
        console.error('Error al crear usuario:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error al crear el usuario',
                details: error.message
            })
        };
    }
};