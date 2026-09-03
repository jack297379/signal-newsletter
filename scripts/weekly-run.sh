#!/bin/zsh
# Weekly unattended data pull for The Signal. Invoked by the launchd agent
# com.wol.signal.weekly-pull (Monday 07:00 local). Writes output/YYYY-MM-DD.md
# and appends a dated console log to logs/cron.log. The Mac must be awake
# (or scheduled to wake via pmset) for launchd to fire on time; if it was
# asleep, launchd runs the job at the next wake.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.." || exit 1
mkdir -p logs
{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') weekly pull start ====="
  npm start
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') exit $? ====="
} >> logs/cron.log 2>&1
