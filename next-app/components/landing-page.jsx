import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";
import CodeWindow from "./code-window";
export default function LandingPage(){return <><SiteHeader /><main>
<section className="hero">
<div className="wrap sdk-frame">
<div className="logo-container"><img src="/logo.svg" width="72" height="72" alt="SDKSPACE logo" /></div>
<h2>{"React following"}<br /><em>{"deveguide by Next.js"}</em></h2>
<p className="en-text">{"Define your task. Build with reusable examples. Review the result."}</p>
<div className="buttons-wrapper">
<a className="btn btn-primary" href="https://agents-sdk.space/">{"Open Workspace"}</a>
<a className="btn btn-secondary" href="https://agents-sdk.space/chat">{"Open Chat"}</a>
</div>
<p className="install"><b>{"$"}</b>{" npm install lsupergen-sdk"}</p>
</div>
</section>
<section className="block" id="features" aria-labelledby="features-title">
<div className="wrap sdk-frame">
<div className="section-head">
<h2 id="features-title">{"Explore LSUPERAGENT"}</h2>
<p>{"Choose a task, provide context, and shape the output."}</p>
</div>
<div className="features">
<a className="feature" href="https://agents-sdk.space/chat?mode=chat">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"></path></svg></span>
<h3>{"AI Chat"}</h3>
<p>{"Start with a question and context. Refine the answer through follow-up prompts."}</p>
</a>
<a className="feature" href="https://agents-sdk.space/chat?mode=code">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"></path></svg></span>
<h3>{"Code"}</h3>
<p>{"Ask AI to write, review, and explain code in the chat."}</p>
</a>
<a className="feature" href="https://agents-sdk.space/chat?mode=image">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m21 16-5-5-9 9"></path></svg></span>
<h3>{"Images"}</h3>
<p>{"Create images with GPT Image and download the results."}</p>
</a>
<a className="feature" href="https://agents-sdk.space/chat?mode=research">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>
<h3>{"Research"}</h3>
<p>{"Research the web and follow the cited sources."}</p>
</a>
<a className="feature" href="https://agents-sdk.space/chat?mode=url">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></span>
<h3>{"Read a Link"}</h3>
<p>{"Share a page URL and ask follow-up questions about it."}</p>
</a>
<a className="feature" href="https://agents-sdk.space/chat?mode=write">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4"></path></svg></span>
<h3>{"Writing"}</h3>
<p>{"Draft and refine articles, posts, and messages."}</p>
</a>
<a className="feature wide highlight" href="https://agents-sdk.space/guide">
<span className="icon"><svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"></path></svg></span>
<span className="go" aria-hidden="true">{"↗"}</span>
<h3>{"lsupergen-sdk"}</h3>
<p>{"Use the npm package with this site's "}<code>{"/v1"}</code>{" API. Create a key and try the SDK in the playground."}</p>
</a>
<a className="feature wide-sm" href="https://www.npmjs.com/package/npmjs.sdk-space" rel="noopener noreferrer">
<span className="go" aria-hidden="true">{"↗"}</span>
<h3>{"npmjs.sdk-space"}</h3>
<p>{"Explore the package, inspect its exports, and adapt it to your project."}</p>
</a>
<a className="feature wide-sm" href="https://agents-sdk.space/docs">
<span className="go" aria-hidden="true">{"↗"}</span>
<span className="icon"><svg viewBox="0 0 24 24"><path d="M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6"></path></svg></span>
<h3>{"Docs"}</h3>
<p>{"SDK guides, API reference, and the LSUPERAGENT production architecture."}</p>
</a>
</div>
</div>
</section>
<section className="block" aria-labelledby="stack-title">
<div className="wrap sdk-frame">
<div className="section-head center">
<h2 id="stack-title">{"A workflow you can reuse"}</h2>
</div>
<div className="stack-core"><div className="chip">{"agents-sdk"}<span>{".space"}</span></div></div>
<div className="rail" aria-hidden="true"></div>
<div className="stack" style={{"marginTop": "0"}}>
<div className="feature">
<span className="icon"><svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9Z"></path></svg></span>
<h3>{"Define the input"}</h3>
<p>{"Describe the task, add relevant context, and choose the output format."}</p>
</div>
<div className="feature">
<span className="icon"><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8.5 8 9 4.6-.5 8-4 8-9V7z"></path><path d="m9 12 2 2 4-4"></path></svg></span>
<h3>{"Build in steps"}</h3>
<p>{"Use chat, examples, and the SDK guide to work through one task at a time."}</p>
</div>
<div className="feature">
<span className="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path></svg></span>
<h3>{"Review the result"}</h3>
<p>{"Check the output against your goal, then adapt it for the next task."}</p>
</div>
</div>
</div>
</section>
<section className="block" id="start" aria-labelledby="start-title">
<div className="wrap sdk-frame">
<div className="section-head">
<h2 id="start-title">{"Get Started"}</h2>
<p>{"From sign-in to your first API request."}</p>
</div>
<div className="steps">
<ol>
<li><div><strong>{"Sign in"}</strong>{"Open the AI workspace with your account."}</div></li>
<li><div><strong>{"Create an API key"}</strong>{"Connect your project from the "}<a href="https://agents-sdk.space/keys">{"API keys"}</a>{" page."}</div></li>
<li><div><strong>{"Install the SDK"}</strong>{"Call "}<code>{"/v1/chat"}</code>{" or "}<code>{"/v1/image"}</code>{" from your code."}</div></li>
</ol>
<CodeWindow title="quickstart.mjs" code={"// npm install lsupergen-sdk\n// Set LSUPERGEN_API_KEY with a key created at /keys\nimport { Lsupergen } from 'lsupergen-sdk';\n\nconst client = new Lsupergen({\n  baseURL: 'https://agents-sdk.space/v1',\n});\nconst me = await client.get('/me');\nconst reply = await client.post('/chat', { body: { message: 'Hello' } });"} />
</div>
</div>
</section>
<section className="block" aria-labelledby="news-community-title">
<div className="wrap sdk-frame">
<div className="section-head">
<h2 id="news-community-title">{"News & Community"}</h2>
<p>{"Updates from primary AI sources."}</p>
</div>
<div className="news-grid">
<a className="news-card" href="https://openai.com/news/" data-feed="openai">
<div className="news-source"><span>{"OpenAI"}</span><span className="news-arrow" aria-hidden="true">{"↗"}</span></div>
<div><h3>{"OpenAI updates"}</h3><p>{"Models, API, developer tools and platform updates."}</p></div>
</a>
<a className="news-card" href="https://www.anthropic.com/news" data-feed="anthropic">
<div className="news-source"><span>{"Anthropic"}</span><span className="news-arrow" aria-hidden="true">{"↗"}</span></div>
<div><h3>{"Anthropic updates"}</h3><p>{"Research, platform releases and developer announcements."}</p></div>
</a>
<a className="news-card" href="https://claude.com/blog" data-feed="claude">
<div className="news-source"><span>{"Claude"}</span><span className="news-arrow" aria-hidden="true">{"↗"}</span></div>
<div><h3>{"Claude releases"}</h3><p>{"Model, product and tooling changes across the Claude ecosystem."}</p></div>
</a>
<a className="news-card" href="https://x.ai/news" data-feed="grok">
<div className="news-source"><span>{"Grok"}</span><span className="news-arrow" aria-hidden="true">{"↗"}</span></div>
<div><h3>{"Grok updates"}</h3><p>{"Model releases, capabilities and developer platform news."}</p></div>
</a>
<a className="news-card" href="https://huggingface.co/blog" data-feed="ai">
<div className="news-source"><span>{"AI News"}</span><span className="news-arrow" aria-hidden="true">{"↗"}</span></div>
<div><h3>{"AI ecosystem"}</h3><p>{"Important releases and changes across the wider AI ecosystem."}</p></div>
</a>
<a className="news-card" href="https://github.com/thanabartbb/lsuperagent.docs" data-feed="community">
<div className="news-source"><span>{"Community"}</span><span className="news-arrow" aria-hidden="true">{"↗"}</span></div>
<div><h3>{"From the community"}</h3><p>{"Build logs, experiments, fixes and reusable workflows from builders."}</p></div>
</a>
</div>
</div>
</section>
<section className="block cta" aria-labelledby="cta-title">
<div className="wrap sdk-frame">
<h2 id="cta-title">{"Ready to build?"}</h2>
<p>{"Explore the docs or open the SDK playground."}</p>
<div className="buttons-wrapper">
<a className="btn btn-primary" href="https://agents-sdk.space/docs">{"Docs"}</a>
<a className="btn btn-secondary" href="https://agents-sdk.space/guide">{"Step into the SDK"}</a>
</div>
</div>
</section>
</main><SiteFooter /></>;}
