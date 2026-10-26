.PHONY: install dev mobile

#to have hooks on github
install:
	git config core.hooksPath .githooks
	cd backend && npm ci
	cd mobile && flutter pub get

dev:
	cd backend && npm run start:dev

mobile:
	cd mobile && flutter run
