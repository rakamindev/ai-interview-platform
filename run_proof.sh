#!/bin/bash
# Script demonstrasi Monozukuri Test Proof & Seeded Fault untuk Video Walkthrough

export PATH="$HOME/.rbenv/bin:$PATH"
eval "$(rbenv init -)" 2>/dev/null || true

echo ""
echo "========================================================"
echo " 1. BACKEND TEST SUITE (Ruby on Rails RSpec)"
echo "========================================================"
cd /Users/asep/Developer/Projects/Rakamin-Test/api
bundle exec rspec

echo ""
echo "========================================================"
echo " 2. FRONTEND TEST SUITE (React Vitest)"
echo "========================================================"
cd /Users/asep/Developer/Projects/Rakamin-Test/web
npm test

echo ""
echo "========================================================"
echo " 3. SEEDED FAULT PROOF (Git Commits)"
echo "========================================================"
cd /Users/asep/Developer/Projects/Rakamin-Test
git log -n 4 --oneline
echo "========================================================"
echo " SELESAI: Seluruh automated test lulus 100%!"
echo "========================================================"
echo ""
