'use client';
import { useState } from 'react';
export default function Home() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!message.trim() || !token.trim() || pending) return;
    setPending(true); setAnswer('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token.trim()}` }, body: JSON.stringify({ message: message.trim() }) });
      const data = await response.json();
      setAnswer(response.ok ? (data.output || data.message || 'No answer returned') : (data.message || data.error || `HTTP ${response.status}`));
    } catch { setAnswer('Could not reach the SDKSPACE server route.'); }
    finally { setPending(false); }
  }
  return <main className="shell"><header><small>SDKSPACE / NEXT.JS</small><h1>Build with SDKSPACE.</h1><p>Real AI responses from the SDKSPACE API via a protected server route.</p></header><form onSubmit={submit}><label>Application access token<input value={token} type="password" autoComplete="off" onChange={event => setToken(event.target.value)} placeholder="Your APP_ACCESS_TOKEN" required /></label><label>Message<textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Ask SDKSPACE..." maxLength={12000} required /></label><button type="submit" disabled={pending}>{pending ? 'Sending...' : 'Send to SDKSPACE'}</button></form><section className="reply" aria-live="polite"><strong>Response</strong><p>{answer || 'Waiting for your first request.'}</p></section><footer>Server-only SDKSPACE_API_KEY · <a href="https://agents-sdk.space/developers">API documentation</a></footer></main>;
}
