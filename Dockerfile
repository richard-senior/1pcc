# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
COPY vendor/ vendor/
COPY cmd/ cmd/
COPY internal/ internal/
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=vendor -ldflags="-s -w" -trimpath -o 1pcc ./cmd/main.go

# Runtime stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /build/1pcc .
COPY static/ static/
COPY questions.json .
COPY config.json .
EXPOSE 7849
ENTRYPOINT ["./1pcc"]
