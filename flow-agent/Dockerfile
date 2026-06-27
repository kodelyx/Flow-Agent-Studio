FROM python:3.11-slim

WORKDIR /app

# Install system deps (ffmpeg for video processing)
RUN apt-get update || apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create output directory
RUN mkdir -p output

EXPOSE 8001 9227 8100

CMD ["python", "-m", "cli.api", "--host", "0.0.0.0", "--port", "8001"]
