# Brand content engine — local dev shortcuts.
# Everything here runs locally: an Express API, a Vite/React console, a SQLite DB,
# and the Claude Code skills/agents. There is no remote deploy.
#
#   API     → http://localhost:5174   (Express, src/server)
#   console → http://localhost:3001   (Vite, proxies /api to the API)

SHELL := /bin/bash
.DEFAULT_GOAL := help

API_PORT := 5174
WEB_PORT := 3001

.PHONY: help install dev api console discover typecheck build db-migrate db-generate profile-check pillars stop

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install deps (root + console)
	npm install
	cd console && npm install

dev: ## Run API (:5174) + console (:3001) together; Ctrl-C stops both
	@echo "API → http://localhost:$(API_PORT)   console → http://localhost:$(WEB_PORT)"
	@trap 'kill 0' EXIT; \
		npm run server & \
		( cd console && npm run dev ) & \
		wait

api: ## Run the Express API only (:5174)
	npm run server

console: ## Run the Vite console only (:3001)
	cd console && npm run dev

discover: ## Refresh the idea queue (RSS engine)
	npx tsx src/ingest/discover-rss.ts

typecheck: ## Typecheck the API and the console
	npx tsc --noEmit
	cd console && npx tsc --noEmit

build: ## Build the console for production
	cd console && npm run build

db-migrate: ## Apply DB migrations
	npm run db:migrate

db-generate: ## Generate a new DB migration from schema changes
	npm run db:generate

profile-check: ## Report whether the active profile is complete
	npx tsx -e "import { checkCompleteness } from './src/profile/completeness'; const r = checkCompleteness(); console.log(JSON.stringify(r, null, 2)); process.exit(r.complete ? 0 : 1);"

pillars: ## Curl the live pillars endpoint (needs the API running)
	curl -s http://localhost:$(API_PORT)/api/pillars && echo

stop: ## Kill anything listening on the API/console ports
	@for p in $(API_PORT) $(WEB_PORT); do \
		pids=$$(lsof -ti tcp:$$p 2>/dev/null); \
		if [ -n "$$pids" ]; then kill $$pids && echo "stopped :$$p"; else echo ":$$p already free"; fi; \
	done
