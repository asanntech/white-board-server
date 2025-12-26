# 3.6 旧 Socket.IO コードの削除

## メタ情報

| 項目       | 値                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 優先度     | P4                                                                                                                                                             |
| 見積もり   | 0.25 日                                                                                                                                                        |
| 依存タスク | [02-auth-middleware.md](./02-auth-middleware.md), [03-json-persistence.md](./03-json-persistence.md), [04-initial-data-load.md](./04-initial-data-load.md), [05-y-redis.md](./05-y-redis.md) |
| ステータス | 未着手                                                                                                                                                         |

## 概要

y-websocket への移行完了後、不要になった Socket.IO 関連のコードとパッケージを削除する。

## 削除対象ファイル

| ファイル                                 | 理由                          |
| ---------------------------------------- | ----------------------------- |
| `src/white-board/white-board.gateway.ts` | Socket.IO ゲートウェイ        |
| `src/redis-io.adapter.ts`                | Socket.IO 用 Redis アダプター |

## 削除対象パッケージ

```bash
pnpm remove @nestjs/platform-socket.io @nestjs/websockets socket.io @socket.io/redis-adapter ioredis
```

また、devDependencies から以下も削除:

```bash
pnpm remove -D socket.io-client
```

## 残すファイル

| ファイル                              | 理由                       |
| ------------------------------------- | -------------------------- |
| `src/white-board/dynamodb.service.ts` | JSON 永続化で再利用        |
| `src/white-board/s3.service.ts`       | スナップショット機能を維持 |
| `src/white-board/drawing.types.ts`    | 型定義を維持               |
| `src/white-board/white-board.module.ts` | モジュール構成を維持（修正必要） |

## 作業内容

### 1. ファイルの削除

```bash
rm src/white-board/white-board.gateway.ts
rm src/redis-io.adapter.ts
```

### 2. white-board.module.ts の更新

`src/white-board/white-board.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { DynamoDBService } from './dynamodb.service'
import { S3Service } from './s3.service'

@Module({
  providers: [DynamoDBService, S3Service],
  exports: [DynamoDBService, S3Service],
})
export class WhiteBoardModule {}
```

### 3. app.module.ts の確認

Socket.IO 関連のインポートが残っていないか確認し、必要に応じて削除。

### 4. main.ts の更新

Redis アダプターの設定を削除:

```typescript
// 削除対象の行
// import { RedisIoAdapter } from './redis-io.adapter'
// const redisIoAdapter = new RedisIoAdapter(app)
// redisIoAdapter.connectToRedis(process.env.REDIS_URL)
// app.useWebSocketAdapter(redisIoAdapter)
```

### 5. パッケージの削除

```bash
pnpm remove @nestjs/platform-socket.io @nestjs/websockets socket.io @socket.io/redis-adapter ioredis
pnpm remove -D socket.io-client
```

### 6. テストファイルの更新

`test/ws-harness.ts` など、Socket.IO を使用しているテストファイルを更新または削除。

## 完了条件

- [ ] Socket.IO 関連ファイルが削除されている
- [ ] Socket.IO 関連パッケージがアンインストールされている
- [ ] NestJS アプリケーションが正常に起動する
- [ ] ビルドエラーがない
- [ ] 既存のテスト（更新後）がパスする

## 関連ファイル

- `src/white-board/white-board.gateway.ts`（削除）
- `src/redis-io.adapter.ts`（削除）
- `src/white-board/white-board.module.ts`（更新）
- `src/main.ts`（更新）
- `package.json`（パッケージ削除）

## 次のタスク

- [07-health-monitoring.md](./07-health-monitoring.md)

