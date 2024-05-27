#! /bin/bash

SOURCES="$(find "$HOME/Documents/Work" -type d -name node_modules -prune -o -name 'zenhub_reports' -print | head -n 1)"
pushd "$SOURCES" || exit
./zip_all.sh
popd || exit
rm -f ./src/zenhub_reports.zip || true
rm -r ./src/zenhub_reports || true
cp "$SOURCES/../zenhub_reports.zip" ./src

pushd src || exit
unzip -nu zenhub_reports.zip
rm -f zenhub_reports.zip
popd || exit

npm ci