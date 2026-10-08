// Same-origin adapter for the existing agent-starter UI. Fail closed on build drift.
const VIEWPORT_STYLE = '<style id="sdkspace-chat-viewport">:root{color-scheme:dark}html,body{width:100%;height:100%;min-height:100%;margin:0!important;overflow:hidden}body{height:100dvh;min-height:100dvh}#root{display:flex;width:100%;height:100%;min-height:0;flex:1 1 auto;flex-direction:column}#root>*{width:100%!important;max-width:none!important;height:100%!important;min-height:0!important;flex:1 1 auto;margin:0!important;border-radius:0!important}</style>';

export function adaptAgentHtml(html) {
  if (!html.includes('id="root"') || !/src="\/assets\/[^" ]+\.js"/.test(html)) throw new Error('Unsupported Agent Starter HTML');
  let adapted = html.replaceAll('="/assets/', '="/agent-ui/assets/')
    .replace('<title>Agent Starter</title>', '<title>Agent Chat · SDKSPACE</title>')
    .replace('href="/favicon.ico"', 'href="/assets/sdkspace-logo.svg"')
    .replace('localStorage.getItem("theme") || "light"', 'localStorage.getItem("theme") || "dark"');
  if (adapted.includes('</head>')) return adapted.replace('</head>', VIEWPORT_STYLE + '</head>');
  return adapted.replace('<div id="root">', VIEWPORT_STYLE + '<div id="root">');
}
export function adaptAgentScript(script, instance) {
  const seam = 'agent:' + String.fromCharCode(96) + 'ChatAgent' + String.fromCharCode(96) + ',onOpen:';
  if (!/^u_[A-Za-z0-9_-]{24,}$/.test(instance) || script.split(seam).length !== 2) throw new Error('Unsupported Agent Starter build');
  return script.replace(seam, 'agent:' + String.fromCharCode(96) + 'ChatAgent' + String.fromCharCode(96) + ',name:' + JSON.stringify(instance) + ',host:location.host,onOpen:');
}
export function agentAssetPath(path) {
  return /^\/agent-ui\/assets\/[A-Za-z0-9_.-]+\.(?:js|css|woff2?|svg|png|jpe?g|webp)$/.test(path) ? path.replace('/agent-ui', '') : null;
}
