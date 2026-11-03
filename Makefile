.PHONY: help install dev build start lint typecheck test format format-check check clean clean-all

# Default target
.DEFAULT_GOAL := help

help: ## แสดงรายการคำสั่งทั้งหมด
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## ติดตั้ง dependencies ทั้งหมด
	npm install

dev: ## รัน development server
	npm run dev

build: ## บิลด์โปรเจกต์สำหรับ production
	npm run build

start: ## รัน production server (หลัง build)
	npm run start

lint: ## ตรวจสอบโค้ดด้วย ESLint
	npm run lint

typecheck: ## ตรวจสอบ TypeScript types
	npm run typecheck

test: ## รัน unit tests
	npm run test

format: ## จัดรูปแบบโค้ดด้วย Prettier
	npx prettier --write .

format-check: ## ตรวจสอบรูปแบบโค้ดด้วย Prettier
	npx prettier --check .

check: lint typecheck test ## รัน lint, typecheck และ test พร้อมกัน

clean: ## ลบ cache และ build output (.next)
	rm -rf .next

clean-all: clean ## ลบ .next และ node_modules
	rm -rf node_modules

