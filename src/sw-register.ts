export const registerSW = () => {
　// dev中は登録しない（HMRや拡張のリクエストをSWが触ってエラーになるため）
  if (!import.meta.env.PROD) return
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // baseに合わせて正しいURLを作る
      const swUrl = new URL('sw.js', import.meta.env.BASE_URL).toString()
      navigator.serviceWorker.register(swUrl).catch(()=>{/* noop */})
    })
  }
}