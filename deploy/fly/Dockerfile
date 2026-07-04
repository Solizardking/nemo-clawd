# Nemo Clawd Fly.io deployment image.
# Builds the current checkout, installs runtime dependencies, and runs the
# wrapper server that exposes /setup, /healthz, and the proxied gateway.

FROM node:22-slim AS build

WORKDIR /build

COPY package*.json tsconfig.json ./
COPY nemo-clawd-mcp/package*.json ./nemo-clawd-mcp/

RUN npm ci --no-audit --no-fund \
    && npm ci --no-audit --no-fund --prefix nemo-clawd-mcp

COPY src/ ./src/
COPY bin/ ./bin/
COPY spinners/ ./spinners/
COPY nemoclawd.plugin.json SKILL.md ./
COPY nemo-clawd-mcp/src/ ./nemo-clawd-mcp/src/
COPY nemo-clawd-mcp/tsconfig.json ./nemo-clawd-mcp/tsconfig.json

RUN npm run build

FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 python3-pip python3-venv \
        curl git ca-certificates \
        iproute2 bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI tools (x86_64 only; arm64 builds skip this optional step).
ARG SOLANA_VERSION=v3.1.9
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    if [ "${arch}" = "arm64" ]; then \
      echo 'WARN: Agave does not publish Linux arm64 CLI installers; skipping Solana CLI'; \
    else \
      sh -c "$(curl -sSfL https://release.anza.xyz/${SOLANA_VERSION}/install)"; \
      SOLANA_BIN_DIR="/root/.local/share/solana/install/active_release/bin"; \
      ln -sf "${SOLANA_BIN_DIR}/solana" /usr/local/bin/solana; \
      ln -sf "${SOLANA_BIN_DIR}/solana-test-validator" /usr/local/bin/solana-test-validator; \
      ln -sf "${SOLANA_BIN_DIR}/solana-keygen" /usr/local/bin/solana-keygen; \
      if [ -x "${SOLANA_BIN_DIR}/spl-token" ]; then \
        ln -sf "${SOLANA_BIN_DIR}/spl-token" /usr/local/bin/spl-token; \
      fi; \
    fi

RUN pip3 install --break-system-packages pyyaml
RUN npm install -g helius-cli 2>/dev/null || echo 'WARN: helius-cli install skipped'

WORKDIR /opt/nemoclawd

COPY package*.json tsconfig.json nemoclawd.plugin.json SKILL.md ./
COPY bin/ ./bin/
COPY scripts/ ./scripts/
COPY spinners/ ./spinners/
COPY nemo-clawd-python/ ./nemo-clawd-python/
COPY zk-primitives/ ./zk-primitives/
COPY nemo-clawd-mcp/package*.json nemo-clawd-mcp/README.md nemo-clawd-mcp/tsconfig.json ./nemo-clawd-mcp/
COPY --from=build /build/dist/ ./dist/
COPY --from=build /build/nemo-clawd-mcp/dist/ ./nemo-clawd-mcp/dist/

RUN npm install --omit=dev --no-audit --no-fund \
    && npm install --omit=dev --no-audit --no-fund --prefix nemo-clawd-mcp \
    && chmod +x bin/nemoclawd.js scripts/*.sh \
    && ln -sf /opt/nemoclawd/bin/nemoclawd.js /usr/local/bin/nemoclawd \
    && mkdir -p /opt/pump-fun

COPY scripts/nemoclawd-start.sh /usr/local/bin/nemoclawd-start
COPY scripts/nemoclawd-solana-agent.sh /usr/local/bin/nemoclawd-solana-agent
COPY scripts/nemoclawd-payment-app.sh /usr/local/bin/nemoclawd-payment-app
COPY scripts/nemoclawd-telegram-bot.sh /usr/local/bin/nemoclawd-telegram-bot
COPY scripts/nemoclawd-swarm-bot.sh /usr/local/bin/nemoclawd-swarm-bot
COPY scripts/nemoclawd-websocket-server.sh /usr/local/bin/nemoclawd-websocket-server
COPY scripts/nemoclawd-solana-bridge.sh /usr/local/bin/nemoclawd-solana-bridge
COPY scripts/nemoclawd-solana-stack.sh /usr/local/bin/nemoclawd-solana-stack
RUN chmod +x /usr/local/bin/nemoclawd-*

COPY deploy/fly/wrapper/package*.json /opt/wrapper/
WORKDIR /opt/wrapper
RUN npm install --omit=dev --no-audit --no-fund
COPY deploy/fly/wrapper/server.js /opt/wrapper/server.js

COPY deploy/fly/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /data

VOLUME /data

ENV DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000

WORKDIR /data
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
