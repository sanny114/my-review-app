// src/cloud.ts
import { loadDB, saveDB } from './store'
import { paths, db, stamp } from './firebase'
import { doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore'
import type { AppDB, Problem, ReviewLog } from './types'

/** ローカル → クラウド（上書き保存） */
export const pushAllToCloud = async (uid: string) => {
  const dbLocal = loadDB()
  const { problems, reviewLogs } = paths(uid)

  console.log('=== クラウドアップロード開始 ===')
  console.log(`アップロード予定問題数: ${dbLocal.problems.length}`)
  console.log(`アップロード予定ログ数: ${dbLocal.reviewLogs.length}`)

  // データクリーンアップ：無効な問題を除去
  const validProblems = dbLocal.problems.filter(p => {
    const isValid = p.id && p.id.trim() !== '' && p.text && p.text.trim() !== '' && p.answer && p.answer.trim() !== ''
    if (!isValid) {
      console.warn('⚠️ 無効な問題をスキップ:', p)
    }
    return isValid
  })
  
  console.log(`有効な問題数: ${validProblems.length}/${dbLocal.problems.length}`)

  // 既存クラウドを一旦削除（安全のため本来は差分更新だが、MVPはシンプルに全入替）
  const oldP = await getDocs(problems); for (const d of oldP.docs) await deleteDoc(d.ref)
  const oldR = await getDocs(reviewLogs); for (const d of oldR.docs) await deleteDoc(d.ref)

  // 問題（有効なもののみ）
  for (const p of validProblems) {
    const ref = doc(problems, p.id)
    const data = { ...p, _updatedAt: stamp() }
    console.log(`問題アップロード: ${p.id} - "${p.text.substring(0, 30)}..."`, data)
    await setDoc(ref, data, { merge: true })
  }
  // ログ
  for (const r of dbLocal.reviewLogs) {
    const ref = doc(reviewLogs, r.id)
    const data = { ...r, _updatedAt: stamp() }
    await setDoc(ref, data, { merge: true })
  }
  
  console.log('✅ クラウドアップロード完了')
}

/** クラウド → ローカル（ローカル置き換え） */
export const pullAllFromCloud = async (uid: string) => {
  const dbLocal: AppDB = loadDB()
  const { problems, reviewLogs } = paths(uid)

  const psSnap = await getDocs(problems)
  const rsSnap = await getDocs(reviewLogs)

  const ps: Problem[] = psSnap.docs.map(d => {
    const { _updatedAt, ...rest } = d.data() as any
    return rest as Problem
  })
  const rs: ReviewLog[] = rsSnap.docs.map(d => {
    const { _updatedAt, ...rest } = d.data() as any
    return rest as ReviewLog
  })

  // 置き換え（ユーザー・設定はローカルを保持）
  dbLocal.problems = ps
  dbLocal.reviewLogs = rs
  saveDB(dbLocal)
}
