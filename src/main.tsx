/**
 * アプリの入口。HTML → main.tsx → App.tsx の順に読み込まれる。
 * CSSはここで一度読み込み、すべての画面へ適用する。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
// index.html の <div id="root"> をReactの管理対象にし、Appから画面を組み立てる。
// StrictModeは開発中に副作用などの問題を見つけやすくするための仕組み。
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
