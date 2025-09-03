import App from '../App'
import { Link } from 'react-router-dom'
import { loadDB } from '../store'


export default function Home(){
const db = loadDB()
const total = db.problems.length
return (
<App>
<div className="grid">
<div className="card">
<h2>ようこそ！</h2>
{total===0 ? (
<p>まだ問題がありません。「問題を登録」から始めましょう。</p>
) : (
<p>登録済みの問題：<b>{total}</b>件</p>
)}
<div className="row">
<Link className="button" to="/session">復習する</Link>
<Link className="button" to="/register">問題を登録</Link>
<Link className="button secondary" to="/list">問題一覧</Link>
</div>
</div>
</div>
</App>
)
}