import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from './firebase'

// デバッグ版のログイン関数
export const debugSignInGoogle = async () => {
  try {
    console.log('🔐 Google認証開始...')
    console.log('Auth config:', {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.slice(0, 10) + '...',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
    })
    
    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')
    
    const result = await signInWithPopup(auth, provider)
    console.log('✅ 認証成功:', result.user.email)
    return result
  } catch (error: any) {
    console.error('❌ 認証エラー詳細:', {
      code: error.code,
      message: error.message,
      details: error
    })
    throw error
  }
}
