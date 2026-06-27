# Build the navigator monitor server (live Chrome view) from source.
FROM golang:1.22-bookworm AS monitor-build
WORKDIR /src
COPY monitor/ ./
RUN go mod tidy && CGO_ENABLED=0 go build -ldflags="-s -w" -o /monitor .

FROM akashyadav758/chrome:latest

USER root

# Copy Flow-extension into the container
COPY Flow-extension /opt/Flow-extension

# Live Chrome view monitor binary
COPY --from=monitor-build /monitor /opt/monitor3/monitor



# Install Chrome for Testing (unbranded)
ARG CFT_URL=https://storage.googleapis.com/chrome-for-testing-public/145.0.7632.117/linux64/chrome-linux64.zip
RUN apt-get update && apt-get install -y --no-install-recommends unzip && \
    curl -fsSL "$CFT_URL" -o /tmp/cft.zip && \
    unzip -q /tmp/cft.zip -d /opt && \
    rm -f /tmp/cft.zip && \
    apt-get purge -y unzip && apt-get autoremove -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set correct permissions and ownership
RUN chown -R 1000:1000 /opt/Flow-extension /opt/chrome-linux64 /opt/monitor3 && \
    chmod -R 755 /opt/Flow-extension /opt/chrome-linux64 /opt/monitor3

# Replace the start script with the non-root version
COPY --chmod=755 start.sh /start.sh

# Run as non-root user 1000
USER 1000

CMD ["/start.sh"]
