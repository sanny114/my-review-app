import App from '../App'
import { useMemo, useState } from 'react'
import { formatJST } from '../utils'
import { Problem } from '../types'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { loadDB } from '../store'  // 従来のstore.tsも併用


export default function ListView(){
  // リアルタイムストアを使用
  const realtimeStore = useRealtimeStore()
  
  // 従来のローカルDBも確認用に取得
  const localDB = loadDB()
  
  const [userId, setUserId] = useState<'rin'|'yui'>('rin')
  const [subject, setSubject] = useState('')
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Problem>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dataSource, setDataSource] = useState<'realtime' | 'local' | 'both'>('realtime')

  // ✅ データソース選択によって表示データを切り替え
  const items = useMemo(()=>{
    let sourceProblems: Problem[] = []
    
    if (dataSource === 'realtime') {
      // リアルタイムストアのみ
      sourceProblems = realtimeStore.problems
    } else if (dataSource === 'local') {
      // ローカルStorageのみ
      sourceProblems = localDB.problems
    } else {
      // 両方を統合（IDで重複排除）
      const allProblems = [...realtimeStore.problems, ...localDB.problems]
      const uniqueProblems = new Map<string, Problem>()
      allProblems.forEach(p => {
        if (!uniqueProblems.has(p.id)) {
          uniqueProblems.set(p.id, p)
        }
      })
      sourceProblems = Array.from(uniqueProblems.values())
    }
    
    // フィルタリング
    let arr = sourceProblems.filter(p=>p.userId===userId && !p.archived)
    if (subject) arr = arr.filter(p=>p.subjectName===subject)
    if (q) {
      const k = q.toLowerCase()
      arr = arr.filter(p=> (p.text+p.answer+(p.source||'')+(p.memo||'')).toLowerCase().includes(k))
    }
    return arr
  },[realtimeStore.problems, localDB.problems, userId, subject, q, dataSource])

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
memo: problem.memo
})
}

