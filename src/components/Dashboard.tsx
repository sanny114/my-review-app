import App from '../App'
import { loadDB } from '../store'
import { useMemo, useState } from 'react'


const jstMidnight = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())


export default function Dashboard(){
const db = loadDB()
const [userId, setUserId] = useState<'rin'|'yui'>('rin')
const [range, setRange] = useState<'7'|'30'>('7')


const { attempts, uniq, correctRate, wrongCount } = useMemo(()=>{
const days = range==='7'? 7:30
const since = new Date(jstMidnight().getTime() - days*24*3600*1000)
const logs = db.reviewLogs.filter(r=> r.userId===userId && new Date(r.reviewedAt)>=since)
const attempts = logs.length
const group = new Map<string, { latest: 'wrong'|'doubt'|'correct', lastAt: string }>()
for (const r of logs){ group.set(r.problemId, { latest: r.rating, lastAt: r.reviewedAt }) }
const uniq = group.size
let correct = 0, wrong = 0
for (const v of group.values()){
if (v.latest==='correct') correct++; else if (v.latest==='wrong') wrong++
}
const correctRate = uniq? (correct*100/uniq) : 0
return { attempts, uniq, correctRate, wrongCount: wrong }
},[db, userId, range])


return (
<App>
<h2>ダッシュボード</h2>
<div className="card row">
<label>子ども</label>
<select className="input" value={userId} onChange={e=>setUserId(e.target.value as any)}>
<option value="rin">りん</option>
<option value="yui">ゆい</option>
</select>
<label>期間</label>
<select className="input" value={range} onChange={e=>setRange(e.target.value as any)}>
<option value="7">7日間</option>
<option value="30">30日間</option>
</select>
</div>


<div className="kpi">
<div className="card"><div>取り組んだ回数</div><h3>{attempts}</h3></div>
<div className="card"><div>ユニーク問題数</div><h3>{uniq}</h3></div>
<div className="card"><div>正答率</div><h3>{uniq? correctRate.toFixed(1): '–'}%</h3></div>
<div className="card"><div>直近の「まちがい」</div><h3>{wrongCount}</h3></div>
</div>
</App>
)
}