// app.js - Raine & Olde Edition (UK English, Custom Themes & Full Details)

const initialFilters = { genre: [], excludeGenres: [], decade: 'todos', platform: [], minRating: 0, duration: 0, ageRatingMin: 0, ageRatingMax: 0, person: null };
const supabase = window.supabaseClient;

const App = () => {
  const { useState, useEffect, useCallback, useRef } = React;
  const { addToast } = useToast();

  // 1. USER STATES & THEMES
  const [currentUser, setCurrentUser] = useLocalStorageState('private_user', 'Raine');
  const [userRegion, setUserRegion] = useState('ES'); 
  const [language, setLanguage] = useState('en');
  const [tmdbLanguage, setTmdbLanguage] = useState('en-GB'); 

  // 2. SUPABASE STATES
  const [watchedMedia, setWatchedMedia] = useState({});
  const [watchList, setWatchList] = useState({});
  
  // 3. STREAMDICE STATES (Filters, TMDB & Search)
  const [mediaType, setMediaType] = useState('movie');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaDetails, setMediaDetails] = useState({});
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [genresMap, setGenresMap] = useState({});
  const [quickPlatformOptions, setQuickPlatformOptions] = useState([]);
  const [allPlatformOptions, setAllPlatformOptions] = useState([]);
  
  // Search & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [pendingPerson, setPendingPerson] = useState(null);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [isWatchedModalOpen, setIsWatchedModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [platformSearchQuery, setPlatformSearchQuery] = useState('');
  
  // Trailer Modal
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [modalTrailerKey, setModalTrailerKey] = useState(null);

  const t = translations[language];

  // ----------------------------------------------------
  // CUSTOM THEMES (Raine Cream/Olive vs Olde Dark/Red)
  // ----------------------------------------------------
  useEffect(() => {
    const root = document.documentElement;
    if (currentUser === 'Raine') {
      // FORCE background color directly on the body to override any style.css conflicts
      document.body.style.backgroundColor = '#9CAF88'; // Perfect Olive Green

      // Raine Theme: Olive green bg, Cream elements, Elegant Forest Green accents (No more peach!)
      root.style.setProperty('--bg-primary', '#9CAF88'); 
      root.style.setProperty('--color-bg', '#9CAF88');
      
      root.style.setProperty('--card-bg', '#F9F6F0'); // Soft pastel cream
      root.style.setProperty('--modal-bg', '#F9F6F0');
      root.style.setProperty('--color-card-bg', '#F9F6F0');
      
      root.style.setProperty('--border-color', '#E5E0D8'); 
      root.style.setProperty('--color-card-border', '#E5E0D8');
      
      root.style.setProperty('--text-primary', '#2C3525'); // Very dark green/charcoal text
      root.style.setProperty('--color-text-primary', '#2C3525');
      
      root.style.setProperty('--text-muted', '#6B7A62');
      root.style.setProperty('--text-secondary', '#6B7A62');
      root.style.setProperty('--color-text-secondary', '#6B7A62');
      
      root.style.setProperty('--color-accent', '#4A5D3E'); // Elegant Forest/Sage Green
      root.style.setProperty('--color-accent-gradient-from', '#4A5D3E');
      root.style.setProperty('--color-accent-gradient-to', '#35452A');
      
      root.classList.remove('dark-mode');
      root.classList.add('light-mode');
    } else {
      // FORCE background color for Olde
      document.body.style.backgroundColor = '#000000';

      // Olde Theme: Pure black bg, dark cards, red details
      root.style.setProperty('--bg-primary', '#000000'); 
      root.style.setProperty('--color-bg', '#000000');
      
      root.style.setProperty('--card-bg', '#0a0a0a'); 
      root.style.setProperty('--modal-bg', '#0a0a0a');
      root.style.setProperty('--color-card-bg', '#0a0a0a');
      
      root.style.setProperty('--border-color', '#330000');
      root.style.setProperty('--color-card-border', '#330000');
      
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--color-text-primary', '#ffffff');
      
      root.style.setProperty('--text-muted', '#9ca3af');
      root.style.setProperty('--text-secondary', '#9ca3af');
      root.style.setProperty('--color-text-secondary', '#9ca3af');
      
      root.style.setProperty('--color-accent', '#dc2626'); 
      root.style.setProperty('--color-accent-gradient-from', '#dc2626');
      root.style.setProperty('--color-accent-gradient-to', '#991b1b'); 
      
      root.classList.add('dark-mode');
      root.classList.remove('light-mode');
    }
  }, [currentUser]);

  // ----------------------------------------------------
  // SUPABASE SYNC
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
    const isAlreadyInList = !!watchList[media.id];
    
    if (isAlreadyInList) {
      setWatchList(prev => { const next = {...prev}; delete next[media.id]; return next; });
      addToast('Removed from Watchlist', 'info');
    } else {
      setWatchList(prev => ({ ...prev, [media.id]: { ...media, addedBy: currentUser, status: 'pending' } }));
      addToast('Added to Watchlist!', 'watchlist');
    }

    if (isAlreadyInList) {
      await supabase.from('shared_watchlist').delete().eq('tmdb_id', media.id.toString());
    } else {
      await supabase.from('shared_watchlist').insert([{ 
        tmdb_id: media.id.toString(), media_type: media.mediaType || mediaType, 
        title: media.title, poster: media.poster, year: media.year?.toString(), 
        added_by: currentUser, status: 'pending' 
      }]);
    }
  };

  const handleMarkAsWatched = async (media) => {
    const isAlreadyWatched = !!watchedMedia[media.id];

    if (isAlreadyWatched) {
      setWatchedMedia(prev => { const next = {...prev}; delete next[media.id]; return next; });
      addToast('Removed from Watched', 'info');
    } else {
      setWatchedMedia(prev => ({ ...prev, [media.id]: { ...media, addedBy: currentUser, status: 'watched' } }));
      addToast('Marked as Watched! ✓', 'watched');
    }

    if (isAlreadyWatched) {
      await supabase.from('shared_watchlist').delete().eq('tmdb_id', media.id.toString());
    } else {
      if (watchList[media.id]) {
        await supabase.from('shared_watchlist').update({ status: 'watched' }).eq('tmdb_id', media.id.toString());
      } else {
        await supabase.from('shared_watchlist').insert([{ 
          tmdb_id: media.id.toString(), media_type: media.mediaType || mediaType, 
          title: media.title, poster: media.poster, year: media.year?.toString(), 
          added_by: currentUser, status: 'watched' 
        }]);
      }
    }
  };

  // ----------------------------------------------------
  // TMDB & SEARCH
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
          addToast("No unseen titles found for this person", 'info');
          setIsDiscovering(false);
        }
        return;
      }

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
        addToast("No films found with these filters", 'info');
        setIsDiscovering(false);
      }
    } catch (err) {
      console.error(err);
      setIsDiscovering(false);
    }
  };

  // FETCH FULL MOVIE DETAILS (Duration, Cast, Trailer, etc.)
  useEffect(() => {
    if (!selectedMedia) return;
    const append = selectedMedia.mediaType === 'movie' 
      ? 'credits,videos,watch/providers,release_dates' 
      : 'credits,videos,watch/providers,content_ratings';

    fetchApi(`${selectedMedia.mediaType}/${selectedMedia.id}`, { language: tmdbLanguage, append_to_response: append })
      .then(details => {
        let certification = '';
        if (selectedMedia.mediaType === 'movie') {
          const rel = details.release_dates?.results?.find(r => r.iso_3166_1 === userRegion);
          certification = rel?.release_dates.find(rd => rd.certification)?.certification || '';
        } else {
          const rat = details.content_ratings?.results?.find(r => r.iso_3166_1 === userRegion);
          certification = rat?.rating || '';
        }

        const regionData = details['watch/providers']?.results?.[userRegion];
        
        setMediaDetails({
          ...details,
          duration: details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null),
          providers: regionData?.flatrate || [],
          trailerKey: details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key || null,
          cast: details.credits?.cast?.slice(0, 10) || [],
          director: details.credits?.crew?.find(p => p.job === 'Director'),
          certification: certification,
          seasons: details.number_of_seasons,
          seasonsList: (details.seasons || []).filter(s => s.season_number > 0)
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

  const openTrailerModal = (key) => {
    setModalTrailerKey(key);
    setIsTrailerModalOpen(true);
  };

  // Use this to filter by actor when clicking their photo
  const handleActorClick = (actorId) => {
    fetchApi(`person/${actorId}`, { language: tmdbLanguage }).then(person => {
      setFilters(f => ({ ...f, person: { id: person.id, title: person.name, role: 'actor' } }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: '72rem', margin: '0 auto' }}>
      
      {/* HEADER WITH GOTHIC FONT */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <h1 style={{ 
          fontFamily: '"UnifrakturMaguntia", "Old English Text MT", serif', 
          fontSize: '3rem', 
          fontWeight: 'normal', 
          color: 'var(--color-accent)',
          margin: 0,
          textShadow: currentUser === 'Olde' ? '0 0 10px rgba(220,38,38,0.5)' : 'none'
        }}>
          Raine & Olde Movie Night
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* SEARCH BAR */}
          <div style={{ position: 'relative' }}>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search actor or director..." style={{ width: '14rem', padding: '0.5rem 1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '9999px', fontSize: '0.875rem', color: 'var(--text-primary)' }} />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', marginTop: '0.5rem', right: 0, width: '15rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', zIndex: 50, overflow: 'hidden' }}>
                {searchResults.map(result => (
                  <button key={result.id} onClick={() => handleSearchResultClick(result)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}>
                    <img src={result.poster ? `${TMDB_THUMBNAIL_BASE_URL}${result.poster}` : ''} style={{ width: '2rem', height: '2rem', borderRadius: '50%', objectFit: 'cover' }} />
                    {result.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setIsWatchlistModalOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 Watchlist ({Object.keys(watchList).length})
          </button>
          
          <button onClick={() => setIsWatchedModalOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}>
            ✓ Watched ({Object.keys(watchedMedia).length})
          </button>

          {/* THEME SWITCHER */}
          <select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            <option value="Raine">Raine's Theme</option>
            <option value="Olde">Olde's Theme</option>
          </select>
          
          {/* MEDIA TYPE TOGGLE */}
          <button onClick={() => setMediaType(mediaType === 'movie' ? 'tv' : 'movie')} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}>
            {mediaType === 'movie' ? '🎬 Films' : '📺 TV Shows'}
          </button>
        </div>
      </header>

      {/* PLATFORM FILTERS */}
      {quickPlatformOptions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {quickPlatformOptions.map(p => (
            <button key={p.id} onClick={() => handleQuickFilterToggle('platform', p.id)} style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 500, border: '1px solid', borderColor: filters.platform.includes(p.id) ? 'transparent' : 'var(--border-color)', background: filters.platform.includes(p.id) ? 'var(--color-accent)' : 'var(--card-bg)', color: filters.platform.includes(p.id) ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}>
              {p.name}
            </button>
          ))}
          <button onClick={() => setIsFilterModalOpen(true)} style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 500, border: '1px dashed var(--color-accent)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
            + Genres & More
          </button>
        </div>
      )}

      {/* ACTIVE PERSON FILTER PILL */}
      {filters.person && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 'bold' }}>
            {filters.person.role === 'actor' ? 'Actor:' : 'Director:'} {filters.person.title}
            <button onClick={() => setFilters(f => ({ ...f, person: null }))} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', color: 'white' }}>✕</button>
          </span>
        </div>
      )}

      {/* SURPRISE ME BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <button onClick={handleSurpriseMe} disabled={isDiscovering} style={{ padding: '1rem 2rem', background: 'linear-gradient(to right, var(--color-accent-gradient-from), var(--color-accent-gradient-to))', color: 'white', fontWeight: 'bold', borderRadius: '9999px', fontSize: '1.25rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
          {isDiscovering ? 'Searching...' : '🎲 Surprise Us!'}
        </button>
      </div>

      {/* MAIN MOVIE CARD WITH FULL DETAILS RESTORED */}
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isDiscovering ? (
          <DiceRollAnimation isRolling={true} />
        ) : selectedMedia ? (
          <div className="movie-card-animated" style={{ width: '100%', maxWidth: '56rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <img src={selectedMedia.poster ? `${TMDB_IMAGE_BASE_URL}${selectedMedia.poster}` : ''} alt="" style={{ width: '14rem', borderRadius: '0.75rem', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }} />
              
              {mediaDetails.trailerKey && (
                <button onClick={() => openTrailerModal(mediaDetails.trailerKey)} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'rgba(168,85,247,0.1)', color: 'var(--color-accent)', fontWeight: 'bold', borderRadius: '0.5rem', border: '1px solid var(--color-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  ▶ Watch Trailer
                </button>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{selectedMedia.title}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>{selectedMedia.synopsis}</p>
              
              {/* RESTORED: Director, Cast, Duration & More using original component */}
              <div style={{ marginBottom: '1.5rem' }}>
                <MediaCardContent media={selectedMedia} details={mediaDetails} isFetching={false} t={t} userRegion={userRegion} handleActorClick={handleActorClick} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button onClick={() => handleMarkAsWatched(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchedMedia[selectedMedia.id] ? '#10b981' : 'transparent', color: watchedMedia[selectedMedia.id] ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchedMedia[selectedMedia.id] ? '✓ Watched by us' : '🎬 Mark as Watched'}
                </button>
                <button onClick={() => handleToggleWatchlist(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchList[selectedMedia.id] ? 'var(--color-accent)' : 'transparent', color: watchList[selectedMedia.id] ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchList[selectedMedia.id] ? '♡ Saved in Watchlist' : '📋 Save to Watchlist'}
                </button>
              </div>

            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Roll the dice to start.</p>
        )}
      </main>

      {/* ALL MODALS (INCLUDING TRAILER) */}
      <TrailerModal isOpen={isTrailerModalOpen} close={() => setIsTrailerModalOpen(false)} trailerKey={modalTrailerKey} />
      <WatchlistModal isOpen={isWatchlistModalOpen} close={() => setIsWatchlistModalOpen(false)} watchlist={watchList} handleToggleWatchlist={handleToggleWatchlist} handleSimilarMediaClick={(media) => setSelectedMedia(media)} mediaType={mediaType} t={t} />
      <WatchedMediaModal isOpen={isWatchedModalOpen} close={() => setIsWatchedModalOpen(false)} watchedMedia={watchedMedia} handleUnwatchMedia={(id) => handleMarkAsWatched(watchedMedia[id] || { id })} mediaType={mediaType} t={t} cookieConsent={true} />
      <FilterModal isOpen={isFilterModalOpen} close={() => setIsFilterModalOpen(false)} handleClearFilters={() => setFilters(initialFilters)} filters={filters} handleGenreChangeInModal={(id, type) => handleQuickFilterToggle(type, id)} handlePlatformChange={(id) => handleQuickFilterToggle('platform', id)} genresMap={genresMap} allPlatformOptions={allPlatformOptions} platformSearchQuery={platformSearchQuery} setPlatformSearchQuery={setPlatformSearchQuery} t={t} />

      {/* ROLE SELECTION MODAL FOR ACTOR/DIRECTOR */}
      {pendingPerson && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--card-bg)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>What role for {pendingPerson.title}?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => { setFilters(f => ({ ...f, person: { ...pendingPerson, role: 'actor' } })); setPendingPerson(null); }} style={{ padding: '1rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Actor / Actress</button>
              <button onClick={() => { setFilters(f => ({ ...f, person: { ...pendingPerson, role: 'director' } })); setPendingPerson(null); }} style={{ padding: '1rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Director</button>
              <button onClick={() => setPendingPerson(null)} style={{ padding: '1rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}>Cancel</button>
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