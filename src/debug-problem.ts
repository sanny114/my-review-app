// デバッグ用の問題登録機能
import { useRealtimeStore } from '../stores/RealtimeStore'

export const debugAddProblem = async () => {
  const realtimeStore = useRealtimeStore()
  
  console.log('🔍 認証状態チェック:', {
    user: realtimeStore.user?.email || 'not logged in',
    uid: realtimeStore.user?.uid || 'no uid'
  })
  
  if (!realtimeStore.user) {
    console.error('❌ ユーザーがログインしていません')
    return
  }
  
  try {
    console.log('🚀 テスト問題の追加開始...')
    
    await realtimeStore.addProblem({
      userId: 'rin',
      subjectName: '漢字',
      subjectFixed: true,
      text: 'テスト問題：漢字を読んでください「山」',
      answer: 'やま',
      tags: ['テスト'],
      archived: false
    })
    
    console.log('✅ テスト問題の追加成功!')
    alert('テスト問題の追加に成功しました！')
  } catch (error) {
    console.error('❌ テスト問題の追加失敗:', error)
    alert('エラー: ' + error.message)
  }
}
