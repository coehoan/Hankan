'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="message-page"><p className="eyebrow">HANKAN</p><h1>잠시 연결이 원활하지 않아요</h1><p>잠시 후 다시 시도해 주세요.</p><button className="primary-button" onClick={reset}>다시 시도하기 ↗</button></main>}
