import { Link, useLocation } from 'react-router-dom'


export default function App({ children }: { children: React.ReactNode }){
const loc = useLocation()
return (
<>
<header>
<div style={{fontWeight:700}}>復習アプリ</div>
<nav className="row">
<Link to="/">ホーム</Link>
<Link to="/register">問題を登録</Link>
<Link to="/session">復習する</Link>
<Link to="/list">問題一覧</Link>
<Link to="/dashboard">ダッシュボード</Link>
<Link to="/data">データ入出力</Link>
<Link to="/settings">設定</Link>
<Link to="/debug" style={{color: '#dc3545'}}>🔧デバッグ</Link>
</nav>
</header>
<div className="container">
{children}
</div>
</>
)
}