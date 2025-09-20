// src/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { getFirestore, serverTimestamp, collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
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

// Storage helpers for image upload
export const uploadProblemImage = async (uid: string, problemId: string, file: File): Promise<string> => {
  const imageRef = ref(storage, `users/${uid}/problems/${problemId}/image_${Date.now()}`)
  const snapshot = await uploadBytes(imageRef, file)
  return await getDownloadURL(snapshot.ref)
}

export const deleteProblemImage = async (imageUrl: string): Promise<void> => {
  try {
    const imageRef = ref(storage, imageUrl)
    await deleteObject(imageRef)
  } catch (error) {
    console.warn('Failed to delete image:', error)
  }
}
