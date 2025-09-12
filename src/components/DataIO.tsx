import App from '../App'
import { onAuth, signInGoogle, signOutGoogle, db } from '../firebase'
import { useEffect, useState } from 'react'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { getDocs, collection, writeBatch, doc } from 'firebase/firestore'

export default function DataIO(){
  const [user, setUser] = useState<null | { uid: string; name: string; email?: string }>(null)
  
  // リアルタイムストアの使用
  const realtimeStore = useRealtimeStore()

  useEffect(() => {
    const unsub = onAuth(u => setUser(u ? { uid: u.uid, name: u.displayName || 'No Name', email: u.email || undefined } : null))
    return () => unsub()
  }, [])

  // JSONエクスポート機能
  const exportToJSON = () => {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      users: [
        { id: 'rin', name: 'りん' },
        { id: 'yui', name: 'ゆい' }
      ],
      problems: realtimeStore.problems,
      reviewLogs: realtimeStore.reviewLogs,
      appSettings: {
        fixedSubjects: ['漢字', '算数'],
        defaultReviewOptions: {
          repeatMistakes: true,
          repeatWithinSession: true
        },
        defaultSortOrder: 'newest'
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `復習アプリ_バックアップ_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const cleanupDuplicates = async () => {
    if (!realtimeStore.user) {
      alert('ログインが必要です')
      return
    }

    if (!confirm('重複データをクリーンアップします。続行しますか？')) return

    try {
      // Firestoreから全データを取得
      const problemsSnapshot = await getDocs(collection(db, 'users', realtimeStore.user.uid, 'problems'))
      const reviewLogsSnapshot = await getDocs(collection(db, 'users', realtimeStore.user.uid, 'reviewLogs'))

      // 重複を検出
      const problemSeenIds = new Map<string, string[]>()
      const logSeenIds = new Map<string, string[]>()

      problemsSnapshot.forEach((doc) => {
        const data = doc.data()
        const originalId = data.id || doc.id
        if (!problemSeenIds.has(originalId)) {
          problemSeenIds.set(originalId, [])
        }
        problemSeenIds.get(originalId)!.push(doc.id)
      })

      reviewLogsSnapshot.forEach((doc) => {
        const data = doc.data()
        const originalId = data.id || doc.id
        if (!logSeenIds.has(originalId)) {
          logSeenIds.set(originalId, [])
        }
        logSeenIds.get(originalId)!.push(doc.id)
      })

      // 重複したドキュメントを削除
      const batch = writeBatch(db)
      let deleteCount = 0

      problemSeenIds.forEach((docIds, originalId) => {
        if (docIds.length > 1) {
          docIds.slice(1).forEach(docId => {
            batch.delete(doc(db, 'users', realtimeStore.user!.uid, 'problems', docId))
            deleteCount++
          })
        }
      })

      logSeenIds.forEach((docIds, originalId) => {
        if (docIds.length > 1) {
          docIds.slice(1).forEach(docId => {
            batch.delete(doc(db, 'users', realtimeStore.user!.uid, 'reviewLogs', docId))
            deleteCount++
          })
        }
      })

      if (deleteCount > 0) {
        await batch.commit()
        alert(`重複データを${deleteCount}件削除しました！`)
      } else {
        alert('重複データは見つかりませんでした。')
      }
    } catch (error) {
      console.error('Cleanup failed:', error)
      alert('クリーンアップに失敗しました。')
    }
  }

  return (
    <App>
      <h2>データ入出力</h2>

      {/* リアルタイム同期 */}
      <div className="card" style={{ border: '2px solid #3b82f6', backgroundColor: '#f0f8ff' }}>
        <h3 style={{ color: '#3b82f6' }}>🚀 リアルタイム同期</h3>
        
        {!user ? (
          <>
            <p>Googleアカウントでログインして、全デバイスでリアルタイム同期を開始しましょう。</p>
            
            <button
              className="button"
              style={{ padding: '12px 24px', fontSize: '16px' }}
              onClick={() => signInGoogle().catch(err => alert('ログインに失敗しました：' + err.message))}
            >
              🔑 Googleでログイン
            </button>
            <p className="muted">※ ポップアップがブロックされる場合は許可してください。</p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <p>ログイン中：<strong>{user.name}</strong>（{user.email || 'メール非公開'}）</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%', 
                  backgroundColor: realtimeStore.isLoading ? '#f59e0b' : '#10b981' 
                }}></div>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                  {realtimeStore.isLoading ? '接続中...' : '✅ リアルタイム同期 有効'}
                </span>
              </div>
              
              <div style={{ fontSize: '14px', color: '#666', marginBottom: 16 }}>
                問題数: {realtimeStore.problems.length}件 | 
                復習ログ: {realtimeStore.reviewLogs.length}件
              </div>
            </div>
            
            {/* バックアップ機能 */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#e7f3ff', borderRadius: 4 }}>
              <h4>💾 データバックアップ</h4>
              <p>現在のすべてのデータをJSONファイルとしてダウンロードします。</p>
              <button 
                className="button"
                style={{
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '16px',
                  border: 'none'
                }}
                onClick={exportToJSON}
              >
                💾 JSONバックアップをダウンロード
              </button>
              <p className="muted" style={{ marginTop: 8 }}>※ 問題{realtimeStore.problems.length}件、復習ログ{realtimeStore.reviewLogs.length}件をエクスポート</p>
            </div>
            
            {/* クリーンアップ機能 */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff3cd', borderRadius: 4 }}>
              <h4>🧩 データクリーンアップ</h4>
              <p>問題の編集・削除でエラーが発生する場合に使用してください。</p>
              <button 
                className="button"
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '16px',
                  border: 'none'
                }}
                onClick={cleanupDuplicates}
              >
                🧩 重複データをクリーンアップ
              </button>
              <p className="muted" style={{ marginTop: 8 }}>※ 重複・破損したデータを自動で修復します</p>
            </div>
            
            {/* 状態表示 */}
            <div style={{ background: '#d4edda', padding: 12, borderRadius: 4, border: '1px solid #28a745' }}>
              <h4 style={{ color: '#28a745' }}>🎉 リアルタイム同期が有効です！</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '14px', color: '#155724' }}>
                <li>問題の登録・編集・削除が即座に全デバイスに同期</li>
                <li>復習結果も自動で同期・共有</li>
                <li>手動アップロード/ダウンロード不要</li>
                <li>家族全員が安心して同時使用可能</li>
              </ul>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <button 
                className="button secondary" 
                onClick={() => signOutGoogle()}
                style={{ padding: '8px 16px' }}
              >
                ログアウト
              </button>
            </div>
          </>
        )}
      </div>

      {/* 使い方ガイド */}
      <div className="card">
        <h3>📖 使い方ガイド</h3>
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
          <h4>🎯 基本的な流れ</h4>
          <ol>
            <li><strong>上記でGoogleログイン</strong>を完了</li>
            <li><strong>「問題を登録」</strong>で問題を追加</li>
            <li><strong>「復習する」</strong>で学習実行</li>
            <li><strong>「問題一覧」</strong>で管理・編集</li>
          </ol>
          
          <h4>💡 ポイント</h4>
          <ul>
            <li>全ての操作が<strong>自動で全デバイスに同期</strong>されます</li>
            <li>PC・タブレット・スマホのどこからでも同じデータにアクセス</li>
            <li>家族みんなが<strong>同時に使用</strong>しても安全</li>
            <li>データは<strong>Googleクラウド</strong>で自動バックアップ</li>
          </ul>

          <h4>⚠️ トラブル時</h4>
          <ul>
            <li>問題の編集・削除でエラーが出る場合：<strong>「🧩 データクリーンアップ」</strong>を実行</li>
            <li>データが表示されない場合：<strong>ページを再読み込み</strong></li>
            <li>同期が遅い場合：<strong>ネットワーク接続を確認</strong></li>
          </ul>
        </div>
      </div>
    </App>
  )
}
