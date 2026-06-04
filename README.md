# Entertainment Shelf

A comprehensive, pure-frontend personal media tracker built with HTML, CSS, JavaScript (ES Modules), and Firebase. Track your movies, series, books, and anime in one place with a premium, Netflix-like dark mode aesthetic.

## Features
- **Multi-Media Tracking:** Dedicated sections for Movies/Series, Books, and Anime.
- **External API Integrations:** - TMDB API (Movies/Series)
  - Google Books API (Books)
  - Jikan v4 API (Anime)
  - Streaming Availability via RapidAPI
- **Firebase Backend:** Secure Google Authentication and Firestore for real-time CRUD operations.
- **Pure Static Frontend:** Zero build tools required. Deployable anywhere.
- **Dynamic Theming:** Dark, AMOLED (Pure Black), and Light modes.

## Setup Instructions

### 1. API Keys Needed
You will need to replace the placeholder keys in the JavaScript files:
- **Firebase:** Update `firebaseConfig` in `js/firebase.js`.
- **TMDB:** Get a free key from [The Movie Database](https://www.themoviedb.org/documentation/api) and paste it in `js/tmdb.js`.
- **Google Books:** Get a free API key from Google Cloud Console and paste it in `js/books-api.js`.
- **RapidAPI Streaming:** Get a key from [Streaming Availability](https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability) and paste it in `js/streaming.js`.
- *(Note: Jikan v4 for Anime does not require an API key).*

### 2. Firebase Configuration
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project and add a Web App.
3. Go to **Authentication** > Sign-in method > Enable **Google**.
4. Go to **Firestore Database** > Create Database.

### 3. Firestore Security Rules
Go to your Firestore Database rules and paste the following to ensure secure read/write access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      // Allow read/write only if the user is signed in and requests their own path
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
