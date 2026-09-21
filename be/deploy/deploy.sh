#!/bin/bash
# =======================================================
# Script deploy / restart Backend Billing Sharing trên VPS
# Thư mục: /home/ubuntu/app/billing-sharing
# Port: 9000
# =======================================================

set -e

APP_DIR="/home/ubuntu/app/billing-sharing"
CONTAINER_NAME="billing-sharing-backend"
JAR_NAME="billing-sharing.jar"

echo "1. Di chuyển vào thư mục ứng dụng..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "2. Chuẩn hóa tên file JAR..."
LATEST_JAR=$(ls -t *.jar 2>/dev/null | grep -v "^${JAR_NAME}$" | head -1 || true)
if [ -n "$LATEST_JAR" ]; then
  mv -f "$LATEST_JAR" "$JAR_NAME"
fi

if [ ! -f "$JAR_NAME" ]; then
  echo "Lỗi: Không tìm thấy file $JAR_NAME tại $APP_DIR"
  exit 1
fi

chmod +x "$JAR_NAME"

echo "3. Dừng và khởi động lại container Docker (Port 9000)..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

ENV_FILE_FLAG=""
if [ -f "$APP_DIR/.env" ]; then
  ENV_FILE_FLAG="--env-file $APP_DIR/.env"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart always \
  --net=host \
  $ENV_FILE_FLAG \
  -v "$APP_DIR":/app \
  eclipse-temurin:17-jre \
  java -Xms512m -Xmx1536m -jar /app/"$JAR_NAME" --server.port=9000


sleep 6
docker ps --filter "name=$CONTAINER_NAME"

echo "4. Kiểm tra sức khỏe Backend (Port 9000)..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:9000/api/v1/auth/me || true
echo "Deploy Backend hoàn tất!"
