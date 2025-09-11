import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './styles.css'
import { registerSW } from './sw-register'
import { RealtimeStoreProvider } from './stores/RealtimeStore'


registerSW()


ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
<RealtimeStoreProvider>
<RouterProvider router={router} />
</RealtimeStoreProvider>
</React.StrictMode>
)