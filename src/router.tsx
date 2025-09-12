import { createHashRouter } from 'react-router-dom'
import Home from './components/Home'
import RegisterForm from './components/RegisterForm'
import Session from './components/Session'
import ListView from './components/ListView'
import Dashboard from './components/Dashboard'
import DataIO from './components/DataIO'
import Settings from './components/Settings'
import DataCleanup from './components/DataCleanup'
import FirestoreCleanup from './components/FirestoreCleanup'


export const router = createHashRouter([
{ path: '/', element: <Home/> },
{ path: '/register', element: <RegisterForm/> },
{ path: '/session', element: <Session/> },
{ path: '/list', element: <ListView/> },
{ path: '/dashboard', element: <Dashboard/> },
{ path: '/data', element: <DataIO/> },
{ path: '/settings', element: <Settings/> },
{ path: '/cleanup', element: <DataCleanup/> },
{ path: '/firestore-cleanup', element: <FirestoreCleanup/> }
])