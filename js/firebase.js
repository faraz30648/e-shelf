const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

export const initAuth = () => {
    const loginBtn = document.getElementById('google-login-btn');
    if(loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
                window.location.href = 'movies.html';
            } catch (error) {
                console.error("Login failed", error);
                alert("Login failed: " + error.message);
            }
        });
    }
};

export const requireAuth = (callback) => {
    auth.onAuthStateChanged(user => {
        if (!user) window.location.href = 'index.html';
        else {
            sessionStorage.setItem('uid', user.uid);
            if(document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL || '';
            callback(user);
        }
    });
};

export const logout = () => {
    auth.signOut().then(() => window.location.href = 'index.html');
};

export const getShelf = async (uid, section) => {
    const snapshot = await db.collection('users').doc(uid).collection(section).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addItem = async (uid, section, itemId, data) => {
    await db.collection('users').doc(uid).collection(section).doc(itemId.toString()).set({
        ...data,
        dateAdded: firebase.firestore.FieldValue.serverTimestamp()
    });
};

export const updateItem = async (uid, section, itemId, data) => {
    await db.collection('users').doc(uid).collection(section).doc(itemId.toString()).update(data);
};

export const deleteItem = async (uid, section, itemId) => {
    await db.collection('users').doc(uid).collection(section).doc(itemId.toString()).delete();
};
