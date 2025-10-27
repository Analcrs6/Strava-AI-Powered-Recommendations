FROM python:3.11-slim

WORKDIR /code
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# sys deps
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# deps
COPY app/pyproject.toml /tmp/pyproject.toml
RUN pip install --no-cache-dir uv && \
    python -c "from pathlib import Path; import tomllib; p = tomllib.loads(Path('/tmp/pyproject.toml').read_text()); print('\n'.join(p['project']['dependencies']))" > /tmp/requirements.txt && \
    uv pip install --system -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt /tmp/pyproject.toml

# code
COPY app /code/app
RUN mkdir -p /data/recsys

EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]

