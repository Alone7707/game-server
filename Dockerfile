# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制所有文件
COPY . .

# 安装依赖并构建
RUN npm install && npm run build

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# 从构建阶段复制产物
COPY --from=builder /app/.output /app/.output

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", ".output/server/index.mjs"]
