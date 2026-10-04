import ThemeToggle from "./theme-toggle";
export default function SiteHeader(){return (<header className="topbar sdk-site-header">
<div className="wrap sdk-frame sdk-header-row">
<h1 className="page-title"><img src="/logo.svg" width="24" height="24" alt="" />{"SDKSPACE"}</h1>
<nav className="topnav" aria-label="Navigation">
<a className="hide-sm" href="#features">{"Features"}</a>
<a className="hide-sm" href="#start">{"Get started"}</a>
<a className="login" href="https://agents-sdk.space/docs">{"Docs"}</a>
<ThemeToggle />
</nav>
</div>
</header>);}
