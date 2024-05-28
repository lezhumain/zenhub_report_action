#! /bin/bash

rm -rf node_modules
rm -rf output/*
if [ -d my_output ]; then
  rm -r my_output
fi

#mv .idea/runConfigurations/main.xml /tmp/main.xml
#sed -E "s/(zh|ghp)_[^\"]+//g" /tmp/main.xml > .idea/runConfigurations/main.xml

#mv .idea/runConfigurations/reviewers.xml /tmp/reviewers.xml
#sed -E "s/(zh|ghp)_[^\"]+//g" /tmp/reviewers.xml > .idea/runConfigurations/reviewers.xml

#mv src/post_to_teams.js /tmp/post_to_teams.js
#sed -E "s|https://[^']+||g" /tmp/post_to_teams.js > ./src/post_to_teams.js

rm -f ../zenhub_reports.zip
mv dist /tmp/dist

#which 7z
#if [ "$?" == "0" ]; then
if which 7z; then
    7z a -tzip ../zenhub_reports.zip ../zenhub_reports
else
    zip -r ../zenhub_reports.zip ../zenhub_reports
fi

#mv /tmp/main.xml ./.idea/runConfigurations/main.xml
#mv /tmp/reviewers.xml ./.idea/runConfigurations/reviewers.xml
#mv /tmp/post_to_teams.js ./src/post_to_teams.js

mv /tmp/dist dist

npm ci
