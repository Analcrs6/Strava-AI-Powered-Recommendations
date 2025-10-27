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
- Data is included in app/resources/synthetic_strava_data.csv
- Index saved under /data/recsys volume

## Quick Commands (using Makefile)
```bash
make help           # Show all available commands
make build          # Build Docker images
make up             # Start all services
make health         # Check if app is running
make recommend      # Test recommendations
make logs           # View logs
make down           # Stop services
```

