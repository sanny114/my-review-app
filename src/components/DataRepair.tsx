import { useState } from 'react'
import { useRealtimeStore } from '../stores/RealtimeStore'
import App from '../App'
import { getDocs, collection, writeBatch, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function DataRepair() {
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const realtimeStore = useRealtimeStore()

  const repairOldProblems = async () => {
    if (!realtimeStore.user) {
      alert('この操作にはログインが必要です')
      return
    }

    const confirmMessage = [
      '🔧 古い問題データの修復',
      '',
      '古い問題のID不整合を修復します。',
      '',
      '⚠️ 処理内容：',
      '- 表示されている問題データを取得',
      '- 正しいIDでFirestoreに再保存',
      '- 古い重複エントリを削除',
      '',
      '続行しますか？'
    ].join('\n')
    
    if (!confirm(confirmMessage)) return

    setIsProcessing(true)
    setStatus('🔄 古い問題データの修復を開始...')

    try {
      // 現在表示されている問題データを取得
      const displayedProblems = realtimeStore.problems
      setStatus(prev => prev + `\n📊 表示中の問題: ${displayedProblems.length}件`)

      // Firestoreから実際のデータを取得
      const problemsSnapshot = await getDocs(collection(db, 'users', realtimeStore.user.uid, 'problems'))
      setStatus(prev => prev + `\n📊 Firestoreの実データ: ${problemsSnapshot.size}件`)

      const batch = writeBatch(db)
      let repairedCount = 0

      // 各表示問題について
      for (const displayProblem of displayedProblems) {
        // Firestoreで実際にそのIDのドキュメントが存在するか確認
        const exists = problemsSnapshot.docs.find(doc => doc.id === displayProblem.id)
        
        if (!exists) {
          // IDが見つからない場合は修復が必要
          setStatus(prev => prev + `\n🔧 修復対象: ${displayProblem.id} (${displayProblem.text.slice(0, 30)}...)`)
          
          // 新しいIDでドキュメントを作成
          const newRef = doc(collection(db, 'users', realtimeStore.user.uid, 'problems'))
          batch.set(newRef, {
            ...displayProblem,
            id: newRef.id, // 新しいIDで保存
            repairedAt: new Date()
          })
          
          repairedCount++
        }
      }

      if (repairedCount > 0) {
        await batch.commit()
        setStatus(prev => prev + `\n✅ ${repairedCount}件の問題を修復しました`)
        setStatus(prev => prev + `\n🔄 ページを再読み込みしてください`)
        
        setTimeout(() => {
          if (confirm('修復が完了しました。\nページを再読み込みしますか？')) {
            window.location.reload()
          }
        }, 2000)
      } else {
        setStatus(prev => prev + `\n✅ 修復が必要な問題はありませんでした`)
      }

    } catch (error) {
      console.error('Repair failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setStatus(prev => prev + `\n❌ エラー: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <App>
      <h2>🔧 データ修復ツール</h2>
      
      <div className="card" style={{ backgroundColor: '#f8d7da', border: '2px solid #dc3545' }}>
        <h3>⚠️ 古い問題データの修復</h3>
        <p>古い問題の削除・編集ができない場合に使用してください。</p>
        
        <div style={{ marginBottom: 16 }}>
          <strong>現在の状況:</strong>
          <ul style={{ marginLeft: 20, marginTop: 8 }}>
            <li>表示中の問題: {realtimeStore.problems.length}件</li>
            <li>認証状態: {realtimeStore.user ? '✅ ログイン済み' : '❌ 未ログイン'}</li>
          </ul>
        </div>

        <button 
          className="button"
          onClick={repairOldProblems}
          disabled={isProcessing || !realtimeStore.user}
          style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16
          }}
        >
          {isProcessing ? '⏳ 修復中...' : '🔧 古い問題データを修復'}
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
