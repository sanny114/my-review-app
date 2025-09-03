import App from '../App'
import { exportJSON, importJSON, loadDB } from '../store'
import { exportLatestStatusCSV, exportLogsCSV, exportProblemsCSV } from '../csv'


export default function DataIO(){
const db = loadDB()


const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0]; if (!file) return
const text = await file.text()
try {
const json = JSON.parse(text)
importJSON(db, json)
alert('取り込みました')
} catch (err){
alert('読み込めませんでした：' + (err as Error).message)
} finally {
e.currentTarget.value = ''
}
}


return (
<App>
<h2>データ入出力</h2>


<div className="card">
<h3>JSONエクスポート/インポート</h3>
<div className="row">
<button className="button" onClick={()=>exportJSON(db)}>JSONをエクスポート</button>
<label className="button secondary" style={{cursor:'pointer'}}>
JSONをインポート
<input type="file" accept="application/json" style={{display:'none'}} onChange={onImport} />
</label>
</div>
</div>


<div className="card">
<h3>CSVエクスポート</h3>
<div className="row">
<button className="button" onClick={()=>exportProblemsCSV(db,'both')}>Problems.csv</button>
<button className="button" onClick={()=>exportLogsCSV(db,'both')}>ReviewLogs.csv</button>
<button className="button" onClick={()=>exportLatestStatusCSV(db,'both')}>Problems_LatestStatus.csv</button>
</div>
<p className="muted">UTF-8(BOM付)でExcelでも文字化けしにくい形式です。</p>
</div>
</App>
)
}