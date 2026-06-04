const TMDB_API_KEY = 'YOUR_TMDB_API_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

export const searchMedia = async (query) => {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv').map(item => ({
        apiId: item.id,
        type: item.media_type,
        title: item.title || item.name,
        posterUrl: item.poster_path ? `${IMG_BASE}${item.poster_path}` : '',
        backdropUrl: item.backdrop_path ? `${IMG_ORIGINAL}${item.backdrop_path}` : '',
        overview: item.overview,
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        rating: item.vote_average
    }));
};

export const getDetails = async (id, type) => {
    const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos,genres`);
    return await res.json();
};
