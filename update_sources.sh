#! /bin/bash

SOURCES="$(find "$HOME/Documents/Work" -type d -name node_modules -prune -o -name 'zenhub_reports' -print | head -n 1)"
pushd "$SOURCES"
./zip_all.sh
popd
rm -f ./src/zenhub_reports.zip || true
rm -r ./src/zenhub_reports || true
cp "$SOURCES/../zenhub_reports.zip" ./src

pushd src
unzip -nu zenhub_reports.zip
rm -f zenhub_reports.zip
popd

npm ci