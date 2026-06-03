// helpers.js

function formatDuration(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}min`;
}

function normalizeMediaData(media, mediaType, genresMap) {
  if (!media || !media.id) return null;
  
  const type = media.media_type || mediaType;
  const isMovie = type === 'movie';
  const releaseDate = isMovie ? media.release_date : media.first_air_date;
  
  let year = null;
  if (releaseDate && typeof releaseDate === 'string' && releaseDate.length >= 4) {
    const parsed = parseInt(releaseDate.substring(0, 4), 10);
    year = isNaN(parsed) ? null : parsed;
  }
  
  let imdbRating = 'N/A';
  if (media.vote_average !== null && media.vote_average !== undefined && media.vote_average > 0) {
    imdbRating = media.vote_average.toFixed(1);
  }
  
  return {
    id: media.id.toString(),
    title: isMovie ? media.title : media.name,
    synopsis: media.overview,
    year: year,
    imdbRating: imdbRating,
    genres: media.genre_ids?.map(id => genresMap[id]).filter(Boolean) || [],
    poster: media.poster_path,
    mediaType: type
  };
}