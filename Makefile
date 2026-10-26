.PHONY: install dev

#to have hooks on github
install:
	git config core.hooksPath .githooks
	cd backend && npm ci

dev:
	cd backend && npm run start:dev