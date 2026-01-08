// server.js - Configuración para Netlify Functions con Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Función auxiliar para respuestas
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  },
  body: JSON.stringify(body)
});

// =============== AUTENTICACIÓN ===============

exports.login = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const { username, password } = JSON.parse(event.body);

    // Buscar usuario en Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password) // En producción, usar bcrypt
      .single();

    if (error || !user) {
      return response(401, { error: 'Credenciales inválidas' });
    }

    return response(200, { 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    return response(500, { error: 'Error del servidor' });
  }
};

// =============== REGISTRO DE HORARIOS ===============

exports.markTime = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const { userId, period, time, date } = JSON.parse(event.body);

    // Buscar si ya existe un registro para este día
    const { data: existing } = await supabase
      .from('time_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    let result;
    if (existing) {
      // Actualizar registro existente
      const updateData = {};
      updateData[`${period}_time`] = time;

      result = await supabase
        .from('time_records')
        .update(updateData)
        .eq('id', existing.id)
        .select();
    } else {
      // Crear nuevo registro
      const insertData = {
        user_id: userId,
        date: date,
        [`${period}_time`]: time
      };

      result = await supabase
        .from('time_records')
        .insert(insertData)
        .select();
    }

    if (result.error) {
      return response(400, { error: result.error.message });
    }

    return response(200, { success: true, data: result.data[0] });
  } catch (error) {
    return response(500, { error: 'Error al registrar horario' });
  }
};

exports.getTimeRecords = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const { userId, date } = event.queryStringParameters;

    let query = supabase.from('time_records').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { success: true, data });
  } catch (error) {
    return response(500, { error: 'Error al obtener registros' });
  }
};

// =============== GESTIÓN DE TAREAS ===============

exports.markTask = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const { userId, taskId, date, completedAt } = JSON.parse(event.body);

    // Buscar si ya existe un registro de esta tarea
    const { data: existing } = await supabase
      .from('task_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .eq('date', date)
      .single();

    let result;
    if (existing) {
      // Agregar nueva marca de tiempo al array de completions
      const completions = existing.completions || [];
      completions.push(completedAt);

      result = await supabase
        .from('task_completions')
        .update({ 
          completions,
          last_completed_at: completedAt
        })
        .eq('id', existing.id)
        .select();
    } else {
      // Crear nuevo registro
      result = await supabase
        .from('task_completions')
        .insert({
          user_id: userId,
          task_id: taskId,
          date: date,
          completions: [completedAt],
          last_completed_at: completedAt
        })
        .select();
    }

    if (result.error) {
      return response(400, { error: result.error.message });
    }

    return response(200, { success: true, data: result.data[0] });
  } catch (error) {
    return response(500, { error: 'Error al marcar tarea' });
  }
};

exports.getTaskCompletions = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const { userId, date } = event.queryStringParameters;

    let query = supabase
      .from('task_completions')
      .select('*, tasks(*)');

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error) {
      return response(400, { error: error.message });
    }

    return response(200, { success: true, data });
  } catch (error) {
    return response(500, { error: 'Error al obtener tareas' });
  }
};

// =============== REPORTES (ADMIN) ===============

exports.getReport = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  try {
    const { date } = event.queryStringParameters;

    // Obtener todos los usuarios
    const { data: users } = await supabase
      .from('users')
      .select('id, username, name')
      .eq('role', 'employee');

    // Obtener registros de tiempo
    const { data: timeRecords } = await supabase
      .from('time_records')
      .select('*')
      .eq('date', date);

    // Obtener completaciones de tareas
    const { data: taskCompletions } = await supabase
      .from('task_completions')
      .select('*, tasks(*)')
      .eq('date', date);

    // Obtener todas las tareas
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .order('id');

    return response(200, { 
      success: true, 
      data: {
        users,
        timeRecords,
        taskCompletions,
        tasks
      }
    });
  } catch (error) {
    return response(500, { error: 'Error al generar reporte' });
  }
};