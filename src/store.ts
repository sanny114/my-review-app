import { AppDB, Problem, ReviewLog, User, RatingCode } from './types'
import { nowIso, uid } from './utils'


const KEY = 'review-app-db-v1'


const defaultDB: AppDB = {
version: '1.0.0',
users: [
{ id: 'rin', name: 'りん' },
{ id: 'yui', name: 'ゆい' }
],
problems: [],
reviewLogs: [],
appSettings: {
fixedSubjects: ['漢字','算数'],
defaultReviewOptions: {
repeatMistakes: true,
repeatWithinSession: true
},
defaultSortOrder: 'newest'
}
}


export const loadDB = (): AppDB => {
try {
const raw = localStorage.getItem(KEY)
if (!raw) return structuredClone(defaultDB)
const parsed = JSON.parse(raw) as AppDB
// かんたんなマイグレーションやバリデーション
if (!Array.isArray(parsed.users) || !Array.isArray(parsed.problems)) {
return structuredClone(defaultDB)
}
return parsed
} catch {
return structuredClone(defaultDB)
}
}


export const saveDB = (db: AppDB) => {
localStorage.setItem(KEY, JSON.stringify(db))
}


// 問題のCRUD
export const addProblem = (db: AppDB, p: Omit<Problem,'id'|'createdAt'|'updatedAt'>) => {
const np: Problem = { ...p, id: uid('p_'), createdAt: nowIso(), updatedAt: nowIso() }
db.problems.unshift(np)
saveDB(db)
return np
}


export const updateProblem = (db: AppDB, pid: string, patch: Partial<Problem>) => {
const idx = db.problems.findIndex(p => p.id === pid)
if (idx === -1) return
db.problems[idx] = { ...db.problems[idx], ...patch, updatedAt: nowIso() }
saveDB(db)
}


export const deleteProblem = (db: AppDB, pid: string) => {
const idx = db.problems.findIndex(p => p.id === pid)
if (idx === -1) return false
db.problems.splice(idx, 1)
// 関連するレビューログも削除
  db.reviewLogs = db.reviewLogs.filter(r => r.problemId !== pid)
  saveDB(db)
  return true
}

export const addReviewLog = (db: AppDB, problemId: string, userId: User['id'], rating: RatingCode) => {
  const log: ReviewLog = { id: uid('r_'), problemId, userId, reviewedAt: nowIso(), rating }
  db.reviewLogs.push(log)
  saveDB(db)
  return log
}


export const exportJSON = (db: AppDB) => {
const blob = new Blob([JSON.stringify(db,null,2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`
a.click(); URL.revokeObjectURL(url)
}


export const importJSON = (db: AppDB, imported: AppDB) => {
// 既存保持＋追加
const idMap = new Set(db.problems.map(p => p.id))
for (const p of imported.problems) {
if (idMap.has(p.id)) {
// 衝突回避: 新ID付与
const newId = uid('p_')
const copy = { ...p, id: newId }
db.problems.push(copy)
} else {
db.problems.push(p)
}
}
for (const r of imported.reviewLogs) {
db.reviewLogs.push(r)
}
// 設定は上書きしない方針（必要に応じてマージ）
saveDB(db)
}