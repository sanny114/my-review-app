import App from '../App'
import { exportJSON, importJSON, loadDB, deleteProblem, updateProblem } from '../store'
import { exportLatestStatusCSV, exportLogsCSV, exportProblemsCSV, importProblemsCSV } from '../csv'
import { pushAllToCloud, pullAllFromCloud } from '../cloud'
import { onAuth, signInGoogle, signOutGoogle, db } from '../firebase'
import { useEffect, useState } from 'react'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { debugSignInGoogle } from '../debug-auth'
import { getDocs, collection, writeBatch, doc } from 'firebase/firestore'

export default function DataIO(){
  const [localDB, setLocalDB] = useState(loadDB())
  const [user, setUser] = useState<null | { uid: string; name: string; email?: string }>(null)
  const [deleteId, setDeleteId] = useState('')
  const [showProblems, setShowProblems] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<'rin' | 'yui' | 'both'>('rin')
  
  // リアルタイムストアの使用
  const realtimeStore = useRealtimeStore()

  useEffect(() => {
    const unsub = onAuth(u => setUser(u ? { uid: u.uid, name: u.displayName || 'No Name', email: u.email || undefined } : null))
    return () => unsub()
  }, [])

  // 重複データクリーンアップ
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
      const problemSeenIds = new Map<string, string[]>() // originalId -> [docId1, docId2, ...]
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

      // 問題の重複削除 (最初の1つだけ残す)
      problemSeenIds.forEach((docIds, originalId) => {
        if (docIds.length > 1) {
          console.log(`🗑️ 問題${originalId}の重複を削除:`, docIds.slice(1))
          docIds.slice(1).forEach(docId => {
            batch.delete(doc(db, 'users', realtimeStore.user!.uid, 'problems', docId))
            deleteCount++
          })
        }
      })

      // ログの重複削除
      logSeenIds.forEach((docIds, originalId) => {
        if (docIds.length > 1) {
          console.log(`🗑️ ログ${originalId}の重複を削除:`, docIds.slice(1))
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

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    try {
      const json = JSON.parse(text)
      importJSON(localDB, json)
      alert('取り込みました')
    } catch (err){
      alert('読み込めませんでした：' + (err as Error).message)
    } finally {
      e.currentTarget.value = ''
    }
  }

  const onImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    try {
      const targetUserId = selectedUserId === 'both' ? 'rin' : selectedUserId
      const result = importProblemsCSV(localDB, text, targetUserId)
      
      if (result.errors.length > 0) {
        const errorMsg = [
          'インポート結果:',
          `成功: ${result.success}件`,
          `エラー: ${result.errors.length}件`,
          '',
          'エラー詳細:',
          ...result.errors.slice(0, 10),
          result.errors.length > 10 ? `...（他${result.errors.length - 10}件）` : ''
        ].filter(line => line !== '').join('\n')
        alert(errorMsg)
      } else {
        alert(`CSVインポートが完了しました！\n成功: ${result.success}件`)
      }
      
      setLocalDB(loadDB()) // DBをリフレッシュ
    } catch (err) {
      alert('CSVファイルの読み込みに失敗しました：' + (err as Error).message)
    } finally {
      e.currentTarget.value = ''
    }
  }

  return (
    <App>
      <h2>データ入出力</h2>

      {/* JSON */}
      <div className="card">
        <h3>JSONエクスポート/インポート</h3>
        <div className="row">
          <button className="button" onClick={()=>exportJSON(localDB)}>JSONをエクスポート</button>
          <label className="button secondary" style={{cursor:'pointer'}}>
            JSONをインポート
            <input type="file" accept="application/json" style={{display:'none'}} onChange={onImport} />
          </label>
        </div>
      </div>

      {/* CSV */}
      <div className="card">
        <h3>CSVエクスポート</h3>
        <div className="row">
          <button className="button" onClick={()=>exportProblemsCSV(localDB,'both')}>Problems.csv</button>
          <button className="button" onClick={()=>exportLogsCSV(localDB,'both')}>ReviewLogs.csv</button>
          <button className="button" onClick={()=>exportLatestStatusCSV(localDB,'both')}>Problems_LatestStatus.csv</button>
        </div>
        <p className="muted">UTF-8(BOM付)でExcelでも文字化けしにくい形式です。</p>
      </div>

      {/* CSVインポート */}
      <div className="card">
        <h3>CSVをインポート（追加入力）</h3>
        <div className="row">
          <label className="button secondary" style={{cursor:'pointer'}}>
            CSVファイルを選択
            <input type="file" accept=".csv" style={{display:'none'}} onChange={onImportCSV} />
          </label>
        </div>
        <p className="muted">
          <strong>CSV形式:</strong> id,subject,unit,question,answer,status,note<br/>
          <strong>status例:</strong> ×/NG/まちがい → まちがい、△/保留/ちょっと自信ない → ちょっと自信ない、それ以外 → できた<br/>
          <strong>注意:</strong> IDが空の場合は自動採番されます。既存のIDと重複する場合は新しいIDが生成されます。
        </p>
        {/* ユーザー選択 */}
        <div style={{marginTop: 8}}>
          <label>登録対象: </label>
          <select value={selectedUserId === 'both' ? 'rin' : selectedUserId} onChange={e => setSelectedUserId(e.target.value as 'rin'|'yui')}>
            <option value="rin">りん</option>
            <option value="yui">ゆい</option>
          </select>
        </div>
      </div>

      {/* ▼ クラウド同期（Firebase 認証） */}
      <div className="card">
        <h3>クラウド同期（Firebase 認証）</h3>

        {!user ? (
          <>
            <p>同じGoogleアカウントでログインすれば、PCとスマホでデータを共有できます。</p>
            
            {/* Firebase設定情報表示 */}
            <details style={{ marginBottom: 12, fontSize: '12px' }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>🔧 Firebase設定情報</summary>
              <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, marginTop: 4 }}>
                <div><strong>Project ID:</strong> {import.meta.env.VITE_FIREBASE_PROJECT_ID}</div>
                <div><strong>Auth Domain:</strong> {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}</div>
                <div><strong>API Key:</strong> {import.meta.env.VITE_FIREBASE_API_KEY?.slice(0, 10)}...</div>
                <div><strong>Current URL:</strong> {window.location.origin}</div>
              </div>
            </details>
            <button
              className="button"
              onClick={() => signInGoogle().catch(err => alert('ログインに失敗しました：' + err.message))}
            >
              Googleでログイン
            </button>
            
            {/* デバッグボタン */}
            <button
              className="button secondary"
              style={{ marginLeft: 8 }}
              onClick={() => debugSignInGoogle().catch(err => {
                alert('デバッグログイン失敗:\n' + err.code + '\n' + err.message)
                console.error('詳細エラー:', err)
              })}
            >
              🔍 デバッグログイン
            </button>
            <p className="muted">※ ポップアップがブロックされる場合は許可してください。</p>
          </>
        ) : (
          <>
            <p>ログイン中：<b>{user.name}</b>（{user.email || 'メール非公開'}）</p>
            <div className="row" style={{gap:12, flexWrap:'wrap'}}>
              <button className="button" onClick={async () => {
                if (!confirm('クラウドのデータを「今の端末の内容」で全て置き換えます。続行しますか？')) return
                await pushAllToCloud(user!.uid)
                alert('クラウドへアップロードしました')
              }}>
                クラウドへアップロード
              </button>

              <button className="button secondary" onClick={async () => {
                if (!confirm('端末のデータを「クラウドの内容」で全て置き換えます。続行しますか？')) return
                await pullAllFromCloud(user!.uid)
                alert('クラウドから取得しました（必要ならページを再読み込みしてください）')
              }}>
                クラウドから取得
              </button>

              <button className="button secondary" onClick={() => signOutGoogle()}>
                ログアウト
              </button>
            </div>
            <p className="muted">※ 初回はPCで「アップロード」→ スマホで「取得」の順にどうぞ。</p>
          </>
        )}
      </div>

      {/* ▼ リアルタイム同期（新機能！） */}
      <div className="card" style={{ border: '2px solid #3b82f6', backgroundColor: '#f0f8ff' }}>
        <h3 style={{ color: '#3b82f6' }}>🚀 リアルタイム同期（新機能！）</h3>
        
        {!realtimeStore.user ? (
          <>
            <p><strong>これまでの手動同期から、リアルタイム自動同期に切り替えができます！</strong></p>
            <div style={{ background: '#fff', padding: 12, borderRadius: 4, margin: '8px 0' }}>
              <h4>📱 リアルタイム同期の特徴：</h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>✅ <strong>自動同期</strong>：誰かが問題を追加すると全デバイスに即座に反映</li>
                <li>✅ <strong>競合解決</strong>：複数人が同時に編集しても安全</li>
                <li>✅ <strong>リアルタイム</strong>：手動アップロード/ダウンロード不要</li>
                <li>✅ <strong>安全性</strong>：Googleクラウドで自動バックアップ</li>
              </ul>
            </div>
            <p style={{ color: '#f59e0b' }}>⚠️ まずはGoogleでログインしてください（上のクラウド同期セクション）</p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%', 
                  backgroundColor: realtimeStore.isLoading ? '#f59e0b' : '#10b981' 
                }}></div>
                <span style={{ fontWeight: 'bold' }}>
                  {realtimeStore.isLoading ? '接続中...' : 'リアルタイム同期 接続済み'}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                問題数: {realtimeStore.problems.length}件 | 
                復習ログ: {realtimeStore.reviewLogs.length}件
              </div>
            </div>
            
            {/* クリーンアップ機能 */}
            <div style={{ marginBottom: 16 }}>
              <h4>🧩 データクリーンアップ</h4>
              <p>重複データが原因で問題数が2倍になっている場合に使用してください。</p>
              <button 
                className="button secondary" 
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '16px'
                }}
                onClick={cleanupDuplicates}
              >
                🧩 重複データをクリーンアップ
              </button>
              <p className="muted">※ 重複したデータを自動で検出・削除します</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              {localDB.problems.length > 0 && (
                <>
                  <h4>📦 ローカルデータの移行</h4>
                  <p>現在ローカルに <strong>{localDB.problems.length}件の問題</strong> があります。</p>
                  <button 
                    className="button" 
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      padding: '12px 24px',
                      fontSize: '16px'
                    }}
                    onClick={async () => {
                      if (!confirm(
                        `ローカルの${localDB.problems.length}件の問題と${localDB.reviewLogs.length}件の復習ログを\n` +
                        'リアルタイム同期に移行します。\n\n' +
                        '移行後は全デバイスで自動同期されます。\n' +
                        '続行しますか？'
                      )) return
                      
                      try {
                        await realtimeStore.migrateFromLocalStorage()
                        setLocalDB(loadDB()) // ローカルDBを更新
                      } catch (error) {
                        console.error('Migration error:', error)
                      }
                    }}
                  >
                    🚀 リアルタイム同期に移行する
                  </button>
                  <p className="muted">※ 既存データはバックアップとして保持されます</p>
                </>
              )}
            </div>
            
            {/* 状態表示 */}
            <div style={{ background: '#fff', padding: 12, borderRadius: 4 }}>
              <h4>🎉 リアルタイム同期が有効です！</h4>
              <p>この端末での変更は、他の全デバイスに自動で反映されます。</p>
              <p><strong>使い方：</strong></p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '14px' }}>
                <li>問題登録、復習結果が即座に全デバイスに同期</li>
                <li>手動アップロード/ダウンロード不要</li>
                <li>家族全員が安心して同時に使用可能</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </App>
  )
}
