import { requireAuth, logout, getShelf, addItem, updateItem, deleteItem } from './firebase.js';
import { searchMedia, getDetails } from './tmdb.js';
import { getStreamingInfo } from './streaming.js';

let currentUser = null;
let shelfData = [];
let currentSelectedItem = null;

const UI = {
    carousels: document.getElementById('carousels-container'),
    hero: document.getElementById('hero-section'),
    searchModal: document.getElementById('search-modal'),
    searchInput: document.getElementById('global-search-input'),
    searchResults: document.getElementById('search-results'),
    itemModal: document.getElementById('item-modal'),
    form: document.getElementById('item-form'),
    toast: document.getElementById('toast-container'),
    statsPanel: document.getElementById('stats-panel'),
    moodFilters: document.getElementById('mood-filters'),
    shelfSearch: document.getElementById('shelf-search'),
    shelfSort: document.getElementById('shelf-sort')
};

const showToast = (msg) => {
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = msg;
    UI.toast.appendChild(t);
    setTimeout(() => t.remove(), 3000);
};

const renderHero = (item) => {
    if(!item) { UI.hero.innerHTML = `<div class="hero-content"><h1>Welcome to Shelf</h1><p>Start adding movies!</p></div>`; return; }
    UI.hero.style.backgroundImage = `url(${item.backdropUrl || item.posterUrl})`;
    UI.hero.innerHTML = `
        <div class="hero-content">
            <h1>${item.title}</h1>
            <p class="hero-meta">${item.year} • ${item.status} • Rating: ${item.userRating || 'N/A'}/10</p>
            <button class="btn btn-primary" onclick="window.openItemModal('${item.id}')">View Details</button>
        </div>
    `;
};

const renderStats = () => {
    const total = shelfData.length;
    const completed = shelfData.filter(i => i.status === 'Completed').length;
    const avgRating = total > 0 ? (shelfData.reduce((acc, i) => acc + (Number(i.userRating)||0), 0) / shelfData.filter(i=>i.userRating).length).toFixed(1) : 0;
    
    UI.statsPanel.innerHTML = `
        <div class="stat-box"><div class="num">${total}</div><div class="label">Total Saved</div></div>
        <div class="stat-box"><div class="num">${completed}</div><div class="label">Completed</div></div>
        <div class="stat-box"><div class="num">${isNaN(avgRating) ? 0 : avgRating}</div><div class="label">Avg Rating</div></div>
    `;
};

const renderCarousels = (filter = '', sort = 'dateAdded', mood = 'all') => {
    const statuses = ['Watching', 'Completed', 'Plan to Watch', 'Dropped', 'On Hold'];
    UI.carousels.innerHTML = '';
    
    let displayData = [...shelfData];
    if(filter) displayData = displayData.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()));
    if(mood !== 'all') displayData = displayData.filter(i => i.genres && i.genres.includes(mood));
    
    displayData.sort((a,b) => {
        if(sort === 'title') return a.title.localeCompare(b.title);
        if(sort === 'userRating') return (b.userRating||0) - (a.userRating||0);
        return (b.dateAdded?.seconds || 0) - (a.dateAdded?.seconds || 0); // Date Added desc
    });

    statuses.forEach(status => {
        const items = displayData.filter(i => i.status === status);
        if(items.length === 0) return;
        
        const row = document.createElement('div');
        row.className = 'carousel-row';
        row.innerHTML = `<h3>${status} <span class="count">${items.length}</span></h3><div class="carousel-track">
            ${items.map(item => `
                <div class="card" onclick="window.openItemModal('${item.id}')">
                    <img src="${item.posterUrl}" alt="${item.title}" loading="lazy">
                    <div class="card-overlay"><h4>${item.title}</h4><span>★ ${item.userRating||'-'}</span></div>
                </div>
            `).join('')}
        </div>`;
        UI.carousels.appendChild(row);
    });
};

const loadShelf = async () => {
    shelfData = await getShelf(currentUser.uid, 'movies');
    renderHero(shelfData[shelfData.length-1]); // Most recent
    renderStats();
    renderCarousels();
};

window.openItemModal = (id) => {
    currentSelectedItem = shelfData.find(i => i.id === id);
    document.getElementById('modal-title').innerText = currentSelectedItem.title;
    document.getElementById('modal-img').src = currentSelectedItem.posterUrl;
    document.getElementById('modal-meta').innerText = `${currentSelectedItem.year}`;
    document.getElementById('modal-overview').innerText = currentSelectedItem.overview;
    
    document.getElementById('item-status').value = currentSelectedItem.status;
    document.getElementById('item-rating').value = currentSelectedItem.userRating || '';
    document.getElementById('item-notes').value = currentSelectedItem.notes || '';
    
    document.getElementById('remove-item-btn').classList.remove('hidden');
    UI.itemModal.classList.remove('hidden');
};

