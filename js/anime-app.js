import { requireAuth, logout, getShelf, addItem, updateItem, deleteItem } from './firebase.js';
import { searchAnime } from './jikan.js';

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
    statsPanel: document.getElementById('stats-panel')
};

const showToast = (msg) => { const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg; UI.toast.appendChild(t); setTimeout(() => t.remove(), 3000); };

const renderStats = () => {
    const total = shelfData.length;
    const completed = shelfData.filter(i => i.status === 'Completed').length;
    const eps = shelfData.reduce((acc, i) => acc + (Number(i.currentEpisode)||0), 0);
    UI.statsPanel.innerHTML = `
        <div class="stat-box"><div class="num">${total}</div><div class="label">Total Anime</div></div>
        <div class="stat-box"><div class="num">${completed}</div><div class="label">Completed</div></div>
        <div class="stat-box"><div class="num">${eps}</div><div class="label">Episodes Watched</div></div>
    `;
};

const renderCarousels = () => {
    const statuses = ['Watching', 'Completed', 'Plan to Watch', 'Dropped', 'On Hold'];
    UI.carousels.innerHTML = '';
    statuses.forEach(status => {
        const items = shelfData.filter(i => i.status === status).sort((a,b) => (b.dateAdded?.seconds || 0) - (a.dateAdded?.seconds || 0));
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
    shelfData = await getShelf(currentUser.uid, 'anime');
    const recent = shelfData[shelfData.length-1];
    if(recent) {
        UI.hero.style.backgroundImage = `url(${recent.backdropUrl || recent.posterUrl})`;
        UI.hero.innerHTML = `<div class="hero-content"><h1>${recent.title}</h1><p class="hero-meta">Ep: ${recent.currentEpisode||0}/${recent.episodes} • ${recent.status}</p><button class="btn btn-primary" onclick="window.openItemModal('${recent.id}')">View Details</button></div>`;
    }
    renderStats(); renderCarousels();
};

window.openItemModal = (id) => {
    currentSelectedItem = shelfData.find(i => i.id === id);
    document.getElementById('modal-title').innerText = currentSelectedItem.title;
    document.getElementById('modal-img').src = currentSelectedItem.posterUrl;
    document.getElementById('modal-meta').innerText = `${currentSelectedItem.year} • ${currentSelectedItem.episodes} Episodes`;
    document.getElementById('modal-overview').innerText = currentSelectedItem.overview || 'No synopsis available.';
    document.getElementById('item-status').value = currentSelectedItem.status;
    document.getElementById('item-progress').value = currentSelectedItem.currentEpisode || 0;
    document.getElementById('item-rating').value = currentSelectedItem.userRating || '';
    document.getElementById('item-notes').value = currentSelectedItem.notes || '';
    document.getElementById('remove-item-btn').classList.remove('hidden');
    UI.itemModal.classList.remove('hidden');
};

let currentSearchResults = [];
window.openAddModal = (index) => {
    const item = currentSearchResults[index];
    currentSelectedItem = { id: item.apiId.toString(), ...item, status: 'Plan to Watch', userRating: '', notes: '', currentEpisode: 0 };
    document.getElementById('modal-title').innerText = item.title;
    document.getElementById('modal-img').src = item.posterUrl;
    document.getElementById('modal-meta').innerText = `${item.year} • ${item.episodes} Episodes`;
    document.getElementById('modal-overview').innerText = item.overview;
    document.getElementById('item-status').value = 'Plan to Watch';
    document.getElementById('item-progress').value = 0;
    document.getElementById('item-rating').value = '';
    document.getElementById('item-notes').value = '';
    document.getElementById('remove-item-btn').classList.add('hidden');
    UI.searchModal.classList.add('hidden');
    UI.itemModal.classList.remove('hidden');
};

let debounceTimer;
UI.searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        if(query.length < 3) return;
        currentSearchResults = await searchAnime(query);
        UI.searchResults.innerHTML = currentSearchResults.map((item, idx) => `
            <div class="card" onclick="window.openAddModal(${idx})">
                <img src="${item.posterUrl}" alt="Poster">
                <div class="card-overlay"><h4>${item.title}</h4></div>
            </div>
        `).join('');
    }, 800); // Higher debounce for Jikan rate limit
});

UI.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        ...currentSelectedItem,
        status: document.getElementById('item-status').value,
        currentEpisode: document.getElementById('item-progress').value,
        userRating: document.getElementById('item-rating').value,
        notes: document.getElementById('item-notes').value
    };
    if(shelfData.some(i => i.id === data.id)) await updateItem(currentUser.uid, 'anime', data.id, data);
    else await addItem(currentUser.uid, 'anime', data.id, data);
    showToast('Saved to shelf!');
    UI.itemModal.classList.add('hidden'); loadShelf();
});

document.getElementById('remove-item-btn').addEventListener('click', async () => {
    if(confirm("Remove this anime?")) { await deleteItem(currentUser.uid, 'anime', currentSelectedItem.id); UI.itemModal.classList.add('hidden'); loadShelf(); }
});

document.getElementById('search-trigger').addEventListener('click', () => { UI.searchModal.classList.remove('hidden'); UI.searchInput.focus(); });
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => { UI.searchModal.classList.add('hidden'); UI.itemModal.classList.add('hidden'); }));
document.getElementById('logout-btn').addEventListener('click', logout);
requireAuth(user => { currentUser = user; loadShelf(); });
