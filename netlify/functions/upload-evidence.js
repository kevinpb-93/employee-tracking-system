const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const busboy = Busboy({ 
            headers: { 
                'content-type': event.headers['content-type'] || ''
            }
        });

        let fileBuffer = null;
        let fileInfo = {};
        const fields = {};
        
        return new Promise((resolve, reject) => {
            busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
                if (fieldname === 'file') {
                    fileInfo = { filename, mimetype, encoding };
                    const chunks = [];
                    
                    file.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    
                    file.on('end', () => {
                        fileBuffer = Buffer.concat(chunks);
                    });
                } else {
                    file.resume();
                }
            });

            busboy.on('field', (fieldname, value) => {
                fields[fieldname] = value;
            });

            busboy.on('finish', async () => {
                try {
                    const { userId, taskId, taskCompletionId, observation } = fields;
                    
                    console.log('📥 Datos recibidos:', { userId, taskId, taskCompletionId, observation });
                    
                    // Validaciones básicas
                    if (!userId || !taskId || !taskCompletionId) {
                        resolve({
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({
                                success: false,
                                error: 'Faltan parámetros requeridos: userId, taskId, taskCompletionId'
                            })
                        });
                        return;
                    }

                    // Convertir taskId a INTEGER
                    const taskIdInt = parseInt(taskId);
                    if (isNaN(taskIdInt)) {
                        resolve({
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({
                                success: false,
                                error: 'taskId debe ser un número entero válido'
                            })
                        });
                        return;
                    }

                    console.log('✅ taskId convertido:', taskIdInt, 'Tipo:', typeof taskIdInt);

                    if (!fileBuffer) {
                        resolve({
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({
                                success: false,
                                error: 'No se proporcionó archivo de imagen'
                            })
                        });
                        return;
                    }

                    // Validar tamaño (5MB máximo)
                    if (fileBuffer.length > 5 * 1024 * 1024) {
                        resolve({
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({
                                success: false,
                                error: 'El archivo es muy grande. Máximo 5MB.'
                            })
                        });
                        return;
                    }

                    // Validar tipo de archivo
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                    if (!allowedTypes.includes(fileInfo.mimetype.toLowerCase())) {
                        resolve({
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({
                                success: false,
                                error: 'Tipo de archivo no permitido. Solo JPG, PNG, WEBP'
                            })
                        });
                        return;
                    }

                    // Inicializar Supabase
                    const supabaseUrl = process.env.SUPABASE_URL;
                    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
                    
                    if (!supabaseUrl || !supabaseKey) {
                        resolve({
                            statusCode: 500,
                            headers,
                            body: JSON.stringify({
                                success: false,
                                error: 'Configuración de Supabase no encontrada'
                            })
                        });
                        return;
                    }

                    const supabase = createClient(supabaseUrl, supabaseKey);

                    // Crear nombre único para el archivo
                    const fileExtension = fileInfo.filename.split('.').pop().toLowerCase();
                    const uniqueId = Math.random().toString(36).substring(2, 15);
                    const fileName = `evidence_${Date.now()}_${uniqueId}.${fileExtension}`;
                    const filePath = `${userId}/${taskIdInt}/${fileName}`;
                    
                    console.log('📁 Subiendo archivo a:', filePath);
                    
                    // Subir a Supabase Storage
                    const { data: uploadData, error: uploadError } = await supabase
                        .storage
                        .from('task-evidence')
                        .upload(filePath, fileBuffer, {
                            contentType: fileInfo.mimetype,
                            upsert: false,
                            cacheControl: '3600'
                        });
                    
                    if (uploadError) {
                        console.error('❌ Error al subir archivo:', uploadError);
                        throw uploadError;
                    }

                    console.log('✅ Archivo subido exitosamente');

                    // Obtener URL pública
                    const { data: urlData } = supabase
                        .storage
                        .from('task-evidence')
                        .getPublicUrl(filePath);
                    
                    const imageUrl = urlData.publicUrl;
                    console.log('🔗 URL pública generada:', imageUrl);

                    // Preparar datos para insertar
                    const insertData = {
                        user_id: userId,              // UUID
                        task_id: taskIdInt,           // INTEGER (corregido)
                        task_completion_id: taskCompletionId, // UUID
                        image_url: imageUrl,
                        observation: observation || null
                    };

                    console.log('💾 Insertando en BD:', insertData);

                    // Guardar en base de datos
                    const { data: dbData, error: dbError } = await supabase
                        .from('task_evidence')
                        .insert(insertData)
                        .select()
                        .single();
                    
                    if (dbError) {
                        console.error('❌ Error en BD:', dbError);
                        // Si hay error en la BD, eliminar el archivo subido
                        console.log('🗑️ Eliminando archivo por error en BD...');
                        await supabase.storage.from('task-evidence').remove([filePath]);
                        throw dbError;
                    }

                    console.log('✅ Evidencia guardada en BD:', dbData);

                    resolve({
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            data: {
                                id: dbData.id,
                                imageUrl,
                                observation: dbData.observation,
                                filePath,
                                uploadedAt: dbData.created_at
                            },
                            message: 'Evidencia subida exitosamente'
                        })
                    });

                } catch (error) {
                    console.error('❌ Error general:', error);
                    resolve({
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({
                            success: false,
                            error: 'Error al procesar: ' + error.message,
                            details: error.details || null,
                            hint: error.hint || null
                        })
                    });
                }
            });

            busboy.on('error', (error) => {
                console.error('❌ Error en Busboy:', error);
                reject(error);
            });

            busboy.end(Buffer.from(event.body, 'base64'));
        });

    } catch (error) {
        console.error('❌ Error crítico:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error del servidor: ' + error.message
            })
        };
    }
};