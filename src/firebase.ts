// src/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { getFirestore, serverTimestamp, collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
const provider = new GoogleAuthProvider()

export const signInGoogle = () => signInWithPopup(auth, provider)
export const signOutGoogle = () => signOut(auth)
export const onAuth = (cb: (u: User|null) => void) => onAuthStateChanged(auth, cb)

// Firestore helpers（コレクション設計：users/{uid}/problems & reviewLogs）
export const paths = (uid: string) => ({
  problems: collection(db, 'users', uid, 'problems'),
  reviewLogs: collection(db, 'users', uid, 'reviewLogs')
})

export const stamp = () => serverTimestamp()
