// firebase.ts

import { initializeApp } from "firebase/app";
import { Platform } from "react-native";

// 🔥 Firebase config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "spent-e04c4.firebaseapp.com",
  projectId: "spent-e04c4",
  storageBucket: "spent-e04c4.firebasestorage.app",
  messagingSenderId: "647249410276",
  appId: "1:647249410276:web:ad13acfde23813869c14f1",
  measurementId: "G-DF4J53PL31",
};

// Initialize Firebase (this part is GOOD)
export const app = initializeApp(firebaseConfig);

// Firestore instance — used for storing detected locations
export { getFirestore } from "firebase/firestore";

// ✅ Analytics: WEB ONLY
export let analytics: any = null;

if (Platform.OS === "web") {
  // Dynamic import so native builds never include analytics
  import("firebase/analytics").then(async ({ getAnalytics, isSupported }) => {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}