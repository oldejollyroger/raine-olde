// db.js - Conexión a Supabase
// Sustituye estos valores por los de tu proyecto en Supabase
const SUPABASE_URL = 'https://maisiydiwreyyuyigwot.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haXNpeWRpd3JleXl1eWlnd290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODkwNDcsImV4cCI6MjA5NjA2NTA0N30.0ALGgrqrWK7M1qGOvirs7XKavyu4iqr_xYrHkdikPAQ';

// Inicializamos el cliente de Supabase
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);