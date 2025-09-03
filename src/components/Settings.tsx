import App from '../App'
import { loadDB, saveDB } from '../store'
import { useState } from 'react'


export default function Settings(){
const db = loadDB()
const [rin, setRin] = useState(db.users.find(u=>u.id==='rin')!.name)
const [yui, setYui] = useState(db.users.find(u=>u.id==='yui')!.name)
const [fs0, setFs0] = useState(db.appSettings.fixedSubjects[0]||'漢字')
const [fs1, setFs1] = useState(db.appSettings.fixedSubjects[1]||'算数')
const [repeat, setRepeat] = useState(db.appSettings.defaultReviewOptions.repeatMistakes)
const [repeatWithin, setRepeatWithin] = useState(db.appSettings.defaultReviewOptions.repeatWithinSession)


const onSave = () => {
db.users.find(u=>u.id==='rin')!.name = rin || 'りん'
db.users.find(u=>u.id==='yui')!.name = yui || 'ゆい'
db.appSettings.fixedSubjects = [fs0||'漢字', fs1||'算数']
db.appSettings.defaultReviewOptions.repeatMistakes = repeat
db.appSettings.defaultReviewOptions.repeatWithinSession = repeatWithin
saveDB(db)
alert('保存しました')
}


return (
<App>
<h2>設定</h2>
<div className="grid">
<div className="card grid">
<h3>子どもの名前</h3>
<label>りん</label>
<input className="input" value={rin} onChange={e=>setRin(e.target.value)} />
<label>ゆい</label>
<input className="input" value={yui} onChange={e=>setYui(e.target.value)} />
</div>


<div className="card grid">
<h3>固定科目（名称変更可／削除不可）</h3>
<label>固定科目1</label>
<input className="input" value={fs0} onChange={e=>setFs0(e.target.value)} />
<label>固定科目2</label>
<input className="input" value={fs1} onChange={e=>setFs1(e.target.value)} />
</div>


<div className="card grid">
<h3>復習オプションの初期設定</h3>
<label><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)} /> 間違えた問題を優先</label>
<label><input type="checkbox" checked={repeatWithin} onChange={e=>setRepeatWithin(e.target.checked)} /> 同じ問題を繰り返し出題</label>
</div>


<div className="row">
<button className="button" onClick={onSave}>保存する</button>
</div>
</div>
</App>
)
}