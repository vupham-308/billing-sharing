#!/bin/bash
# =======================================================
# Script deploy / restart Backend Billing Sharing trên VPS
# Thư mục: /home/ubuntu/app/billing-sharing
# Port: 6969
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

echo "3. Dừng và khởi động lại container Docker (Port 6969)..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

APP_PORT=6969
ENV_FILE_FLAG=""
if [ -f "$APP_DIR/.env" ]; then
  ENV_FILE_FLAG="--env-file $APP_DIR/.env"
  echo "-> Đã nạp file .env thành công."
  ENV_PORT=$(grep -E '^[[:space:]]*SERVER_PORT=' "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '\r"' | xargs || true)
  if [ -n "$ENV_PORT" ]; then
    APP_PORT="$ENV_PORT"
  fi
else
  echo "-> CẢNH BÁO: Chưa tìm thấy file $APP_DIR/.env. Hãy tạo file .env để cấu hình kết nối DB!"
fi

echo "-> Port được sử dụng: $APP_PORT"

# Chạy container với:
# - Giới hạn RAM tối đa 768m và CPU 0.5 core để tránh nghẽn VPS
# - --restart on-failure:1 chỉ thử lại đúng 1 lần duy nhất nếu lỗi
# - -XX:+UseSerialGC và -Xms128m -Xmx384m để tối ưu tuyệt đối cho VPS ít tài nguyên
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart on-failure:1 \
  --memory="768m" \
  --cpus="0.5" \
  --net=host \
  $ENV_FILE_FLAG \
  -v "$APP_DIR":/app \
  eclipse-temurin:17-jre \
  java -Xms128m -Xmx384m -XX:+UseSerialGC -jar /app/"$JAR_NAME" --server.port="$APP_PORT"

echo "4. Đang chờ ứng dụng khởi động và kiểm tra sức khỏe trên cổng $APP_PORT..."
READY=0
for i in {1..10}; do
  sleep 3
  STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
  if [ "$STATUS" != "running" ]; then
    echo "LỖI: Container bị dừng hoặc crash (Status: $STATUS). Log chi tiết:"
    docker logs --tail 40 "$CONTAINER_NAME"
    exit 1
  fi

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/api/v1/auth/me" || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "-> Backend phản hồi HTTP Status: $HTTP_CODE (Sẵn sàng sau $((i*3))s)"
    READY=1
    break
  fi
  echo "   Đang chờ Spring Boot khởi động ($((i*3))s)..."
done

docker ps --filter "name=$CONTAINER_NAME"

if [ $READY -eq 1 ]; then
  echo "Deploy Backend hoàn tất thành công!"
else
  echo "Cảnh báo: Backend mất nhiều thời gian hơn để phản hồi. Kiểm tra log bằng: docker logs -f $CONTAINER_NAME"
fi