// ✅ 編集保存（安全性を向上）
const saveEdit = async () => {
  if (!editingId || !editForm.text?.trim() || !editForm.answer?.trim()) {
    alert('問題文と答えは必須です')
    return
  }

  // 編集対象の問題を特定
  const problemToEdit = items.find(p => p.id === editingId)
  if (!problemToEdit) {
    alert('編集対象の問題が見つかりません')
    setEditingId(null)
    return
  }

  // データソースに応じた編集処理
  try {
    if (dataSource === 'realtime') {
      // リアルタイムストアでの編集
      if (!realtimeStore.user) {
        alert('更新にはログインが必要です')
        return
      }
      
      // Firestoreに問題が存在するかチェック
      const existsInFirestore = realtimeStore.problems.some(p => p.id === editingId)
      if (!existsInFirestore) {
        alert('⚠️ この問題はFirestoreに存在しません。\n\n「統合表示」に切り替えてローカルデータとして編集するか、\nデータクリーンアップを実行してください。')
        return
      }
      
      // データ更新
      const patch: Partial<Problem> = {
        subjectName: editForm.subjectName?.trim() || '未分類',
        subjectFixed: ['漢字', '算数'].includes(editForm.subjectName?.trim() || ''),
        text: editForm.text.trim(),
        answer: editForm.answer.trim(),
        tags: editForm.tags || [],
      }
      
      // undefined を避けるため、値がある場合のみフィールドを追加
      if (editForm.source?.trim()) {
        patch.source = editForm.source.trim()
      }
      if (editForm.memo?.trim()) {
        patch.memo = editForm.memo.trim()
      }

      await realtimeStore.updateProblem(editingId, patch)
    } else if (dataSource === 'local') {
      // ローカルStorageでの編集
      const { updateProblem, loadDB } = await import('../store')
      const currentDB = loadDB()
      
      const patch: Partial<Problem> = {
        subjectName: editForm.subjectName?.trim() || '未分類',
        subjectFixed: ['漢字', '算数'].includes(editForm.subjectName?.trim() || ''),
        text: editForm.text.trim(),
        answer: editForm.answer.trim(),
        tags: editForm.tags || [],
      }
      
      if (editForm.source?.trim()) {
        patch.source = editForm.source.trim()
      }
      if (editForm.memo?.trim()) {
        patch.memo = editForm.memo.trim()
      }
      
      updateProblem(currentDB, editingId, patch)
    } else {
      // 統合表示での編集（どちらに存在するかチェック）
      const existsInFirestore = realtimeStore.problems.some(p => p.id === editingId)
      const existsInLocal = localDB.problems.some(p => p.id === editingId)
      
      if (existsInFirestore && realtimeStore.user) {
        // Firestoreに存在する場合
        const patch: Partial<Problem> = {
          subjectName: editForm.subjectName?.trim() || '未分類',
          subjectFixed: ['漢字', '算数'].includes(editForm.subjectName?.trim() || ''),
          text: editForm.text.trim(),
          answer: editForm.answer.trim(),
          tags: editForm.tags || [],
        }
        
        if (editForm.source?.trim()) {
          patch.source = editForm.source.trim()
        }
        if (editForm.memo?.trim()) {
          patch.memo = editForm.memo.trim()
        }
        
        await realtimeStore.updateProblem(editingId, patch)
      } else if (existsInLocal) {
        // ローカルにのみ存在する場合
        const { updateProblem, loadDB } = await import('../store')
        const currentDB = loadDB()
        
        const patch: Partial<Problem> = {
          subjectName: editForm.subjectName?.trim() || '未分類',
          subjectFixed: ['漢字', '算数'].includes(editForm.subjectName?.trim() || ''),
          text: editForm.text.trim(),
          answer: editForm.answer.trim(),
          tags: editForm.tags || [],
        }
        
        if (editForm.source?.trim()) {
          patch.source = editForm.source.trim()
        }
        if (editForm.memo?.trim()) {
          patch.memo = editForm.memo.trim()
        }
        
        updateProblem(currentDB, editingId, patch)
      } else {
        alert('編集対象の問題が見つかりません')
        setEditingId(null)
        return
      }
    }
    
    setEditingId(null)
    setEditForm({})
    alert('保存しました')
  } catch (error) {
    console.error('Failed to update problem:', error)
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('No document to update')) {
      alert('⚠️ この問題はクラウドに存在しません。\n\nデータクリーンアップを実行するか、\n「💾 ローカルStorage」モードで編集してください。')
    } else {
      alert('更新に失敗しました: ' + message)
    }
  }
}

// 編集キャンセル
const cancelEdit = () => {
setEditingId(null)
setEditForm({})
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
// 全て選択済みの場合は全解除
setSelectedIds(new Set())
} else {
// 一部または未選択の場合は全選択
setSelectedIds(new Set(items.map(p => p.id)))
}
}

// ✅ 改善された一括削除機能
const handleBulkDelete = async () => {
  if (selectedIds.size === 0) {
    alert('削除する問題を選択してください')
    return
  }

  const selectedProblems = items.filter(p => selectedIds.has(p.id))
  const problemTexts = selectedProblems.map(p => `・${p.text.slice(0, 30)}...`).slice(0, 5)
  const displayText = problemTexts.join('\n') + (selectedProblems.length > 5 ? `\n...(他${selectedProblems.length - 5}件)` : '')

  if (!confirm(`${selectedIds.size}件の問題を削除しますか？\n\n${displayText}`)) return

  let successCount = 0
  for (const problemId of selectedIds) {
    try {
      // データソースごとに適切な削除処理
      if (dataSource === 'realtime') {
        // リアルタイムストアのみ
        if (!realtimeStore.user) {
          alert('削除にはログインが必要です')
          return
        }
        await realtimeStore.deleteProblem(problemId)
      } else if (dataSource === 'local') {
        // ローカルStorageのみ
        const { deleteProblem, loadDB, saveDB } = await import('../store')
        const currentDB = loadDB()
        deleteProblem(currentDB, problemId)
      } else {
        // 両方から削除
        try {
          if (realtimeStore.user) {
            await realtimeStore.deleteProblem(problemId)
          }
        } catch (error) {
          console.warn(`リアルタイムからの削除失敗 (${problemId}):`, error)
        }
        
        try {
          const { deleteProblem, loadDB } = await import('../store')
          const currentDB = loadDB()
          deleteProblem(currentDB, problemId)
        } catch (error) {
          console.warn(`ローカルからの削除失敗 (${problemId}):`, error)
        }
      }
      successCount++
    } catch (error) {
      console.error('Failed to delete problem:', error)
    }
  }

  setSelectedIds(new Set())
  alert(`${successCount}件の問題を削除しました`)
}

