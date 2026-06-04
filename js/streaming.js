const RAPIDAPI_KEY = 'YOUR_RAPIDAPI_KEY';
const HOST = 'streaming-availability.p.rapidapi.com';

export const getStreamingInfo = async (tmdbId, type) => {
    try {
        const res = await fetch(`https://${HOST}/shows/search/title?country=us&title_type=${type}&tmdb_id=${tmdbId}`, {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': HOST
            }
        });
        if(!res.ok) throw new Error("API Limit");
        const data = await res.json();
        // Assuming array format based on typical RapidAPI streaming structure
        if(data && data.result && data.result.length > 0) {
            const streaming = data.result[0].streamingInfo.us || [];
            return streaming.map(s => ({
                service: s.service,
                type: s.streamingType, // sub, rent, buy
                link: s.link
            }));
        }
        return [];
    } catch (e) {
        console.warn("Streaming API failed, using fallback", e);
        return null; // Signals to UI to use fallback
    }
};
