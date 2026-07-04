# Nemo Clawd sandbox image.
#
# This image is intentionally built from the current checkout instead of an
# external npm release so sandbox and Fly deployments ship the code under test.

FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 python3-pip python3-venv \
        curl git ca-certificates \
        iproute2 bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI tools via an explicit Agave release.
# Anza does not publish Linux arm64 CLI installers, so arm64 builds skip this
# optional toolchain instead of failing the image.
ARG SOLANA_VERSION=v3.1.9
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    if [ "${arch}" = "arm64" ]; then \
      echo 'WARN: Agave does not publish Linux arm64 CLI installers; skipping Solana CLI in this sandbox build'; \
    else \
      sh -c "$(curl -sSfL https://release.anza.xyz/${SOLANA_VERSION}/install)"; \
      SOLANA_BIN_DIR="/root/.local/share/solana/install/active_release/bin"; \
      ln -sf "${SOLANA_BIN_DIR}/solana" /usr/local/bin/solana; \
      ln -sf "${SOLANA_BIN_DIR}/solana-test-validator" /usr/local/bin/solana-test-validator; \
      ln -sf "${SOLANA_BIN_DIR}/solana-keygen" /usr/local/bin/solana-keygen; \
      if [ -x "${SOLANA_BIN_DIR}/spl-token" ]; then \
        ln -sf "${SOLANA_BIN_DIR}/spl-token" /usr/local/bin/spl-token; \
      else \
        echo 'WARN: spl-token is not bundled in this Agave release'; \
      fi; \
    fi

RUN pip3 install --break-system-packages pyyaml

WORKDIR /opt/nemoclawd

COPY package*.json tsconfig.json nemoclawd.plugin.json SKILL.md ./
COPY bin/ ./bin/
COPY dist/ ./dist/
COPY scripts/ ./scripts/
COPY spinners/ ./spinners/
COPY nemo-clawd-mcp/ ./nemo-clawd-mcp/
COPY nemo-clawd-python/ ./nemo-clawd-python/
COPY zk-primitives/ ./zk-primitives/

RUN npm install --omit=dev --no-audit --no-fund \
    && npm install --omit=dev --no-audit --no-fund --prefix nemo-clawd-mcp \
    && chmod +x bin/nemoclawd.js scripts/*.sh \
    && ln -sf /opt/nemoclawd/bin/nemoclawd.js /usr/local/bin/nemoclawd

RUN npm install -g helius-cli 2>/dev/null || echo 'WARN: helius-cli install skipped'

RUN groupadd -r sandbox && useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox \
    && mkdir -p /sandbox/.nemoclawd/agents/main/agent \
                /sandbox/.nemoclawd/workspace/skills \
                /sandbox/.nemoclawd/wallets \
                /sandbox/.nemoclawd/vault \
    && chmod 700 /sandbox/.nemoclawd /sandbox/.nemoclawd/wallets \
    && chown -R sandbox:sandbox /sandbox

COPY scripts/nemoclawd-start.sh /usr/local/bin/nemoclawd-start
COPY scripts/nemoclawd-solana-agent.sh /usr/local/bin/nemoclawd-solana-agent
COPY scripts/nemoclawd-payment-app.sh /usr/local/bin/nemoclawd-payment-app
COPY scripts/nemoclawd-telegram-bot.sh /usr/local/bin/nemoclawd-telegram-bot
COPY scripts/nemoclawd-swarm-bot.sh /usr/local/bin/nemoclawd-swarm-bot
COPY scripts/nemoclawd-websocket-server.sh /usr/local/bin/nemoclawd-websocket-server
COPY scripts/nemoclawd-solana-bridge.sh /usr/local/bin/nemoclawd-solana-bridge
COPY scripts/nemoclawd-solana-stack.sh /usr/local/bin/nemoclawd-solana-stack
RUN chmod +x /usr/local/bin/nemoclawd-*

USER sandbox
WORKDIR /sandbox

ENTRYPOINT ["/bin/bash"]
CMD []
