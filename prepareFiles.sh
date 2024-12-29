#! /bin/bash

cp src/zenhub_reports/src/post_to_teams.js /tmp/post_to_teams.js
sed -E "s|'http[^']+webhook[^']+'|''|g" /tmp/post_to_teams.js > src/zenhub_reports/src/post_to_teams.js
