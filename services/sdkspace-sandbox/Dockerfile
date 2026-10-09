# Isolated executor; do not bake runtime keys or user workspaces into this image.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git python3 ripgrep \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g @openai/codex@alpha
RUN useradd --create-home --uid 10001 sandbox \
    && mkdir -p /workspace && chown sandbox:sandbox /workspace
WORKDIR /workspace
USER sandbox
# Cloudflare starts Codex with entrypoint arguments supplied by a signed webhook.
CMD ["sleep", "infinity"]
