// db.js CORRECTO
const SUPABASE_URL = 'https://maisiydiwreyyuyigwot.supabase.co/rest/v1'; // Sin barra al final y sin /rest/v1
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haXNpeWRpd3JleXl1eWlnd290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODkwNDcsImV4cCI6MjA5NjA2NTA0N30.0ALGgrqrWK7M1qGOvirs7XKavyu4iqr_xYrHkdikPAQ...'; // Tu clave anónima gigante

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);