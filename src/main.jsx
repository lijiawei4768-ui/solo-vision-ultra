import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 如果 Vercel 还是报错找不到 index.css，就删掉下面这一行
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
