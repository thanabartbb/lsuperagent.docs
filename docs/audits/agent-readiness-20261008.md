# SDKSPACE readiness audit — 2026-10-08

Source: owner-supplied Is Agentic report, score 6/100. A scanner snapshot is not a substitute for live HTTP evidence.

## Implemented and testable

Public raw HTML exceeds 500 characters, with one H1 and sequential H2 headings. Public pages negotiate HTML and Markdown with Vary: Accept. OpenAPI 3.1 describes the real v1 health, identity, text and image endpoints with unique operation IDs, descriptions, typed request/response fields, bearer authentication and examples. JSON errors include codes, messages where supplied by existing handlers, and resolution hints. The developer page links keys, quickstart, a public read-only health check and the existing authenticated Guide playground. JSON-LD, canonical/lang/Open Graph metadata, robots.txt, llms.txt and an XML sitemap identify real public resources. About/contact/privacy contain verifiable information without invented promises. Generation responses expose existing burst RateLimit headers and 429 Retry-After; OpenAPI documents these fields.

## External findings and owner decisions

- Crawler tests from Termux with GPTBot, ClaudeBot, ChatGPT-User, PerplexityBot, Google-Extended and Applebot-Extended returned HTTP 200 after the previous deployment. This does not prove reachability from the scanner's network or a verified crawler identity. Another Python HTTP client returned 403 without an HTML title or cf-mitigated header; its source cannot be established from that response alone. Review Cloudflare Security Events and Access logs for the scan time before changing a rule. No authenticated Cloudflare API credential was available in this session. Narrow a confirmed blocking rule to the public resource paths; preserve private route authentication. Do not allow arbitrary User-Agent claims as a security credential.
- Organization contactPoint currently identifies the public project support URL. Publishing an email/phone and PostalAddress requires accurate owner-approved public business contact information. Login credentials or a private location must not be reused as public contact data.
- Search ranking and resource discoverability depend on indexing, crawl access and external mentions. Page titles, links and llms.txt provide the on-site signals; top-ten rankings cannot be guaranteed by code.
- Prepared npm package `packages/sdkspace-cli` contains only its CLI, README and manifest. Local npm authentication returned 401, so registry publication remains pending. Confirm rights to @sdkbank, an appropriate license, and npm publishing authentication before release. Do not advertise it as registry-published until a successful publish and registry fetch.
- The site does not implement GraphQL or NLWeb. A WAF-generated 403 on a guessed route is not proof either API exists. Use the documented REST surface for schema and rate evidence.

## Validation

Worker syntax checks; behavioral tests for authentication, JSON hints, OpenAPI fields, negotiation, public content and CLI packaging; npm pack dry-run. After publication verify every public resource with HTTP status, content type and body parsing; verify unauthenticated private API responses remain JSON 401. A current external scan is required before claiming the report failures have cleared.
