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

// 改良されたCSV解析関数
const parseCSVText = (csvText: string): string[][] => {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < csvText.length) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        currentField += '"'
        i += 2
        continue
      } else {
        // クォートの開始または終了
        inQuotes = !inQuotes
        i++
        continue
      }
    }

    if (!inQuotes) {
      if (char === ',') {
        // フィールド区切り
        currentRow.push(currentField.trim())
        currentField = ''
        i++
        continue
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // 行区切り
        currentRow.push(currentField.trim())
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
        if (char === '\r' && nextChar === '\n') {
          i += 2
        } else {
          i++
        }
        continue
      }
    }

    // 通常の文字またはクォート内の改行
    if (char === '\r' && nextChar === '\n') {
      currentField += '\n'
      i += 2
    } else if (char === '\r' || char === '\n') {
      currentField += '\n'
      i++
    } else {
      currentField += char
      i++
    }
  }

  // 最後のフィールドと行を処理
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

// CSVインポート機能（改良版）
export const importProblemsCSV = (db: AppDB, csvText: string, defaultUserId: User['id'] = 'rin'): { success: number, errors: string[] } => {
  console.log('=== 改良されたCSVインポート開始 ===')
  console.log('CSV文字数:', csvText.length)
  console.log('CSV最初の200文字:', JSON.stringify(csvText.substring(0, 200)))

  const rows = parseCSVText(csvText)
  console.log('解析された行数:', rows.length)
  
  if (rows.length === 0) {
    return { success: 0, errors: ['CSVファイルが空です'] }
  }

  const header = rows[0].map(h => h.toLowerCase())
  console.log('ヘッダー:', header)
  
  const errors: string[] = []
  let success = 0

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

  for (let i = 1; i < rows.length; i++) {
    try {
      const fields = rows[i]
      console.log(`\n行${i + 1}: フィールド数=${fields.length}`)
      console.log(`問題文に改行を含む: ${fields[3] && fields[3].includes('\n') ? 'YES' : 'NO'}`)
      console.log(`回答に改行を含む: ${fields[4] && fields[4].includes('\n') ? 'YES' : 'NO'}`)
      console.log(`問題文: ${JSON.stringify(fields[3]?.substring(0, 100))}`)
      console.log(`回答: ${JSON.stringify(fields[4]?.substring(0, 100))}`)
      
      if (fields.length < 5) {
        errors.push(`行${i + 1}: フィールド数が不足しています（${fields.length}個、最低5個必要）`)
        continue
      }

      // 引き継ぎ書の形式: id,subject,unit,question,answer,status,note
      const [csvId, subject, unit, question, answer, status, note] = fields
      
      if (!question?.trim() || !answer?.trim()) {
        errors.push(`行${i + 1}: 問題文または答えが空です`)
        continue
      }

      // ID生成
      let problemId = csvId?.trim() || uid('p_')
      if (!problemId) {
        problemId = uid('p_')
      }
      
      console.log(`行${i + 1}: 生成ID="${problemId}"`)

      // 改行文字の正規化と保持
      const normalizeText = (text: string): string => {
        if (!text) return ''
        return text
          .replace(/\\n/g, '\n')  // エスケープされた改行文字を実際の改行に変換
          .replace(/\r\n/g, '\n')  // Windows改行をUnix改行に統一
          .replace(/\r/g, '\n')    // Mac改行をUnix改行に統一
          .trim()
      }

      const normalizedQuestion = normalizeText(question)
      const normalizedAnswer = normalizeText(answer)

      console.log(`正規化後の問題文: ${JSON.stringify(normalizedQuestion.substring(0, 100))}`)
      console.log(`正規化後の回答: ${JSON.stringify(normalizedAnswer.substring(0, 100))}`)

      // 実際のデータ構造に変換
      const problem: Problem = {
        id: problemId,
        userId: defaultUserId,
        subjectName: subject?.trim() || '未分類',
        subjectFixed: ['漢字', '算数'].includes(subject?.trim() || ''),
        text: normalizedQuestion,
        answer: normalizedAnswer,
        tags: unit ? unit.split(';').map(t => t.trim()).filter(t => t) : [],
        source: note?.trim() || undefined,
        memo: undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archived: false
      }

      // 重複チェック
      const existing = db.problems.find(p => p.id === problem.id)
      if (existing) {
        problem.id = uid('p_')
      }

      db.problems.push(problem)
      
      // ステータスに応じて初回レビューログを追加
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
      console.log(`行${i + 1}: 成功 - 問題「${problem.text.substring(0, 30)}...」`)
    } catch (err) {
      errors.push(`行${i + 1}: ${(err as Error).message}`)
      console.error(`行${i + 1} 例外エラー:`, err)
    }
  }

  console.log('=== 改良されたCSVインポート完了 ===')
  console.log(`成功: ${success}件, エラー: ${errors.length}件`)

  if (success > 0) {
    saveDB(db)
  }

  return { success, errors }
}