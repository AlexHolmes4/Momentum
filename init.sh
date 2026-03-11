#!/bin/bash
# init.sh — Startup verification for Momentum Coding Agent sessions
# Run at the start of every new Claude Code session on this project.

set -e

echo "=== Momentum — Agent Session Startup ==="
echo ""
echo "📁 Directory: $(pwd)"
echo "📦 Node: $(node -v 2>/dev/null || echo 'NOT FOUND') | npm: $(npm -v 2>/dev/null || echo 'NOT FOUND')"
echo "📦 dotnet: $(dotnet --version 2>/dev/null || echo 'NOT FOUND')"
echo ""

# Frontend checks
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

# API checks
if [ -d "api" ]; then
  echo ""
  echo "=== API Project ==="
  if dotnet --version &>/dev/null; then
    echo "✅ .NET SDK available"
    if [ ! -d "api/src/Momentum.Api/bin" ] || [ ! -d "api/src/Momentum.Api/obj" ]; then
      echo "⚠️  API not restored — running dotnet restore..."
      dotnet restore api/src/Momentum.Api
    else
      echo "✅ API packages restored"
    fi
  else
    echo "⚠️  .NET SDK not found — API features require .NET 10"
  fi
fi

echo ""
echo "=== Recent Commits (last 8) ==="
git log --oneline -8

echo ""
echo "=== Git Status ==="
git status --short

echo ""
echo "=== Progress Log ==="
cat claude-progress.txt 2>/dev/null || echo "(no progress log yet)"

echo ""
echo "=== Next Features ==="
# Show first few failing features to indicate what's next
if [ ! -f "claude-features.json" ]; then
  echo "(claude-features.json not found — run /project-harness to create it)"
else
node -e "
const f = require('./claude-features.json');
const failing = f.features.filter(x => x.status === 'failing').slice(0, 5);
if (failing.length === 0) {
  console.log('All features passing!');
} else {
  console.log('Next failing features:');
  failing.forEach(x => console.log('  ' + x.id + ' [' + x.area + '] ' + x.name));
  const total = f.features.length;
  const passing = f.features.filter(x => x.status === 'passing').length;
  console.log('  ... (' + passing + '/' + total + ' passing)');
}
"
fi

echo ""
echo "=== Agent Instructions ==="
echo "1. Find first 'failing' feature in claude-features.json"
echo "2. Implement it (one feature or batch per session)"
echo "3. Verify: frontend at http://localhost:11001 | API via 'dotnet test' in api/"
echo "4. Update claude-features.json status to 'passing'"
echo "5. Append summary to claude-progress.txt"
echo "6. Commit"
echo ""
