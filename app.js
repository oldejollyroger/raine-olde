const { useState, useEffect } = React;

const App = () => {
  // Región fijada en España por defecto, pero cambiable si os vais de viaje
  const [region, setRegion] = useState('ES'); 
  const [watchlist, setWatchlist] = useState([]);

  // Suscripción a Supabase (Watchlist en tiempo real)
  useEffect(() => {
    const fetchList = async () => {
      const { data } = await supabase.from('shared_watchlist').select('*');
      if (data) setWatchlist(data);
    };
    
    fetchList();

    const channel = supabase.channel('cambios-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_watchlist' }, 
        () => fetchList() // Recarga si el otro usuario añade algo
      ).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="app-container">
      <header>
        <h1 style={{ color: 'var(--accent-glow)' }}>Cine Privado</h1>
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="ES">España</option>
          <option value="GB">Reino Unido</option>
          <option value="US">Estados Unidos</option>
        </select>
      </header>
      
      <main className="cyber-card" style={{ marginTop: '20px' }}>
        <h2>Our Watchlist ({watchlist.length})</h2>
        {/* Aquí irá el mapeo de películas y el botón del randomizer */}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);