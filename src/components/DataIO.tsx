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

  // JSONインポート機能
  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string)
        
        // データ形式を検証
        if (!jsonData.problems || !Array.isArray(jsonData.problems)) {
          alert('❌ 無効なJSONファイルです。正しいバックアップファイルを選択してください。')
          return
        }

        if (!realtimeStore.user) {
          alert('❌ ログインが必要です')
          return
        }

        if (!confirm(`${jsonData.problems.length}件の問題をインポートしますか？`)) {
          return
        }

        let successCount = 0
        let errorCount = 0

        // 問題をインポート
        for (const problem of jsonData.problems) {
          try {
            await realtimeStore.addProblem({
              id: undefined, // 自動生成IDを使用
              userId: problem.userId,
              subjectName: problem.subjectName || '未分類',
              subjectFixed: ['漢字', '算数'].includes(problem.subjectName),
              text: problem.text,
              answer: problem.answer,
              tags: problem.tags || [],
              source: problem.source || '',
              memo: problem.memo || '',
              archived: problem.archived || false
            })
            successCount++
          } catch (error) {
            console.error('Failed to import problem:', error)
            errorCount++
          }
        }

        // レビューログをインポート（存在する場合）
        if (jsonData.reviewLogs && Array.isArray(jsonData.reviewLogs)) {
          for (const log of jsonData.reviewLogs) {
            try {
              // 問題IDは新しいものに置き換わるので、レビューログは参考程度
              console.log('Review log skipped (問題IDが変更されるため):', log)
            } catch (error) {
              console.error('Failed to import review log:', error)
            }
          }
        }

        alert(`✅ インポート完了！\n成功: ${successCount}件\n失敗: ${errorCount}件`)
        
        // ファイル選択をリセット
        event.target.value = ''
      } catch (error) {
        console.error('JSON import error:', error)
        alert('❌ JSONファイルの読み込みに失敗しました: ' + error)
        event.target.value = ''
      }
    }
    
    reader.readAsText(file)
  }

  // CSVテンプレートダウンロード
  const downloadCSVTemplate = () => {
    const csvTemplate = [
      'id,userId,subjectName,text,answer,tags,source,memo,status',
      ',rin,漢字,あの漢字を書きましょう,あ,漢字練習,教科書P.10,,',
      ',yui,算数,10+5=？,15,たし算,ドリル,,',
      ',rin,算数,2×3=？,6,かけ算;九九,ドリル,,',
    ].join('\n')
    
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '問題登録テンプレート.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // CSVインポート機能
  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const csvData = e.target?.result as string
        
        // CSV解析（簡単なパース）
        const lines = csvData.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
          alert('❌ CSVファイルが無効です。ヘッダー行とデータ行が必要です。')
          return
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        const expectedHeaders = ['id', 'userId', 'subjectName', 'text', 'answer', 'tags', 'source', 'memo', 'status']
        
        // ヘッダーチェック（柔軟に）
        const hasRequiredHeaders = ['userId', 'text', 'answer'].every(required => 
          headers.some(h => h.includes(required))
        )
        
        if (!hasRequiredHeaders) {
          alert('❌ CSVファイルに必要なヘッダー（userId, text, answer）が見つかりません。')
          return
        }

        if (!realtimeStore.user) {
          alert('❌ ログインが必要です')
          return
        }

        if (!confirm(`${lines.length - 1}行のデータをインポートしますか？`)) {
          return
        }

        let successCount = 0
        let errorCount = 0

        // データ行を処理
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
            const rowData: any = {}
            
            headers.forEach((header, index) => {
              rowData[header] = values[index] || ''
            })

            // 必須フィールドチェック
            if (!rowData.text || !rowData.answer || !rowData.userId) {
              console.warn(`行 ${i + 1}: 必須フィールドが不足`, rowData)
              errorCount++
              continue
            }

            // タグを配列に変換
            const tags = rowData.tags ? rowData.tags.split(';').map((t: string) => t.trim()).filter((t: string) => t) : []

            await realtimeStore.addProblem({
              id: undefined, // 自動生成IDを使用
              userId: rowData.userId,
              subjectName: rowData.subjectName || '未分類',
              subjectFixed: ['漢字', '算数'].includes(rowData.subjectName),
              text: rowData.text,
              answer: rowData.answer,
              tags: tags,
              source: rowData.source || '',
              memo: rowData.memo || '',
              archived: false
            })
            
            successCount++
          } catch (error) {
            console.error(`行 ${i + 1} の処理エラー:`, error)
            errorCount++
          }
        }

        alert(`✅ CSVインポート完了！\n成功: ${successCount}件\n失敗: ${errorCount}件`)
        
        // ファイル選択をリセット
        event.target.value = ''
      } catch (error) {
        console.error('CSV import error:', error)
        alert('❌ CSVファイルの読み込みに失敗しました: ' + error)
        event.target.value = ''
      }
    }
    
    reader.readAsText(file)
  }
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
            
            {/* データインポート機能 */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f8f0', borderRadius: 4, border: '1px solid #28a745' }}>
              <h4>📁 データインポート</h4>
              <p>バックアップファイルからデータを復元します。</p>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {/* JSONインポート */}
                <label className="button" style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-block'
                }}>
                  📄 JSONファイルをインポート
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={importFromJSON}
                    style={{ display: 'none' }}
                  />
                </label>
                
                {/* CSVインポート */}
                <label className="button" style={{
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-block'
                }}>
                  📈 CSVファイルをインポート
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={importFromCSV}
                    style={{ display: 'none' }}
                  />
                </label>
                
                {/* CSVテンプレートダウンロード */}
                <button 
                  className="button secondary"
                  onClick={downloadCSVTemplate}
                  style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  📋 CSVテンプレートダウンロード
                </button>
              </div>
              
              <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.4' }}>
                <div><strong>JSON:</strong> アプリのバックアップファイルを復元</div>
                <div><strong>CSV:</strong> Excelやスプレッドシートから作成したファイルをインポート</div>
                <div><strong>テンプレート:</strong> CSV作成用のサンプルファイルをダウンロード</div>
              </div>
            </div>
            
            {/* データエクスポート機能 */}
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
            <li><strong>方法A: 手動登録</strong> - 「問題を登録」で問題を追加</li>
            <li><strong>方法B: バックアップ復元</strong> - 上記「JSONファイルをインポート」で復元</li>
            <li><strong>方法C: CSV一括登録</strong> - テンプレートをダウンロードしてExcelで編集後インポート</li>
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
            <li>データを失った場合：<strong>バックアップJSONファイルから復元</strong></li>
          </ul>
          
          <h4>📈 CSVインポートの使い方</h4>
          <ol>
            <li><strong>「📋 CSVテンプレートダウンロード」</strong>をクリック</li>
            <li>ダウンロードした<strong>「問題登録テンプレート.csv」</strong>をExcelで開く</li>
            <li>サンプル行を参考に、新しい問題を追加</li>
            <li>保存後、<strong>「📈 CSVファイルをインポート」</strong>でアップロード</li>
          </ol>
          
          <div style={{ backgroundColor: '#e7f3ff', padding: '8px', borderRadius: '4px', marginTop: '12px' }}>
            <small>
              <strong>📝 CSV形式説明：</strong><br />
              ・ <strong>userId:</strong> rin または yui<br />
              ・ <strong>subjectName:</strong> 漢字、算数、理科など<br />
              ・ <strong>text:</strong> 問題文<br />
              ・ <strong>answer:</strong> 正答<br />
              ・ <strong>tags:</strong> タグを「;」で区切って記入<br />
              ・ <strong>source:</strong> 出典（空欄OK）<br />
              ・ <strong>memo:</strong> メモ（空欄OK）
            </small>
          </div>
        </div>
      </div>
    </App>
  )
}
