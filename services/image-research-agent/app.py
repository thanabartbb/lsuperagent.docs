"""Private Python CLI for the managed Agents API; no public HTTP listener."""
import argparse
import asyncio
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
import uuid

import httpx
from dotenv import load_dotenv
from jsonschema import validate, ValidationError
from openai import AsyncOpenAI, APIError, APIStatusError

ROOT = Path(__file__).resolve().parent
PROJECT = "proj_Kbc70ouR70glbq4U3fvrhBTp"


def schema(properties):
    return {"type": "object", "properties": properties,
            "required": list(properties), "additionalProperties": False}


STRING = {"type": "string", "minLength": 1, "maxLength": 12000}
STRINGS = {"type": "array", "items": STRING, "maxItems": 30}
OUTPUT_SCHEMA = schema({
    "reasoning": {"type": "string"},
    "result": schema({
        "status": {"type": "string", "enum": ["completed", "partial", "blocked"]},
        "summary": {"type": "string"},
        "images": {"type": "array", "items": schema({"path": {"type": "string"}, "description": {"type": "string"}})},
        "sources": {"type": "array", "items": schema({"title": {"type": "string"}, "url": {"type": "string"}})},
        "artifacts": {"type": "array", "items": schema({"path": {"type": "string"}, "status": {"type": "string"}})},
        "limitations": {"type": "array", "items": {"type": "string"}},
    }),
})
FUNCTIONS = {
    "generate_image": ("Generate one real image and save it as a local PNG artifact.",
                       schema({"prompt": STRING})),
    "get_agents_sdk_info": ("Retrieve official Agents documentation relevant to a topic.",
                            schema({"topic": STRING})),
    "generate_ai_agents_website": (
        "Generate website source files for review. Does not execute, deploy, or configure integrations.",
        schema({"site_name": STRING, "primary_functions": STRINGS,
                "design_theme": STRING, "user_roles": STRINGS,
                "integration_services": STRINGS})),
}


def definition():
    tools = [{"type": "function", "name": name, "description": desc,
              "parameters": params, "defer_loading": False}
             for name, (desc, params) in FUNCTIONS.items()]
    mcp = {"type": "mcp", "server_label": "openai_developers", "required": False,
           "transport": {"type": "http", "server_url": "https://developers.openai.com/mcp"}}
    credential = os.getenv("OPENAI_MCP_CREDENTIAL_ID")
    if credential:
        if not os.getenv("OPENAI_VAULT_ID"):
            raise ValueError("OPENAI_MCP_CREDENTIAL_ID requires OPENAI_VAULT_ID")
        mcp["credential_id"] = credential
    tools += [mcp, {"type": "web_search", "mode": "live", "context_size": "medium"}]
    return {"name": "Image and Research Orchestrator",
            "model": os.getenv("OPENAI_MODEL", "gpt-6-astra"),
            "instructions": (ROOT / "system-prompt.md").read_text(),
            "tools": tools, "multi_agent": {"enabled": True, "max_concurrent_subagents": 5},
            "reasoning": {"effort": "medium", "summary": "auto"},
            "text": {"format": {"type": "json_schema", "name": "orchestrator_result",
                                "strict": True, "schema": OUTPUT_SCHEMA}, "verbosity": "medium"}}


def emit(kind, **fields):
    print(json.dumps({"type": kind, **fields}, ensure_ascii=False), flush=True)


class Store:
    """One local owner/process per state directory; never put this in static assets."""
    def __init__(self, directory):
        self.root = Path(directory)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    def read(self, name):
        path = self.root / name
        return json.loads(path.read_text()) if path.exists() else None

    def write(self, name, value):
        path = self.root / name
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(value, ensure_ascii=False))
        tmp.chmod(0o600)
        tmp.replace(path)


