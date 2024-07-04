FROM node:20-alpine

RUN apk update && apk upgrade
RUN apk add bash
RUN apk add dos2unix
RUN apk add openjdk17 python3 make g++

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run bundle

ARG ARG_API_KEY=abc
ENV API_KEY=$ARG_API_KEY

ARG ARG_GH_API_KEY=abc
ENV GH_API_KEY=$ARG_GH_API_KEY

CMD dos2unix /app/run_with_inputs.sh && bash /app/run_with_inputs.sh

# docker build -t zenhub_reports .
# docker build --build-arg ARG_API_KEY="$API_KEY" --build-arg ARG_GH_API_KEY="$GH_API_KEY" -t zenhub_reports .

# docker run --name zenhub_reports_container -t zenhub_reports
# docker run --env API_KEY --env GH_API_KEY --name zenhub_reports_container -t zenhub_reports

# docker run -v "$(pwd)/my_output:/app/output" -t zenhub_reports
# docker run -v "$(pwd)/my_output:/app/output" -v "~/.certificates:/.certificates" -t zenhub_reports
