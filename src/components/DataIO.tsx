import App from '../App'
import { exportJSON, importJSON, loadDB, deleteProblem, updateProblem } from '../store'
import { exportLatestStatusCSV, exportLogsCSV, exportProblemsCSV, importProblemsCSV } from '../csv'
import { pushAllToCloud, pullAllFromCloud } from '../cloud'
import { onAuth, signInGoogle, signOutGoogle } from '../firebase'
import { useEffect, useState } from 'react'

export default function DataIO(){
  const [db, setDB] = useState(loadDB())
  const [user, setUser] = useState<null | { uid: string; name: string; email?: string }>(null)
  const [deleteId, setDeleteId] = useState('')
  const [showProblems, setShowProblems] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<'rin' | 'yui' | 'both'>('rin')

  useEffect(() => {
    const unsub = onAuth(u => setUser(u ? { uid: u.uid, name: u.displayName || 'No Name', email: u.email || undefined } : null))
    return () => unsub()
  }, [])

  const refreshDB = () => setDB(loadDB())

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

  const onImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    try {
      const targetUserId = selectedUserId === 'both' ? 'rin' : selectedUserId
      const result = importProblemsCSV(db, text, targetUserId)
      
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
      
      refreshDB() // DBをリフレッシュ
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
    </App>
  )
}
