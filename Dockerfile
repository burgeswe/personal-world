# TODO: pin by digest after the first build is validated
FROM python:3.12-slim-bookworm

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev --extra test \
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

CMD ["uv", "run", "uvicorn", "personal_world.api:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]