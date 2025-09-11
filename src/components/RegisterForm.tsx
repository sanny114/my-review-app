import { FormEvent, useMemo, useState } from 'react'
import App from '../App'
import { Problem } from '../types'
import { useRealtimeStore } from '../stores/RealtimeStore'


const fixedSubjects = ['漢字','算数']


type FormState = {
userId: 'rin'|'yui'
subjectName: string
subjectFixed: boolean
text: string
answer: string
tagsInput: string
source: string
memo: string
}


export default function RegisterForm(){
// リアルタイムストアを使用
const realtimeStore = useRealtimeStore()

const [state, setState] = useState<FormState>({
  userId: 'rin', subjectName: '漢字', subjectFixed: true,
    text:'', answer:'', tagsInput:'', source:'', memo:''
  })


  const subjects = useMemo(()=>{
    const free = Array.from(new Set(realtimeStore.problems.map(p=>p.subjectFixed? null : p.subjectName).filter(Boolean))) as string[]
    return [...fixedSubjects, ...free]
  },[realtimeStore.problems]) // リアルタイムデータを依存に


  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!state.text.trim()) { alert('問題文は必須です'); return }
    if (!state.answer.trim()) { alert('正答は必須です'); return }
    
    // 認証チェック
    if (!realtimeStore.user) {
      alert('リアルタイム同期を使用するにはログインが必要です。\nデータ入出力ページでGoogleログインしてください。')
      return
    }
    
    const subjFixed = fixedSubjects.includes(state.subjectName)
    const tags = state.tagsInput.split(';').map(s=>s.trim()).filter(Boolean)
    
    try {
      // リアルタイムストアに保存（自動同期）
      const problemData: any = {
        userId: state.userId,
        subjectName: state.subjectName,
        subjectFixed: subjFixed,
        text: state.text.trim(),
        answer: state.answer.trim(),
        tags,
        archived: false
      }
      
      // undefined を避けるため、値がある場合のみフィールドを追加
      if (state.source.trim()) {
        problemData.source = state.source.trim()
      }
      if (state.memo.trim()) {
        problemData.memo = state.memo.trim()
      }
      
      await realtimeStore.addProblem(problemData)
      
      alert('保存しました！全デバイスに自動同期されます 🎆')
      setState(s=>({...s, text:'', answer:'', tagsInput:'', source:'', memo:''}))
    } catch (error) {
      console.error('Failed to save problem:', error)
      const message = error instanceof Error ? error.message : String(error)
      alert('問題の保存に失敗しました: ' + message)
    }
  }


  return (
    <App>
      <h2>問題を登録</h2>
      
      {/* 認証状態表示 */}
      <div className="card" style={{ 
        marginBottom: 16, 
        backgroundColor: realtimeStore.user ? '#f0f9ff' : '#fef3c7', 
        border: `2px solid ${realtimeStore.user ? '#3b82f6' : '#f59e0b'}` 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            width: 12, 
            height: 12, 
            borderRadius: '50%', 
            backgroundColor: realtimeStore.user ? '#10b981' : '#f59e0b' 
          }}></div>
          <strong>
            {realtimeStore.user 
              ? `✅ リアルタイム同期有効 (${realtimeStore.user.email})` 
              : '⚠️ リアルタイム同期にはログインが必要'
            }
          </strong>
        </div>
        {!realtimeStore.user && (
          <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
            「データ入出力」ページでGoogleログインしてください。
          </p>
        )}
        
        {/* デバッグボタン */}
        {realtimeStore.user && (
          <div style={{ marginTop: 12 }}>
            <button 
              type="button"
              className="button secondary"
              style={{ fontSize: '14px', padding: '8px 16px' }}
              onClick={async () => {
                console.log('🔍 デバッグ：認証状態チェック:', {
                  user: realtimeStore.user?.email,
                  uid: realtimeStore.user?.uid,
                  problems: realtimeStore.problems.length
                })
                
                try {
                  console.log('🚀 デバッグ：テスト問題の追加開始...')
                  
                  await realtimeStore.addProblem({
                    userId: 'rin',
                    subjectName: '漢字',
                    subjectFixed: true,
                    text: 'デバッグテスト問題：' + new Date().toLocaleTimeString(),
                    answer: 'テスト答え',
                    tags: ['デバッグ'],
                    archived: false
                  })
                  
                  console.log('✅ デバッグ：テスト問題の追加成功!')
                  alert('✅ デバッグテスト成功！問題が追加されました。')
                } catch (error) {
                  console.error('❌ デバッグ：テスト問題の追加失敗:', error)
                  const message = error instanceof Error ? error.message : String(error)
                  alert('❌ デバッグテスト失敗: ' + message)
                }
              }}
            >
              🔧 デバッグテスト実行
            </button>
          </div>
        )}
      </div>
      <form className="grid" onSubmit={onSubmit}>
        <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <label>子ども</label>
            <select className="input" value={state.userId} onChange={e=>setState({...state, userId: e.target.value as any})}>
              <option value="rin">りん</option>
              <option value="yui">ゆい</option>
            </select>
          </div>
          <div>
            <label>科目</label>
            <select className="input" value={state.subjectName} onChange={e=>setState({...state, subjectName: e.target.value})}>
              {subjects.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <small className="muted">新しい科目は、このセレクトに直接入力して追加してください。</small>
          </div>
        </div>

        <div>
          <label>問題文（必須）</label>
          <textarea className="input" value={state.text} onChange={e=>setState({...state, text:e.target.value})} rows={4} />
        </div>
        <div>
          <label>正答（必須）</label>
          <textarea className="input" value={state.answer} onChange={e=>setState({...state, answer:e.target.value})} rows={3} />
        </div>

        <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <label>タグ（; 区切り）</label>
            <input className="input" value={state.tagsInput} onChange={e=>setState({...state, tagsInput:e.target.value})} placeholder="例: わり算; 基礎" />
          </div>
          <div>
            <label>出典</label>
            <input className="input" value={state.source} onChange={e=>setState({...state, source:e.target.value})} placeholder="例: 算数テスト 2025-08-28" />
          </div>
        </div>

        <div>
          <label>メモ</label>
          <textarea className="input" value={state.memo} onChange={e=>setState({...state, memo:e.target.value})} rows={3} />
        </div>

        <div className="row">
          <button 
            className="button" 
            type="submit"
            disabled={!realtimeStore.user}
            style={{
              opacity: !realtimeStore.user ? 0.5 : 1,
              cursor: !realtimeStore.user ? 'not-allowed' : 'pointer'
            }}
          >
            {realtimeStore.user ? '🚀 保存する（リアルタイム同期）' : 'ログインが必要'}
          </button>
        </div>
      </form>
    </App>
  )
}