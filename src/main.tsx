import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { NotConfigured } from './pages/NotConfigured'
import { isSupabaseConfigured } from './lib/env'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(<StrictMode>{isSupabaseConfigured ? <App /> : <NotConfigured />}</StrictMode>)
