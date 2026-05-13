FROM golang:1.22-bookworm AS build

WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seatalk-bot ./cmd/seatalk-bot

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates poppler-utils imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /out/seatalk-bot /app/seatalk-bot

ENV PORT=8080 \
    WORK_DIR=/tmp/seatalk-bot

EXPOSE 8080
ENTRYPOINT ["/app/seatalk-bot"]

