const GOOGLE_BOOKS_API_KEY = 'YOUR_GOOGLE_BOOKS_API_KEY';
const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

export const searchBooks = async (query) => {
    const res = await fetch(`${BASE_URL}?q=${encodeURIComponent(query)}&key=${GOOGLE_BOOKS_API_KEY}&maxResults=20`);
    const data = await res.json();
    if(!data.items) return [];
    return data.items.map(item => {
        const info = item.volumeInfo;
        return {
            apiId: item.id,
            title: info.title,
            author: info.authors ? info.authors.join(', ') : 'Unknown',
            posterUrl: info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : '',
            overview: info.description || 'No description available.',
            year: (info.publishedDate || '').split('-')[0],
            pages: info.pageCount || 0,
            genres: info.categories || []
        };
    });
};
