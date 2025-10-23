
// FIX: Use modular imports for Firebase to ensure consistency and resolve import errors.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBipNaUdqrQPLD_UF29RK8J1DOEWMFnr-I",
  authDomain: "smart-attendance-36076.firebaseapp.com",
  projectId: "smart-attendance-36076",
  storageBucket: "smart-attendance-36076.firebasestorage.app",
  messagingSenderId: "570161749271",
  appId: "1:570161749271:web:74221fe65ba5b94cebab52",
  measurementId: "G-52C5D8BRW7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