const openAddModal = async (apiId, type) => {
    // Fetch full details from TMDB
    const details = await getDetails(apiId, type);
    currentSelectedItem = {
        id: apiId.toString(), type: type,
        title: details.title || details.name,
        posterUrl: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
        backdropUrl: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
        overview: details.overview,
        year: (details.release_date || details.first_air_date || '').split('-')[0],
        genres: details.genres.map(g => g.name),
        status: 'Plan to Watch', userRating: '', notes: ''
    };
    
    document.getElementById('modal-title').innerText = currentSelectedItem.title;
    document.getElementById('modal-img').src = currentSelectedItem.posterUrl;
    document.getElementById('modal-meta').innerText = currentSelectedItem.year;
    document.getElementById('modal-overview').innerText = currentSelectedItem.overview;
    
    document.getElementById('item-status').value = 'Plan to Watch';
    document.getElementById('item-rating').value = '';
    document.getElementById('item-notes').value = '';
    document.getElementById('remove-item-btn').classList.add('hidden');
    
    // Fetch streaming
    const streamingContainer = document.getElementById('streaming-badges');
    streamingContainer.innerHTML = 'Loading streams...';
    const streams = await getStreamingInfo(apiId, type);
    if(streams === null) {
        streamingContainer.innerHTML = `<a href="https://www.justwatch.com/us/search?q=${encodeURIComponent(currentSelectedItem.title)}" target="_blank" class="btn btn-sm btn-primary">Check JustWatch</a>`;
    } else if (streams.length > 0) {
        streamingContainer.innerHTML = streams.map(s => `<span class="${s.type === 'subscription' ? 'sub' : ''}">${s.service} (${s.type})</span>`).join('');
    } else {
        streamingContainer.innerHTML = '<span>No streams found</span>';
    }

    UI.searchModal.classList.add('hidden');
    UI.itemModal.classList.remove('hidden');
};
window.openAddModal = openAddModal;

// Event Listeners
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('search-trigger').addEventListener('click', () => { UI.searchModal.classList.remove('hidden'); UI.searchInput.focus(); });
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => {
    UI.searchModal.classList.add('hidden'); UI.itemModal.classList.add('hidden');
}));
document.addEventListener('keydown', (e) => {
    if(e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); UI.searchModal.classList.remove('hidden'); UI.searchInput.focus(); }
    if(e.key === 'Escape') { UI.searchModal.classList.add('hidden'); UI.itemModal.classList.add('hidden'); }
});

let debounceTimer;
UI.searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        if(query.length < 3) return;
        const results = await searchMedia(query);
        UI.searchResults.innerHTML = results.map(item => `
            <div class="card" onclick="window.openAddModal(${item.apiId}, '${item.type}')">
                <img src="${item.posterUrl || 'https://via.placeholder.com/150x225?text=No+Image'}" alt="Poster">
                <div class="card-overlay"><h4>${item.title}</h4><p>${item.year}</p></div>
            </div>
        `).join('');
    }, 500);
});

UI.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        ...currentSelectedItem,
        status: document.getElementById('item-status').value,
        userRating: document.getElementById('item-rating').value,
        notes: document.getElementById('item-notes').value
    };
    
    const exists = shelfData.some(i => i.id === data.id);
    if(exists) {
        await updateItem(currentUser.uid, 'movies', data.id, data);
        showToast('Updated successfully!');
    } else {
        await addItem(currentUser.uid, 'movies', data.id, data);
        showToast('Added to shelf!');
    }
    UI.itemModal.classList.add('hidden');
    loadShelf();
});

document.getElementById('remove-item-btn').addEventListener('click', async () => {
    if(confirm("Remove this item?")) {
        await deleteItem(currentUser.uid, 'movies', currentSelectedItem.id);
        showToast('Item removed.');
        UI.itemModal.classList.add('hidden');
        loadShelf();
    }
});

// Filters & Sort
UI.shelfSearch.addEventListener('input', (e) => renderCarousels(e.target.value, UI.shelfSort.value, document.querySelector('.mood-filters .active').dataset.mood));
UI.shelfSort.addEventListener('change', (e) => renderCarousels(UI.shelfSearch.value, e.target.value, document.querySelector('.mood-filters .active').dataset.mood));
UI.moodFilters.addEventListener('click', (e) => {
    if(e.target.classList.contains('chip')) {
        document.querySelectorAll('.mood-filters .chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        renderCarousels(UI.shelfSearch.value, UI.shelfSort.value, e.target.dataset.mood);
    }
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    const body = document.body;
    if(body.classList.contains('theme-dark')) { body.classList.replace('theme-dark', 'theme-amoled'); }
    else if(body.classList.contains('theme-amoled')) { body.classList.replace('theme-amoled', 'theme-light'); }
    else { body.classList.replace('theme-light', 'theme-dark'); }
    localStorage.setItem('theme', body.className);
});

// Init
const savedTheme = localStorage.getItem('theme');
if(savedTheme) document.body.className = savedTheme;

requireAuth(user => { currentUser = user; loadShelf(); });
