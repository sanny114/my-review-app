import App from '../App'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'


const jstMidnight = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())


export default function Dashboard(){
const realtimeStore = useRealtimeStore()
const [userId, setUserId] = useState<'rin'|'yui'>('rin')
const [range, setRange] = useState<'7'|'30'>('7')


const { attempts, uniq, correctRate, wrongCount } = useMemo(()=>{
const days = range==='7'? 7:30
const since = new Date(jstMidnight().getTime() - days*24*3600*1000)
const logs = realtimeStore.reviewLogs.filter(r=> r.userId===userId && new Date(r.reviewedAt)>=since)
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
},[realtimeStore.reviewLogs, userId, range])

// 日別学習量グラフ用データを生成
const dailyData = useMemo(() => {
  const days = range === '7' ? 7 : 30
  const result = []
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(jstMidnight().getTime() - i * 24 * 3600 * 1000)
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD形式
    const nextDate = new Date(date.getTime() + 24 * 3600 * 1000)
    
    // その日の学習ログをカウント
    const dayLogs = realtimeStore.reviewLogs.filter(log => {
      const logDate = new Date(log.reviewedAt)
      return log.userId === userId && logDate >= date && logDate < nextDate
    })
    
    // 日本語の曜日を取得
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    
    result.push({
      date: dateStr,
      label: `${date.getMonth() + 1}/${date.getDate()}(${weekday})`,
      shortLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      count: dayLogs.length,
      weekday
    })
  }
  
  return result
}, [realtimeStore.reviewLogs, userId, range])


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

{/* 日別学習量グラフ */}
<div className="card">
  <h3 style={{ marginBottom: '16px', color: '#495057' }}>
    📈 日別学習量 ({range === '7' ? '過去7日間' : '過去30日間'})
  </h3>
  
  {dailyData.length > 0 ? (
    <div style={{ width: '100%', height: range === '7' ? '300px' : '400px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dailyData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 60
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
          <XAxis 
            dataKey={range === '7' ? 'shortLabel' : 'shortLabel'}
            angle={range === '7' ? 0 : -45}
            textAnchor={range === '7' ? 'middle' : 'end'}
            height={range === '7' ? 30 : 80}
            fontSize={12}
            stroke="#6c757d"
          />
          <YAxis 
            stroke="#6c757d"
            fontSize={12}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#495057' }}>
                      {data.label}
                    </p>
                    <p style={{ margin: '4px 0 0 0', color: '#3b82f6' }}>
                      📝 {data.count}問題を解いた
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar 
            dataKey="count" 
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            stroke="#2563eb"
            strokeWidth={1}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <div style={{ 
      textAlign: 'center', 
      padding: '40px', 
      color: '#6c757d',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px'
    }}>
      <p style={{ margin: 0, fontSize: '16px' }}>
        📈 まだ学習データがありません
      </p>
      <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
        問題を解いてグラフを作ってみましょう！
      </p>
    </div>
  )}
</div>

{/* 既存のKPI表示 */}
<div className="kpi">
<div className="card"><div>取り組んだ回数</div><h3>{attempts}</h3></div>
<div className="card"><div>ユニーク問題数</div><h3>{uniq}</h3></div>
<div className="card"><div>正答率</div><h3>{uniq? correctRate.toFixed(1): '–'}%</h3></div>
<div className="card"><div>直近の「まちがい」</div><h3>{wrongCount}</h3></div>
</div>
</App>
)
}