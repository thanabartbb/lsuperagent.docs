# SDKSPACE Image and Research Orchestrator

Python 3.11+ private CLI using the official `openai` package, `AsyncOpenAI`, and
`client.beta.agents`. It creates a reusable agent, persists the returned ID, starts
a managed session with that ID, streams events, executes pending function calls,
and sends follow-up messages to the same session.

## Setup

```sh
cd services/image-research-agent
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Set `OPENAI_API_KEY` privately in the server environment or `.env`. Use a key with
access to project `proj_Kbc70ouR70glbq4U3fvrhBTp` and the requested models/Agents API.
Never paste a key into chat, browser code, git, or a shared terminal transcript.
The project ID selects a project; it is not authentication. The website domain
is not the OpenAI API base URL.

```sh
python app.py config
python app.py new 'ค้นคว้า OpenAI Agents API จากเอกสารทางการ พร้อมแหล่งอ้างอิง'
python app.py send 'สร้างภาพแนวอวกาศสำหรับบทความนี้'
python app.py inspect
python app.py cancel
python -m unittest -v test_app.py
```

`new` creates a conversation; `send` reuses the saved conversation. Use `--session`
for an explicit session, `--state` for separate conversations, and `--artifacts`
for an output directory. Run only one CLI process per state directory.

The selected environment is `none`: this workload needs service-side web search
and MCP plus the local Python function dispatcher, not shell access or a sandbox.
No sandbox runtime or executor connection is required. Keep the CLI process alive
while functions are pending. This is a private backend application, not a public
multi-user service or a Cloudflare Python deployment.

## Tools and configuration corrections

- `generate_image`: calls Images API and saves a real PNG locally. It does not
  invent a public image URL. Default image model: `gpt-image-1`, configurable.
- `get_agents_sdk_info`: replaces `Placeholder1` with `topic` and retrieves the
  official SDK overview. The agent can use developer MCP for more focused lookup.
- `generate_ai_agents_website`: generates source files with Responses API,
  validates paths, and writes review artifacts. Files are not executed or deployed;
  generated code and requested integrations still require review and testing.
- Web search is no longer restricted to the website's own domain.
- Developer MCP uses public access by default. The supplied credential was not
  assumed valid: if required, set its project-owned credential and matching vault
  in `OPENAI_MCP_CREDENTIAL_ID` and `OPENAI_VAULT_ID`.
- The model remains `gpt-6-astra`; multi-agent concurrency remains five.
- `system-prompt.md` asks for JSON with an operational `reasoning` summary and
  a `result`. Detailed private reasoning is neither requested nor logged.

## Failure handling

HTTP errors print status and request ID without provider error bodies. Missing
credentials fail before network access. Tool schema failures return failed tool
results. Completed tool results are cached by session/turn/call ID to avoid
re-executing duplicate events. An interrupted tool call is marked pending and
requires inspection rather than silently charging for another image.

The CLI stops only on a root turn's terminal event, not an idle event or a subagent
completion. If a stream disconnects, use `inspect` to read saved output/status.
Use `resume` only if the turn is still active or awaiting a function result.
If it completed, `inspect` is sufficient. `send` starts a new turn when idle.
Do not blindly repeat `new` after a network failure: a remote session may exist.
The local timeout is 900 seconds; interruption/timeout does not cancel remote work.
Use `cancel` explicitly. Submission keys are saved in `.state/submission.json`.

## Integration boundary

This directory is excluded by the repository's existing static asset allowlist.
No website routing, auth, D1 schema, quota, React packages, or hosting is changed.
Before public integration, host this backend in a long-running Python environment,
map authenticated users to their own sessions, add quotas and artifact access
control, and connect the existing Worker to it. Never expose arbitrary session IDs
or these local state directories to website visitors.

## Sources and verification

- https://developers.openai.com/api/docs/guides/agents-api/overview
- https://developers.openai.com/api/docs/guides/agents-api/configuration
- https://developers.openai.com/api/docs/guides/agents-api/sessions/events
- https://developers.openai.com/api/docs/guides/agents-api/tools/functions
- https://github.com/openai/openai-python

Offline tests use simulated API events; they do not establish account entitlement,
successful live image generation, or deployment. A live run requires the project's
API key and accessible runtime.
