import '../../styles/home.css';
import '../../styles/home-fullscreen.css';

export const metadata = {
  title: 'Home · SDKSPACE',
  description: 'SDKSPACE developer workspace for chat, image APIs, documentation, and SDK quickstarts.',
};

const Arrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
);

export default function HomePage() {
  return (
    <main className="sdk-home" data-sdkspace-page="home">
      <section className="home-phone" aria-label="SDKSPACE workspace home">
        <div className="home-top-strip" />
        <div className="home-dome" />

        <div className="home-content">
          <header className="home-header">
            <a className="home-logo" href="/loading" aria-label="SDKSPACE introduction">
              <img src="/logo.svg" alt="" width="22" height="22" />
              <span className="home-sdk">SDK</span><span className="home-space">SPACE</span>
            </a>

            <details className="home-menu">
              <summary aria-label="Open navigation"><span /><span /><span /></summary>
              <nav className="home-nav" aria-label="Main navigation">
                <a href="/home">Open Workspace</a>
                <a href="/chat">Open Chat</a>
                <a href="/docs">Docs</a>
                <a href="/guide">Step into the SDK</a>
                <a href="/keys">API keys</a>
                <a href="/tools">Tools</a>
                <a href="/news">AI News</a>
              </nav>
            </details>
          </header>

          <section className="home-hero">
            <h1 className="home-title">
              <span className="home-title-main">Build with</span>
              <span className="home-title-brand">SDKSPACE</span>
            </h1>
            <p className="home-lede">Chat, create images and connect your application through the SDK. Start with the guide, then test a real request.</p>

            <div className="home-cta">
              <a className="home-primary" href="/chat">Open Chat <Arrow /></a>
              <a className="home-play" href="/guide" aria-label="Open Playground">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>
              </a>
            </div>
          </section>

          <section className="home-glow">
            <div className="home-card" id="components">
              <div className="home-lib-row">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z" fill="none" stroke="#4da3ff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                <span className="home-lib-label">SDKSPACE LIBRARY</span>
              </div>
              <div className="home-lib-title">SDK &amp; API</div>
              <div className="home-lib-desc">Chat and image APIs for your application.</div>
              <a className="home-ghost" href="/docs/quickstart">Quickstart <Arrow /></a>

              <div className="home-illus" aria-hidden="true">
                <div className="home-win home-win-back">
                  <div className="home-dots"><i /><i /><i /></div>
                  <div className="home-glyph">&lt;/&gt;</div>
                </div>
                <div className="home-win home-win-main">
                  <div className="home-dots"><i /><i /><i /></div>
                  <div className="home-atom">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#6fb6ff" strokeWidth="1.3">
                      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
                      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
                      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
                      <circle cx="12" cy="12" r="1.8" fill="#8fc4ff" stroke="none" />
                    </svg>
                  </div>
                </div>
                <div className="home-dotgrid" />
              </div>
            </div>
          </section>

          <section className="home-grid" aria-label="SDKSPACE benefits">
            <article className="home-mini">
              <div className="home-mini-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>
              </div>
              <div className="home-mini-title">Build Faster</div>
              <div className="home-mini-desc">Start with a real API request, then build the workflow you need.</div>
            </article>

            <a className="home-mini" href="/docs">
              <div className="home-mini-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4c2 0 5 .5 6 2 1-1.5 4-2 6-2 1 0 2 .3 2 .3v14s-1-.3-2-.3c-2 0-5 .5-6 2-1-1.5-4-2-6-2-1 0-2 .3-2 .3v-14S3 4 4 4z" /></svg>
              </div>
              <div className="home-mini-title">Developer Guide</div>
              <div className="home-mini-desc">Clear documentation and examples to get you building with confidence.</div>
            </a>
          </section>

          <section className="home-package" aria-label="SDK packages">
            <p><a href="https://www.npmjs.com/package/npmjs.sdk-space">npmjs.sdk-space</a> · Explore the package and inspect its exports. Use <a href="/docs/installation">lsupergen-sdk</a> for this site&apos;s API client.</p>
            <pre><code>{`// npm install lsupergen-sdk
// Set LSUPERGEN_API_KEY with a key created at /keys
import { Lsupergen } from 'lsupergen-sdk';

const client = new Lsupergen({
  baseURL: 'https://agents-sdk.space/v1',
});
const me = await client.get('/me');
const reply = await client.post('/chat', { body: { message: 'Hello' } });`}</code></pre>
          </section>
        </div>
      </section>
    </main>
  );
}
