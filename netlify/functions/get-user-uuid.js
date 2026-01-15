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
        const { username, id } = event.queryStringParameters || {};
        
        if (!username && !id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Se requiere username o id'
                })
            };
        }

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

        let query = supabase
            .from('users')
            .select('id, name, username, role')
            .limit(1);

        if (username) {
            query = query.eq('username', username);
        } else if (id) {
            query = query.eq('id', id);
        }

        const { data: users, error } = await query;

        if (error || !users || users.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Usuario no encontrado'
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: users[0]
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error del servidor'
            })
        };
    }
};