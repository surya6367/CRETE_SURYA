// www/firebase-setup.js

// Firebase Configuration (Updated with your credentials)
const firebaseConfig = {
    apiKey: "AIzaSyBQM0KrwvcsUckhJArkvAhPMD1_n_ytuoM",
    authDomain: "freefiretournament-5d4f5.firebaseapp.com",
    projectId: "freefiretournament-5d4f5",
    storageBucket: "freefiretournament-5d4f5.firebasestorage.app",
    messagingSenderId: "80370183123",
    appId: "1:80370183123:web:6e56e89b67b7ff87551d26",
    databaseURL: "https://freefiretournament-5d4f5-default-rtdb.firebaseio.com" // Realtime Database URL
};

// Initialize Firebase
const appInstance = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();