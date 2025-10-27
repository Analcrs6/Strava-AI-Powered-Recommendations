# Strava App (single service with recommender)

## Run
```bash
cp .env.example .env
docker compose up --build
```

App: http://localhost:8080
Health: GET /health/live
Recommend: POST /recommend {"activity_id":"<id>","k":10}

## Seed / Test
The recommender auto-builds from CSV on startup:
- synthetic_strava_data.csv is mounted into the container as /datasets/synthetic_strava_data.csv
- Index saved under /data/recsys volume.

