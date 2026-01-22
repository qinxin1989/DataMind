#!/bin/bash

BASE_URL="http://localhost:3000"
USERNAME="admin"
PASSWORD="admin123"

# 1. 登录获取token
echo "1. 登录系统..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

echo "登录响应: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.user.id')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "登录失败！"
  exit 1
fi

echo "登录成功: 用户ID=$USER_ID, Token=$TOKEN"

# 2. 创建测试数据源
echo -e "\n2. 创建测试数据源..."
TEST_DATASOURCE='{
  "name": "测试数据源",
  "type": "mysql",
  "config": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "ai-data-platform"
  },
  "visibility": "private",
  "approvalStatus": null
}'

UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/datasource" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$TEST_DATASOURCE")

echo "数据源上传响应: $UPLOAD_RESPONSE"

DATASOURCE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')

if [ -z "$DATASOURCE_ID" ] || [ "$DATASOURCE_ID" == "null" ]; then
  echo "数据源上传失败！"
  exit 1
fi

echo -e "\n✅ 测试通过！文件上传不再出现外键约束错误。"
echo "数据源ID: $DATASOURCE_ID"

# 3. 清理测试数据
echo -e "\n3. 清理测试数据..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/datasource/$DATASOURCE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "删除响应: $DELETE_RESPONSE"
echo "测试数据已清理！"