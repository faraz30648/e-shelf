const firebaseConfig = {
    apiKey: "AIzaSyDP6aEk0kgGD1AHvrik6wgNDe0d3bnl01I",
    authDomain: "e-shelf-8ecd7.firebaseapp.com",
    projectId: "e-shelf-8ecd7",
    storageBucket: "e-shelf-8ecd7.firebasestorage.app",
    messagingSenderId: "265591028174",
    appId: "1:265591028174:web:c56eacc042346f4c84939f"
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
