#!/bin/sh
# Лаунчер для snap (classic): suid-песочница Chromium не работает внутри
# snap-монта, поэтому --no-sandbox (внешний confinement снапа сохраняется).
exec "$SNAP/opt/cozymusic/yandexmusic" --no-sandbox "$@"
