import App from '../App'
import { exportJSON, importJSON, loadDB } from '../store'
import { exportLatestStatusCSV, exportLogsCSV, exportProblemsCSV } from '../csv'

// ▼ 追加：Firebase 認証の読み込み
import { onAuth, signInGoogle, signOutGoogle } from '../firebase'
import { useEffect, useState } from 'react'

export default function DataIO(){
  const db = loadDB()

  // ▼ 追加：ログイン状態を持つ
  const [user, setUser] = useState<null | { uid: string; name: string; email?: string }>(null)
  useEffect(() => {
    const unsub = onAuth(u => setUser(u ? { uid: u.uid, name: u.displayName || 'No Name', email: u.email || undefined } : null))
    return () => unsub()
  }, [])

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    try {
      const json = JSON.parse(text)
      importJSON(db, json)
      alert('取り込みました')
    } catch (err){
      alert('読み込めませんでした：' + (err as Error).message)
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
          <button className="button" onClick={()=>exportJSON(db)}>JSONをエクスポート</button>
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
          <button className="button" onClick={()=>exportProblemsCSV(db,'both')}>Problems.csv</button>
          <button className="button" onClick={()=>exportLogsCSV(db,'both')}>ReviewLogs.csv</button>
          <button className="button" onClick={()=>exportLatestStatusCSV(db,'both')}>Problems_LatestStatus.csv</button>
        </div>
        <p className="muted">UTF-8(BOM付)でExcelでも文字化けしにくい形式です。</p>
      </div>

      {/* ▼ 追加：Googleログイン */}
      <div className="card">
        <h3>クラウド同期（Firebase 認証）</h3>

        {!user ? (
          <>
            <p>同じGoogleアカウントでログインすれば、PCとスマホでデータを共有できます。</p>
            <button
              className="button"
              onClick={() => signInGoogle().catch(err => alert('ログインに失敗しました：' + err.message))}
            >
              Googleでログイン
            </button>
            <p className="muted">※ ポップアップがブロックされる場合は許可してください。</p>
          </>
        ) : (
          <>
            <p>ログイン中：<b>{user.name}</b>（{user.email || 'メール非公開'}）</p>
            <div className="row">
              <button className="button secondary" onClick={() => signOutGoogle()}>
                ログアウト
              </button>
            </div>
            <p className="muted">次のステップで「クラウドへ保存／取得」ボタンを追加できます。</p>
          </>
        )}
      </div>
    </App>
  )
}
