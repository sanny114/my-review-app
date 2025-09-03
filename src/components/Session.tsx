import { useMemo, useState } from 'react'
import App from '../App'
import { addReviewLog, loadDB } from '../store'
import { RatingCode } from '../types'

const ratingBtn: { k: RatingCode; label: string; className: string; style?: React.CSSProperties }[] = [
  { k: 'wrong',  label: 'まちがい',           className: 'button danger' },
  { k: 'doubt',  label: 'ちょっと自信ない',   className: 'button', style: { background: '#f59e0b', color: '#fff' } },
  { k: 'correct',label: 'できた',             className: 'button', style: { background: '#10b981', color: '#fff' } }
]

export default function Session(){
  const db = loadDB()
  const [userId, setUserId] = useState<'rin'|'yui'>('rin')
  const [subjectFilter, setSubjectFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')

  const [repeatMistakes, setRepeatMistakes] = useState(db.appSettings.defaultReviewOptions.repeatMistakes)
  const [repeatWithin,  setRepeatWithin]  = useState(db.appSettings.defaultReviewOptions.repeatWithinSession)

  const problems = useMemo(()=>{
    return db.problems.filter(p =>
      p.userId === userId &&
      !p.archived &&
      (!subjectFilter || p.subjectName === subjectFilter) &&
      (!tagFilter || (p.tags || []).includes(tagFilter))
    )
  }, [db, userId, subjectFilter, tagFilter])

  const [queue, setQueue] = useState(() => problems.map(p => p.id))
  const [idx, setIdx] = useState(0)
  const [showAns, setShowAns] = useState(false)

  const current = db.problems.find(p => p.id === queue[idx])

  const addRepeat = (pid: string, rating: RatingCode) => {
    if (!repeatWithin) return
    if (repeatMistakes && (rating === 'wrong' || rating === 'doubt')) {
      // 数問後に差し込む
      const insertAt = Math.min(queue.length, idx + 3)
      setQueue(q => [...q.slice(0, insertAt), pid, ...q.slice(insertAt)])
    }
  }

  const onRate = (r: RatingCode) => {
    if (!current) return
    addReviewLog(db, current.id, userId, r)
    addRepeat(current.id, r)
    setShowAns(false)
    setIdx(i => Math.min(i + 1, queue.length))
  }

  const onRestart = () => {
    setIdx(0)
    setShowAns(false)
  }

  return (
    <App>
      <h2>復習する</h2>

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
        <div className="card">
          <div className="row">
            <label>子ども</label>
            <select className="input" value={userId} onChange={e => setUserId(e.target.value as any)}>
              <option value="rin">りん</option>
              <option value="yui">ゆい</option>
            </select>

            <label>科目</label>
            <select className="input" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="">（すべて）</option>
              {Array.from(new Set(db.problems.filter(p => p.userId === userId).map(p => p.subjectName))).map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>

            <label>タグ</label>
            <select className="input" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              <option value="">（なし）</option>
              {Array.from(new Set(db.problems.filter(p => p.userId === userId).flatMap(p => p.tags || []))).map(t =>
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

        {current ? (
          <div className="card">
            <div style={{ color: '#666' }}>{idx + 1} / {queue.length}</div>
            <h3 style={{ marginTop: 8 }}>{current.text}</h3>

            {showAns ? (
              <div className="card" style={{ background: '#f8fafc' }}>
                <div><b>正答:</b></div>
                <div>{current.answer}</div>
                {current.memo && <div style={{ marginTop: 8, color: '#555' }}><b>メモ:</b> {current.memo}</div>}
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 12 }}>
              {!showAns && <button className="button" onClick={() => setShowAns(true)}>答えを見る</button>}
              <button className="button secondary" onClick={() => setIdx(i => Math.max(0, i - 1))}>前へ</button>
              <button className="button secondary" onClick={() => setIdx(i => Math.min(queue.length - 1, i + 1))}>次へ</button>
            </div>

            {showAns && (
              <div className="row" style={{ marginTop: 12, gap: 12 }}>
                {ratingBtn.map(b => (
                  <button
                    key={b.k}
                    className={b.className}
                    style={b.style}
                    onClick={() => onRate(b.k)}
                  >
                    {b.label}
                  </button>
                ))}
                <button className="button secondary" onClick={() => setShowAns(false)}>もう一度この問題</button>
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            {problems.length === 0 ? (
              <p>条件に合う問題がありません。フィルタを見直してください。</p>
            ) : (
              <>
                <p>セッションが終了しました。</p>
                <button className="button" onClick={onRestart}>同じ条件でもう一度</button>
              </>
            )}
          </div>
        )}
      </div>
    </App>
  )
}
