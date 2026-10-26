echo "Checking mobile format..."
ROOT="$(git rev-parse --show-toplevel)"
CHECK="dart format --output=none --set-exit-if-changed lib"

if command -v dart >/dev/null 2>&1; then
  (cd "$ROOT/mobile" && $CHECK)
elif command -v docker >/dev/null 2>&1; then
  docker run --rm -v "$ROOT/mobile":/app -w /app dart:stable $CHECK
else
  echo "Neither dart nor docker found, skipping mobile format check."
  true
fi || {
  echo "Incorrect format: run 'dart format lib' in mobile/ and commit again."
  exit 1
}