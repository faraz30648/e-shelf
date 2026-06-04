import { requireAuth, logout, getShelf, addItem, updateItem, deleteItem } from './firebase.js';
import { searchBooks } from './books-api.js';

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
    const pages = shelfData.filter(i => i.status === 'Completed').reduce((acc, i) => acc + (Number(i.pages)||0), 0);
    UI.statsPanel.innerHTML = `
        <div class="stat-box"><div class="num">${total}</div><div class="label">Total Books</div></div>
        <div class="stat-box"><div class="num">${completed}</div><div class="label">Read</div></div>
        <div class="stat-box"><div class="num">${pages}</div><div class="label">Pages Read</div></div>
    `;
};

const renderCarousels = () => {
    const statuses = ['Reading', 'Completed', 'Plan to Read', 'Dropped', 'On Hold'];
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
    shelfData = await getShelf(currentUser.uid, 'books');
    const recent = shelfData[shelfData.length-1];
    if(recent) {
        UI.hero.innerHTML = `<div class="hero-content"><h1>${recent.title}</h1><p class="hero-meta">${recent.author} • ${recent.status}</p><button class="btn btn-primary" onclick="window.openItemModal('${recent.id}')">View Details</button></div>`;
    }
    renderStats(); renderCarousels();
};

window.openItemModal = (id) => {
    currentSelectedItem = shelfData.find(i => i.id === id);
    document.getElementById('modal-title').innerText = currentSelectedItem.title;
    document.getElementById('modal-img').src = currentSelectedItem.posterUrl;
    document.getElementById('modal-meta').innerText = `${currentSelectedItem.author} • ${currentSelectedItem.year} • ${currentSelectedItem.pages} pages`;
    document.getElementById('modal-overview').innerText = currentSelectedItem.overview;
    document.getElementById('item-status').value = currentSelectedItem.status;
    document.getElementById('item-progress').value = currentSelectedItem.currentPage || 0;
    document.getElementById('item-rating').value = currentSelectedItem.userRating || '';
    document.getElementById('item-notes').value = currentSelectedItem.notes || '';
    document.getElementById('remove-item-btn').classList.remove('hidden');
    UI.itemModal.classList.remove('hidden');
};

let currentSearchResults = [];
window.openAddModal = (index) => {
    const item = currentSearchResults[index];
    currentSelectedItem = { id: item.apiId, ...item, status: 'Plan to Read', userRating: '', notes: '', currentPage: 0 };
    document.getElementById('modal-title').innerText = item.title;
    document.getElementById('modal-img').src = item.posterUrl;
    document.getElementById('modal-meta').innerText = `${item.author} • ${item.year}`;
    document.getElementById('modal-overview').innerText = item.overview;
    document.getElementById('item-status').value = 'Plan to Read';
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
        currentSearchResults = await searchBooks(query);
        UI.searchResults.innerHTML = currentSearchResults.map((item, idx) => `
            <div class="card" onclick="window.openAddModal(${idx})">
                <img src="${item.posterUrl || 'https://via.placeholder.com/150x225?text=No+Image'}" alt="Poster">
                <div class="card-overlay"><h4>${item.title}</h4></div>
            </div>
        `).join('');
    }, 500);
});

UI.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        ...currentSelectedItem,
        status: document.getElementById('item-status').value,
        currentPage: document.getElementById('item-progress').value,
        userRating: document.getElementById('item-rating').value,
        notes: document.getElementById('item-notes').value
    };
    if(shelfData.some(i => i.id === data.id)) await updateItem(currentUser.uid, 'books', data.id, data);
    else await addItem(currentUser.uid, 'books', data.id, data);
    showToast('Saved to shelf!');
    UI.itemModal.classList.add('hidden'); loadShelf();
});

document.getElementById('remove-item-btn').addEventListener('click', async () => {
    if(confirm("Remove this book?")) { await deleteItem(currentUser.uid, 'books', currentSelectedItem.id); UI.itemModal.classList.add('hidden'); loadShelf(); }
});

document.getElementById('search-trigger').addEventListener('click', () => { UI.searchModal.classList.remove('hidden'); UI.searchInput.focus(); });
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => { UI.searchModal.classList.add('hidden'); UI.itemModal.classList.add('hidden'); }));
document.getElementById('logout-btn').addEventListener('click', logout);
requireAuth(user => { currentUser = user; loadShelf(); });
