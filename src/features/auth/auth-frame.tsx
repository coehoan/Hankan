import Link from 'next/link';

export function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M7 23C1 12 11 4 26 5c1 14-8 24-19 18Z" fill="currentColor" opacity=".22" />
        <path
          d="m7 25 16-17M11 21l-2-7m8 1 7 1"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      한칸
    </span>
  );
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="한칸 소개">
        <Link className="brand-link" href="/">
          <Brand />
        </Link>
        <div className="story-copy">
          <h1>
            재료는 신선하게,
            <br />
            냉장고는 가볍게.
          </h1>
          <p className="story-description">
            무엇이 남았는지, 무엇을 먼저 먹을지.
            <br />
            한칸에서 차근차근 정리해 보세요.
          </p>
          <div className="produce-art" aria-hidden="true">
            <span className="art-ring" />
            <svg viewBox="0 0 300 210" fill="none">
              <ellipse cx="150" cy="185" rx="101" ry="12" fill="currentColor" opacity=".07" />
              <path d="m105 169 11-54 31 4-12 55Z" fill="#f2ead3" />
              <path d="m114 116 32 5L166 34l-24-6Z" fill="#70a080" />
              <path d="m126 122 21 1 44-61-18-12Z" fill="#3e775b" />
              <path d="m114 124 18-3-7-82-21 3Z" fill="#a9c78c" />
              <path d="m115 173-9 14m17-13-1 15m11-15 7 14" stroke="#b8a27a" strokeWidth="2" />
              <path
                d="M233 127c5 29-8 43-31 43s-36-14-31-43c4-25 22-54 31-54s27 29 31 54Z"
                fill="#dfc194"
              />
              <path
                d="M206 76c13 17 25 43 27 51 5 29-8 43-31 43 17-15 24-53 4-94Z"
                fill="#bd9f78"
                opacity=".3"
              />
              <path d="m50 114 23-11 28 14-24 11Z" fill="#fff8e6" />
              <path d="m50 114 27 14v37l-27-15Z" fill="#e8d8b6" />
              <path d="m77 128 24-11v36l-24 12Z" fill="#f5e9ce" />
              <path d="m61 117 12-7m-17 18v13m30-6 10-4" stroke="#c7b693" strokeWidth="1.5" />
              <path d="M200 46c8-13 22-15 26-3 4 11-12 16-26 3Z" fill="#85ad77" />
              <path d="m199 48 18-5" stroke="#527e4b" strokeWidth="1.5" />
            </svg>
            <span className="art-caption">조금 덜 버리고, 조금 더 맛있게.</span>
          </div>
        </div>
        <p className="story-footer">내 냉장고의 작은 습관, 한칸</p>
      </section>
      <section className="auth-content">
        <div className="mobile-brand">
          <Link className="brand-link" href="/">
            <Brand />
          </Link>
        </div>
        {children}
        <p className="auth-footer">냉장고를 가볍게, 한 끼를 맛있게.</p>
      </section>
    </main>
  );
}
