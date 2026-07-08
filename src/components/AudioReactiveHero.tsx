import { LayeredLogo } from './LayeredLogo'

export function AudioReactiveHero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <h1 id="hero-title" className="sr-only">
          MARLEAU
        </h1>
        <LayeredLogo />
        <nav className="social-links" aria-label="MARLEAU social links">
          <a
            aria-label="Instagram"
            className="social-link"
            href="https://www.instagram.com/foreyesmd/"
            rel="noreferrer"
            target="_blank"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <rect height="18" rx="5" width="18" x="3" y="3" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.2" />
            </svg>
          </a>
          <a
            aria-label="SoundCloud"
            className="social-link"
            href="https://soundcloud.com/marleau"
            rel="noreferrer"
            target="_blank"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 11.2v5.6M8 9.7v7.1M11 7.8v9M14 8.4v8.4" />
              <path d="M5 17h13.2a3.8 3.8 0 0 0 .2-7.6 5.7 5.7 0 0 0-10.6-2.2" />
            </svg>
          </a>
        </nav>
      </div>
    </section>
  )
}
