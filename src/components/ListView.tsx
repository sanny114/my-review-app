import App from '../App'
import { loadDB } from '../store'
import { useMemo, useState } from 'react'
import { formatJST } from '../utils'


export default function ListView(){
const db = loadDB()
const [userId, setUserId] = useState<'rin'|'yui'>('rin')
const [subject, setSubject] = useState('')
const [q, setQ] = useState('')


const items = useMemo(()=>{
let arr = db.problems.filter(p=>p.userId===userId && !p.archived)
if (subject) arr = arr.filter(p=>p.subjectName===subject)
if (q) {
const k = q.toLowerCase()
arr = arr.filter(p=> (p.text+p.answer+(p.source||'')+(p.memo||'')).toLowerCase().includes(k))
}
return arr
},[db, userId, subject, q])


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
</tr>
</thead>
<tbody>
{items.map(p=> (
<tr key={p.id}>
<td>{p.subjectName}</td>
<td>{p.text.slice(0,40)}</td>
<td>{p.answer.slice(0,40)}</td>
<td>{(p.tags||[]).join('; ')}</td>
<td>{p.source}</td>
<td>{formatJST(p.createdAt)}</td>
</tr>
))}
</tbody>
</table>
{items.length===0 && <p>条件に合う問題がありません。</p>}
</div>
</App>
)
}