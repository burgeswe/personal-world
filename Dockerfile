# TODO: pin by digest after the first build is validated

# --- frontend build stage --------------------------------------------
# Builds frontend/ when it exists in the build context; tolerates its
# absence (trees before the React frontend is tracked) so the core image
# always builds. Only the resulting dist/ reaches the runtime image.

# TODO: pin by digest
FROM node:22-alpine AS frontend
WORKDIR /src
COPY . /src/
RUN mkdir -p /out && if [ -f /src/frontend/package.json ]; then \
      cd /src/frontend && npm ci --no-audit --no-fund && npm run build && cp -r dist/. /out/; \
    else echo "frontend/ not present in build context; producing empty dist (react mode will report 503 honestly)"; fi

# --- runtime stage ----------------------------------------------------
# TODO: pin by digest after the first build is validated
FROM python:3.12-slim-bookworm

# git: source-control capability feeds the dashboard + chat context.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git jq curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev --extra test --extra crypto \
    && rm -rf ~/.cache

COPY src ./src
RUN uv pip install --no-cache-dir .

COPY --from=frontend /out /app/frontend/dist

ENV PW_DATA_DIR=/data \
    PW_CONFIG_DIR=/config \
    PW_FRONTEND_DIST=/app/frontend/dist

VOLUME /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys,os; \
        r=urllib.request.urlopen('http://127.0.0.1:8000/healthz',timeout=4); \
        sys.exit(0 if r.status==200 else 1)"

# Fail fast at runtime when auth is unconfigured: an empty PW_API_TOKEN
# must never serve (core already 503s protected routes; this makes the
# boot itself loud). Compose parses without the token; the container
# does not.
CMD ["sh", "-c", \
     "test -n \"$PW_API_TOKEN\" || { echo 'FATAL: PW_API_TOKEN is empty or unset; refusing to boot (auth is fail-closed).' >&2; exit 1; }; \
      exec uv run uvicorn personal_world.api:create_app --factory --host 0.0.0.0 --port 8000"]