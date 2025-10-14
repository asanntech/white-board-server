## セットアップ

```bash
$ pnpm install

$ pnpm prisma migrate dev
```

## アプリ起動

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## テスト実行

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## APIクライアントコードの生成

open-api.jsonを出力

```bash
$ pnpm generate-api
```

## マイグレーションの実行

```bash
# development
$ pnpm prisma migrate dev --name <変更名>

# production
$ pnpm prisma migrate deploy --name <変更名>
```

## ソフトウェアアーキテクチャ

### 全体像

NestJS を用いたモジュール指向のバックエンド。同期 API は REST、双方向通信は Socket.IO (WebSocket) を使用。RDB には Prisma、リアルタイム描画データは DynamoDB、バイナリ／スナップショットは S3 を利用します。スケールアウト時の Socket.IO 連携に Redis アダプタを用います。

```
Client (Web)
  ├─ REST (HTTP) ───────────────▶ NestJS Controllers
  │                                  ├─ Services (ドメインロジック)
  │                                  ├─ Prisma (RDB: Users/Rooms ...)
  │                                  └─ OpenAPI (Swagger)
  └─ Socket.IO (WS) ────────────▶ WhiteBoard Gateway
                                     ├─ Redis Adapter (Pub/Sub)
                                     ├─ DynamoDB (リアルタイム描画)
                                     └─ S3 (画像/スナップショット)
```

### バックエンド構成要素

- アプリはモジュール分割（`auth`, `room`, `user`, `white-board`）。HTTP は Controller、ロジックは Service、入出力は各 Service/Provider で実装。
- DTO で入力検証し、`@nestjs/swagger` でスキーマ自動化。

### データストレージ

- RDB: Prisma でユーザー/ルームを管理（マイグレーションは `prisma/migrations`）。
- DynamoDB: ホワイトボードのリアルタイムイベントを保存。
- S3: 画像/スナップショットを永続化。

### リアルタイム通信

- `white-board.gateway.ts` で Socket.IO イベントを定義。水平分散は Redis アダプタで同期。

### 認証/認可

- JWT/JWKS でトークン検証（`auth.guard.ts`, `auth.service.ts`）。

### API とスキーマ

- `pnpm generate-api` で `open-api.json` を生成し、CI で差分チェック。

### 設定と運用

- 環境変数で設定。CI は Lint/Build/OpenAPI 差分。ECR へのデプロイワークフローあり。

### 主要な処理フロー

- REST: Controller → DTO 検証 → Service → I/O → Response
- 描画: Client ↔ Gateway ↔ Redis ↔ DynamoDB/S3
