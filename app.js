// app.js - Fusión StreamDice + Supabase Colaborativo

const initialFilters = { genre: [], excludeGenres: [], decade: 'todos', platform: [], minRating: 0, duration: 0, ageRatingMin: 0, ageRatingMax: 0 };
const supabase = window.supabaseClient;

const App = () => {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;
  const { addToast } = useToast();

  // ESTADOS DE USUARIO PRIVADO
  const [currentUser, setCurrentUser] = useLocalStorageState('private_user', 'Usuario 1');
  const [userRegion, setUserRegion] = useLocalStorageState('movieRandomizerRegion', 'ES');
  const [language, setLanguage] = useState('es');
  const [tmdbLanguage, setTmdbLanguage] = useState('es-ES');
  const [mode, setMode] = useState('dark');
  const [accent, setAccent] = useState(ACCENT_COLORS[0]);

  // ESTADOS DE SUPABASE
  const [watchedMedia, setWatchedMedia] = useState({});
  const [watchList, setWatchList] = useState({});

  // RESTO DE ESTADOS DE STREAMDICE
  const [mediaType, setMediaType] = useState('movie');
  const [filters, setFilters] = useState(initialFilters);
  const [allMedia, setAllMedia] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaDetails, setMediaDetails] = useState({});
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [genresMap, setGenresMap] = useState({});
  const [quickPlatformOptions, setQuickPlatformOptions] = useState([]);
  const [allPlatformOptions, setAllPlatformOptions] = useState([]);
  
  const t = translations[language];
  const detailsCache = useRef({});

  // 1. SINCRONIZACIÓN CON SUPABASE EN TIEMPO REAL
  useEffect(() => {
    const fetchDB = async () => {
      const { data } = await supabase.from('shared_watchlist').select('*');
      if (data) {
        const newWatched = {};
        const newWatchlist = {};
        data.forEach(item => {
          const mediaObj = { 
            id: item.tmdb_id, 
            title: item.title, 
            poster: item.poster, 
            mediaType: item.media_type, 
            year: item.year, 
            addedBy: item.added_by 
          };
          if (item.status === 'watched') newWatched[item.tmdb_id] = mediaObj;
          else newWatchlist[item.tmdb_id] = mediaObj;
        });
        setWatchedMedia(newWatched);
        setWatchList(newWatchlist);
      }
    };

    fetchDB();

    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_watchlist' }, fetchDB)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // 2. ACCIONES DE SUPABASE
  const handleToggleWatchlist = async (media) => {
    if (watchList[media.id]) {
      await supabase.from('shared_watchlist').delete().eq('tmdb_id', media.id.toString());
      addToast(t.toastRemovedFromWatchlist, 'info');
    } else {
      await supabase.from('shared_watchlist').insert([{
        tmdb_id: media.id.toString(),
        media_type: media.mediaType || mediaType,
        title: media.title,
        poster: media.poster,
        year: media.year?.toString(),
        added_by: currentUser,
        status: 'pending'
      }]);
      addToast(t.toastAddedToWatchlist, 'watchlist');
    }
  };

  const handleMarkAsWatched = async (media) => {
    if (watchedMedia[media.id]) {
      await supabase.from('shared_watchlist').delete().eq('tmdb_id', media.id.toString());
      addToast(t.toastUnwatched, 'info');
    } else {
      if (watchList[media.id]) {
        await supabase.from('shared_watchlist').update({ status: 'watched' }).eq('tmdb_id', media.id.toString());
      } else {
        await supabase.from('shared_watchlist').insert([{
          tmdb_id: media.id.toString(),
          media_type: media.mediaType || mediaType,
          title: media.title,
          poster: media.poster,
          year: media.year?.toString(),
          added_by: currentUser,
          status: 'watched'
        }]);
      }
      addToast(t.toastWatched, 'watched');
    }
  };

  // 3. API TMDB BASE
  const fetchApi = useCallback(async (path, query) => {
    const params = new URLSearchParams(query);
    const url = `${TMDB_BASE_URL}/${path}?api_key=${TMDB_API_KEY}&${params.toString()}`;
    const response = await fetch(url);
    return response.json();
  }, []);

  useEffect(() => {
    fetchApi(`genre/${mediaType}/list`, { language: tmdbLanguage }).then(d => {
      if(d.genres) setGenresMap(d.genres.reduce((a, g) => ({ ...a, [g.id]: g.name }), {}));
    });
    fetchApi(`watch/providers/${mediaType}`, { watch_region: userRegion }).then(d => {
      if(d.results) {
        const sorted = d.results.sort((a, b) => (a.display_priorities?.[userRegion] ?? 100) - (b.display_priorities?.[userRegion] ?? 100));
        setQuickPlatformOptions(sorted.slice(0, 6).map(p => ({ id: p.provider_id.toString(), name: p.provider_name })));
        setAllPlatformOptions(sorted.map(p => ({ id: p.provider_id.toString(), name: p.provider_name })));
      }
    });
  }, [mediaType, userRegion, tmdbLanguage, fetchApi]);

  const handleSurpriseMe = async () => {
    setIsDiscovering(true);
    try {
      const queryParams = {
        language: tmdbLanguage,
        watch_region: userRegion,
        with_watch_monetization_types: 'flatrate|free|ads|rent|buy',
        sort_by: 'popularity.desc'
      };

      const initialData = await fetchApi(`discover/${mediaType}`, queryParams);
      const randomPage = Math.floor(Math.random() * Math.min(initialData.total_pages, 20)) + 1;
      const data = randomPage === 1 ? initialData : await fetchApi(`discover/${mediaType}`, { ...queryParams, page: randomPage });
      
      const transformedMedia = data.results.map(m => normalizeMediaData(m, mediaType, genresMap)).filter(Boolean);
      
      // Filtramos las que ya están en Supabase como vistas
      const unwatchedMedia = transformedMedia.filter(m => !watchedMedia[m.id]);

      if (unwatchedMedia.length > 0) {
        const selected = unwatchedMedia[Math.floor(Math.random() * unwatchedMedia.length)];
        setTimeout(() => {
          setSelectedMedia(selected);
          setIsDiscovering(false);
        }, 1200);
      } else {
        addToast(t.noMoviesFound, 'info');
        setIsDiscovering(false);
      }
    } catch (err) {
      console.error(err);
      setIsDiscovering(false);
    }
  };

  useEffect(() => {
    if (!selectedMedia) return;
    fetchApi(`${selectedMedia.mediaType}/${selectedMedia.id}`, { language: tmdbLanguage, append_to_response: 'credits,videos,watch/providers' })
      .then(details => {
        const regionData = details['watch/providers']?.results?.[userRegion];
        setMediaDetails({
          ...details,
          providers: regionData?.flatrate || [],
          trailerKey: details.videos?.results?.find(v => v.type === 'Trailer')?.key || null,
          cast: details.credits?.cast?.slice(0, 10) || [],
          director: details.credits?.crew?.find(p => p.job === 'Director')
        });
      });
  }, [selectedMedia, userRegion, tmdbLanguage, fetchApi]);

  const isCurrentMediaWatched = selectedMedia && watchedMedia[selectedMedia.id];

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: '72rem', margin: '0 auto' }}>
      
      {/* HEADER ADAPTADO PARA DOS PERSONAS */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>Cine Privado</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            value={currentUser} 
            onChange={(e) => setCurrentUser(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
          >
            <option value="Usuario 1">Yo (Usuario 1)</option>
            <option value="Usuario 2">Tú (Usuario 2)</option>
          </select>

          <button onClick={() => setMediaType(mediaType === 'movie' ? 'tv' : 'movie')} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {mediaType === 'movie' ? '🎬 Películas' : '📺 Series'}
          </button>
        </div>
      </header>

      {/* BOTÓN SORPRÉNDEME */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <button onClick={handleSurpriseMe} disabled={isDiscovering} style={{ padding: '1rem 2rem', background: 'linear-gradient(to right, var(--color-accent), #ec4899)', color: 'white', fontWeight: 'bold', borderRadius: '9999px', fontSize: '1.25rem', border: 'none', cursor: 'pointer' }}>
          {isDiscovering ? 'Buscando...' : '🎲 ¡Sorpréndenos!'}
        </button>
      </div>

      {/* MOVIE CARD Y ANIMACIONES */}
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isDiscovering ? (
          <DiceRollAnimation isRolling={true} />
        ) : selectedMedia ? (
          <div className="movie-card-animated" style={{ width: '100%', maxWidth: '56rem', backgroundColor: '#1f2937', borderRadius: '1rem', padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
            
            <img src={selectedMedia.poster ? `${TMDB_IMAGE_BASE_URL}${selectedMedia.poster}` : ''} alt="" style={{ width: '14rem', borderRadius: '0.75rem' }} />
            
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '0.5rem' }}>{selectedMedia.title}</h2>
              <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>{selectedMedia.synopsis}</p>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button onClick={() => handleMarkAsWatched(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: isCurrentMediaWatched ? '#10b981' : '#374151', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  {isCurrentMediaWatched ? '✓ Vista por nosotros' : '🎬 Marcar como Vista'}
                </button>
                <button onClick={() => handleToggleWatchlist(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchList[selectedMedia.id] ? '#ec4899' : '#374151', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchList[selectedMedia.id] ? '♡ En nuestra Watchlist' : '📋 Guardar para ver'}
                </button>
              </div>

              {mediaDetails.providers?.length > 0 && (
                <div>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase' }}>Disponible en {userRegion}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {mediaDetails.providers.map(p => (
                      <img key={p.provider_id} src={`${TMDB_IMAGE_BASE_URL}${p.logo_path}`} style={{ width: '36px', borderRadius: '8px' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '1.2rem' }}>Dadle al dado para empezar.</p>
        )}
      </main>

    </div>
  );
};

// ESTO ES LO QUE FALTABA: El envoltorio que necesita script.js para funcionar
const AppWithProviders = () => {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
};