// ✅ 改善された削除機能：データソースに応じて適切に削除
const handleDelete = async (problem: Problem) => {
  if (!confirm(`問題「${problem.text.slice(0, 30)}...」を削除しますか？`)) return

  try {
    // データソースごとに適切な削除処理
    if (dataSource === 'realtime') {
      // リアルタイムストアのみ
      if (!realtimeStore.user) {
        alert('削除にはログインが必要です')
        return
      }
      await realtimeStore.deleteProblem(problem.id)
    } else if (dataSource === 'local') {
      // ローカルStorageのみ
      const { deleteProblem, loadDB } = await import('../store')
      const currentDB = loadDB()
      deleteProblem(currentDB, problem.id)
    } else {
      // 両方から削除（安全のため）
      try {
        // リアルタイムから削除
        if (realtimeStore.user) {
          await realtimeStore.deleteProblem(problem.id)
        }
      } catch (error) {
        console.warn('リアルタイムからの削除失敗:', error)
      }
      
      try {
        // ローカルからも削除
        const { deleteProblem, loadDB } = await import('../store')
        const currentDB = loadDB()
        deleteProblem(currentDB, problem.id)
      } catch (error) {
        console.warn('ローカルからの削除失敗:', error)
      }
    }
    
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

{/* ✅ データソース選択機能を追加 */}
<div className="card" style={{marginBottom: 16, backgroundColor: '#f8f9fa', border: '2px solid #dee2e6'}}>
  <h4>🔍 データソース選択</h4>
  <div style={{display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12}}>
    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <input 
        type="radio" 
        checked={dataSource === 'realtime'} 
        onChange={() => setDataSource('realtime')}
      />
      <span style={{fontWeight: dataSource === 'realtime' ? 'bold' : 'normal'}}>
        🚀 リアルタイムデータ ({realtimeStore.problems.filter(p=>p.userId===userId && !p.archived).length}件)
      </span>
    </label>
    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <input 
        type="radio" 
        checked={dataSource === 'local'} 
        onChange={() => setDataSource('local')}
      />
      <span style={{fontWeight: dataSource === 'local' ? 'bold' : 'normal'}}>
        💾 ローカルStorage ({localDB.problems.filter(p=>p.userId===userId && !p.archived).length}件)
      </span>
    </label>
    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <input 
        type="radio" 
        checked={dataSource === 'both'} 
        onChange={() => setDataSource('both')}
      />
      <span style={{fontWeight: dataSource === 'both' ? 'bold' : 'normal'}}>
        📊 統合表示 ({items.length}件)
      </span>
    </label>
  </div>
  
  {/* 警告メッセージ */}
  {dataSource !== 'realtime' && localDB.problems.length > 0 && (
    <div style={{padding: 12, backgroundColor: '#fff3cd', borderRadius: 4, border: '1px solid #ffc107'}}>
      <strong>⚠️ 注意:</strong> ローカルStorageに古いデータが残っています。
      <br />
      <small>
        リアルタイム同期に移行後、ローカルデータは「データ入出力」ページから削除することを推奨します。
      </small>
    </div>
  )}
  
  {/* 推奨アクション */}
  {dataSource === 'local' && (
    <div style={{padding: 12, backgroundColor: '#e7f3ff', borderRadius: 4, border: '1px solid #3b82f6'}}>
      <strong>💡 推奨:</strong> ローカルデータの削除を推奨します。
      <br />
      <small>「統合表示」で削除することで、リアルタイムとローカル両方から安全に削除できます。</small>
    </div>
  )}
</div>

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
{Array.from(new Set([
  ...realtimeStore.problems.filter(p=>p.userId===userId).map(p=>p.subjectName),
  ...(dataSource !== 'realtime' ? localDB.problems.filter(p=>p.userId===userId).map(p=>p.subjectName) : [])
])).map(s=> <option key={s} value={s}>{s}</option>)}
</select>
<label>検索</label>
<input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="キーワード" />
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


<div className="card" style={{overflowX:'auto'}}>
<table className="table">
<thead>
<tr>
<th style={{width: '40px'}}>
<input 
type="checkbox" 
checked={items.length > 0 && selectedIds.size === items.length}
ref={checkboxRef => {
if (checkboxRef) {
checkboxRef.indeterminate = selectedIds.size > 0 && selectedIds.size < items.length
}
}}
onChange={toggleAllSelection}
disabled={editingId !== null}
title={selectedIds.size === items.length ? '全解除' : '全選択'}
/>
</th>
<th>科目</th>
<th>問題文</th>
<th>正答</th>
<th>タグ</th>
<th>出典</th>
<th>登録日時</th>
<th>操作</th>
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
<td>
{isEditing ? (
<select 
value={editForm.subjectName || ''} 
onChange={e => setEditForm({...editForm, subjectName: e.target.value})}
style={{width: '100px'}}
>
<option value="漢字">漢字</option>
<option value="算数">算数</option>
<option value="国語">国語</option>
<option value="理科">理科</option>
<option value="社会">社会</option>
</select>
) : p.subjectName}
</td>

{/* 問題文 */}
<td style={{minWidth: '200px'}}>
{isEditing ? (
<textarea 
value={editForm.text || ''} 
onChange={e => setEditForm({...editForm, text: e.target.value})}
rows={3}
style={{width: '100%', resize: 'vertical'}}
/>
) : (
<div style={{maxWidth: '200px', wordWrap: 'break-word'}}>
{p.text.length > 60 ? p.text.slice(0, 60) + '...' : p.text}
</div>
)}
</td>

{/* 正答 */}
<td style={{minWidth: '120px'}}>
{isEditing ? (
<textarea 
value={editForm.answer || ''} 
onChange={e => setEditForm({...editForm, answer: e.target.value})}
rows={2}
style={{width: '100%', resize: 'vertical'}}
/>
) : (
<div style={{maxWidth: '120px', wordWrap: 'break-word'}}>
{p.answer.length > 30 ? p.answer.slice(0, 30) + '...' : p.answer}
</div>
)}
</td>

{/* タグ */}
<td>
{isEditing ? (
<input 
value={(editForm.tags || []).join('; ')} 
onChange={e => setEditForm({...editForm, tags: e.target.value.split(';').map(t => t.trim()).filter(t => t)})}
placeholder="タグ1; タグ2"
style={{width: '120px'}}
/>
) : (p.tags||[]).join('; ')}
</td>

{/* 出典 */}
<td>
{isEditing ? (
<input 
value={editForm.source || ''} 
onChange={e => setEditForm({...editForm, source: e.target.value})}
placeholder="出典"
style={{width: '120px'}}
/>
) : (p.source || '')}
</td>

{/* 登録日時 */}
<td style={{minWidth: '120px'}}>
{formatJST(p.createdAt)}
</td>

{/* 操作 */}
<td style={{minWidth: '120px'}}>
{isEditing ? (
<div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
<button 
className="button"
style={{fontSize: '12px', padding: '4px 8px'}}
onClick={saveEdit}
>
保存
</button>
<button 
className="button secondary"
style={{fontSize: '12px', padding: '4px 8px'}}
onClick={cancelEdit}
>
キャンセル
</button>
</div>
) : (
<div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
<button 
className="button secondary"
style={{fontSize: '12px', padding: '4px 8px'}}
onClick={() => startEdit(p)}
disabled={editingId !== null}
>
編集
</button>
<button 
className="button"
style={{fontSize: '12px', padding: '4px 8px', backgroundColor: '#dc3545', borderColor: '#dc3545'}}
onClick={() => handleDelete(p)}
disabled={editingId !== null}
>
削除
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
