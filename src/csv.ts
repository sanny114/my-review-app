import { AppDB, RatingCode, Problem, User } from './types'
import { escapeCsv, formatJST, uid, nowIso } from './utils'
import { saveDB } from './store'


const ratingLabel = (r: RatingCode) => r === 'wrong' ? 'まちがい' : r === 'doubt' ? 'ちょっと自信ない' : 'できた'


const dl = (name: string, csv: string) => {
// UTF-8 BOM 付与して日本語の文字化け回避
const BOM = '\uFEFF'
const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = name
a.click(); URL.revokeObjectURL(url)
}


export const exportProblemsCSV = (db: AppDB, who: 'rin'|'yui'|'both'='both') => {
const header = 'problem_id,user_id,user_name,subject_name,subject_fixed,text,answer,tags,source,memo,created_at,last_updated_at\r\n'
const users = new Map(db.users.map(u=>[u.id,u.name]))
const rows = db.problems
.filter(p => who==='both' ? true : p.userId===who)
.map(p => [
p.id, p.userId, users.get(p.userId)||'', p.subjectName, String(p.subjectFixed),
p.text, p.answer, (p.tags||[]).join(';'), p.source||'', p.memo||'',
formatJST(p.createdAt), formatJST(p.updatedAt)
].map(v=>escapeCsv(String(v))).join(','))
dl(`Problems_${who}_${Date.now()}.csv`, header + rows.join('\r\n'))
}


export const exportLogsCSV = (db: AppDB, who: 'rin'|'yui'|'both'='both', from?: Date, to?: Date) => {
const header = 'log_id,problem_id,user_id,user_name,reviewed_at,rating_code,rating_label\r\n'
const users = new Map(db.users.map(u=>[u.id,u.name]))
const rows = db.reviewLogs
.filter(r => (who==='both' ? true : r.userId===who))
.filter(r => from? new Date(r.reviewedAt)>=from : true)
.filter(r => to? new Date(r.reviewedAt)<=to : true)
.map(r => [
r.id, r.problemId, r.userId, users.get(r.userId)||'', formatJST(r.reviewedAt), r.rating, ratingLabel(r.rating)
].map(v=>escapeCsv(String(v))).join(','))
dl(`ReviewLogs_${who}_${Date.now()}.csv`, header + rows.join('\r\n'))
}


export const exportLatestStatusCSV = (db: AppDB, who: 'rin'|'yui'|'both'='both') => {
const header = 'problem_id,user_id,user_name,subject_name,latest_rating_code,latest_rating_label,last_reviewed_at,attempts_7d,attempts_30d,first_seen_at,has_correct_7d\r\n'
const users = new Map(db.users.map(u=>[u.id,u.name]))
const byProblem = new Map<string, ReturnType<typeof buildItem>>()


function buildItem(pId: string) {
return {
problemId: pId, latestRating: undefined as RatingCode|undefined,
lastReviewedAt: undefined as string|undefined,
firstSeenAt: undefined as string|undefined,
attempts7: 0, attempts30: 0, hasCorrect7: false
}
}


const now = new Date()
const d7 = new Date(now.getTime() - 7*24*3600*1000)
const d30 = new Date(now.getTime() - 30*24*3600*1000)


const problems = db.problems.filter(p => who==='both'? true : p.userId===who)
for (const p of problems) byProblem.set(p.id, buildItem(p.id))


const relatedLogs = db.reviewLogs
.filter(r => byProblem.has(r.problemId))
.sort((a,b)=> new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime())


for (const r of relatedLogs) {
const it = byProblem.get(r.problemId)!;
// first seen
if (!it.firstSeenAt) it.firstSeenAt = r.reviewedAt
// latest
it.latestRating = r.rating
it.lastReviewedAt = r.reviewedAt
const t = new Date(r.reviewedAt)
if (t >= d7) it.attempts7++
if (t >= d30) it.attempts30++
if (r.rating === 'correct' && t >= d7) it.hasCorrect7 = true
}


const rows = problems.map(p => {
const it = byProblem.get(p.id)!
const latestCode = it.latestRating ?? ''
const latestLabel = latestCode ? ratingLabel(latestCode as RatingCode) : ''
const lastAt = it.lastReviewedAt ? formatJST(it.lastReviewedAt) : ''
const firstAt = it.firstSeenAt ? formatJST(it.firstSeenAt) : ''
return [
p.id, p.userId, users.get(p.userId)||'', p.subjectName,
latestCode, latestLabel, lastAt, it.attempts7, it.attempts30, firstAt, it.hasCorrect7? 'TRUE':'FALSE'
].map(v=>escapeCsv(String(v))).join(',')
})


dl(`Problems_LatestStatus_${who}_${Date.now()}.csv`, header + rows.join('\r\n'))
}

// CSVインポート機能
export const importProblemsCSV = (db: AppDB, csvText: string, defaultUserId: User['id'] = 'rin'): { success: number, errors: string[] } => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) {
    return { success: 0, errors: ['CSVファイルが空です'] }
  }

  const header = lines[0].toLowerCase()
  const errors: string[] = []
  let success = 0

  // ヘッダー解析 - 引き継ぎ書に合わせて柔軟に対応
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++ // skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // ステータス表記ゆれ補正
  const normalizeStatus = (status: string): RatingCode => {
    const s = status.toLowerCase().trim()
    if (s.includes('×') || s.includes('ng') || s.includes('まちがい') || s === 'wrong') {
      return 'wrong'
    }
    if (s.includes('△') || s.includes('保留') || s.includes('ちょっと自信ない') || s === 'doubt') {
      return 'doubt'
    }
    return 'correct' // それ以外は「できた」
  }

  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCSVLine(lines[i])
      if (fields.length < 5) {
        errors.push(`行${i + 1}: フィールド数が不足しています`)
        continue
      }

      // 引き継ぎ書の形式: id,subject,unit,question,answer,status,note
      const [csvId, subject, unit, question, answer, status, note] = fields
      
      if (!question.trim() || !answer.trim()) {
        errors.push(`行${i + 1}: 問題文または答えが空です`)
        continue
      }

      // 実際のデータ構造に変換
      const problem: Problem = {
        id: csvId.trim() || uid('p_'), // 空IDは自動採番
        userId: defaultUserId,
        subjectName: subject.trim() || '未分類',
        subjectFixed: ['漢字', '算数'].includes(subject.trim()),
        text: question.trim(),
        answer: answer.trim(),
        tags: unit ? unit.split(';').map(t => t.trim()).filter(t => t) : [],
        source: '',
        memo: note ? note.trim() : '',
        createdAt: nowIso(),
        updatedAt: nowIso()
      }

      // 重複チェック
      const existing = db.problems.find(p => p.id === problem.id)
      if (existing) {
        // IDが重複している場合は新しいIDを生成
        problem.id = uid('p_')
      }

      db.problems.push(problem)
      
      // ステータスが「まちがい」または「ちょっと自信ない」の場合、初回レビューログを追加
      const rating = normalizeStatus(status || '')
      if (rating !== 'correct') {
        const reviewLog = {
          id: uid('r_'),
          problemId: problem.id,
          userId: defaultUserId,
          reviewedAt: nowIso(),
          rating
        }
        db.reviewLogs.push(reviewLog)
      }

      success++
    } catch (err) {
      errors.push(`行${i + 1}: ${(err as Error).message}`)
    }
  }

  if (success > 0) {
    saveDB(db)
  }

  return { success, errors }
}