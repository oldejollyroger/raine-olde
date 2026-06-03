// app.js - Lógica principal
const { useState, useEffect } = React;
const supabase = window.supabaseClient;

const App = () => {
  // Estado inicial: Región ES por defecto y lista vacía
  const [region, setRegion] = useState('ES');
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  // Efecto para cargar datos y suscribirse a cambios en tiempo real
  useEffect(() => {
    const fetchWatchlist = async () => {
      const { data, error } = await supabase
        .from('shared_watchlist')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setWatchlist(data);
      }
      setLoading(false);
    };

    fetchWatchlist();

    // Canal en tiempo real: Escucha cualquier cambio en la tabla 'shared_watchlist'
    const channel = supabase.channel('watchlist-compartida')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_watchlist' }, 
        (payload) => {
          console.log('Cambio detectado en la base de datos:', payload);
          fetchWatchlist(); // Recargamos la lista silenciosamente
        }
      )
      .subscribe();

    // Limpieza al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Función de prueba para añadir una película manualmente (luego la conectaremos a TMDB)
  const addTestMovie = async () => {
    const { error } = await supabase.from('shared_watchlist').insert([{
      tmdb_id: Math.floor(Math.random() * 10000).toString(),
      media_type: 'movie',
      title: 'Película de Prueba ' + Math.floor(Math.random() * 100),
      added_by: 'Yo',
      status: 'pending'
    }]);

    if (error) console.error("Error añadiendo película:", error);
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: 'var(--accent-glow)' }}>Cine Privado</h1>
        
        {/* Selector de región minimalista (Por defecto ES) */}
        <select 
          value={region} 
          onChange={(e) => setRegion(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '8px', background: '#1f2937', color: '#fff', border: '1px solid #374151' }}
        >
          <option value="ES">España</option>
          <option value="GB">Reino Unido</option>
          <option value="US">Estados Unidos</option>
        </select>
      </header>

      <main>
        <div className="cyber-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Nuestra Watchlist ({watchlist.length})</h2>
            <button onClick={addTestMovie} style={{ padding: '0.5rem 1rem', background: 'var(--accent-glow)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              + Añadir Prueba
            </button>
          </div>

          {loading ? (
            <p>Cargando lista compartida...</p>
          ) : watchlist.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>La lista está vacía. ¡Añadid algo para ver!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {watchlist.map(item => (
                <li key={item.id} style={{ padding: '1rem', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{item.title}</strong> <small style={{ color: '#9ca3af' }}>añadido por {item.added_by}</small></span>
                  <span style={{ color: item.status === 'watched' ? '#10b981' : '#f59e0b' }}>
                    {item.status === 'watched' ? 'Vista ✓' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);