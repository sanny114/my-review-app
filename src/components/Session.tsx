import { useMemo, useState } from 'react'
import App from '../App'
import { RatingCode } from '../types'
import { useRealtimeStore } from '../stores/RealtimeStore'

const ratingBtn: { k: RatingCode; label: string; text: string; className: string; style?: React.CSSProperties }[] = [
  { 
    k: 'correct',
    label: '○',
    text: 'できた！',             
    className: 'button secondary', 
    style: { 
      fontSize: '32px', 
      padding: '20px 40px', 
      color: '#dc2626', 
      backgroundColor: 'white', 
      border: '2px solid #e5e7eb',
      fontWeight: 'bold',
      minWidth: '120px',
      minHeight: '100px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    } 
  },
  { 
    k: 'doubt',  
    label: '△',
    text: '自信ない',   
    className: 'button secondary', 
    style: { 
      fontSize: '32px', 
      padding: '20px 40px', 
      color: '#f59e0b', 
      backgroundColor: 'white', 
      border: '2px solid #e5e7eb',
      fontWeight: 'bold',
      minWidth: '120px',
      minHeight: '100px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    } 
  },
  { 
    k: 'wrong',  
    label: '×',
    text: 'まちがった',           
    className: 'button secondary', 
    style: { 
      fontSize: '32px', 
      padding: '20px 40px', 
      color: '#16a34a', 
      backgroundColor: 'white', 
      border: '2px solid #e5e7eb',
      fontWeight: 'bold',
      minWidth: '120px',
      minHeight: '100px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    } 
  }
]

export default function Session(){
  const realtimeStore = useRealtimeStore()
  
  const [userId, setUserId] = useState<'rin'|'yui'>('rin')
  const [subjectFilter, setSubjectFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [repeatMistakes, setRepeatMistakes] = useState(true)
  const [repeatWithin, setRepeatWithin] = useState(true)
  const [mode, setMode] = useState<'setup' | 'review'>('setup')
  const [sessionProblems, setSessionProblems] = useState<string[]>([])
  const [queue, setQueue] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [showAns, setShowAns] = useState(false)

  const problems = useMemo(()=>{
    const filtered = realtimeStore.problems.filter(p =>
      p.userId === userId &&
      !p.archived &&
      (!subjectFilter || p.subjectName === subjectFilter) &&
      (!tagFilter || (p.tags || []).includes(tagFilter))
    )
    return filtered
  }, [realtimeStore.problems, userId, subjectFilter, tagFilter])

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const getSortedProblems = () => {
    const problemsWithScore = problems.map(problem => {
      const logs = realtimeStore.reviewLogs.filter(log => 
        log.problemId === problem.id && log.userId === userId
      )
      const wrongCount = logs.filter(log => log.rating === 'wrong').length
      const doubtCount = logs.filter(log => log.rating === 'doubt').length
      const score = wrongCount * 2 + doubtCount * 1
      return { ...problem, score, wrongCount, doubtCount }
    })

    const scoreGroups = new Map()
    problemsWithScore.forEach(problem => {
      const score = problem.score
      if (!scoreGroups.has(score)) {
        scoreGroups.set(score, [])
      }
      scoreGroups.get(score).push(problem)
    })

    const shuffledGroups = Array.from(scoreGroups.entries())
      .sort(([a], [b]) => b - a)
      .map(([score, problems]) => shuffleArray(problems))
      .flat()

    return shuffledGroups.map(p => p.id)
  }

  const startReviewSession = () => {
    if (problems.length === 0) {
      alert('条件に合う問題がありません。フィルタを見直してください。')
      return
    }
    
    const sortedProblemIds = getSortedProblems()
    setSessionProblems(sortedProblemIds)
    setQueue(sortedProblemIds)
    setIdx(0)
    setShowAns(false)
    setMode('review')
  }

  const endReviewSession = () => {
    setMode('setup')
    setSessionProblems([])
    setQueue([])
    setIdx(0)
    setShowAns(false)
  }

  const current = realtimeStore.problems.find(p => p.id === queue[idx])

  // 現在の問題の過去履歴を取得
  const getCurrentProblemHistory = () => {
    if (!current) return []
    
    const logs = realtimeStore.reviewLogs
      .filter(log => log.problemId === current.id && log.userId === userId)
      .sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime())
      .slice(-7) // 直近7回分のみ表示
    
    return logs.map(log => {
      switch(log.rating) {
        case 'correct': return '○'
        case 'doubt': return '△'  
        case 'wrong': return '×'
        default: return '?'
      }
    })
  }

  const historySymbols = getCurrentProblemHistory()

  const addRepeat = (pid: string, rating: RatingCode) => {
    if (!repeatWithin) return
    if (repeatMistakes && (rating === 'wrong' || rating === 'doubt')) {
      const insertAt = Math.min(queue.length, idx + 3)
      setQueue(q => [...q.slice(0, insertAt), pid, ...q.slice(insertAt)])
    }
  }

  const onRate = async (r: RatingCode) => {
    if (!current) return
    
    try {
      await realtimeStore.addReviewLog(current.id, userId, r)
    } catch (error) {
      console.error('Failed to save review log:', error)
      alert('復習結果の保存に失敗しました。ネットワークを確認してください。')
      return
    }
    
    addRepeat(current.id, r)
    setShowAns(false)
    setIdx(i => Math.min(i + 1, queue.length))
  }

  const onRestart = () => {
    if (sessionProblems.length > 0) {
      setQueue([...sessionProblems])
      setIdx(0)
      setShowAns(false)
    }
  }

  return (
    <App>
      <h2>復習する</h2>

      {mode === 'setup' ? (
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
          <div className="card">
            <h3>復習設定</h3>
            <div className="row">
              <label>子ども</label>
              <select className="input" value={userId} onChange={e => setUserId(e.target.value as any)}>
                <option value="rin">りん</option>
                <option value="yui">ゆい</option>
              </select>

              <label>科目</label>
              <select className="input" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                <option value="">（すべて）</option>
                {Array.from(new Set(realtimeStore.problems.filter(p => p.userId === userId).map(p => p.subjectName))).map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>

              <label>タグ</label>
              <select className="input" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                <option value="">（なし）</option>
                {Array.from(new Set(realtimeStore.problems.filter(p => p.userId === userId).flatMap(p => p.tags || []))).map(t =>
                  <option key={t} value={t}>{t}</option>
                )}
              </select>
            </div>

            <div className="row">
              <label className="row">
                <input type="checkbox" checked={repeatMistakes} onChange={e => setRepeatMistakes(e.target.checked)} />
                &nbsp;間違えを優先して反復
              </label>
              <label className="row">
                <input type="checkbox" checked={repeatWithin} onChange={e => setRepeatWithin(e.target.checked)} />
                &nbsp;同じ問題を繰り返し出題
              </label>
            </div>
          </div>

          <div className="card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16, color: '#666' }}>
                対象問題数: <strong>{problems.length}件</strong>
              </div>
              
              {problems.length > 0 ? (
                <button 
                  className="button" 
                  style={{
                    fontSize: '20px',
                    padding: '16px 40px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    minWidth: '200px'
                  }}
                  onClick={startReviewSession}
                >
                  🎲 ランダム復習をはじめる
                </button>
              ) : (
                <div style={{ color: '#f59e0b' }}>
                  <p>条件に合う問題がありません。</p>
                  <p>フィルタを見直すか、まずは問題を登録してください。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
          <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>
              {queue.length > 0 && (
                <>
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{idx + 1}</span>
                  <span style={{ color: '#666' }}> / {queue.length}</span>
                </>
              )}
            </div>
            <button 
              className="button secondary" 
              style={{
                fontSize: '16px',
                padding: '8px 20px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none'
              }}
              onClick={endReviewSession}
            >
              🌅 今日はおしまい
            </button>
          </div>

          {current ? (
            <div className="card">
              <h3 style={{ marginTop: 8, fontSize: '24px', lineHeight: '1.4' }}>{current.text}</h3>

              {/* 過去履歴表示 */}
              {historySymbols.length > 0 && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '8px 12px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '4px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    📊 過去の解答履歴（右が最新）
                  </div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontFamily: 'monospace',
                    letterSpacing: '4px',
                    color: '#495057',
                    fontWeight: 'bold'
                  }}>
                    {historySymbols.join(' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                    ○：できた　△：自信ない　×：まちがった
                  </div>
                </div>
              )}

              {showAns ? (
                <div className="card" style={{ background: '#f8fafc' }}>
                  <div><b>正答:</b></div>
                  <div style={{ fontSize: '18px', marginTop: '8px' }}>{current.answer}</div>
                  {current.memo && <div style={{ marginTop: 8, color: '#555' }}><b>メモ:</b> {current.memo}</div>}
                </div>
              ) : null}

              <div className="row" style={{ marginTop: 12 }}>
                {!showAns && <button className="button" onClick={() => setShowAns(true)}>答えを見る</button>}
                <button className="button secondary" onClick={() => setIdx(i => Math.max(0, i - 1))}>前へ</button>
                <button className="button secondary" onClick={() => setIdx(i => Math.min(queue.length - 1, i + 1))}>次へ</button>
              </div>

              {showAns && (
                <div style={{ 
                  marginTop: 24, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 16, 
                  alignItems: 'center'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: 16,
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                  }}>
                    {ratingBtn.map(b => (
                      <button
                        key={b.k}
                        className={b.className}
                        style={{
                          ...b.style,
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                        onTouchStart={(e) => {
                          e.currentTarget.style.transform = 'scale(0.95)'
                        }}
                        onTouchEnd={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                        onClick={() => onRate(b.k)}
                      >
                        <div style={{ fontSize: '32px', lineHeight: '1' }}>{b.label}</div>
                        <div style={{ fontSize: '14px', fontWeight: 'normal', lineHeight: '1' }}>{b.text}</div>
                      </button>
                    ))}
                  </div>
                  <button 
                    className="button secondary" 
                    style={{
                      fontSize: '16px',
                      padding: '12px 24px',
                      marginTop: '8px'
                    }}
                    onClick={() => setShowAns(false)}
                  >
                    もう一度この問題
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div style={{ textAlign: 'center' }}>
                <h3>🎉 おつかれさまでした！</h3>
                <p>セッションが終了しました。</p>
                <div style={{ marginTop: 16, gap: 12, display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="button" onClick={onRestart}>同じ条件でもう一度</button>
                  <button className="button secondary" onClick={endReviewSession}>設定に戻る</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </App>
  )
}
