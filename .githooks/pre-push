#!/bin/sh
cd backend || exit 1

echo "Checking format..."
npx prettier --check "src/**/*.ts" "test/**/*.ts" || {
  echo "Incorrect format : launch'npm run format' into backend/ before committing again."
  exit 1
}

echo "Lint..."
npm run lint || exit 1