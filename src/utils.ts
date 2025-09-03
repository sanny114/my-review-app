export const nowIso = () => new Date().toISOString()
export const uid = (p = '') => `${p}${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`


export const formatJST = (iso: string) => {
const d = new Date(iso)
const pad = (n: number) => String(n).padStart(2,'0')
const Y = d.getFullYear()
const M = pad(d.getMonth()+1)
const D = pad(d.getDate())
const h = pad(d.getHours())
const m = pad(d.getMinutes())
const s = pad(d.getSeconds())
return `${Y}-${M}-${D} ${h}:${m}:${s}`
}


export const escapeCsv = (v: string) => {
if (/[",\n]/.test(v)) return '"' + v.replace(/"/g,'""') + '"'
return v
}