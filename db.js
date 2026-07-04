// db.js CORRECTO
const SUPABASE_URL = 'https://maisiydiwreyyuyigwot.supabase.co'; // Sin barra al final y sin /rest/v1
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haXNpeWRpd3JleXl1eWlnd290Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4OTA0NywiZXhwIjoyMDk2MDY1MDQ3fQ.QfkD-AlCZ2nb5fqBqz4nk2GKDtG17XaWGrDscXv-neE'; // Tu clave anónima gigante

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);