class Executor:
    def __init__(self, client, store, artifacts):
        self.client, self.store = client, store
        self.artifacts = Path(artifacts).resolve()
        self.artifacts.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.calls = 0

    async def invoke(self, name, args, key):
        if name not in FUNCTIONS:
            raise ValueError("Unknown function")
        validate(args, FUNCTIONS[name][1])
        self.calls += 1
        if self.calls > 12:
            raise ValueError("Function budget exceeded (12 calls per invocation)")
        destination = self.artifacts / key
        destination.mkdir(exist_ok=True, mode=0o700)
        if name == "generate_image":
            result = await self.client.images.generate(
                model=os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1"),
                prompt=args["prompt"], size="1024x1024", n=1,
                extra_headers={"Idempotency-Key": key})
            if not result.data or not result.data[0].b64_json:
                raise ValueError("Image API returned no PNG data")
            path = destination / "image.png"
            path.write_bytes(base64.b64decode(result.data[0].b64_json, validate=True))
            return {"path": str(path), "mime_type": "image/png", "public_url": None}
        if name == "get_agents_sdk_info":
            url = "https://developers.openai.com/api/docs/guides/agents/overview.md"
            async with httpx.AsyncClient(timeout=30, follow_redirects=False) as http:
                response = await http.get(url)
                response.raise_for_status()
            return {"topic": args["topic"], "source": url,
                    "content": response.text[:40000], "truncated": len(response.text) > 40000}
        file_schema = schema({"files": {"type": "array", "items": schema({
            "path": {"type": "string"}, "content": {"type": "string"}})}})
        result = await self.client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-6-astra"),
            instructions="Generate a small runnable Python backend website source project. "
            "Provider keys stay in environment variables on the backend. Include README and "
            "requirements. Clearly label unconfigured integrations and roles. Never claim "
            "deployment or test success. Return relative paths and source content only.",
            input=json.dumps(args),
            text={"format": {"type": "json_schema", "name": "website_files",
                             "strict": True, "schema": file_schema}},
            extra_headers={"Idempotency-Key": key})
        bundle = json.loads(result.output_text)
        validate(bundle, file_schema)
        if not 1 <= len(bundle["files"]) <= 30:
            raise ValueError("Invalid generated file count")
        paths = []
        for item in bundle["files"]:
            relative = PurePosixPath(item["path"])
            if (relative.is_absolute() or not relative.parts or
                any(p in {"..", ".env", ".git"} for p in relative.parts) or
                "\\" in item["path"] or len(item["content"]) > 200000):
                raise ValueError("Unsafe generated file path or size")
            path = destination.joinpath(*relative.parts)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(item["content"])
            paths.append(str(path))
        return {"status": "generated_unverified", "files": paths,
                "executed": False, "deployed": False}

    async def handle(self, session_id, action):
        if action.get("type") != "function_call":
            raise RuntimeError("Unsupported required action: " + action.get("type", "unknown"))
        key = hashlib.sha256((session_id + action["turn_id"] + action["call_id"]).encode()).hexdigest()
        cached = self.store.read(key + ".json")
        if cached and cached.get("pending"):
            raise RuntimeError("A prior tool call was interrupted; inspect artifacts before retrying")
        if cached is None:
            self.store.write(key + ".json", {"pending": True})
            cached = {"type": "agent.session.input.tool_result",
                      "turn_id": action["turn_id"], "call_id": action["call_id"]}
            try:
                args = action["arguments"]
                if isinstance(args, str):
                    args = json.loads(args)
                output = await self.invoke(action["name"], args, key)
                cached.update(success=True, output=json.dumps(output, ensure_ascii=False))
            except (ValueError, ValidationError, APIError, httpx.HTTPError, OSError) as exc:
                # Provider exception text may contain request data; do not log it.
                cached.update(success=False, error="Tool failed: " + type(exc).__name__)
            self.store.write(key + ".json", cached)
        await self.client.beta.agents.sessions.events.create(
            session_id, events=[cached], idempotency_key=key)
        emit("tool.result", name=action["name"], success=cached["success"])


async def consume(stream, client, store, executor, session_id=None):
    async with stream:
        async for event in stream:
            data = event.to_dict()
            kind = data["type"]
            session = data.get("session") or {}
            session_id = session.get("id") or data.get("session_id") or session_id
            if session_id:
                store.write("session.json", {"id": session_id})
            # Stream metadata and user-visible text only, never raw reasoning/tool arguments.
            visible = {"session_id": session_id}
            if "output_text" in kind and isinstance(data.get("delta"), str):
                visible["delta"] = data["delta"]
            item = data.get("item") or {}
            if item.get("type") == "message" and item.get("role") == "assistant":
                visible["content"] = item.get("content", [])
            emit(kind, **visible)
            if kind == "agent.session.requires_action":
                if not session_id:
                    raise RuntimeError("Required action has no session ID")
                for action in session.get("required_actions", []):
                    await executor.handle(session_id, action)
            if kind in {"error", "agent.session.failed", "agent.session.environment.failed"}:
                raise RuntimeError("Agent lifecycle failure: " + kind)
            turn = data.get("turn") or {}
            if turn.get("subagent_id") is None:
                if kind in {"agent.session.turn.failed", "agent.session.turn.cancelled"}:
                    raise RuntimeError(kind)
                if kind == "agent.session.turn.completed":
                    if not session_id:
                        raise RuntimeError("Completed turn missing session ID")
                    return session_id
    raise RuntimeError("Stream disconnected before completion; use inspect, then resume")


