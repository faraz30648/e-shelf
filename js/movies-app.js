// movies-app.js - Unified App Controller
import { checkAuthState, logout, getLibrary, saveItem, deleteItem } from './firebase.js';
import { searchMedia, getDetails, discoverMedia } from './tmdb.js';

let currentUser = null;
let libraryData = [];
let currentDrawerItem = null;

// --- UTILS & CORE ---
const $ = id => document.getElementById(id);
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : 'N/A';
const fireConfetti = (x, y) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#00e054', '#40bcf4', '#ff8000', '#e50914'];
    for (let i = 0; i < 30; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = x + 'px'; c.style.top = y + 'px';
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.setProperty('--tx', `${(Math.random() - 0.5) * 200}px`);
        c.style.setProperty('--ty', `${(Math.random() - 1) * 200}px`);
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 1000);
    }
};

// --- INIT & RENDER ---
checkAuthState(async (user) => {
    if (!user) { window.location.replace('index.html'); return; }
    currentUser = user;
    $('user-avatar').src = user.photoURL \vert{}\vert{} 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';$('user-name').textContent = user.displayName || 'User';
    await loadLibrary();
});

$('logout-btn').addEventListener('click', logout);

const loadLibrary = async () => {
    try {
        libraryData = await getLibrary(currentUser.uid);
        renderGrid();
        updateStats();
    } catch (e) {
        console.error("Error loading library", e);
        $('library-grid').innerHTML = '<p class="error">Failed to load library.</p>';
    }
};

