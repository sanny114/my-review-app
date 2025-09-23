export type User = { id: 'rin' | 'yui'; name: string }


export type RatingCode = 'wrong' | 'doubt' | 'correct'

// 問題作成用の型（IDは自動生成またはカスタム）
export type CreateProblemData = {
  id?: string // オプション: 指定されない場合は自動生成
  userId: User['id']
  subjectName: string
  subjectFixed: boolean
  text: string
  image?: string
  answer: string
  tags: string[]
  source?: string
  memo?: string
  archived?: boolean
}

export type Problem = {
id: string
userId: User['id']
subjectName: string // 漢字/算数/自由科目
subjectFixed: boolean
text: string
image?: string // 問題文に添付する画像のURL
answer: string
tags: string[]
source?: string
memo?: string
createdAt: string // ISO
updatedAt: string // ISO
archived?: boolean
}


export type ReviewLog = {
id: string
problemId: string
userId: User['id']
reviewedAt: string // ISO
rating: RatingCode
}


export type AppSettings = {
fixedSubjects: string[] // ["漢字","算数"]
defaultReviewOptions: {
repeatMistakes: boolean
repeatWithinSession: boolean
}
defaultSortOrder: 'newest' | 'wrongFirst' | 'tagThenNewest'
}


export type AppDB = {
version: string
users: User[]
problems: Problem[]
reviewLogs: ReviewLog[]
appSettings: AppSettings
}