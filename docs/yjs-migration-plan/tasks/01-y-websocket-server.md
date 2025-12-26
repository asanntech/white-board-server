# 3.1 y-websocket サーバーの構築

## メタ情報

| 項目       | 値                     |
| ---------- | ---------------------- |
| 優先度     | P1（最優先）           |
| 見積もり   | 0.5 日                 |
| 依存タスク | なし                   |
| ステータス | 未着手                 |

## 概要

y-websocket サーバーを NestJS とは別プロセスで起動し、Yjs ドキュメントの同期基盤を構築する。

## 作業内容

### 1. パッケージの導入

```bash
pnpm add yjs y-websocket ws
pnpm add -D @types/ws
```

### 2. ディレクトリ・ファイル構成

```
src/
├── yjs-server/
│   ├── index.ts          # エントリーポイント
│   ├── persistence.ts    # JSON 永続化ロジック（別タスク）
│   └── auth.ts           # 認証ミドルウェア（別タスク）
```

### 3. エントリーポイントの実装

`src/yjs-server/index.ts`:

```typescript
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'

const port = process.env.YJS_WS_PORT || 1234

const wss = new WebSocketServer({ port: Number(port) })

wss.on('connection', (conn, req) => {
  // roomId を URL パスから取得（例: /room123）
  const roomId = req.url?.slice(1) || 'default'
  
  setupWSConnection(conn, req, { docName: roomId })
})

console.log(`y-websocket server running on port ${port}`)
```

### 4. package.json に起動スクリプトを追加

```json
{
  "scripts": {
    "start:yjs": "ts-node src/yjs-server/index.ts",
    "start:yjs:prod": "node dist/yjs-server/index.js"
  }
}
```

### 5. 環境変数

| 変数名        | 説明                       | デフォルト |
| ------------- | -------------------------- | ---------- |
| YJS_WS_PORT   | y-websocket サーバーのポート | 1234       |

## 完了条件

- [ ] y-websocket サーバーが起動できる
- [ ] フロントエンドから WebSocket 接続が確立できる
- [ ] ルーム（roomId）ごとに Y.Doc が分離されている
- [ ] 複数クライアント間でリアルタイム同期が動作する

## 関連ファイル

- `src/yjs-server/index.ts`（新規作成）
- `package.json`（スクリプト追加）

## 次のタスク

このタスク完了後、以下のタスクが並行して開始可能：

- [02-auth-middleware.md](./02-auth-middleware.md)
- [03-json-persistence.md](./03-json-persistence.md)
- [05-y-redis.md](./05-y-redis.md)