const renderGrid = () => {
    const grid = $('library-grid');
    const q = $('library-search').value.toLowerCase();
    const typeF = $('filter-type').value;
    const statF = $('filter-status').value;
    const [sortF, sortDir] = $('sort-by').value.split('-');

    let filtered = libraryData.filter(item => {
        if (q && !item.title.toLowerCase().includes(q)) return false;
        if (typeF !== 'all' && item.type !== typeF) return false;
        if (statF !== 'all' && item.status !== statF) return false;
        return true;
    });

    filtered.sort((a, b) => {
        let valA = a[sortF] || ''; let valB = b[sortF] || '';
        if(sortF === 'rating' || sortF === 'year') { valA = Number(valA); valB = Number(valB); }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    grid.innerHTML = filtered.map(item => `
        <div class="card" data-id="${item.docId}" tabindex="0">
            <img src="${item.posterUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}" alt="${item.title}" loading="lazy">
            <div class="card-badge">${item.type === 'tv' ? 'TV' : 'MOV'}</div>
            <div class="card-overlay">
                <div class="card-title">${item.title}</div>
                <div class="card-meta">${item.year} • ${item.rating ? '★'+item.rating : (item.reaction === 'loved' ? '❤️' : (item.reaction === 'liked' ? '👍' : ''))}</div>
            </div>
        </div>
    `).join('') || '<p class="subtext" style="grid-column: 1/-1;">No titles found.</p>';

    grid.querySelectorAll('.card').forEach(c => {
        c.addEventListener('click', () => openDrawer(c.dataset.id));
        c.addEventListener('keypress', (e) => { if(e.key==='Enter') openDrawer(c.dataset.id) });
    });
};

['library-search', 'filter-type', 'filter-status', 'sort-by'].forEach(id => {
    $(id).addEventListener('input', renderGrid);
});

const updateStats = () => {
    const movies = libraryData.filter(i => i.type === 'movie').length;
    const tv = libraryData.filter(i => i.type === 'tv').length;
    const rated = libraryData.filter(i => i.rating);
    const avg = rated.length ? (rated.reduce((a, b) => a + Number(b.rating), 0) / rated.length).toFixed(1) : '-';
    $('stats-strip').innerHTML = `
        <span><strong>${libraryData.length}</strong> Titles</span>
        <span><strong>${movies}</strong> Movies</span>
        <span><strong>${tv}</strong> Series</span>
        <span><strong>★ ${avg}</strong> Avg</span>
    `;
};

// --- DRAWER ---
const openDrawer = (docId) => {
    currentDrawerItem = libraryData.find(i => i.docId === docId);
    if (!currentDrawerItem) return;
    const i = currentDrawerItem;
    
    $('drawer-poster').src = i.posterUrl || '';
    document.querySelector('.drawer-backdrop-img').style.backgroundImage = `url(${i.backdropUrl || i.posterUrl})`;
    $('drawer-title').textContent = i.title;
    $('drawer-meta').textContent = `${i.year} • ${i.type === 'tv' ? 'Series' : 'Movie'} • ${i.genres?.join(', ') || ''}`;
    $('drawer-overview').textContent = i.overview \vert{}\vert{} '';$('d-status').value = i.status || 'Watched';
    $('d-platform').value = i.platform \vert{}\vert{} 'None';$('d-rating').value = i.rating || '';
    $('d-reaction').value = i.reaction \vert{}\vert{} '';$('d-date').value = i.dateWatched ? i.dateWatched.split('T')[0] : '';
    $('d-note').value = i.note || '';

    const seriesGroup = $('d-series-group');
    if (i.type === 'tv') {
        seriesGroup.hidden = false;
        $('d-season').value = i.progress?.season || '';
        $('d-episode').value = i.progress?.episode || '';
        $('d-finished').checked = !!i.progress?.finished;
    } else {
        seriesGroup.hidden = true;
    }

    $('drawer-backdrop').hidden = false;
    $('detail-drawer').setAttribute('aria-hidden', 'false');

    // Streaming API hook
    const streamDiv = $('streaming-placeholder');
    if(window.streamingAPI?.getStreaming) {
        streamDiv.innerHTML = 'Loading streams...';
        window.streamingAPI.getStreaming(i.tmdbId).then(html => streamDiv.innerHTML = html).catch(()=> streamDiv.innerHTML='');
    }
};

const closeDrawer = () => {
    $('drawer-backdrop').hidden = true;
    $('detail-drawer').setAttribute('aria-hidden', 'true');
    currentDrawerItem = null;
};
$('drawer-close').addEventListener('click', closeDrawer);$('drawer-backdrop').addEventListener('click', closeDrawer);

$('drawer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentDrawerItem) return;
    const btn = e.target.querySelector('button[type="submit"]');
    const ogText = btn.textContent;
    btn.textContent = 'Saving...';
    
    const updates = {
        status: $('d-status').value,
        platform: $('d-platform').value,
        rating: Number($('d-rating').value) || null,
        reaction: $('d-reaction').value || null,
        dateWatched: $('d-date').value ? new Date($('d-date').value).toISOString() : null,
        note: $('d-note').value,
    };
    if (currentDrawerItem.type === 'tv') {
        updates.progress = {
            season: Number($('d-season').value) || null,
            episode: Number($('d-episode').value) || null,
            finished: $('d-finished').checked
        };
    }

    const payload = { ...currentDrawerItem, ...updates };
    try {
        const saved = await saveItem(currentUser.uid, payload);
        const idx = libraryData.findIndex(item => item.docId === saved.docId);
        if(idx > -1) libraryData[idx] = saved;
        renderGrid(); updateStats(); closeDrawer();
    } catch(err) { alert('Failed to save.'); }
    btn.textContent = ogText;
});

$('d-delete').addEventListener('click', async () => {
    if (!currentDrawerItem || !confirm(`Delete ${currentDrawerItem.title}?`)) return;
    await deleteItem(currentUser.uid, currentDrawerItem.docId);
    libraryData = libraryData.filter(i => i.docId !== currentDrawerItem.docId);
    renderGrid(); updateStats(); closeDrawer();
});


// --- ADD FLOW (SEARCH, PASTE, CSV, SWIPE) ---
$('add-btn-main').addEventListener('click', () => {$('add-sheet').hidden = false;
    $('add-sheet').setAttribute('aria-hidden', 'false');$('add-search-input').focus();
});
$('close-sheet').addEventListener('click', () => {$('add-sheet').hidden = true;
    $('add-sheet').setAttribute('aria-hidden', 'true');
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.hidden = true);
        tab.classList.add('active');
        $(tab.dataset.target).hidden = false;
    });
});

