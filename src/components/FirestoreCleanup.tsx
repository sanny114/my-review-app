import { useState } from 'react'
import { useRealtimeStore } from '../stores/RealtimeStore'
import App from '../App'
import { getDocs, collection, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'

export default function FirestoreCleanup() {
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const realtimeStore = useRealtimeStore()

  const forceCleanupFirestore = async () => {
    if (!realtimeStore.user) {
      alert('この操作にはログインが必要です')
      return
    }

    const confirmMessage = [
      '⚠️ 緊急用Firestoreクリーンアップ',
      '',
      'Firestoreの重複・ゴーストデータを完全削除します。',
      '',
      '⚠️ 危険な操作：',
      '- 現在表示されている問題のみ保持',
      '- 他の重複データは削除されます',
      '',
      '続行しますか？'
    ].join('\n')
    
    if (!confirm(confirmMessage)) return

    setIsProcessing(true)
    setStatus('🔄 Firestoreクリーンアップを開始...')

    try {
      // Firestoreから全問題を取得
      const problemsSnapshot = await getDocs(collection(db, 'users', realtimeStore.user.uid, 'problems'))
      const reviewLogsSnapshot = await getDocs(collection(db, 'users', realtimeStore.user.uid, 'reviewLogs'))

      setStatus(prev => prev + `\n📊 Firestore問題: ${problemsSnapshot.size}件`)
      setStatus(prev => prev + `\n📊 Firestoreログ: ${reviewLogsSnapshot.size}件`)
      setStatus(prev => prev + `\n📊 表示中問題: ${realtimeStore.problems.length}件`)

      // 表示中の問題IDセットを作成
      const validProblemIds = new Set(realtimeStore.problems.map(p => p.id))
      setStatus(prev => prev + `\n🎯 有効ID数: ${validProblemIds.size}件`)

      const batch = writeBatch(db)
      let deleteCount = 0

      // 表示中にない問題を削除
      problemsSnapshot.forEach((doc) => {
        const data = doc.data()
        const originalId = data.id || doc.id
        
        if (!validProblemIds.has(originalId)) {
          console.log(`🗑️ 削除対象問題: ${doc.id} (${data.text?.slice(0, 20)}...)`)
          batch.delete(doc.ref)
          deleteCount++
        }
      })

      // 孤立したレビューログを削除
      reviewLogsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (!validProblemIds.has(data.problemId)) {
          console.log(`🗑️ 削除対象ログ: ${doc.id} (問題ID: ${data.problemId})`)
          batch.delete(doc.ref)
          deleteCount++
        }
      })

      setStatus(prev => prev + `\n🗑️ 削除対象: ${deleteCount}件`)

      if (deleteCount > 0) {
        await batch.commit()
        setStatus(prev => prev + `\n✅ Firestoreクリーンアップ完了！`)
        setStatus(prev => prev + `\n🔄 ページを再読み込みしてください`)
        
        setTimeout(() => {
          if (confirm('クリーンアップが完了しました。\nページを再読み込みしますか？')) {
            window.location.reload()
          }
        }, 2000)
      } else {
        setStatus(prev => prev + `\n✅ 削除対象データがありませんでした`)
      }

    } catch (error) {
      console.error('Firestore cleanup failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setStatus(prev => prev + `\n❌ エラー: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <App>
      <h2>🧩 Firestore緊急クリーンアップ</h2>
      
      <div className="card" style={{ backgroundColor: '#f8d7da', border: '2px solid #dc3545' }}>
        <h3>⚠️ 緊急用ツール</h3>
        <p>通常のクリーンアップで解決しない場合のみ使用してください。</p>
        
        <div style={{ marginBottom: 16 }}>
          <strong>現在の状況:</strong>
          <ul style={{ marginLeft: 20, marginTop: 8 }}>
            <li>表示中の問題: {realtimeStore.problems.length}件</li>
            <li>認証状態: {realtimeStore.user ? '✅ ログイン済み' : '❌ 未ログイン'}</li>
          </ul>
        </div>

        <button 
          className="button"
          onClick={forceCleanupFirestore}
          disabled={isProcessing || !realtimeStore.user}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16
          }}
        >
          {isProcessing ? '⏳ 処理中...' : '🧩 Firestore強制クリーンアップ'}
        </button>
        
        {!realtimeStore.user && (
          <p style={{ color: '#dc3545', marginTop: 8 }}>
            ⚠️ この操作にはログインが必要です
          </p>
        )}
      </div>

      {status && (
        <div className="card">
          <h4>📊 実行結果</h4>
          <pre style={{
            backgroundColor: '#f8f9fa',
            padding: 16,
            borderRadius: 4,
            border: '1px solid #dee2e6',
            whiteSpace: 'pre-wrap',
            fontSize: 14
          }}>
            {status}
          </pre>
        </div>
      )}
    </App>
  )
}