async def run(args):
    load_dotenv(ROOT / ".env")
    config = definition()
    if args.command == "config":
        print(json.dumps(config, ensure_ascii=False, indent=2))
        return
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("OPENAI_API_KEY is missing; set it privately in the server environment")
    store = Store(args.state)
    async with AsyncOpenAI(project=os.getenv("OPENAI_PROJECT_ID", PROJECT),
                           timeout=360, max_retries=0) as client:
        if not hasattr(client.beta, "agents"):
            raise ValueError("Install the pinned official openai SDK with beta.agents")
        executor = Executor(client, store, args.artifacts)
        sessions = client.beta.agents.sessions
        saved = store.read("session.json") or {}
        sid = args.session or saved.get("id")
        if args.command in {"inspect", "cancel", "resume", "send"} and not sid:
            raise ValueError("No saved session; start one with new")
        if args.command == "inspect":
            session = await sessions.retrieve(sid)
            emit("session.status", session_id=sid, status=session.status,
                 required_actions=[a.type for a in session.required_actions or []])
            async for item in sessions.items.list(sid, order="asc", limit=100):
                data = item.to_dict()
                if data.get("type") == "message" and data.get("role") == "assistant":
                    emit("saved.output", content=data.get("content", []))
            return
        if args.command == "cancel":
            await sessions.events.create(sid, events=[{"type": "agent.session.input.cancel"}])
            emit("cancellation.accepted", session_id=sid)
            return
        if args.command == "new":
            digest = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
            agent = store.read("agent.json")
            if not agent or agent.get("hash") != digest:
                created = await client.beta.agents.create(**config)
                agent = {"id": created.id, "hash": digest}
                store.write("agent.json", agent)
            emit("agent.ready", agent_id=agent["id"])
            extra = {"vault_ids": [os.environ["OPENAI_VAULT_ID"]]} if os.getenv("OPENAI_VAULT_ID") else {}
            stream = await sessions.create(agent_id=agent["id"], environment={"type": "none"},
                                           input=args.message, stream=True, **extra)
        else:
            stream = await sessions.events.stream(sid)
            try:
                if args.command == "send":
                    submission = {"key": str(uuid.uuid4()), "session_id": sid, "message": args.message}
                    store.write("submission.json", submission)
                    await sessions.events.create(sid, idempotency_key=submission["key"], events=[{
                        "type": "agent.session.input.message", "input": [{"role": "user",
                        "content": [{"type": "input_text", "text": args.message}]}]}])
                else:
                    current = await sessions.retrieve(sid)
                    for action in current.required_actions or []:
                        await executor.handle(sid, action.to_dict())
            except BaseException:
                await stream.close()
                raise
        try:
            async with asyncio.timeout(900):
                sid = await consume(stream, client, store, executor, sid if args.command != "new" else None)
            emit("run.completed", session_id=sid)
        except TimeoutError:
            raise RuntimeError("Local 900s limit reached; inspect or cancel the saved session") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["config", "new", "send", "resume", "inspect", "cancel"])
    parser.add_argument("message", nargs="?", default="ค้นคว้า OpenAI Agents API จากเอกสารทางการ พร้อมแหล่งอ้างอิง")
    parser.add_argument("--session")
    parser.add_argument("--state", default=str(ROOT / ".state"))
    parser.add_argument("--artifacts", default=str(ROOT / "artifacts"))
    args = parser.parse_args()
    try:
        asyncio.run(run(args))
    except APIStatusError as exc:
        emit("error", code="openai_http_error", status=exc.status_code, request_id=exc.request_id)
        return 1
    except APIError as exc:
        emit("error", code=type(exc).__name__, message="Connection failed; inspect saved session before retrying")
        return 1
    except (ValueError, RuntimeError, OSError) as exc:
        emit("error", code=type(exc).__name__, message=str(exc))
        return 1
    except KeyboardInterrupt:
        emit("interrupted", message="Local stream stopped. Remote turn may continue; use cancel to stop it.")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
