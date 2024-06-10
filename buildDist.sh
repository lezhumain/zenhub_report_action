#! /bin/bash

docker build --build-arg ARG_API_KEY="$API_KEY" --build-arg ARG_GH_API_KEY="$GH_API_KEY" -t zenhub_reports .

id=$(docker create zenhub_reports)
docker cp $id:/app/dist - > ./dist.tar
docker rm -v $id

tar xvf dist.tar