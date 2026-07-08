import { AudioReactiveHero } from './components/AudioReactiveHero'
import { profile, socialLinks, streamingLinks } from './content/profile'
import './App.css'

function App() {
  return (
    <main>
      <AudioReactiveHero />

      <section className="section section-listen" id="listen" aria-labelledby="listen-title">
        <div className="section-kicker">Listen</div>
        <h2 id="listen-title">Deep, textural production for late rooms and strange light.</h2>
        <div className="link-grid" aria-label="Streaming links">
          {streamingLinks.map((link) => (
            <a href={link.href} key={link.label}>
              <span>{link.label}</span>
              <span aria-hidden="true">Open</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section section-about" id="about" aria-labelledby="about-title">
        <div className="section-kicker">About</div>
        <h2 id="about-title">{profile.displayName}</h2>
        <p>{profile.bio}</p>
      </section>

      <section className="section section-connect" id="connect" aria-labelledby="connect-title">
        <div>
          <div className="section-kicker">Connect</div>
          <h2 id="connect-title">Collaborations, production, remixes, and press.</h2>
        </div>
        <div className="connect-panel">
          <a className="email-link" href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
          <div className="social-row" aria-label="Social links">
            {socialLinks.map((link) => (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </div>
          <p>{profile.pressNote}</p>
        </div>
      </section>
    </main>
  )
}

export default App
