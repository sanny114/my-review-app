import { FormEvent, useMemo, useState } from 'react'
import App from '../App'
import { Problem } from '../types'
import { useRealtimeStore } from '../stores/RealtimeStore'
import ImageUploader from './ImageUploader'
import { uploadProblemImage, deleteProblemImage } from '../firebase'
import { uid } from '../utils'

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
  imageFile: File | null // アップロードする画像ファイル
  imageUrl: string | null // アップロード済み画像URL
}

export default function RegisterForm(){
  // リアルタイムストアを使用
  const realtimeStore = useRealtimeStore()

  const [state, setState] = useState<FormState>({
    userId: 'rin', subjectName: '漢字', subjectFixed: true,
    text:'', answer:'', tagsInput:'', source:'', memo:'',
    imageFile: null, imageUrl: null
  })
  const [isUploading, setIsUploading] = useState(false)

  const subjects = useMemo(()=>{
    const free = Array.from(new Set(realtimeStore.problems.map(p=>p.subjectFixed? null : p.subjectName).filter(Boolean))) as string[]
    return [...fixedSubjects, ...free]
  },[realtimeStore.problems])

  // 画像アップロードハンドラー
  const handleImageChange = (file: File | null) => {
    setState(prev => ({
      ...prev,
      imageFile: file,
      // 新しいファイルが選ばれたら、前のURLをクリア
      imageUrl: file ? null : prev.imageUrl
    }))
  }

  // 画像削除ハンドラー
  const handleImageDelete = async () => {
    if (state.imageUrl) {
      try {
        await deleteProblemImage(state.imageUrl)
      } catch (error) {
        console.warn('画像の削除に失敗しました:', error)
      }
    }
    setState(prev => ({
      ...prev,
      imageFile: null,
      imageUrl: null
    }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!state.text.trim()) { alert('問題文は必須です'); return }
    if (!state.answer.trim()) { alert('正答は必須です'); return }
    
    // 認証チェック
    if (!realtimeStore.user) {
      alert('リアルタイム同期を使用するにはログインが必要です。\nデータ入出力ページでGoogleログインしてください。')
      return
    }
    
    setIsUploading(true)
    
    try {
      const subjFixed = fixedSubjects.includes(state.subjectName)
      const tags = state.tagsInput.split(';').map(s=>s.trim()).filter(Boolean)
      
      // 問題データの基本情報
      const problemData: any = {
        userId: state.userId,
        subjectName: state.subjectName,
        subjectFixed: subjFixed,
        text: state.text.trim(),
        answer: state.answer.trim(),
        tags,
        archived: false
      }
      
      // 画像アップロード処理
      if (state.imageFile) {
        const problemId = uid('p_') // 新しい問題IDを生成
        const imageUrl = await uploadProblemImage(realtimeStore.user.uid, problemId, state.imageFile)
        problemData.image = imageUrl
        // 生成したIDを使用
        problemData.id = problemId
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
      setState(s=>({...s, text:'', answer:'', tagsInput:'', source:'', memo:'', imageFile: null, imageUrl: null}))
    } catch (error) {
      console.error('Failed to save problem:', error)
      const message = error instanceof Error ? error.message : String(error)
      alert('問題の保存に失敗しました: ' + message)
    } finally {
      setIsUploading(false)
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

        {/* 画像アップロード機能 */}
        <ImageUploader
          currentImageUrl={state.imageUrl || undefined}
          onImageChange={handleImageChange}
          onImageDelete={handleImageDelete}
          maxSizeMB={2}
          disabled={isUploading || !realtimeStore.user}
        />
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
            disabled={!realtimeStore.user || isUploading}
            style={{
              opacity: (!realtimeStore.user || isUploading) ? 0.5 : 1,
              cursor: (!realtimeStore.user || isUploading) ? 'not-allowed' : 'pointer',
              padding: '12px 24px',
              fontSize: '16px'
            }}
          >
            {isUploading 
              ? '🔄 保存中（画像アップロード中）...' 
              : !realtimeStore.user 
                ? 'ログインが必要' 
                : '🚀 保存する（リアルタイム同期）'
            }
          </button>
        </div>
      </form>
    </App>
  )
}
