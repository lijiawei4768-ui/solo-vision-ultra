import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 我们彻底删掉了对 index.css 的引用，因为样式已经在 index.html 里通过 CDN 解决了
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
