export const registerSW = () => {
if ('serviceWorker' in navigator) {
window.addEventListener('load', () => {
navigator.serviceWorker.register('/my-review-app/sw.js').catch(()=>{/* noop */})
})
}
}