import App from '../App'
import { loadDB, updateProblem, deleteProblem } from '../store'
import { useMemo, useState } from 'react'
import { formatJST } from '../utils'
import { Problem } from '../types'


export default function ListView(){
const [db, setDB] = useState(loadDB())
const [userId, setUserId] = useState<'rin'|'yui'>('rin')
const [subject, setSubject] = useState('')
const [q, setQ] = useState('')
const [editingId, setEditingId] = useState<string | null>(null)
const [editForm, setEditForm] = useState<Partial<Problem>>({})

// DBをリフレッシュする関数
const refreshDB = () => setDB(loadDB())

const items = useMemo(()=>{
let arr = db.problems.filter(p=>p.userId===userId && !p.archived)
if (subject) arr = arr.filter(p=>p.subjectName===subject)
if (q) {
const k = q.toLowerCase()
arr = arr.filter(p=> (p.text+p.answer+(p.source||'')+(p.memo||'')).toLowerCase().includes(k))
}
return arr
},[db, userId, subject, q])

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

// 編集保存
const saveEdit = () => {
if (!editingId || !editForm.text?.trim() || !editForm.answer?.trim()) {
alert('問題文と答えは必須です')
return
}

// データ更新
const patch: Partial<Problem> = {
subjectName: editForm.subjectName?.trim() || '未分類',
subjectFixed: ['漢字', '算数'].includes(editForm.subjectName?.trim() || ''),
text: editForm.text.trim(),
answer: editForm.answer.trim(),
tags: editForm.tags || [],
source: editForm.source?.trim() || undefined,
memo: editForm.memo?.trim() || undefined
}

updateProblem(db, editingId, patch)
refreshDB()
setEditingId(null)
setEditForm({})
alert('保存しました')
}

// 編集キャンセル
const cancelEdit = () => {
setEditingId(null)
setEditForm({})
}

// 削除
const handleDelete = (problem: Problem) => {
if (!confirm(`問題「${problem.text.slice(0, 30)}...」を削除しますか？`)) return

if (deleteProblem(db, problem.id)) {
refreshDB()
alert('削除しました')
} else {
alert('削除に失敗しました')
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
{Array.from(new Set(db.problems.filter(p=>p.userId===userId).map(p=>p.subjectName))).map(s=> <option key={s} value={s}>{s}</option>)}
</select>
<label>検索</label>
<input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="キーワード" />
</div>
</div>


<div className="card" style={{overflowX:'auto'}}>
<table className="table">
<thead>
<tr>
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
return (
<tr key={p.id} style={isEditing ? {backgroundColor: '#f0f8ff'} : {}}>
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
</div>
</App>
)
}