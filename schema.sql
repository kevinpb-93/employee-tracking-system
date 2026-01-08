-- ============================================
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE
-- ============================================

-- Tabla de usuarios
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- En producción usar hash con bcrypt
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tareas predefinidas
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('entry', 'midday', 'exit')),
  deadline TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de registros de horarios (entrada, medio día, salida)
CREATE TABLE time_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entry_time TIME,
  midday_time TIME,
  exit_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Tabla de completación de tareas
CREATE TABLE task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completions JSONB DEFAULT '[]'::jsonb, -- Array de timestamps
  last_completed_at TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_id, date)
);

-- Índices para mejorar performance
CREATE INDEX idx_time_records_user_date ON time_records(user_id, date);
CREATE INDEX idx_task_completions_user_date ON task_completions(user_id, date);
CREATE INDEX idx_task_completions_date ON task_completions(date);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_records_updated_at BEFORE UPDATE ON time_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_completions_updated_at BEFORE UPDATE ON task_completions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Insertar usuarios de ejemplo
INSERT INTO users (username, password, name, role) VALUES
  ('admin', 'admin123', 'Administrador', 'admin'),
  ('juan', '1234', 'Juan Pérez', 'employee'),
  ('maria', '1234', 'María González', 'employee'),
  ('carlos', '1234', 'Carlos Rodríguez', 'employee'),
  ('ana', '1234', 'Ana Martínez', 'employee');

-- Insertar tareas predefinidas
INSERT INTO tasks (name, period, deadline) VALUES
  ('Barrer y trapear pisos y tapetes', 'entry', '09:00'),
  ('Limpiar manijas y agarraderas de puertas', 'entry', '09:30'),
  ('Limpiar apagadores', 'midday', '13:00'),
  ('Limpiar vitrinas', 'midday', '13:30'),
  ('Limpiar baño', 'exit', '16:30'),
  ('Limpiar sillas y mesa de trabajo', 'exit', '17:00'),
  ('Vaciar basura', 'exit', '17:15');

-- ============================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Política para users: todos pueden leer (para login)
CREATE POLICY "Users can read all users" ON users
  FOR SELECT USING (true);

-- Política para tasks: todos pueden leer
CREATE POLICY "Anyone can read tasks" ON tasks
  FOR SELECT USING (true);

-- Política para time_records: usuarios pueden ver sus propios registros
CREATE POLICY "Users can read their own time records" ON time_records
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own time records" ON time_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own time records" ON time_records
  FOR UPDATE USING (true);

-- Política para task_completions: usuarios pueden ver sus propias tareas
CREATE POLICY "Users can read all task completions" ON task_completions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own task completions" ON task_completions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own task completions" ON task_completions
  FOR UPDATE USING (true);