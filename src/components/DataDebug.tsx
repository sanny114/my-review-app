import { useState } from 'react'
import App from '../App'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { loadDB } from '../store'

export default function DataDebug() {
  const realtimeStore = useRealtimeStore()
  const [showDetails, setShowDetails] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  
  // LocalStorageデータを取得
  const localDB = loadDB()

  const analyzeData = () => {
    const firestoreProblems = realtimeStore.problems
    const localProblems = localDB.problems
    
    console.log('🔍 データ分析開始')
    console.log('📚 Firestore Problems:', firestoreProblems)
    console.log('💾 LocalStorage Problems:', localProblems)
    
    const analysis = {
      firestore: {
        total: firestoreProblems.length,
        problems: firestoreProblems.map(p => ({
          id: p.id,
          originalId: (p as any).originalId,
          text: p.text?.slice(0, 30) + '...',
          userId: p.userId
        }))
      },
      localStorage: {
        total: localProblems.length,
        problems: localProblems.map(p => ({
          id: p.id,
          text: p.text?.slice(0, 30) + '...',
          userId: p.userId
        }))
      },
      idMismatch: [],
      suggestions: []
    }

    // ID不整合をチェック
    firestoreProblems.forEach(fp => {
      const matchingLocal = localProblems.find(lp => 
        lp.text === fp.text && lp.userId === fp.userId
      )
      if (matchingLocal && matchingLocal.id !== fp.id) {
        (analysis.idMismatch as any).push({
          firestoreId: fp.id,
          localStorageId: matchingLocal.id,
          text: fp.text?.slice(0, 30) + '...'
        })
      }
    })

    // 提案を追加
    if (analysis.idMismatch.length > 0) {
      analysis.suggestions.push('ID不整合が検出されました。データクリーンアップが必要です。')
    }
    
    if (analysis.localStorage.total > 0 && analysis.firestore.total === 0) {
      analysis.suggestions.push('LocalStorageのデータをFirestoreに移行してください。')
    }

    setAnalysisResult(analysis)
    console.log('📊 分析結果:', analysis)
  }

  const cleanupFirestoreData = async () => {
    if (!confirm('⚠️ Firestoreの全データを削除しますか？\n（この操作は元に戻せません）')) {
      return
    }

    try {
      console.log('🗑️ Firestore データクリーンアップ開始')
      
      for (const problem of realtimeStore.problems) {
        await realtimeStore.deleteProblem(problem.id)
      }
      
      alert('✅ Firestoreデータを削除しました。LocalStorageから再移行できます。')
    } catch (error) {
      console.error('クリーンアップエラー:', error)
      alert('❌ クリーンアップに失敗しました: ' + error)
    }
  }

  const forceLocalStorageMigration = async () => {
    if (!confirm('LocalStorageのデータをFirestoreに強制移行しますか？')) {
      return
    }

    try {
      await realtimeStore.migrateFromLocalStorage()
      alert('✅ 移行が完了しました')
    } catch (error) {
      console.error('移行エラー:', error)
      alert('❌ 移行に失敗しました: ' + error)
    }
  }

  return (
    <App>
      <h2>🔧 データデバッグ画面</h2>
      
      <div className="card">
        <h3>データ状況</h3>
        <div className="row">
          <div>
            <strong>Firestore（クラウド）:</strong> {realtimeStore.problems.length}件
          </div>
          <div>
            <strong>LocalStorage（ローカル）:</strong> {localDB.problems.length}件
          </div>
        </div>
        
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="button" onClick={analyzeData}>
            🔍 詳細分析実行
          </button>
          <button 
            className="button secondary" 
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '非表示' : '詳細表示'}
          </button>
        </div>
      </div>

      {analysisResult && (
        <div className="card">
          <h3>📊 分析結果</h3>
          
          {analysisResult.suggestions.length > 0 && (
            <div style={{ backgroundColor: '#fff3cd', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              <strong>💡 提案:</strong>
              <ul>
                {analysisResult.suggestions.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {analysisResult.idMismatch.length > 0 && (
            <div style={{ backgroundColor: '#f8d7da', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              <strong>🚨 ID不整合 ({analysisResult.idMismatch.length}件):</strong>
              {analysisResult.idMismatch.slice(0, 3).map((mismatch: any, i: number) => (
                <div key={i} style={{ fontSize: '12px', marginTop: '4px' }}>
                  • {mismatch.text}
                  <br />
                  &nbsp;&nbsp;Firestore: {mismatch.firestoreId}
                  <br />
                  &nbsp;&nbsp;LocalStorage: {mismatch.localStorageId}
                </div>
              ))}
              {analysisResult.idMismatch.length > 3 && (
                <div style={{ fontSize: '12px', color: '#666' }}>
                  ...他{analysisResult.idMismatch.length - 3}件
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              className="button"
              style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
              onClick={forceLocalStorageMigration}
            >
              🔄 LocalStorage → Firestore 強制移行
            </button>
            <button 
              className="button"
              style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              onClick={cleanupFirestoreData}
            >
              🗑️ Firestore データ全削除
            </button>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="card">
            <h4>☁️ Firestore データ</h4>
            <div style={{ fontSize: '12px', maxHeight: '300px', overflowY: 'auto' }}>
              {realtimeStore.problems.length === 0 ? (
                <p>データなし</p>
              ) : (
                realtimeStore.problems.map(p => (
                  <div key={p.id} style={{ marginBottom: '8px', padding: '4px', backgroundColor: '#f8f9fa' }}>
                    <div><strong>ID:</strong> {p.id}</div>
                    <div><strong>User:</strong> {p.userId}</div>
                    <div><strong>Text:</strong> {p.text?.slice(0, 50)}...</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h4>💾 LocalStorage データ</h4>
            <div style={{ fontSize: '12px', maxHeight: '300px', overflowY: 'auto' }}>
              {localDB.problems.length === 0 ? (
                <p>データなし</p>
              ) : (
                localDB.problems.map(p => (
                  <div key={p.id} style={{ marginBottom: '8px', padding: '4px', backgroundColor: '#f8f9fa' }}>
                    <div><strong>ID:</strong> {p.id}</div>
                    <div><strong>User:</strong> {p.userId}</div>
                    <div><strong>Text:</strong> {p.text?.slice(0, 50)}...</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>🛠️ 修復手順</h3>
        <ol>
          <li><strong>「詳細分析実行」</strong>をクリックして問題を確認</li>
          <li>ID不整合が検出された場合：
            <ul>
              <li>「Firestore データ全削除」（一時的にクラウドデータを削除）</li>
              <li>「LocalStorage → Firestore 強制移行」（ローカルデータを移行）</li>
            </ul>
          </li>
          <li>移行後、アプリが正常に動作するかテスト</li>
        </ol>
        
        <div style={{ backgroundColor: '#e7f3ff', padding: '8px', borderRadius: '4px', marginTop: '12px' }}>
          <small>
            💡 <strong>ヒント:</strong> LocalStorageに古いデータがある場合は、それを優先してFirestoreに移行することをお勧めします。
          </small>
        </div>
      </div>
    </App>
  )
}
