// app.js - Raine & Olde Edition (Cloud Sync Fix & Safe Inserts)

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
  const [watchedMedia, setWatchedMedia] = useLocalStorageState('ro_watched_media', {});
  const [watchList, setWatchList] = useLocalStorageState('ro_watchlist_media', {});
  const [availableLists, setAvailableLists] = useState(['General']);
  
  // 3. STREAMDICE STATES
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
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [modalTrailerKey, setModalTrailerKey] = useState(null);
  const [isActorModalOpen, setIsActorModalOpen] = useState(false);
  const [actorDetails, setActorDetails] = useState(null);

  // Custom List Selector Modal States
  const [isListSelectorOpen, setIsListSelectorOpen] = useState(false);
  const [mediaToSave, setMediaToSave] = useState(null);
  const [newListName, setNewListName] = useState('');

  const t = translations[language];

  // ----------------------------------------------------
  // CSS INJECTION (Themes)
  // ----------------------------------------------------
  useEffect(() => {
    const body = document.body;
    if (currentUser === 'Raine') {
      document.body.style.backgroundColor = '#9CAF88'; 
      body.classList.remove('dark-mode');
      body.classList.add('light-mode');
    } else {
      document.body.style.backgroundColor = '#000000';
      body.classList.remove('light-mode');
      body.classList.add('dark-mode');
    }
  }, [currentUser]);

  const themeStyles = `
    :root, body, .light-mode, .dark-mode {
      --bg-primary: ${currentUser === 'Raine' ? '#9CAF88' : '#000000'} !important;
      --bg-secondary: ${currentUser === 'Raine' ? '#C1D0B5' : '#0a0a0a'} !important;
      --bg-tertiary: ${currentUser === 'Raine' ? '#A9BA9D' : '#1a1a1a'} !important;
      --color-bg: ${currentUser === 'Raine' ? '#9CAF88' : '#000000'} !important;
      background-color: ${currentUser === 'Raine' ? '#9CAF88' : '#000000'} !important;
      --card-bg: ${currentUser === 'Raine' ? '#C1D0B5' : '#0a0a0a'} !important;
      --modal-bg: ${currentUser === 'Raine' ? '#C1D0B5' : '#0a0a0a'} !important;
      --color-card-bg: ${currentUser === 'Raine' ? '#C1D0B5' : '#0a0a0a'} !important;
      --border-color: ${currentUser === 'Raine' ? '#A9BA9D' : '#330000'} !important;
      --color-card-border: ${currentUser === 'Raine' ? '#A9BA9D' : '#330000'} !important;
      --text-primary: ${currentUser === 'Raine' ? '#2C3525' : '#ffffff'} !important;
      --color-text-primary: ${currentUser === 'Raine' ? '#2C3525' : '#ffffff'} !important;
      --text-muted: ${currentUser === 'Raine' ? '#5A6B4F' : '#9ca3af'} !important;
      --text-secondary: ${currentUser === 'Raine' ? '#5A6B4F' : '#9ca3af'} !important;
      --color-text-secondary: ${currentUser === 'Raine' ? '#5A6B4F' : '#9ca3af'} !important;
      --color-accent: ${currentUser === 'Raine' ? '#4A5D3E' : '#dc2626'} !important;
      --color-accent-gradient-from: ${currentUser === 'Raine' ? '#4A5D3E' : '#dc2626'} !important;
      --color-accent-gradient-to: ${currentUser === 'Raine' ? '#35452A' : '#991b1b'} !important;
    }

    .light-mode .movie-card-animated span[style*="9999px"] {
      background-color: #9CAF88 !important; 
      color: #1a2315 !important; 
      border: 1px solid #4A5D3E !important; 
      font-weight: 700 !important;
    }
    
    .light-mode .movie-card-animated span[style*="251"] {
      background-color: #f4a261 !important; 
      color: #4a2100 !important;
      border: 1px solid #e76f51 !important;
    }
  `;

  // ----------------------------------------------------
  // SUPABASE SYNC (Single Source of Truth)
  // ----------------------------------------------------
  useEffect(() => {
    const fetchDB = async () => {
      const { data, error } = await supabase.from('shared_watchlist').select('*');
      if (error) {
        console.error("Error fetching from Supabase:", error);
        return;
      }
      
      if (data) {
        const newWatched = {};
        const newWatchlist = {};
        const lists = new Set(['General']);

        data.forEach(item => {
          const listName = item.list_name || 'General';
          const mediaObj = { 
            id: item.tmdb_id, 
            title: item.title, 
            poster: item.poster, 
            mediaType: item.media_type, 
            year: item.year, 
            addedBy: item.added_by,
            listName: listName
          };
          
          if (item.status === 'watched') {
            newWatched[item.tmdb_id] = mediaObj;
          } else {
            newWatchlist[item.tmdb_id] = mediaObj;
            lists.add(listName);
          }
        });
        
        setWatchedMedia(newWatched);
        setWatchList(newWatchlist);
        setAvailableLists(Array.from(lists));
      }
    };
    
    fetchDB();
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'shared_watchlist' }, fetchDB).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ----------------------------------------------------
  // LIST ACTIONS (Safe Null Data Handling)
  // ----------------------------------------------------
  const openListSelector = (media) => {
    if (watchList[media.id]) {
      removeFromWatchlist(media.id);
    } else {
      setMediaToSave(media);
      setIsListSelectorOpen(true);
    }
  };

  const removeFromWatchlist = async (id) => {
    setWatchList(prev => { const next = {...prev}; delete next[id]; return next; });
    addToast('Removed from Watchlist', 'info');
    await supabase.from('shared_watchlist').delete().eq('tmdb_id', id.toString());
  };

  const saveToCustomList = async (listName) => {
    if (!mediaToSave) return;
    const finalListName = listName.trim() || 'General';
    
    setWatchList(prev => ({ ...prev, [mediaToSave.id]: { ...mediaToSave, addedBy: currentUser, status: 'pending', listName: finalListName } }));
    if (!availableLists.includes(finalListName)) setAvailableLists([...availableLists, finalListName]);
    
    addToast(`Added to ${finalListName}!`, 'watchlist');
    setIsListSelectorOpen(false);
    setNewListName('');
    
    // SAFE INSERT: Prevents undefined crashes
    const { error } = await supabase.from('shared_watchlist').insert([{ 
      tmdb_id: mediaToSave.id.toString(), 
      media_type: mediaToSave.mediaType || mediaType, 
      title: mediaToSave.title || 'Unknown Title', 
      poster: mediaToSave.poster || null, 
      year: mediaToSave.year?.toString() || null, 
      added_by: currentUser, 
      status: 'pending',
      list_name: finalListName
    }]);

    if (error) {
      console.error("Error saving:", error);
      addToast('Error saving to cloud. Please refresh.', 'error');
    }
  };

  const handleToggleWatchlist = async (media) => {
    // This function is kept for the fallback/modal remove buttons
    const isAlreadyInList = !!watchList[media.id];
    if (isAlreadyInList) {
      removeFromWatchlist(media.id);
    } else {
      openListSelector(media);
    }
  };

  const handleMarkAsWatched = async (media) => {
    const isAlreadyWatched = !!watchedMedia[media.id];

    if (isAlreadyWatched) {
      setWatchedMedia(prev => { const next = {...prev}; delete next[media.id]; return next; });
      addToast('Removed from Watched', 'info');
      await supabase.from('shared_watchlist').delete().eq('tmdb_id', media.id.toString());
    } else {
      setWatchedMedia(prev => ({ ...prev, [media.id]: { ...media, addedBy: currentUser, status: 'watched' } }));
      addToast('Marked as Watched! ✓', 'watched');
      
      if (watchList[media.id]) {
        await supabase.from('shared_watchlist').update({ status: 'watched' }).eq('tmdb_id', media.id.toString());
      } else {
        const { error } = await supabase.from('shared_watchlist').insert([{ 
          tmdb_id: media.id.toString(), 
          media_type: media.mediaType || mediaType, 
          title: media.title || 'Unknown Title', 
          poster: media.poster || null, 
          year: media.year?.toString() || null, 
          added_by: currentUser, 
          status: 'watched',
          list_name: 'General'
        }]);

        if (error) {
          console.error("Error saving to watched:", error);
          addToast('Error saving to cloud.', 'error');
        }
      }
    }
  };

  // ----------------------------------------------------
  // TMDB & API LOGIC
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

  const handleActorClick = (actorId) => {
    setActorDetails(null);
    setIsActorModalOpen(true);
    fetchApi(`person/${actorId}`, { language: tmdbLanguage, append_to_response: 'movie_credits,tv_credits' })
      .then(person => setActorDetails(person));
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

  useEffect(() => {
    if (!selectedMedia) return;
    const append = selectedMedia.mediaType === 'movie' 
      ? 'credits,videos,watch/providers,release_dates,similar,recommendations' 
      : 'credits,videos,watch/providers,content_ratings,similar,recommendations';

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
        const similarMedia = [...(details.recommendations?.results || []), ...(details.similar?.results || [])]
          .filter((v, i, a) => v.poster_path && a.findIndex(t => t.id === v.id) === i)
          .map(r => normalizeMediaData(r, selectedMedia.mediaType, genresMap))
          .filter(Boolean)
          .slice(0, 10);
        
        setMediaDetails({
          ...details,
          duration: details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null),
          providers: regionData?.flatrate || [],
          trailerKey: details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key || null,
          cast: details.credits?.cast?.slice(0, 10) || [],
          director: details.credits?.crew?.find(p => p.job === 'Director'),
          certification: certification,
          seasons: details.number_of_seasons,
          seasonsList: (details.seasons || []).filter(s => s.season_number > 0),
          similar: similarMedia
        });
      });
  }, [selectedMedia, userRegion, tmdbLanguage, fetchApi, genresMap]);

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

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: '72rem', margin: '0 auto' }}>
      <style>{themeStyles}</style>

      {/* HEADER CENTERED */}
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <h1 style={{ fontFamily: '"UnifrakturMaguntia", "Old English Text MT", serif', fontSize: 'clamp(3rem, 6vw, 4.5rem)', fontWeight: 'normal', color: 'var(--color-accent)', margin: 0, textAlign: 'center', lineHeight: '1.1', textShadow: currentUser === 'Olde' ? '0 0 10px rgba(220,38,38,0.5)' : 'none' }}>
            Raine & Olde
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 600, letterSpacing: '0.05em', textAlign: 'center' }}>
            Everything to watch w my everything
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
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
            📋 Our Lists ({Object.keys(watchList).length})
          </button>
          
          <button onClick={() => setIsWatchedModalOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}>
            ✓ Watched ({Object.keys(watchedMedia).length})
          </button>

          <select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            <option value="Raine">Raine's Theme</option>
            <option value="Olde">Olde's Theme</option>
          </select>
          
          <button onClick={() => setMediaType(mediaType === 'movie' ? 'tv' : 'movie')} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}>
            {mediaType === 'movie' ? '🎬 Films' : '📺 TV Shows'}
          </button>
        </div>
      </header>

      {/* QUICK PLATFORM FILTERS */}
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

      {/* ACTIVE FILTERS SHOWCASE */}
      {(filters.person || filters.platform.length > 0 || filters.genre.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', alignSelf: 'center', marginRight: '0.5rem', fontWeight: 'bold' }}>ACTIVE FILTERS:</span>
          
          {filters.person && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-accent)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {filters.person.role === 'actor' ? 'Actor:' : 'Director:'} {filters.person.title}
              <button onClick={() => setFilters(f => ({ ...f, person: null }))} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', padding: '2px 6px', cursor: 'pointer', color: 'white' }}>✕</button>
            </span>
          )}
          
          {filters.platform.map(id => {
            const p = allPlatformOptions.find(opt => opt.id === id);
            return p && (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                {p.name}
                <button onClick={() => handleQuickFilterToggle('platform', id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
              </span>
            );
          })}

          {filters.genre.map(id => genresMap[id] && (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {genresMap[id]}
              <button onClick={() => handleQuickFilterToggle('genre', id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* SURPRISE ME BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <button onClick={handleSurpriseMe} disabled={isDiscovering} style={{ padding: '1rem 2rem', background: 'linear-gradient(to right, var(--color-accent-gradient-from), var(--color-accent-gradient-to))', color: 'white', fontWeight: 'bold', borderRadius: '9999px', fontSize: '1.25rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
          {isDiscovering ? 'Searching...' : '🎲 Surprise Us!'}
        </button>
      </div>

      {/* MAIN MOVIE CARD */}
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isDiscovering ? (
          <DiceRollAnimation isRolling={true} />
        ) : selectedMedia ? (
          <div className="movie-card-animated" style={{ width: '100%', maxWidth: '56rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <img src={selectedMedia.poster ? `${TMDB_IMAGE_BASE_URL}${selectedMedia.poster}` : ''} alt="" style={{ width: '14rem', borderRadius: '0.75rem', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }} />
              
              {mediaDetails.trailerKey && (
                <button onClick={() => { setModalTrailerKey(mediaDetails.trailerKey); setIsTrailerModalOpen(true); }} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'rgba(74, 93, 62, 0.1)', color: 'var(--color-accent)', fontWeight: 'bold', borderRadius: '0.5rem', border: '1px solid var(--color-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  ▶ Watch Trailer
                </button>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{selectedMedia.title}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>{selectedMedia.synopsis}</p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <MediaCardContent media={selectedMedia} details={mediaDetails} isFetching={false} t={t} userRegion={userRegion} handleActorClick={handleActorClick} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button onClick={() => handleMarkAsWatched(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchedMedia[selectedMedia.id] ? '#10b981' : 'transparent', color: watchedMedia[selectedMedia.id] ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchedMedia[selectedMedia.id] ? '✓ Watched by us' : '🎬 Mark as Watched'}
                </button>
                <button onClick={() => openListSelector(selectedMedia)} style={{ flex: 1, padding: '0.75rem', backgroundColor: watchList[selectedMedia.id] ? 'var(--color-accent)' : 'transparent', color: watchList[selectedMedia.id] ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {watchList[selectedMedia.id] ? `♡ Saved in ${watchList[selectedMedia.id].listName || 'List'}` : '📋 Save to List...'}
                </button>
              </div>

              {/* SIMILAR MOVIES SECTION */}
              {mediaDetails.similar?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', width: '100%' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Similar Titles</p>
                  <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {mediaDetails.similar.map(media => (
                      <button key={media.id} onClick={() => { setSelectedMedia(media); window.scrollTo({top: 0, behavior: 'smooth'}); }} style={{ flexShrink: 0, width: '7rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <img src={media.poster ? `${TMDB_THUMBNAIL_BASE_URL}${media.poster}` : ''} style={{ width: '100%', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '0.375rem', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', textAlign: 'center' }}>Roll the dice to start.</p>
        )}
      </main>

      {/* SELECT/CREATE LIST MODAL */}
      {isListSelectorOpen && mediaToSave && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setIsListSelectorOpen(false)}>
          <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--card-bg)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Save to which list?</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
              {availableLists.map(listName => (
                <button key={listName} onClick={() => saveToCustomList(listName)} style={{ padding: '0.75rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {listName}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>OR CREATE NEW LIST</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="E.g. Spooky Night" style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                <button onClick={() => saveToCustomList(newListName)} disabled={!newListName.trim()} style={{ padding: '0.5rem 1rem', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', opacity: newListName.trim() ? 1 : 0.5 }}>
                  Create
                </button>
              </div>
            </div>
            
            <button onClick={() => setIsListSelectorOpen(false)} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', marginTop: '1rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* GENERAL MODALS */}
      <TrailerModal isOpen={isTrailerModalOpen} close={() => setIsTrailerModalOpen(false)} trailerKey={modalTrailerKey} />
      
      {/* CUSTOMIZED WATCHLIST MODAL (Groups by List Name) */}
      {isWatchlistModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setIsWatchlistModalOpen(false)}>
          <div style={{ width: '100%', maxWidth: '540px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--modal-bg)', borderRadius: '1.25rem 1.25rem 0 0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Our Lists</h2>
              <button onClick={() => setIsWatchlistModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
              {availableLists.map(listName => {
                const itemsInList = Object.values(watchList).filter(m => m.listName === listName && m.mediaType === mediaType);
                if (itemsInList.length === 0) return null;
                
                return (
                  <div key={listName} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{listName} ({itemsInList.length})</h3>
                    {itemsInList.map(media => (
                      <div key={media.id} onClick={() => { setSelectedMedia(media); setIsWatchlistModalOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                        <img src={media.poster ? `${TMDB_THUMBNAIL_BASE_URL}${media.poster}` : ''} style={{ width: '2.75rem', height: '4rem', objectFit: 'cover', borderRadius: '0.375rem' }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{media.title}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Added by {media.addedBy}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFromWatchlist(media.id); }} style={{ padding: '0.25rem 0.625rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '9999px', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {Object.values(watchList).filter(m => m.mediaType === mediaType).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No titles saved yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <WatchedMediaModal isOpen={isWatchedModalOpen} close={() => setIsWatchedModalOpen(false)} watchedMedia={watchedMedia} handleUnwatchMedia={(id) => handleMarkAsWatched(watchedMedia[id] || { id })} mediaType={mediaType} t={t} cookieConsent={true} />
      <FilterModal isOpen={isFilterModalOpen} close={() => setIsFilterModalOpen(false)} handleClearFilters={() => setFilters(initialFilters)} filters={filters} handleGenreChangeInModal={(id, type) => handleQuickFilterToggle(type, id)} handlePlatformChange={(id) => handleQuickFilterToggle('platform', id)} genresMap={genresMap} allPlatformOptions={allPlatformOptions} platformSearchQuery={platformSearchQuery} setPlatformSearchQuery={setPlatformSearchQuery} t={t} />

      {/* PRIVATE ACTOR MODAL */}
      {isActorModalOpen && actorDetails && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: '1rem' }} onClick={() => setIsActorModalOpen(false)}>
          <div style={{ width: '100%', maxWidth: '42rem', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1.5rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsActorModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <img src={actorDetails.profile_path ? `${TMDB_IMAGE_BASE_URL}${actorDetails.profile_path}` : ''} style={{ width: '10rem', borderRadius: '0.5rem', objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h2 style={{ fontSize: '2rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>{actorDetails.name}</h2>
                
                <button onClick={() => {
                  setFilters(f => ({ ...f, person: { id: actorDetails.id, title: actorDetails.name, role: 'actor' } }));
                  setIsActorModalOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '9999px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  + Add to filters
                </button>
                
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>{actorDetails.biography ? `${actorDetails.biography.substring(0, 300)}...` : 'No biography available.'}</p>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
               <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Known For</h3>
               <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                 {[...(actorDetails.movie_credits?.cast || []), ...(actorDetails.tv_credits?.cast || [])]
                    .filter(m => m.poster_path)
                    .sort((a, b) => b.popularity - a.popularity)
                    .slice(0, 10)
                    .map(m => (
                   <div key={m.id} style={{ flexShrink: 0, width: '6rem' }}>
                     <img src={`${TMDB_THUMBNAIL_BASE_URL}${m.poster_path}`} style={{ width: '100%', borderRadius: '0.5rem' }} />
                     <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title || m.name}</p>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* FALLBACK SEARCH MODAL FOR PERSON ROLE */}
      {pendingPerson && !isActorModalOpen && (
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