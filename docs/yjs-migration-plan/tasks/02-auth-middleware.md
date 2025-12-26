# 3.2 認証ミドルウェアの実装

## メタ情報

| 項目       | 値                                           |
| ---------- | -------------------------------------------- |
| 優先度     | P2                                           |
| 見積もり   | 0.5 日                                       |
| 依存タスク | [01-y-websocket-server.md](./01-y-websocket-server.md) |
| ステータス | 未着手                                       |

## 概要

y-websocket サーバーへの WebSocket 接続時に JWT トークンを検証し、認証されたユーザーのみ接続を許可する。

## 作業内容

### 1. 認証ロジックの共有モジュール化

既存の `src/auth/auth.service.ts` から JWT 検証ロジックを切り出し、NestJS と y-websocket サーバーの両方から利用できるようにする。

`src/shared/jwt-verifier.ts`:

```typescript
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const client = jwksClient({
  jwksUri: process.env.JWKS_URI as string,
})

export async function verifyToken(token: string): Promise<jwt.JwtPayload | null> {
  try {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded) return null

    const key = await client.getSigningKey(decoded.header.kid)
    const signingKey = key.getPublicKey()

    return jwt.verify(token, signingKey) as jwt.JwtPayload
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}
```

### 2. y-websocket サーバーへの認証追加

`src/yjs-server/auth.ts`:

```typescript
import { IncomingMessage } from 'http'
import { verifyToken } from '../shared/jwt-verifier'

export async function authenticate(req: IncomingMessage): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token')

  if (!token) {
    return false
  }

  const payload = await verifyToken(token)
  return payload !== null
}
```

### 3. index.ts の更新

`src/yjs-server/index.ts`:

```typescript
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'
import { authenticate } from './auth'

const wss = new WebSocketServer({ port: Number(process.env.YJS_WS_PORT || 1234) })

wss.on('connection', async (conn, req) => {
  // 認証チェック
  const isAuthenticated = await authenticate(req)
  if (!isAuthenticated) {
    conn.close(4001, 'Unauthorized')
    return
  }

  const url = new URL(req.url || '', 'http://localhost')
  const roomId = url.pathname.slice(1) || 'default'

  setupWSConnection(conn, req, { docName: roomId })
})
```

## 完了条件

- [ ] トークンなしの接続が拒否される（4001 エラー）
- [ ] 無効なトークンでの接続が拒否される
- [ ] 有効なトークンでの接続が成功する
- [ ] 既存の NestJS AuthGuard が引き続き動作する

## 関連ファイル

- `src/shared/jwt-verifier.ts`（新規作成）
- `src/yjs-server/auth.ts`（新規作成）
- `src/yjs-server/index.ts`（更新）
- `src/auth/auth.service.ts`（リファクタリング - 共有ロジックを使用）

## 次のタスク

- [06-cleanup-old-code.md](./06-cleanup-old-code.md)（他タスクと並行で依存）

