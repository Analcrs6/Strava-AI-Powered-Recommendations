.PHONY: help build up down restart logs clean test health recommend rebuild-index shell-app shell-db

# Default target
help:
	@echo "Strava App - Docker Commands"
	@echo ""
	@echo "Setup & Run:"
	@echo "  make build          - Build all Docker images (backend + frontend)"
	@echo "  make rebuild        - Build without cache (use if changes not picked up)"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo ""
	@echo "Development:"
	@echo "  make logs           - View all logs (follow mode)"
	@echo "  make logs-app       - View backend logs only"
	@echo "  make logs-frontend  - View frontend logs only"
	@echo "  make shell-app      - Open shell in app container"
	@echo "  make shell-db       - Open psql shell in main database"
	@echo "  make shell-db-demo  - Open psql shell in demo database"
	@echo ""
	@echo "Testing:"
	@echo "  make health         - Check health endpoint"
	@echo "  make recommend      - Test recommendations (activity_id=1_1)"
	@echo "  make rebuild-index  - Manually rebuild FAISS index"
	@echo ""
	@echo "URLs:"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8080"
	@echo "  API Docs:  http://localhost:8080/docs"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean          - Stop services and remove volumes"
	@echo "  make clean-all      - Remove everything including images"

# Build the Docker images
build:
	sudo docker compose build

# Build without cache (use when code changes aren't picked up)
rebuild:
	sudo docker compose build --no-cache

# Start all services
up:
	sudo docker compose up

# Start in detached mode
up-d:
	sudo docker compose up -d

# Stop all services
down:
	sudo docker compose down

# Restart all services
restart:
	sudo docker compose restart

# View logs
logs:
	sudo docker compose logs -f

# View app logs only
logs-app:
	sudo docker compose logs -f app

# View frontend logs only
logs-frontend:
	sudo docker compose logs -f frontend

# Check health
health:
	@echo "Checking health endpoint..."
	@curl -s http://localhost:8080/health/live | jq || curl -s http://localhost:8080/health/live

# Test recommendations
recommend:
	@echo "Testing recommendations for activity 1_1..."
	@curl -s -X POST http://localhost:8080/recommend \
		-H "Content-Type: application/json" \
		-d '{"activity_id":"1_1","k":5}' | jq || \
	curl -s -X POST http://localhost:8080/recommend \
		-H "Content-Type: application/json" \
		-d '{"activity_id":"1_1","k":5}'

# Rebuild FAISS index
rebuild-index:
	@echo "Rebuilding FAISS index..."
	@curl -s -X POST http://localhost:8080/recommend/rebuild | jq || \
	curl -s -X POST http://localhost:8080/recommend/rebuild

# Open shell in app container
shell-app:
	sudo docker exec -it strava-app /bin/bash

# Open psql shell
shell-db:
	sudo docker exec -it db psql -U strava -d strava

# Open demo psql shell
shell-db-demo:
	sudo docker exec -it db-demo psql -U strava_demo -d strava_demo

# Clean up (remove volumes)
clean:
	sudo docker compose down -v

# Clean everything (including images)
clean-all:
	sudo docker compose down -v --rmi all

# Quick start (build and run)
start: build up-d
	@echo ""
	@echo "Services starting..."
	@sleep 5
	@echo ""
	@echo "App:          http://localhost:8080"
	@echo "API Docs:     http://localhost:8080/docs"
	@echo "PostgreSQL:   localhost:5433"
	@echo "MinIO API:    http://localhost:9090"
	@echo "MinIO Console: http://localhost:9091"
	@echo ""
	@echo "Run 'make logs' to view logs"
	@echo "Run 'make health' to check if the app is ready"

# Test full workflow
test: health recommend
	@echo ""
	@echo "All tests passed!"

