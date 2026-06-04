const BASE_URL = 'https://api.jikan.moe/v4';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const searchAnime = async (query) => {
    await delay(400); // Rate limit protection
    const res = await fetch(`${BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=15`);
    const data = await res.json();
    return data.data.map(item => ({
        apiId: item.mal_id,
        title: item.title_english || item.title,
        posterUrl: item.images.jpg.large_image_url,
        backdropUrl: item.images.jpg.large_image_url, // Jikan doesn't have true backdrops often
        overview: item.synopsis,
        year: item.year || (item.aired && item.aired.prop.from.year),
        episodes: item.episodes || 0,
        genres: item.genres.map(g => g.name)
    }));
};
