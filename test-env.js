require('dotenv').config();
console.log('=== VARIABLES DE ENTORNO ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Presente' : '✗ Faltante');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ Presente' : '✗ Faltante');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓ Presente' : '✗ Faltante');
console.log('Longitud SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY?.length || 0);