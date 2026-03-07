#!/bin/bash
# init.sh — Startup verification for Momentum Coding Agent sessions
# Run at the start of every new Claude Code session on this project.

set -e

echo "=== Momentum — Agent Session Startup ==="
echo ""
echo "📁 Directory: $(pwd)"
echo "📦 Node: $(node -v 2>/dev/null || echo 'NOT FOUND') | npm: $(npm -v 2>/dev/null || echo 'NOT FOUND')"
echo ""

if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules missing — running npm install..."
  npm install
else
  echo "✅ node_modules present"
fi

if [ ! -f ".env.local" ]; then
  echo "❌ .env.local missing — copy .env.example and add Supabase credentials"
  exit 1
else
  echo "✅ .env.local present"
fi

echo ""
echo "=== Recent Commits (last 8) ==="
git log --oneline -8

echo ""
echo "=== Git Status ==="
git status --short

echo ""
echo "=== Progress Log ==="
cat claude-progress.txt

echo ""
echo "=== Agent Instructions ==="
echo "1. Find first 'failing' feature in claude-features.json"
echo "2. Implement it — one feature per session"
echo "3. Test at http://localhost:11001 (npm run dev)"
echo "4. Update claude-features.json status to 'passing'"
echo "5. Append summary to claude-progress.txt"
echo "6. Commit"
echo ""
