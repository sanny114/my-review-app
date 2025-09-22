import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as FirebaseUser } from 'firebase/auth'
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db, onAuth } from '../firebase'
import { Problem, ReviewLog, RatingCode, User, AppDB } from '../types'
import { uid, nowIso } from '../utils'

// Context型定義
interface RealtimeStoreContextType {
  // 認証状態
  user: FirebaseUser | null
  isLoading: boolean
  
  // データ
  problems: Problem[]
  reviewLogs: ReviewLog[]
  
  // Actions
  addProblem: (problem: Omit<Problem, 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>
  updateProblem: (id: string, updates: Partial<Problem>) => Promise<void>
  deleteProblem: (id: string) => Promise<void>
  addReviewLog: (problemId: string, userId: User['id'], rating: RatingCode) => Promise<void>
  
  // 移行用
  migrateFromLocalStorage: () => Promise<void>
  
  // 従来のAPI互換性のため
  getDB: () => AppDB
}

const RealtimeStoreContext = createContext<RealtimeStoreContextType | null>(null)

// カスタムフック
export const useRealtimeStore = () => {
  const context = useContext(RealtimeStoreContext)
  if (!context) {
    throw new Error('useRealtimeStore must be used within RealtimeStoreProvider')
  }
  return context
}

// Provider コンポーネント
export const RealtimeStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [problems, setProblems] = useState<Problem[]>([])
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([])

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuth((firebaseUser) => {
      setUser(firebaseUser)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  // Firestoreリアルタイムリスナー
  useEffect(() => {
    if (!user) {
      setProblems([])
      setReviewLogs([])
      return
    }

    // 問題のリアルタイム監視
    const problemsQuery = query(
      collection(db, 'users', user.uid, 'problems'),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeProblems = onSnapshot(problemsQuery, (snapshot) => {
      const problemsData: Problem[] = []
      const seenIds = new Set<string>() // 重複排除用
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        const problem = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as Problem
        
        // 重複チェック (元のIDで)
        const originalId = data.id || doc.id
        if (!seenIds.has(originalId)) {
          seenIds.add(originalId)
          problemsData.push(problem)
        } else {
          console.warn('🚨 重複データ検出:', { docId: doc.id, originalId, text: data.text?.slice(0, 30) })
        }
      })
      
      console.log('📚 Problems loaded:', { total: snapshot.size, unique: problemsData.length, duplicates: snapshot.size - problemsData.length })
      setProblems(problemsData)
    })

    // レビューログのリアルタイム監視  
    const reviewLogsQuery = query(
      collection(db, 'users', user.uid, 'reviewLogs'),
      orderBy('reviewedAt', 'desc')
    )
    
    const unsubscribeReviewLogs = onSnapshot(reviewLogsQuery, (snapshot) => {
      const reviewLogsData: ReviewLog[] = []
      const seenIds = new Set<string>() // 重複排除用
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        const log = {
          id: doc.id,
          ...data,
          reviewedAt: data.reviewedAt?.toDate?.()?.toISOString() || data.reviewedAt,
        } as ReviewLog
        
        // 重複チェック (元のIDで)
        const originalId = data.id || doc.id
        if (!seenIds.has(originalId)) {
          seenIds.add(originalId)
          reviewLogsData.push(log)
        } else {
          console.warn('🚨 重複ログ検出:', { docId: doc.id, originalId, problemId: data.problemId })
        }
      })
      
      console.log('📊 ReviewLogs loaded:', { total: snapshot.size, unique: reviewLogsData.length, duplicates: snapshot.size - reviewLogsData.length })
      setReviewLogs(reviewLogsData)
    })

    return () => {
      unsubscribeProblems()
      unsubscribeReviewLogs()
    }
  }, [user])

  // Actions実装
  const addProblem = async (problemData: Omit<Problem, 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (!user) throw new Error('User not authenticated')
    
    // undefined 値を除去してクリーンなデータを作成
    const cleanData: any = {}
    let customId: string | undefined
    
    Object.keys(problemData).forEach(key => {
      const value = (problemData as any)[key]
      if (value !== undefined) {
        if (key === 'id') {
          customId = value // カスタムIDを取り出す
        } else {
          cleanData[key] = value
        }
      }
    })
    
    console.log('💾 問題保存データ:', { customId, cleanData })
    
    const dataToSave = {
      ...cleanData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    
    if (customId) {
      // カスタムIDが指定されている場合はsetDocを使用
      await setDoc(doc(db, 'users', user.uid, 'problems', customId), dataToSave)
    } else {
      // カスタムIDが指定されていない場合はaddDocを使用
      await addDoc(collection(db, 'users', user.uid, 'problems'), dataToSave)
    }
  }

  const updateProblem = async (id: string, updates: Partial<Problem>) => {
    if (!user) throw new Error('User not authenticated')
    
    // undefined 値を除去してクリーンなデータを作成
    const cleanUpdates: any = {}
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key]
      if (value !== undefined) {
        cleanUpdates[key] = value
      }
    })
    
    console.log('📝 問題更新データ:', { id, updates: cleanUpdates })
    console.log('🔍 現在のユーザー:', { uid: user.uid })
    console.log('🔍 更新パス:', `users/${user.uid}/problems/${id}`)
    
    try {
      const problemRef = doc(db, 'users', user.uid, 'problems', id)
      console.log('🔍 Firestore参照:', problemRef.path)
      
      await updateDoc(problemRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      })
      
      console.log('✅ 更新完了:', id)
    } catch (error) {
      console.error('❌ 更新失敗 - 詳細エラー:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: (error as any)?.code || 'unknown',
        id: id,
        updates: cleanUpdates,
        userUid: user.uid
      })
      throw error
    }
  }

  const deleteProblem = async (id: string) => {
    if (!user) throw new Error('User not authenticated')
    
    const batch = writeBatch(db)
    
    // 問題を削除
    const problemRef = doc(db, 'users', user.uid, 'problems', id)
    batch.delete(problemRef)
    
    // 関連するレビューログも削除
    const relatedLogs = reviewLogs.filter(log => log.problemId === id)
    relatedLogs.forEach(log => {
      const logRef = doc(db, 'users', user.uid, 'reviewLogs', log.id)
      batch.delete(logRef)
    })
    
    await batch.commit()
  }

  const addReviewLog = async (problemId: string, userId: User['id'], rating: RatingCode) => {
    if (!user) throw new Error('User not authenticated')
    
    await addDoc(collection(db, 'users', user.uid, 'reviewLogs'), {
      problemId,
      userId,
      rating,
      reviewedAt: serverTimestamp(),
    })
  }

  // LocalStorageからの移行
  const migrateFromLocalStorage = async () => {
    if (!user) throw new Error('User not authenticated')
    
    try {
      // 既存のLocalStorageデータを読み込み
      const rawData = localStorage.getItem('review-app-db-v1')
      if (!rawData) {
        console.log('No local data found to migrate')
        return
      }

      const localDB: AppDB = JSON.parse(rawData)
      const batch = writeBatch(db)

      // 問題を移行
      localDB.problems.forEach((problem) => {
        const problemRef = doc(collection(db, 'users', user.uid, 'problems'))
        batch.set(problemRef, {
          ...problem,
          createdAt: new Date(problem.createdAt),
          updatedAt: new Date(problem.updatedAt),
        })
      })

      // レビューログを移行
      localDB.reviewLogs.forEach((log) => {
        const logRef = doc(collection(db, 'users', user.uid, 'reviewLogs'))
        batch.set(logRef, {
          ...log,
          reviewedAt: new Date(log.reviewedAt),
        })
      })

      await batch.commit()
      
      // 移行完了後、LocalStorageをバックアップとして残す
      localStorage.setItem('review-app-db-v1-backup', rawData)
      
      console.log('Migration completed successfully!')
      alert('ローカルデータをクラウドに移行しました！これで全デバイスでリアルタイム同期されます 🎉')
      
    } catch (error) {
      console.error('Migration failed:', error)
      alert('データ移行に失敗しました。再度お試しください。')
    }
  }

  // 従来API互換のためのgetDB
  const getDB = (): AppDB => ({
    version: '1.0.0',
    users: [
      { id: 'rin', name: 'りん' },
      { id: 'yui', name: 'ゆい' }
    ],
    problems,
    reviewLogs,
    appSettings: {
      fixedSubjects: ['漢字', '算数'],
      defaultReviewOptions: {
        repeatMistakes: true,
        repeatWithinSession: true
      },
      defaultSortOrder: 'newest'
    }
  })

  const value: RealtimeStoreContextType = {
    user,
    isLoading,
    problems,
    reviewLogs,
    addProblem,
    updateProblem,
    deleteProblem,
    addReviewLog,
    migrateFromLocalStorage,
    getDB
  }

  return (
    <RealtimeStoreContext.Provider value={value}>
      {children}
    </RealtimeStoreContext.Provider>
  )
}
