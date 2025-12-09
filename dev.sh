#!/usr/bin/env bash
set -a           # automatically export all variables
source .env      # load GEMINI_API_KEY, QWEN_*, etc.
set +a

wrangler pages dev public --d1=DB=jokebot-db
