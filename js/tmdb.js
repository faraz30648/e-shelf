// tmdb.js
const TMDB_API_KEY = '0010a32a4e1e60188f2036b82b0a8a1b';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/w1280'; // Using w1280 instead of original for performance

const mapTitle = (item) => ({
    apiId: item.id,
    type: item.media_type || (item.name ? 'tv' : 'movie'),
    title: item.title || item.name,
    posterUrl: item.poster_path ? `${IMG_BASE}${item.poster_path}` : '',
    backdropUrl: item.backdrop_path ? `${IMG_ORIGINAL}${item.backdrop_path}` : '',
    overview: item.overview,
    year: (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A',
    rating: item.vote_average || 0
});

export const searchMedia = async (query) => {
    if (!query) return [];
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv').map(mapTitle);
};

export const getDetails = async (id, type) => {
    const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos,genres`);
    const data = await res.json();
    return {
        ...mapTitle({...data, media_type: type}),
        genres: data.genres ? data.genres.map(g => g.name) : [],
        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 0),
        totalSeasons: data.number_of_seasons || 1
    };
};

export const getTrending = async () => {
    const res = await fetch(`${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}`);
    const data = await res.json();
    return data.results.filter(item => item.poster_path).map(mapTitle);
};

export const discoverMedia = async (type, providerId) => {
    // Watch providers in IN: Netflix: 8, Amazon: 119, Hotstar: 122
    let url = `${BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&watch_region=IN`;
    if (providerId) url += `&with_watch_providers=${providerId}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results.filter(item => item.poster_path).map(item => mapTitle({...item, media_type: type}));
};
