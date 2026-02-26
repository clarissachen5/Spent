// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "spent-e04c4.firebaseapp.com",
  projectId: "spent-e04c4",
  storageBucket: "spent-e04c4.firebasestorage.app",
  messagingSenderId: "647249410276",
  appId: "1:647249410276:web:ad13acfde23813869c14f1",
  measurementId: "G-DF4J53PL31"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);