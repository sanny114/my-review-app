import App from '../App'
import { useMemo, useState } from 'react'
import { formatJST } from '../utils'
import { Problem } from '../types'
import { useRealtimeStore } from '../stores/RealtimeStore'
import ProblemImage from './ProblemImage'
import ImageUploader from './ImageUploader'
import { uploadProblemImage, deleteProblemImage } from '../firebase'

export default function ListView(){
  const realtimeStore = useRealtimeStore()
  
  const [userId, setUserId] = useState<'rin'|'yui'>('rin')
  const [subject, setSubject] = useState('')
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'wrongCount' | 'correctRate' | 'totalAttempts'>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Problem>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [isImageUploading, setIsImageUploading] = useState(false)

  // 問題ごとの統計惇報を計算
  const getProblemStats = (problemId: string) => {
    const logs = realtimeStore.reviewLogs.filter(log => 
      log.problemId === problemId && log.userId === userId
    )
    
    const totalAttempts = logs.length
    const wrongCount = logs.filter(log => log.rating === 'wrong').length
    const correctCount = logs.filter(log => log.rating === 'correct').length
    const correctRate = totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0
    
    return {
      totalAttempts,
      wrongCount,
      correctCount,
      correctRate: Math.round(correctRate)
    }
  }

  // シンプル化：RealtimeStoreのデータのみ使用
  const items = useMemo(()=>{
    let arr = realtimeStore.problems.filter(p=>p.userId===userId && !p.archived)
    if (subject) arr = arr.filter(p=>p.subjectName===subject)
    if (q) {
      const k = q.toLowerCase()
      arr = arr.filter(p=> (p.text+p.answer+(p.source||'')+(p.memo||'')).toLowerCase().includes(k))
    }
    
    // 統計情報付きの配列を作成
    const arrWithStats = arr.map(p => ({
      ...p,
      stats: getProblemStats(p.id)
    }))
    
    // ソート機能を追加
    if (sortBy === 'newest') {
      arrWithStats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sortBy === 'wrongCount') {
      arrWithStats.sort((a, b) => b.stats.wrongCount - a.stats.wrongCount)
    } else if (sortBy === 'correctRate') {
      arrWithStats.sort((a, b) => a.stats.correctRate - b.stats.correctRate)
    } else if (sortBy === 'totalAttempts') {
      arrWithStats.sort((a, b) => b.stats.totalAttempts - a.stats.totalAttempts)
    }
    
    return arrWithStats
  },[realtimeStore.problems, realtimeStore.reviewLogs, userId, subject, q, sortBy])

  // フィルタが変わったら選択をクリア
  useMemo(() => {
    const currentItemIds = new Set(items.map(p => p.id))
    const newSelected = new Set(Array.from(selectedIds).filter(id => currentItemIds.has(id)))
    if (newSelected.size !== selectedIds.size) {
      setSelectedIds(newSelected)
    }
  }, [items, selectedIds])

  // 編集開始
  const startEdit = (problem: Problem) => {
    setEditingId(problem.id)
    setEditForm({
      subjectName: problem.subjectName,
      text: problem.text,
      answer: problem.answer,
      tags: problem.tags,
      source: problem.source,
      memo: problem.memo,
      image: problem.image // 現在の画像URLを設定
    })
    setEditImageFile(null) // 編集開始時は新しいファイルなし
  }

  // シンプル化：編集保存
  const saveEdit = async () => {
    if (!editingId || !editForm.text?.trim() || !editForm.answer?.trim()) {
      alert('問題文と答えは必須です')
      return
    }

    if (!realtimeStore.user) {
      alert('更新にはログインが必要です')
      return
    }

    setIsImageUploading(true)

    try {
      const patch: Partial<Problem> = {
        subjectName: editForm.subjectName?.trim() || '未分類',
        subjectFixed: ['漢字', '算数'].includes(editForm.subjectName?.trim() || ''),
        text: editForm.text.trim(),
        answer: editForm.answer.trim(),
        tags: editForm.tags || [],
      }
      
      // 画像処理
      if (editImageFile) {
        // 新しい画像がアップロードされた場合
        const imageUrl = await uploadProblemImage(realtimeStore.user.uid, editingId, editImageFile)
        patch.image = imageUrl
        
        // 旧い画像がある場合は削除
        if (editForm.image) {
          try {
            await deleteProblemImage(editForm.image)
          } catch (error) {
            console.warn('旧い画像の削除に失敗:', error)
          }
        }
      } else if (editForm.image) {
        // 既存の画像を維持
        patch.image = editForm.image
      }
      
      if (editForm.source?.trim()) {
        patch.source = editForm.source.trim()
      }
      if (editForm.memo?.trim()) {
        patch.memo = editForm.memo.trim()
      }

      await realtimeStore.updateProblem(editingId, patch)
      setEditingId(null)
      setEditForm({})
      setEditImageFile(null)
      alert('保存しました')
    } catch (error) {
      console.error('Failed to update problem:', error)
      const message = error instanceof Error ? error.message : String(error)
      alert('更新に失敗しました: ' + message)
    } finally {
      setIsImageUploading(false)
    }
  }

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setEditImageFile(null)
  }

  // 編集時の画像ハンドラー
  const handleEditImageChange = (file: File | null) => {
    setEditImageFile(file)
  }

  const handleEditImageDelete = async () => {
    if (editForm.image) {
      // 既存の画像を削除
      try {
        await deleteProblemImage(editForm.image)
        setEditForm(prev => ({ ...prev, image: undefined }))
      } catch (error) {
        console.warn('画像の削除に失敗:', error)
        alert('画像の削除に失敗しました')
      }
    }
    setEditImageFile(null)
  }

  // 個別選択のトグル
  const toggleSelection = (problemId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(problemId)) {
      newSelected.delete(problemId)
    } else {
      newSelected.add(problemId)
    }
    setSelectedIds(newSelected)
  }

  // 全選択/全解除
  const toggleAllSelection = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(p => p.id)))
    }
  }

  // シンプル化：一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('削除する問題を選択してください')
      return
    }

    if (!realtimeStore.user) {
      alert('削除にはログインが必要です')
      return
    }

    const selectedProblems = items.filter(p => selectedIds.has(p.id))
    const problemTexts = selectedProblems.map(p => `・${p.text.slice(0, 30)}...`).slice(0, 5)
    const displayText = problemTexts.join('\n') + (selectedProblems.length > 5 ? `\n...(他${selectedProblems.length - 5}件)` : '')

    if (!confirm(`${selectedIds.size}件の問題を削除しますか？\n\n${displayText}`)) return

    let successCount = 0
    for (const problemId of selectedIds) {
      try {
        await realtimeStore.deleteProblem(problemId)
        successCount++
      } catch (error) {
        console.error('Failed to delete problem:', error)
      }
    }

    setSelectedIds(new Set())
    alert(`${successCount}件の問題を削除しました`)
  }

  // シンプル化：削除
  const handleDelete = async (problem: Problem) => {
    if (!confirm(`問題「${problem.text.slice(0, 30)}...」を削除しますか？`)) return

    if (!realtimeStore.user) {
      alert('削除にはログインが必要です')
      return
    }

    try {
      await realtimeStore.deleteProblem(problem.id)
      alert('削除しました')
    } catch (error) {
      console.error('Failed to delete problem:', error)
      const message = error instanceof Error ? error.message : String(error)
      alert('削除に失敗しました: ' + message)
    }
  }

  return (
    <App>
      <h2>問題一覧</h2>
      
      <div className="card">
        <div className="row">
          <label>子ども</label>
          <select className="input" value={userId} onChange={e=>setUserId(e.target.value as any)}>
            <option value="rin">りん</option>
            <option value="yui">ゆい</option>
          </select>
          <label>科目</label>
          <select className="input" value={subject} onChange={e=>setSubject(e.target.value)}>
            <option value="">（すべて）</option>
            {Array.from(new Set(realtimeStore.problems.filter(p=>p.userId===userId).map(p=>p.subjectName))).map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <label>検索</label>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="キーワード" />
          <label>並び順</label>
          <select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value as any)}>
            <option value="newest">最新順</option>
            <option value="wrongCount">間違い多い順</option>
            <option value="correctRate">正答率低い順</option>
            <option value="totalAttempts">挑戦回数多い順</option>
          </select>
        </div>

        {/* 選択状態と一括操作 */}
        {items.length > 0 && (
          <div style={{marginTop: '12px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span style={{fontSize: '14px', color: '#6c757d'}}>
                  📊 {items.length}件中 {selectedIds.size}件選択中
                </span>
                {selectedIds.size > 0 && (
                  <button 
                    className="button"
                    style={{fontSize: '12px', padding: '4px 8px', backgroundColor: '#dc3545', borderColor: '#dc3545'}}
                    onClick={handleBulkDelete}
                    disabled={editingId !== null}
                  >
                    🗑️ {selectedIds.size}件を一括削除
                  </button>
                )}
              </div>
              <button 
                className="button secondary"
                style={{fontSize: '12px', padding: '4px 8px'}}
                onClick={toggleAllSelection}
                disabled={editingId !== null}
              >
                {selectedIds.size === items.length && items.length > 0 ? '全解除' : '全選択'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{overflowX:'auto', maxWidth: '100%'}}>
        <table className="table" style={{minWidth: '1050px', fontSize: '14px', borderCollapse: 'separate', borderSpacing: 0}}>
          <thead>
            <tr>
              <th style={{width: '40px'}}>
                <input 
                  type="checkbox" 
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onChange={toggleAllSelection}
                  disabled={editingId !== null}
                  title={selectedIds.size === items.length ? '全解除' : '全選択'}
                />
              </th>
              <th style={{width: '60px'}}>科目</th>
              <th style={{width: '200px'}}>問題文</th>
              <th style={{width: '160px'}}>正答</th>
              <th style={{width: '70px'}}>挑戦回数</th>
              <th style={{width: '50px'}}>間違い</th>
              <th style={{width: '50px'}}>正答率</th>
              <th style={{width: '80px'}}>タグ</th>
              <th style={{width: '80px'}}>出典</th>
              <th style={{width: '100px'}}>登録日時</th>
              <th style={{width: '160px', position: 'sticky', right: 0, backgroundColor: 'white', borderLeft: '2px solid #dee2e6'}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p=> {
              const isEditing = editingId === p.id
              const isSelected = selectedIds.has(p.id)
              return (
                <tr key={p.id} style={isEditing ? {backgroundColor: '#f0f8ff'} : isSelected ? {backgroundColor: '#fff3cd'} : {}}>
                  {/* チェックボックス */}
                  <td>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelection(p.id)}
                      disabled={editingId !== null}
                    />
                  </td>
                  {/* 科目 */}
                  <td style={{width: '60px', maxWidth: '60px'}}>
                    {isEditing ? (
                      <select 
                        value={editForm.subjectName || ''} 
                        onChange={e => setEditForm({...editForm, subjectName: e.target.value})}
                        style={{width: '55px', fontSize: '12px'}}
                      >
                        <option value="漢字">漢字</option>
                        <option value="算数">算数</option>
                        <option value="国語">国語</option>
                        <option value="理科">理科</option>
                        <option value="社会">社会</option>
                      </select>
                    ) : (
                      <div style={{fontSize: '12px'}}>{p.subjectName}</div>
                    )}
                  </td>

                  {/* 問題文 */}
                  <td style={{width: '200px', maxWidth: '200px'}}>
                    {isEditing ? (
                      <div>
                        <textarea 
                          value={editForm.text || ''} 
                          onChange={e => setEditForm({...editForm, text: e.target.value})}
                          rows={4}
                          style={{
                            width: '100%', 
                            maxWidth: '190px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: '12px',
                            marginBottom: '8px'
                          }}
                        />
                        {/* 編集時の画像アップロード */}
                        <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                          📷 画像（任意）
                        </div>
                        {(editForm.image || editImageFile) ? (
                          <div style={{ marginBottom: '8px' }}>
                            <img
                              src={editImageFile ? URL.createObjectURL(editImageFile) : editForm.image}
                              alt="編集中の画像"
                              style={{
                                maxWidth: '120px',
                                maxHeight: '60px',
                                objectFit: 'contain',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              <label style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}>
                                変更
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleEditImageChange(e.target.files?.[0] || null)}
                                  style={{ display: 'none' }}
                                  disabled={isImageUploading}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleEditImageDelete}
                                disabled={isImageUploading}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label style={{
                            display: 'block',
                            fontSize: '10px',
                            padding: '8px',
                            border: '1px dashed #dee2e6',
                            borderRadius: '4px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: '#f8f9fa',
                            marginBottom: '8px'
                          }}>
                            + 画像追加
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleEditImageChange(e.target.files?.[0] || null)}
                              style={{ display: 'none' }}
                              disabled={isImageUploading}
                            />
                          </label>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          maxWidth: '200px', 
                          wordWrap: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontSize: '12px',
                          lineHeight: '1.3',
                          overflow: 'hidden'
                        }}>
                          {p.text.length > 70 ? p.text.slice(0, 70) + '...' : p.text}
                        </div>
                        {/* 一覧での画像表示（小さく） */}
                        {p.image && (
                          <div style={{ marginTop: '8px' }}>
                            <ProblemImage
                              imageUrl={p.image}
                              alt="問題画像"
                              maxHeight="80px"
                              maxWidth="150px"
                              showZoom={true}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 正答 */}
                  <td style={{width: '160px', maxWidth: '160px'}}>
                    {isEditing ? (
                      <textarea 
                        value={editForm.answer || ''} 
                        onChange={e => setEditForm({...editForm, answer: e.target.value})}
                        rows={4}
                        style={{
                          width: '100%', 
                          maxWidth: '150px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          fontSize: '12px'
                        }}
                      />
                    ) : (
                      <div style={{
                        maxWidth: '160px', 
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                        fontSize: '12px',
                        lineHeight: '1.3',
                        overflow: 'hidden'
                      }}>
                        {p.answer.length > 45 ? p.answer.slice(0, 45) + '...' : p.answer}
                      </div>
                    )}
                  </td>

                  {/* 挑戦回数 */}
                  <td style={{width: '70px', textAlign: 'center', color: p.stats.totalAttempts > 0 ? '#495057' : '#6c757d', fontSize: '12px'}}>
                    <div style={{fontWeight: 'bold'}}>
                      {p.stats.totalAttempts > 0 ? `${p.stats.totalAttempts}` : '-'}
                    </div>
                    <div style={{fontSize: '10px', color: '#6c757d'}}>回</div>
                  </td>

                  {/* 間違い回数 */}
                  <td style={{width: '50px', textAlign: 'center', fontSize: '12px'}}>
                    <div style={{
                      fontWeight: 'bold',
                      color: p.stats.wrongCount > 0 ? '#dc3545' : '#6c757d'
                    }}>
                      {p.stats.wrongCount > 0 ? `${p.stats.wrongCount}` : '-'}
                    </div>
                    <div style={{fontSize: '10px', color: '#6c757d'}}>間違い</div>
                  </td>

                  {/* 正答率 */}
                  <td style={{width: '50px', textAlign: 'center', fontSize: '12px'}}>
                    {p.stats.totalAttempts > 0 ? (
                      <div>
                        <div style={{
                          color: p.stats.correctRate >= 80 ? '#28a745' : 
                                 p.stats.correctRate >= 60 ? '#ffc107' : '#dc3545',
                          fontWeight: 'bold',
                          fontSize: '13px'
                        }}>
                          {p.stats.correctRate}%
                        </div>
                        <div style={{fontSize: '9px', color: '#6c757d'}}>正答率</div>
                      </div>
                    ) : (
                      <span style={{color: '#6c757d'}}>-</span>
                    )}
                  </td>

                  {/* タグ */}
                  <td style={{width: '80px', maxWidth: '80px'}}>
                    {isEditing ? (
                      <input 
                        value={(editForm.tags || []).join('; ')} 
                        onChange={e => setEditForm({...editForm, tags: e.target.value.split(';').map(t => t.trim()).filter(t => t)})}
                        placeholder="タグ1; タグ2"
                        style={{width: '75px', fontSize: '11px'}}
                      />
                    ) : (
                      <div style={{fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {(p.tags||[]).join('; ')}
                      </div>
                    )}
                  </td>

                  {/* 出典 */}
                  <td style={{width: '80px', maxWidth: '80px'}}>
                    {isEditing ? (
                      <input 
                        value={editForm.source || ''} 
                        onChange={e => setEditForm({...editForm, source: e.target.value})}
                        placeholder="出典"
                        style={{width: '75px', fontSize: '11px'}}
                      />
                    ) : (
                      <div style={{fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {p.source || ''}
                      </div>
                    )}
                  </td>

                  {/* 登録日時 */}
                  <td style={{width: '100px', fontSize: '11px'}}>
                    <div style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                      {formatJST(p.createdAt).split(' ')[0]}
                    </div>
                    <div style={{fontSize: '10px', color: '#6c757d'}}>
                      {formatJST(p.createdAt).split(' ')[1]}
                    </div>
                  </td>

                  {/* 操作 */}
                  <td style={{
                    width: '160px', 
                    minWidth: '160px',
                    position: 'sticky', 
                    right: 0, 
                    backgroundColor: isSelected ? '#fff3cd' : isEditing ? '#f0f8ff' : 'white',
                    borderLeft: '2px solid #dee2e6',
                    zIndex: 10
                  }}>
                    {isEditing ? (
                      <div style={{display: 'flex', gap: '2px', flexDirection: 'column'}}>
                        <button 
                          className="button"
                          style={{
                            fontSize: '11px', 
                            padding: '4px 6px', 
                            marginBottom: '2px',
                            opacity: isImageUploading ? 0.5 : 1
                          }}
                          onClick={saveEdit}
                          disabled={isImageUploading}
                        >
                          {isImageUploading ? '🔄 保存中...' : '✔ 保存'}
                        </button>
                        <button 
                          className="button secondary"
                          style={{
                            fontSize: '11px', 
                            padding: '4px 6px',
                            opacity: isImageUploading ? 0.5 : 1
                          }}
                          onClick={cancelEdit}
                          disabled={isImageUploading}
                        >
                          ✖ キャンセル
                        </button>
                      </div>
                    ) : (
                      <div style={{display: 'flex', gap: '2px', flexDirection: 'column'}}>
                        <button 
                          className="button secondary"
                          style={{fontSize: '11px', padding: '4px 6px', marginBottom: '2px'}}
                          onClick={() => startEdit(p)}
                          disabled={editingId !== null}
                        >
                          ✏ 編集
                        </button>
                        <button 
                          className="button"
                          style={{fontSize: '11px', padding: '4px 6px', backgroundColor: '#dc3545', borderColor: '#dc3545'}}
                          onClick={() => handleDelete(p)}
                          disabled={editingId !== null}
                        >
                          🗑 削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {items.length===0 && <p>条件に合う問題がありません。</p>}
        {editingId && (
          <div style={{marginTop: '12px', padding: '8px', backgroundColor: '#e7f3ff', borderRadius: '4px'}}>
            <small>
              💡 <strong>編集中:</strong> 問題文と答えは必須です。他の項目は空欄でもOKです。
            </small>
          </div>
        )}
        {selectedIds.size > 0 && !editingId && (
          <div style={{marginTop: '12px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107'}}>
            <small>
              ✅ <strong>{selectedIds.size}件選択中:</strong> 上の「一括削除」ボタンでまとめて削除できます。
            </small>
          </div>
        )}
      </div>
    </App>
  )
}
