import { FormEvent, useMemo, useState } from 'react'
import App from '../App'
import { addProblem, loadDB } from '../store'
import { Problem } from '../types'


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
const db = loadDB()
const [state, setState] = useState<FormState>({
userId: 'rin', subjectName: '漢字', subjectFixed: true,
text:'', answer:'', tagsInput:'', source:'', memo:''
})


const subjects = useMemo(()=>{
const free = Array.from(new Set(db.problems.map(p=>p.subjectFixed? null : p.subjectName).filter(Boolean))) as string[]
return [...fixedSubjects, ...free]
},[db.problems])


const onSubmit = (e: FormEvent) => {
e.preventDefault()
if (!state.text.trim()) { alert('問題文は必須です'); return }
if (!state.answer.trim()) { alert('正答は必須です'); return }
const subjFixed = fixedSubjects.includes(state.subjectName)
const tags = state.tagsInput.split(';').map(s=>s.trim()).filter(Boolean)
addProblem(db, {
userId: state.userId,
subjectName: state.subjectName,
subjectFixed: subjFixed,
text: state.text.trim(),
answer: state.answer.trim(),
tags,
source: state.source.trim() || undefined,
memo: state.memo.trim() || undefined,
archived: false
} as Omit<Problem,'id'|'createdAt'|'updatedAt'>)
alert('保存しました')
setState(s=>({...s, text:'', answer:'', tagsInput:'', source:'', memo:''}))
}


return (
<App>
<h2>問題を登録</h2>
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
<button className="button" type="submit">保存する</button>
</div>
</form>
</App>
)
}