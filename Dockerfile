FROM node:20-bookworm
RUN apt-get update && apt-get -y upgrade && apt-get install -y python3 pip g++ make default-jdk
#FROM node:18-alpine
#RUN apk update && apk add bash python3
#RUN apk add --update --no-cache \
#    make \
#    g++ \
#    jpeg-dev \
#    cairo-dev \
#    giflib-dev \
#    pango-dev \
#    libtool \
#    autoconf \
#    automake

WORKDIR /app

COPY . .

#RUN cp .github/linters/.*.yml /app/
#RUN cp .github/linters/* /app/

RUN npm ci
RUN npm run bundle
#RUN npx tsc

ARG ARG_API_KEY=abc
ENV API_KEY=$ARG_API_KEY

ARG ARG_GH_API_KEY=abc
ENV GH_API_KEY=$ARG_GH_API_KEY

#ENV NODE_EXTRA_CA_CERTS="/.certificates/ZscalerRootCertificate-2048-SHA256.crt"

CMD npm ci && npm run bundle
#CMD npm run main
#CMD java --version && npm list -g && echo "Typescript: $(npx tsc -v)"


# docker build --build-arg ARG_API_KEY="$API_KEY" --build-arg ARG_GH_API_KEY="$GH_API_KEY" -t zenhub_reports .
# docker run -t zenhub_reports
# docker run -v "$(pwd)/my_output:/app/output" -t zenhub_reports
# docker run -v "$(pwd)/my_output:/app/output" -v "~/.certificates:/.certificates" -t zenhub_reports

