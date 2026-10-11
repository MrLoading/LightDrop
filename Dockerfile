# 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 拷贝依赖定义
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile || pnpm install

# 拷贝源代码
COPY . .

# 执行全量构建 (前端静态资源 + 后端 TypeScript)
RUN pnpm build

# 运行阶段
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# 拷贝构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# 暴露端口
EXPOSE 8080

# 挂载数据卷
VOLUME ["/app/data"]

CMD ["node", "dist/server/index.js"]
