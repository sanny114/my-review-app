import App from '../App'
import { useRealtimeStore } from '../stores/RealtimeStore'
import { useMemo, useState } from 'react'


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
    <div style={{ width: '100%' }}>
      {/* グラフエリア */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'end', 
        height: '200px',
        padding: '20px 0',
        borderBottom: '2px solid #e9ecef',
        marginBottom: '10px'
      }}>
        {dailyData.map((item, index) => {
          const maxCount = Math.max(...dailyData.map(d => d.count), 1)
          const barHeight = item.count > 0 ? Math.max((item.count / maxCount) * 160, 8) : 2
          
          return (
            <div 
              key={item.date}
              style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                margin: '0 2px',
                position: 'relative'
              }}
            >
              {/* バー */}
              <div
                style={{
                  width: '100%',
                  maxWidth: range === '7' ? '40px' : '25px',
                  height: `${barHeight}px`,
                  backgroundColor: item.count > 0 ? '#3b82f6' : '#e9ecef',
                  borderRadius: '4px 4px 0 0',
                  border: '1px solid #2563eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = item.count > 0 ? '#2563eb' : '#dee2e6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = item.count > 0 ? '#3b82f6' : '#e9ecef'
                }}
                title={`${item.label}: ${item.count}問題を解いた`}
              >
                {/* 数値表示 */}
                {item.count > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-25px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#495057',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.count}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* X軸ラベル */}
      <div style={{ 
        display: 'flex',
        marginTop: '5px'
      }}>
        {dailyData.map((item) => (
          <div 
            key={item.date}
            style={{ 
              flex: 1, 
              textAlign: 'center',
              fontSize: '11px',
              color: '#6c757d',
              margin: '0 2px',
              lineHeight: '1.2'
            }}
          >
            <div>{item.shortLabel}</div>
            <div style={{ fontSize: '10px', color: '#adb5bd' }}>
              ({item.weekday})
            </div>
          </div>
        ))}
      </div>
      
      {/* 統計情報 */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>合計</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
            {dailyData.reduce((sum, item) => sum + item.count, 0)}問
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>平均</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#495057' }}>
            {(dailyData.reduce((sum, item) => sum + item.count, 0) / dailyData.length).toFixed(1)}問/日
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>最高</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
            {Math.max(...dailyData.map(d => d.count))}問
          </div>
        </div>
      </div>
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
