# TODO: pin by digest after the first build is validated
FROM python:3.12-slim-bookworm

# git: source-control capability feeds the dashboard + chat context.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev --extra test --extra crypto \
    && rm -rf ~/.cache

COPY src ./src
RUN uv pip install --no-cache-dir .

ENV PW_DATA_DIR=/data \
    PW_CONFIG_DIR=/config

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