// 1. Search Tab
let searchTimer;
$('add-search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    if(query.length < 2) { $('add-search-results').innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
        const results = await searchMedia(query);
        $('add-search-results').innerHTML = results.map(item => `
            <div class="card" data-api="${item.apiId}" data-type="${item.type}">
                <img src="${item.posterUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}">
                <div class="card-badge">${item.type==='tv'?'TV':'MOV'}</div>
                <div class="card-overlay"><div class="card-title">${item.title}</div><div class="card-meta">${item.year}</div></div>
            </div>
        `).join('');
        $('add-search-results').querySelectorAll('.card').forEach(c => {
            c.addEventListener('click', () => openQuickAdd(c.dataset.api, c.dataset.type, c));
        });
    }, 400);
});

// Quick Add Panel
let qaCurrentItem = null;
const openQuickAdd = async (apiId, type, triggerEl) => {
    qaCurrentItem = await getDetails(apiId, type);
    $('qa-title').textContent = qaCurrentItem.title;
    $('qa-meta').textContent = `${qaCurrentItem.year} • ${type==='tv'?'Series':'Movie'}`;
    $('qa-poster').src = qaCurrentItem.posterUrl;
    
    document.querySelectorAll('.btn-reaction').forEach(b => b.classList.remove('active'));
    $('qa-status').value = 'Watched';$('qa-platform').value = 'Other';
    
    if(type === 'tv') {
        $('qa-series-group').hidden = false;
        $('qa-season').value = '';$('qa-episode').value = '';
        $('qa-btn-finished').onclick = (e) => { e.preventDefault();$('qa-season').value = qaCurrentItem.totalSeasons; $('qa-episode').value = '1'; };     } else {$('qa-series-group').hidden = true;
    }
    
    $('quick-add-panel').hidden = false;
    qaCurrentItem._triggerEl = triggerEl; // For animation pos
};
$('qa-close').addEventListener('click', () =>$('quick-add-panel').hidden = true);
document.querySelectorAll('.btn-reaction').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-reaction').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});
$('qa-save').addEventListener('click', async (e) => {
    if(!qaCurrentItem) return;
    const btn = e.target; btn.textContent = '...';
    const activeReact = document.querySelector('.btn-reaction.active');
    
    const payload = {
        tmdbId: qaCurrentItem.apiId,
        type: qaCurrentItem.type,
        title: qaCurrentItem.title,
        year: qaCurrentItem.year,
        posterUrl: qaCurrentItem.posterUrl,
        backdropUrl: qaCurrentItem.backdropUrl,
        overview: qaCurrentItem.overview,
        genres: qaCurrentItem.genres,
        runtime: qaCurrentItem.runtime,
        status: $('qa-status').value,
        platform: $('qa-platform').value,
        reaction: activeReact ? activeReact.dataset.val : null,
        rating: activeReact ? Number(activeReact.dataset.rating) : null,
        dateWatched: new Date().toISOString(),
        source: 'manual'
    };
    if(payload.type === 'tv') {
        payload.progress = { season: Number($('qa-season').value)\vert{}\vert{}null, episode: Number($('qa-episode').value)||null, finished: false };
    }
    
    try {
        const saved = await saveItem(currentUser.uid, payload);
        if(!libraryData.find(i => i.docId === saved.docId)) libraryData.unshift(saved);
        renderGrid(); updateStats();
        $('quick-add-panel').hidden = true;
        btn.textContent = 'Save to Library';
        if(qaCurrentItem._triggerEl) {
            const rect = qaCurrentItem._triggerEl.getBoundingClientRect();
            fireConfetti(rect.left + rect.width/2, rect.top + rect.height/2);
        }
    } catch(err) { alert('Error saving'); btn.textContent = 'Save to Library'; }
});

