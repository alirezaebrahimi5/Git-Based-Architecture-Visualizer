# backend/Dockerfile

# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Final stage: use Alpine 3.18 and install Python dependencies
FROM alpine:3.18
WORKDIR /app

# Install Python3 and pip.
RUN apk add --no-cache python3 py3-pip

# Install required Python packages.
RUN pip3 install transformers torch

# Copy the compiled Go binary from the builder stage.
COPY --from=builder /app/server .

# Copy the generate_mermaid.py script into the container.
COPY generate_mermaid.py .

EXPOSE 8080
CMD ["./server"]
