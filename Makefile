.PHONY: up down api web test lint migrate tidy

export GOTOOLCHAIN := local

DATABASE_URL ?= postgres://wantbrief:wantbrief@127.0.0.1:5432/wantbrief?sslmode=disable
HTTP_ADDR ?= :8080
CORS_ORIGIN ?= http://127.0.0.1:5173
BOOTSTRAP_PASSWORD ?= wantbrief
TOKEN_KEY ?= 00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff

up:
	docker compose up -d
	@until docker compose exec -T postgres pg_isready -U wantbrief -d wantbrief >/dev/null 2>&1; do sleep 1; done

down:
	docker compose down

tidy:
	go mod tidy

migrate: up
	go run ./cmd/api -migrate-only

api: up
	DATABASE_URL="$(DATABASE_URL)" HTTP_ADDR="$(HTTP_ADDR)" CORS_ORIGIN="$(CORS_ORIGIN)" \
		BOOTSTRAP_PASSWORD="$(BOOTSTRAP_PASSWORD)" TOKEN_KEY="$(TOKEN_KEY)" \
		go run ./cmd/api

web:
	cd web && bun run dev

test:
	go test ./...
	cd web && bun run typecheck

lint:
	gofmt -w $$(find . -name '*.go' -not -path './web/*')
	go vet ./...
	cd web && bun run typecheck

typecheck:
	cd web && bun run typecheck