// 2. CSV Import (Netflix/Prime)
$('csv-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    const rows = text.split('\n').map(r => r.split(',(?=(?:(?:[^"]*"){2})*[^"]*$)/').map(c => c.replace(/^"\vert{}"$/g, '').trim()));
    if(rows.length < 2) return alert('Invalid CSV');
    
    const headers = rows[0].map(h => h.toLowerCase());
    const titleIdx = headers.findIndex(h => h.includes('title'));
    const dateIdx = headers.findIndex(h => h.includes('date'));
    if(titleIdx === -1) return alert('No Title column found');

    const parsedData = {}; // Deduplicate series
    for(let i=1; i<rows.length; i++) {
        if(!rows[i][titleIdx]) continue;
        let rawTitle = rows[i][titleIdx];
        let date = dateIdx > -1 ? rows[i][dateIdx] : null;
        
        // Netflix Series extraction: "Show Name: Season X: Ep Y"
        let isTv = false;
        let cleanTitle = rawTitle;
        if(rawTitle.includes(': Season') || rawTitle.includes(': Limited Series') || rawTitle.includes(': Part')) {
            isTv = true;
            cleanTitle = rawTitle.split(':')[0].trim();
        }
        
        if(!parsedData[cleanTitle]) parsedData[cleanTitle] = { title: cleanTitle, date, isTv, count: 1 };
        else {
            parsedData[cleanTitle].count++;
            // rudimentary date max (assuming YYYY-MM-DD or parseable)
            if(date && new Date(date) > new Date(parsedData[cleanTitle].date)) parsedData[cleanTitle].date = date;
        }
    }
    
    $('csv-progress').hidden = false;
    const items = Object.values(parsedData);
    const reviewItems = [];
    
    for(let i=0; i<items.length; i++) {
        $('csv-progress').firstElementChild.style.width = `${((i+1)/items.length)*100}%`;
        const hits = await searchMedia(items[i].title);
        // Try to match type if we guessed it, else take top hit
        let best = hits[0];
        if(hits.length > 0 && items[i].isTv) {
            const tvHit = hits.find(h => h.type === 'tv');
            if(tvHit) best = tvHit;
        }
        
        if(best) {
            // Skip if in library
            const docId = `${best.apiId}_${best.type}`;
            if(!libraryData.find(lib => lib.docId === docId)) {
                reviewItems.push({ original: items[i], bestMatch: best, docId });
            }
        }
        // Artificial delay for rate limits
        await new Promise(r => setTimeout(r, 200)); 
    }
    
    $('csv-progress').hidden = true;
    $('csv-review-area').hidden = false;
    $('csv-match-count').textContent = reviewItems.length;
    
    $('csv-review-list').innerHTML = reviewItems.map((r, i) => `
        <div class="review-item">
            <input type="checkbox" id="csv-chk-${i}" checked>
            <img src="${r.bestMatch.posterUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}">
            <div class="info">
                <strong>${r.bestMatch.title} (${r.bestMatch.year})</strong>
                <div class="subtext">From: ${r.original.title} ${r.original.isTv ? `(${r.original.count} eps)` : ''}</div>
            </div>
        </div>
    `).join('');
    
    $('csv-save-btn').onclick = async () => {
        const btn = $('csv-save-btn'); btn.textContent = 'Importing...';
        for(let i=0; i<reviewItems.length; i++) {
            if($(`csv-chk-${i}`).checked) {
                const r = reviewItems[i];
                const full = await getDetails(r.bestMatch.apiId, r.bestMatch.type);
                await saveItem(currentUser.uid, {
                    tmdbId: full.apiId, type: full.type, title: full.title, year: full.year,
                    posterUrl: full.posterUrl, backdropUrl: full.backdropUrl, overview: full.overview,
                    status: 'Watched', platform: 'Netflix', dateWatched: r.original.date ? new Date(r.original.date).toISOString() : new Date().toISOString(),
                    source: 'netflix-import'
                });
                await new Promise(res => setTimeout(res, 200)); // Rate limit
            }
        }
        await loadLibrary();
        btn.textContent = 'Import Checked Items';
        $('csv-review-area').hidden = true;
        alert('Import complete!');
    };
});

// 3. Swipe Deck
let swipeDeck = [];
let swipeIndex = 0;
let isDragging = false;
let startX = 0, startY = 0, currX = 0, currY = 0;

const loadSwipeDeck = async () => {
    const type = $('swipe-type').value;
    const plat = $('swipe-platform').value;
    const btn = $('swipe-load-btn');
    btn.textContent = 'Loading...';
    try {
        const results = await discoverMedia(type, plat);
        // Exclude already library
        swipeDeck = results.filter(r => !libraryData.find(l => l.tmdbId === r.apiId));
        swipeIndex = 0;
        renderSwipeDeck();
    } catch(e) { alert("Failed to load deck."); }
    btn.textContent = 'Load Deck';
};
$('swipe-load-btn').addEventListener('click', loadSwipeDeck);

const renderSwipeDeck = () => {
    const container = $('swipe-deck');
    container.innerHTML = '';
    if(swipeIndex >= swipeDeck.length) { container.innerHTML = '<p class="subtext text-center mt-2">No more titles. Try changing filters.</p>'; return; }
    
    // Render top 3 for 3D effect
    for(let i = Math.min(swipeIndex + 2, swipeDeck.length - 1); i >= swipeIndex; i--) {
        const item = swipeDeck[i];
        const card = document.createElement('div');
        card.className = 'swipe-card';
        card.dataset.index = i;
        const offset = i - swipeIndex;
        card.style.transform = `scale(${1 - offset*0.05}) translateY(${offset*15}px)`;
        card.style.zIndex = 100 - offset;
        
        card.innerHTML = `
            <img src="${item.posterUrl}" draggable="false">
            <div class="swipe-info">
                <h3>${item.title} (${item.year})</h3>
                <p class="subtext" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${item.overview}</p>
            </div>
        `;
        
        if(i === swipeIndex) attachSwipeEvents(card);
        container.appendChild(card);
    }
};

const attachSwipeEvents = (card) => {
    const handleDown = (e) => {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        card.style.transition = 'none';
    };
    const handleMove = (e) => {
        if(!isDragging) return;
        const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const y = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        currX = x - startX; currY = y - startY;
        const rot = currX * 0.05;
        card.style.transform = `translate(${currX}px, ${currY}px) rotate(${rot}deg)`;
    };
    const handleUp = () => {
        if(!isDragging) return;
        isDragging = false;
        card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        if(currX > 100) swipeAction('seen');
        else if(currX < -100) swipeAction('skip');
        else if(currY < -100) swipeAction('loved');
        else card.style.transform = 'translate(0px, 0px) rotate(0deg)'; // reset
        currX = 0; currY = 0;
    };
    
    card.addEventListener('mousedown', handleDown); window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
    card.addEventListener('touchstart', handleDown); window.addEventListener('touchmove', handleMove); window.addEventListener('touchend', handleUp);
};

const swipeAction = async (action) => {
    const item = swipeDeck[swipeIndex];
    if(!item) return;
    
    if(action === 'seen' || action === 'loved') {
        const full = await getDetails(item.apiId, item.type);
        const payload = {
            tmdbId: full.apiId, type: full.type, title: full.title, year: full.year,
            posterUrl: full.posterUrl, backdropUrl: full.backdropUrl, overview: full.overview,
            status: 'Watched', dateWatched: new Date().toISOString(), source: 'swipe'
        };
        if(action === 'loved') { payload.reaction = 'loved'; payload.rating = 9; }
        
        const saved = await saveItem(currentUser.uid, payload);
        libraryData.unshift(saved);
        renderGrid(); updateStats();
        fireConfetti(window.innerWidth/2, window.innerHeight/2);
    }
    
    swipeIndex++;
    renderSwipeDeck();
};

$('swipe-btn-left').addEventListener('click', () => swipeAction('skip'));
$('swipe-btn-right').addEventListener('click', () => swipeAction('seen'));$('swipe-btn-up').addEventListener('click', () => swipeAction('loved'));
