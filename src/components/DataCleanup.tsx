import { useState } from 'react'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { loadDB } from '../store'
import App from '../App'

export default function DataCleanup() {
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const realtimeStore = useRealtimeStore()
  const localDB = loadDB()

  const analyzeData = () => {
    const realtimeProblems = realtimeStore.problems.length
    const localProblems = localDB.problems.length
    const realtimeLogs = realtimeStore.reviewLogs.length
    const localLogs = localDB.reviewLogs.length
    
    const analysisText = [
      '📊 データ分析結果:',
      `🚀 Firestore: 問題${realtimeProblems}件、ログ${realtimeLogs}件`,
      `💾 LocalStorage: 問題${localProblems}件、ログ${localLogs}件`,
      '',
      localProblems > 0 ? '⚠️ ローカルデータが残っています' : '✅ ローカルデータはクリア済み'
    ].join('\n')
    
    setStatus(analysisText)
  }

  const clearLocalStorage = async () => {
    const confirmMessage = [
      'ローカルStorageのデータをクリアします。',
      '',
      '⚠️ この操作は元に戻せません！',
      'リアルタイムデータは保持されます。',
      '',
      '続行しますか？'
    ].join('\n')
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    setIsProcessing(true)
    try {
      // バックアップを作成
      const currentData = localStorage.getItem('review-app-db-v1')
      if (currentData) {
        const backup = JSON.parse(currentData)
        const backupBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
        const backupUrl = URL.createObjectURL(backupBlob)
        const backupLink = document.createElement('a')
        backupLink.href = backupUrl
        backupLink.download = `local-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(backupLink)
        backupLink.click()
        document.body.removeChild(backupLink)
        URL.revokeObjectURL(backupUrl)
        
        setStatus(prevStatus => prevStatus + '\n📦 バックアップファイルをダウンロードしました')
      }
      
      // LocalStorageをクリア
      localStorage.removeItem('review-app-db-v1')
      
      setStatus(prevStatus => prevStatus + '\n✅ ローカルStorageをクリアしました')
      
      // ページリロードを促す
      setTimeout(() => {
        const reloadMessage = [
          'データクリアが完了しました。',
          'ページを再読み込みして変更を反映しますか？'
        ].join('\n')
        
        if (confirm(reloadMessage)) {
          window.location.reload()
        }
      }, 1000)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setStatus(prevStatus => prevStatus + `\n❌ エラー: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const forceReload = () => {
    window.location.reload()
  }

  return (
    <App>
      <h2>🧹 データクリーンアップ</h2>
      
      <div className="card" style={{ backgroundColor: '#fff3cd', border: '2px solid #ffc107' }}>
        <h3>⚠️ 緊急用データクリーンアップツール</h3>
        <p>古い問題が削除・編集できない場合に使用してください。</p>
      </div>

      <div className="card">
        <h4>📊 データ状況確認</h4>
        <button 
          className="button secondary" 
          onClick={analyzeData}
          style={{ marginBottom: 16 }}
        >
          🔍 データを分析
        </button>
        
        {status && (
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
        )}
      </div>

      <div className="card" style={{ backgroundColor: '#f8d7da', border: '2px solid #dc3545' }}>
        <h4>🗑️ ローカルStorageクリーンアップ</h4>
        <p><strong>⚠️ 危険な操作:</strong> ローカルに残った古いデータを完全削除します。</p>
        <ul style={{ marginLeft: 20, fontSize: 14 }}>
          <li>✅ リアルタイムデータ（Firestore）は保持されます</li>
          <li>📦 削除前に自動でバックアップファイルをダウンロード</li>
          <li>🔄 完了後にページが再読み込みされます</li>
        </ul>
        
        <button 
          className="button"
          onClick={clearLocalStorage}
          disabled={isProcessing}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16,
            marginTop: 12
          }}
        >
          {isProcessing ? '⏳ 処理中...' : '🗑️ ローカルStorageをクリア'}
        </button>
      </div>

      <div className="card">
        <h4>🔄 再読み込み</h4>
        <p>データクリア後やエラーが続く場合に使用してください。</p>
        <button 
          className="button secondary"
          onClick={forceReload}
          style={{ padding: '12px 24px' }}
        >
          🔄 ページを再読み込み
        </button>
      </div>

      <div className="card" style={{ backgroundColor: '#d4edda', border: '2px solid #28a745' }}>
        <h4>✅ 正常化後の確認手順</h4>
        <ol style={{ marginLeft: 20, lineHeight: 1.6 }}>
          <li><strong>問題一覧</strong>でデータソース選択を確認</li>
          <li><strong>「🚀 リアルタイムデータ」</strong> のみを使用</li>
          <li>問題の <strong>削除・編集</strong> が正常に動作することを確認</li>
          <li>他のデバイスとの <strong>同期</strong> が正常に動作することを確認</li>
        </ol>
      </div>
    </App>
  )
}
