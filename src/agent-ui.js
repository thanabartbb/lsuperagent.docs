// Same-origin adapter for the existing agent-starter UI. Fail closed on build drift.
export function adaptAgentHtml(html) {
  if (!html.includes('id="root"') || !/src="\/assets\/[^" ]+\.js"/.test(html)) throw new Error('Unsupported Agent Starter HTML');
  return html.replaceAll('="/assets/', '="/agent-ui/assets/')
    .replace('<title>Agent Starter</title>', '<title>Agent Chat · SDKSPACE</title>')
    .replace('href="/favicon.ico"', 'href="/assets/sdkspace-logo.svg"')
    .replace('localStorage.getItem("theme") || "light"', 'localStorage.getItem("theme") || "dark"');
}
export function adaptAgentScript(script, instance) {
  const seam = 'agent:`ChatAgent`,onOpen:';
  if (!/^u_[A-Za-z0-9_-]{24,}$/.test(instance) || script.split(seam).length !== 2) throw new Error('Unsupported Agent Starter build');
  return script.replace(seam, 'agent:`ChatAgent`,name:' + JSON.stringify(instance) + ',host:location.host,onOpen:');
}
export function agentAssetPath(path) {
  return /^\/agent-ui\/assets\/[A-Za-z0-9_.-]+\.(?:js|css|woff2?|svg|png|jpg|webp)$/.test(path) ? path.replace('/agent-ui', '') : null;
}
