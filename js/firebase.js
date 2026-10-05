// firebase.js
const firebaseConfig = {
    apiKey: "AIzaSyDP6aEk0kgGD1AHvrik6wgNDe0d3bnl01I",
    authDomain: "e-shelf-8ecd7.firebaseapp.com",
    projectId: "e-shelf-8ecd7",
    storageBucket: "e-shelf-8ecd7.firebasestorage.app",
    messagingSenderId: "265591028174",
    appId: "1:265591028174:web:c56eacc042346f4c84939f"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

export const checkAuthState = (callback) => {
    auth.onAuthStateChanged(callback);
};

export const initAuth = () => {
    const loginBtn = document.getElementById('google-login-btn');
    if(loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const btnSpinner = loginBtn.querySelector('.btn-spinner');
            const errDiv = document.getElementById('login-error');
            errDiv.style.display = 'none';
            if(btnSpinner) btnSpinner.style.display = 'block';
            
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
            } catch (error) {
                console.error("Login failed", error);
                errDiv.textContent = error.message;
                errDiv.style.display = 'block';
            } finally {
                if(btnSpinner) btnSpinner.style.display = 'none';
            }
        });
    }
};

export const logout = () => {
    auth.signOut().then(() => window.location.replace('index.html'));
};

// We continue using 'movies' collection to not break old data, but treat it as 'library'
export const getLibrary = async (uid) => {
    const snapshot = await db.collection('users').doc(uid).collection('movies').get();
    return snapshot.docs.map(doc => {
        let data = doc.data();
        // MIGRATION MAPPER (Old format -> New format)
        if (!data.tmdbId) data.tmdbId = doc.id;
        if (!data.type) data.type = 'movie'; 
        if (!data.status) data.status = 'Watched';
        if (!data.createdAt) data.createdAt = data.dateAdded || new Date().toISOString();
        if (data.rating && !data.reaction) {
            if (data.rating >= 8) data.reaction = 'loved';
            else if (data.rating >= 6) data.reaction = 'liked';
            else if (data.rating >= 4) data.reaction = 'meh';
            else data.reaction = 'nope';
        }
        return { docId: doc.id, ...data };
    });
};

export const saveItem = async (uid, data) => {
    const docId = `${data.tmdbId}_${data.type}`;
    const payload = {
        ...data,
        updatedAt: new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString()
    };
    await db.collection('users').doc(uid).collection('movies').doc(docId).set(payload, { merge: true });
    return { docId, ...payload };
};

export const deleteItem = async (uid, docId) => {
    await db.collection('users').doc(uid).collection('movies').doc(docId).delete();
};
