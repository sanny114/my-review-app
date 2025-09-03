import { AppDB, RatingCode } from './types'
import { escapeCsv, formatJST } from './utils'


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