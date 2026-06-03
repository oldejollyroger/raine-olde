// app.js - Raine & Olde Edition

const initialFilters = { genre: [], excludeGenres: [], decade: 'todos', platform: [], minRating: 0, duration: 0, ageRatingMin: 0, ageRatingMax: 0, person: null };
const supabase = window.supabaseClient;

const App = () => {
  const { useState, useEffect, useCallback, useRef } = React;
  const { addToast } = useToast();

  // 1. ESTADOS DE USUARIO Y TEMAS
  const [currentUser, setCurrentUser] = useLocalStorageState('private_user', 'Raine');
  const [userRegion, setUserRegion] = useState('ES');
  const [language, setLanguage] = useState('es');
  const [tmdbLanguage, setTmdbLanguage] = useState('es-ES');

  // 2. ESTADOS DE SUPABASE
  const [watchedMedia, setWatchedMedia] = useState({});
  const [watchList, setWatchList] = useState({});
  
  // 3. ESTADOS DE STREAMDICE (Filtros, TMDB y Búsqueda)
  const [mediaType, setMediaType] = useState('movie');
  const [filters, setFilters] = useState(initialFilters);
  const [allMedia, setAllMedia] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaDetails, setMediaDetails] = useState({});
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [genresMap, setGenresMap] = useState({});
  const [quickPlatformOptions, setQuickPlatformOptions] = useState([]);
  const [allPlatformOptions, setAllPlatformOptions] = useState([]);
  
  // Búsqueda (Para actores y directores)
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [pendingPerson, setPendingPerson] = useState(null);

  // Modales
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [isWatchedModalOpen, setIsWatchedModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [platformSearchQuery, setPlatformSearchQuery] = useState('');

  const t = translations[language];

  // ----------------------------------------------------
  // EFECTO DE TEMAS PERSONALIZADOS (Raine vs Olde)
  // ----------------------------------------------------
  useEffect(() => {
    const root = document.documentElement;
    if (currentUser === 'Raine') {
      // Tema Raine: Verde oliva claro, colores pastel
      root.style.setProperty('--color-bg', '#f2f5eb');
      root.style.setProperty('--color-card-bg', '#ffffff');
      root.style.setProperty('--color-card-border', '#dce3d0');
      root.style.setProperty('--color-text-primary', '#2f3e2f');
      root.style.setProperty('--color-text-secondary', '#7a8c7a');
      root.style.setProperty('--color-accent', '#8ea67a');
      root.style.setProperty('--color-accent-gradient-from', '#8ea67a');
      root.style.setProperty('--color-accent-gradient-to', '#b5c9a3');
      root.classList.remove('dark-mode');
      root.classList.add('light-mode');
    } else {
      // Tema Olde: Oscuro con toques rojos
      root.style.setProperty('--color-bg', '#050505');
      root.style.setProperty('--color-card-bg', '#121212');
      root.style.setProperty('--color-card-border', '#262626');
      root.style.setProperty('--color-text-primary', '#f3f4f6');
      root.style.setProperty('--color-text-secondary', '#9ca3af');
      root.style.setProperty('--color-accent', '#dc2626');
      root.style.setProperty('--color-accent-gradient-from', '#dc2626');
      root.style.setProperty('--color-accent-gradient-to', '#991b1b');
      root.classList.add('dark-mode');
      root.classList.remove('light-mode');
    }
  }, [currentUser]);

  // ----------------------------------------------------
  // SINCRONIZACIÓN SUPABASE
  // ----------------------------------------------------
  useEffect(() => {
    const fetchDB = async () => {
      const { data } = await supabase.from('shared_watchlist').select('*');
      if (data) {
        const newWatched = {};
        const newWatchlist = {};
        data.forEach(item => {
          const mediaObj = { id: item.tmdb_id, title: item.title, poster: item.poster, mediaType: item.media_type, year: item.year, addedBy: item.added_by };
          if (item.status === 'watched') newWatched[item.tmdb_id] = mediaObj;
          else newWatchlist[item.tmdb_id] = mediaObj;
        });
        setWatchedMedia(newWatched);
        setWatchList(newWatchlist);
      }
    };
    fetchDB();
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'shared_watchlist' }, fetchDB).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleToggleWatchlist = async (media) => {
    if (watchList[media.id]) {
      await supabase.from('shared_watchlist').delete().eq('tmdb_id', media.id.toString());
      addToast(t.toastRemovedFromWatchlist, 'info');
    } else {
      await supabase.from('shared_watchlist').insert([{ tmdb_id: media.id.toString(), media_type: media.mediaType || mediaType, title: media.title, poster: media.poster, year: media.year?.toString(), added_by: currentUser, status: 'pending' }]);
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
        await supabase.from('shared_watchlist').insert([{ tmdb_id: media.id.toString(), media_type: media.mediaType || mediaType, title: media.title, poster: media.poster, year: media.year?.toString(), added_by: currentUser, status: 'watched' }]);
      }
      addToast(t.toastWatched, 'watched');
    }
  };

  // ----------------------------------------------------
  // TMDB & BÚSQUEDA
  // ----------------------------------------------------
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

  // Buscador para Actores/Directores
  useEffect(() => {
    if (debouncedSearchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    const search = async () => {
      try {
        const data = await fetchApi('search/multi', { query: debouncedSearchQuery, language: tmdbLanguage });
        const results = data.results
          .filter(r => r.media_type === 'person' && r.profile_path)
          .map(r => ({ id: r.id, title: r.name, poster: r.profile_path, resultType: 'person' }))
          .slice(0, 5);
        setSearchResults(results);
      } catch (err) { console.error(err); }
    };
    search();
  }, [debouncedSearchQuery, tmdbLanguage, fetchApi]);

  const handleSearchResultClick = (result) => {
    setPendingPerson(result);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSurpriseMe = async () => {
    setIsDiscovering(true);
    try {
      // Si hay filtro de actor/director, usamos un endpoint distinto
      if (filters.person) {
        const creditType = filters.person.role === 'actor' ? 'cast' : 'crew';
        const jobMap = { director: 'Director', writer: 'Writer', producer: 'Producer' };
        const creditEndpoint = mediaType === 'movie' ? `person/${filters.person.id}/movie_credits` : `person/${filters.person.id}/tv_credits`;
        
        const creditsData = await fetchApi(creditEndpoint, { language: tmdbLanguage });
        let matches = creditsData[creditType] || [];
        if (creditType === 'crew') matches = matches.filter(m => m.job === jobMap[filters.person.role]);
        
        matches = matches.filter(m => m.poster_path).sort((a, b) => b.popularity - a.popularity);
        const unwatchedMatches = matches.filter(m => !watchedMedia[m.id.toString()]);

        if (unwatchedMatches.length > 0) {
          const selected = unwatchedMatches[Math.floor(Math.random() * unwatchedMatches.length)];
          setTimeout(() => { setSelectedMedia(normalizeMediaData(selected, mediaType, genresMap)); setIsDiscovering(false); }, 1200);
        } else {
          addToast("No hay pelis nuevas de esta persona", 'info');
          setIsDiscovering(false);
        }
        return;
      }

      // Si no, búsqueda general con filtros
      const queryParams = {
        language: tmdbLanguage,
        watch_region: userRegion,
        with_watch_monetization_types: 'flatrate|free|ads|rent|buy',
        ...(filters.platform.length > 0 && { with_watch_providers: filters.platform.join('|') }),
        ...(filters.genre.length > 0 && { with_genres: filters.genre.join(',') }),
        sort_by: 'popularity.desc'
      };

      const initialData = await fetchApi(`discover/${mediaType}`, queryParams);
      const totalPages = Math.min(initialData.total_pages, 20);
      const randomPage = Math.floor(Math.random() * totalPages) + 1;
      const data = randomPage === 1 ? initialData : await fetchApi(`discover/${mediaType}`, { ...queryParams, page: randomPage });
      
      const transformedMedia = data.results.map(m => normalizeMediaData(m, mediaType, genresMap)).filter(Boolean);
      const unwatchedMedia = transformedMedia.filter(m => !watchedMedia[m.id]);

      if (unwatchedMedia.length > 0) {
        const selected = unwatchedMedia[Math.floor(Math.random() * unwatchedMedia.length)];
        setTimeout(() => { setSelectedMedia(selected); setIsDiscovering(false); }, 1200);
      } else {
        addToast("No se encontró nada con estos filtros", 'info');
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

  const handleQuickFilterToggle = (list, id) => {
    setFilters(f => {
      const current = [...(f[list] || [])];
      const index = current.indexOf(id);
      if (index > -1) current.splice(index, 1);
      else current.push(id);
      return { ...f, [list]: current };
    });
  };

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: '72rem', margin: '0 auto' }}>
      
      {/* HEADER */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>R&O Movie Night</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* BUSCADOR DE ACTORES/DIRECTORES */}
          <div style={{ position: 'relative' }}>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar actor o director..." style={{ width: '12rem', padding: '0.5rem 1rem', backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '9999px', fontSize: '0.875rem', color: 'var(--color-text-primary)' }} />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', marginTop: '0.5rem', right: 0, width: '15rem', backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '0.75rem', zIndex: 50, overflow: 'hidden' }}>
                {searchResults.map(result => (
                  <button key={result.id} onClick={() => handleSearchResultClick(result)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text-primary)' }}>
                    <img src={result.poster ? `${TMDB_THUMBNAIL_BASE_URL}${result.poster}` : ''} style={{ width: '2rem', height: '2rem', borderRadius: '50%', objectFit: 'cover' }} />
                    {result.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setIsWatchlistModalOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--color-card-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-card-border)', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 Por ver ({Object.keys(watchList).length})
          </button>
          
          <button onClick={() => setIsWatchedModalOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--color-card-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-card-border)', cursor: 'pointer', fontWeight: 'bold' }}>
            ✓ Vistas ({Object.keys(watchedMedia).length})
          </button>

          <select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            <option value="Raine">Tema: Raine</option>
            <option value="Olde">Tema: Olde</option>
          </select>
        </div>
      </header>

      {/* FILTROS (Plataformas) */}
      {quickPlatformOptions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {quickPlatformOptions.map(p => (
            <button key={p.id} onClick={() => handleQuickFilterToggle('platform', p.id)} style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 500, border: '1px solid', borderColor: filters.platform.includes(p.id) ? 'transparent' : 'var(--color-card-border)', background: filters.platform.includes(p.id) ? 'var(--color-accent)' : 'var(--color-card-bg)', color: filters.platform.includes(p.id) ? 'white' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
              {p.name}
            </button>
          ))}
          <button onClick={() => setIsFilterModalOpen(true)} style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 500, border: '1px dashed var(--color-accent)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
            + Géneros y más
          </button>
        </div>
      )}

      {/* PÍLDORA DE ACTOR/DIRECTOR ACTIVO */}
      {filters.person && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 'bold' }}>
            {filters.person.role === 'actor' ? 'Actúa:' : 'Dirige:'} {filters.person.title}
            <button onClick={() => setFilters(f => ({ ...f, person: null }))} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', color: 'white' }}>✕</button>
          </span>
        </div>
      )}

      {/* BOTÓN SORPRÉNDEME */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <button onClick={handleSurpriseMe} disabled={isDiscovering} style={{ padding: '1rem 2rem', background: 'linear-gradient(to right, var(--color-accent-gradient-from), var(--color-accent-gradient-to))', color: 'white', fontWeight: 'bold', borderRadius: '9999px', fontSize: '1.25rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
          {isDiscovering ? 'Buscando...' : '🎲 ¡Sorpréndenos!'}
        </button>
      </div>

      {/* MOVIE CARD Y ANIMACIONES */}
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isDiscovering ? (
          <DiceRollAnimation isRolling={true} />
        ) : selectedMedia ? (
          <div className="movie-card-animated" style={{ width: '100%', maxWidth: '56rem', backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            <img src={selectedMedia.poster ? `${TMDB_IMAGE_BASE_URL}${selectedMedia.poster}` : ''} alt="" style={{ width: '14rem', borderRadius: '0.75rem', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }} />
            
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2 style={{ fontSize: '2rem', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>{selectedMedia.title}</h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>{selectedMedia.synopsis}</p>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button onClick={() => handleMarkAsWatched(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchedMedia[selectedMedia.id] ? '#10b981' : 'var(--color-bg)', color: watchedMedia[selectedMedia.id] ? 'white' : 'var(--color-text-primary)', border: '1px solid var(--color-card-border)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchedMedia[selectedMedia.id] ? '✓ Vista' : '🎬 Marcar como Vista'}
                </button>
                <button onClick={() => handleToggleWatchlist(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchList[selectedMedia.id] ? 'var(--color-accent)' : 'var(--color-bg)', color: watchList[selectedMedia.id] ? 'white' : 'var(--color-text-primary)', border: '1px solid var(--color-card-border)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchList[selectedMedia.id] ? '♡ En la lista' : '📋 Guardar para ver'}
                </button>
              </div>

              {mediaDetails.providers?.length > 0 && (
                <div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Disponible para ver en:</p>
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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.2rem' }}>Dadle al dado para empezar.</p>
        )}
      </main>

      {/* MODALES REUTILIZADOS DE COMPONENTS.JS */}
      <WatchlistModal isOpen={isWatchlistModalOpen} close={() => setIsWatchlistModalOpen(false)} watchlist={watchList} handleToggleWatchlist={handleToggleWatchlist} handleSimilarMediaClick={(media) => setSelectedMedia(media)} mediaType={mediaType} t={t} />
      <WatchedMediaModal isOpen={isWatchedModalOpen} close={() => setIsWatchedModalOpen(false)} watchedMedia={watchedMedia} handleUnwatchMedia={(id) => handleMarkAsWatched({id})} mediaType={mediaType} t={t} cookieConsent={true} />
      <FilterModal isOpen={isFilterModalOpen} close={() => setIsFilterModalOpen(false)} handleClearFilters={() => setFilters(initialFilters)} filters={filters} handleGenreChangeInModal={(id, type) => handleQuickFilterToggle(type, id)} handlePlatformChange={(id) => handleQuickFilterToggle('platform', id)} genresMap={genresMap} allPlatformOptions={allPlatformOptions} platformSearchQuery={platformSearchQuery} setPlatformSearchQuery={setPlatformSearchQuery} t={t} />

      {/* MODAL DE SELECCIÓN DE ROL PARA ACTOR/DIRECTOR */}
      {pendingPerson && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--color-card-bg)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--color-card-border)' }}>
            <h2 style={{ color: 'var(--color-text-primary)', marginBottom: '1rem' }}>¿Qué rol buscas de {pendingPerson.title}?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => { setFilters(f => ({ ...f, person: { ...pendingPerson, role: 'actor' } })); setPendingPerson(null); }} style={{ padding: '1rem', background: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-card-border)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Actor / Actriz</button>
              <button onClick={() => { setFilters(f => ({ ...f, person: { ...pendingPerson, role: 'director' } })); setPendingPerson(null); }} style={{ padding: '1rem', background: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-card-border)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Director/a</button>
              <button onClick={() => setPendingPerson(null)} style={{ padding: '1rem', background: 'transparent', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AppWithProviders = () => {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
};