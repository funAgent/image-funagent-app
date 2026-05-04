# FunAgent Image

微信登录的 AI 图片生成工作台，主域名建议使用 `image.funagent.app`。

## MVP 功能

- 个人公众号可用的验证码登录：网页生成 `登录 123456`，用户发送到公众号，微信回调完成登录。
- 登录后才能使用图片生成。
- 默认每日 3 次免费额度，管理员可按用户覆盖每日次数、参考图数量、单张大小和状态。
- 支持文本生图、参考图改图，默认模型为 `gpt-image-2`。
- 生成结果保存到 Vercel Blob，历史记录保存在 Supabase Postgres。

## 本地开发

```bash
npm install
npm run db:generate
npm run db:deploy
npm run dev
```

本地 `.env` 可以参考 `.env.example`。调试登录需要：

```bash
ALLOW_DEV_LOGIN="true"
DEV_LOGIN_ROLE="USER"
```

如果需要本地管理员账号，可以临时把 `DEV_LOGIN_ROLE` 改成 `ADMIN`，但生产环境必须保持 `ALLOW_DEV_LOGIN="false"`。

## 生产环境变量

在 Vercel Project Settings 里配置：

```bash
DATABASE_URL="postgresql://APP_ROLE:PASSWORD@db.PROJECT_REF.supabase.co:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1&uselibpqcompat=true"
DIRECT_URL="postgresql://MIGRATION_ROLE:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&uselibpqcompat=true"
# SHADOW_DATABASE_URL=""
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
NEXT_PUBLIC_APP_URL="https://image.funagent.app"
OPENAI_API_KEY=""
OPENAI_BASE_URL=""
OPENAI_IMAGE_MODEL="gpt-image-2"
# 可选：OpenAI SDK 兼容网关，例如 api-xai.ainaibahub.com
XAI_API_KEY=""
XAI_BASE_URL="https://api-xai.ainaibahub.com/v1"
WECHAT_TOKEN="..."
WECHAT_APP_ID="..."
WECHAT_APP_SECRET="..."
ADMIN_OPENIDS="openid1,openid2"
DEFAULT_DAILY_LIMIT="3"
DEFAULT_MAX_REF_IMAGES="4"
DEFAULT_MAX_FILE_MB="10"
MAX_TOTAL_UPLOAD_MB="25"
BLOB_READ_WRITE_TOKEN="..."
ALLOW_DEV_LOGIN="false"
DEV_LOGIN_ROLE="USER"
```

不要把真实 OpenAI Key、数据库连接串、Blob Token 或微信 AppSecret 提交到仓库。

如果使用 OpenAI SDK 兼容网关：

- `OPENAI_BASE_URL` 或 `XAI_BASE_URL` 填网关地址，例如 `https://api-xai.ainaibahub.com/v1`。
- `XAI_API_KEY` 填网关平台 Key；设置后会优先于 `OPENAI_API_KEY` 使用。
- `OPENAI_IMAGE_MODEL` 继续使用网关支持的模型名，例如 `gpt-image-2`。

## Supabase 数据库

建议为应用创建两个数据库角色：

- `APP_ROLE`：应用运行时使用，拥有表级读写权限。
- `MIGRATION_ROLE`：Prisma 迁移使用，拥有迁移所需 DDL 权限。

部署到 Vercel 时，按 `.env.example` 配置你自己的 `DATABASE_URL` 和 `DIRECT_URL`。

- `DATABASE_URL`：给 Vercel 运行时使用，使用 Supabase Transaction Pooler，端口通常是 `6543`，并添加 `pgbouncer=true&connection_limit=1`。
- `DIRECT_URL`：给 Prisma 迁移使用，建议用 Session pooler 或 Direct connection，端口通常是 `5432`。
- 两个 URL 都要带 `sslmode=require&uselibpqcompat=true`，用于兼容 Node `pg`/Prisma adapter 的 TLS 处理。

如果 `invite-login` 在 Vercel 返回 `UPSTREAM_ERROR`，优先检查 `DATABASE_URL` 是否误用了 `5432` 直连，或是否缺少 `pgbouncer=true&connection_limit=1`。

首次部署后执行迁移：

```bash
npm run db:deploy
```

常用本地命令：

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:deploy
npm run db:status
```

## 微信公众号配置

公众号服务器地址：

```txt
https://image.funagent.app/api/wechat
```

Token 使用 `WECHAT_TOKEN` 的值。个人公众号优先使用消息验证码登录；如果后续升级为认证服务号，可以在现有 `User.wechatOpenId` 体系上补 OAuth。

## 域名与 Vercel

建议 DNS：

```txt
image.funagent.app  CNAME  cname.vercel-dns.com
img.funagent.app    CNAME  cname.vercel-dns.com
```

`image.funagent.app` 作为主站，`img.funagent.app` 可作为短域名跳转。
