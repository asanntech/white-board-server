# 3.7 ヘルスチェック・監視の追加

## メタ情報

| 項目       | 値                                           |
| ---------- | -------------------------------------------- |
| 優先度     | P5（最後）                                   |
| 見積もり   | 0.5 日                                       |
| 依存タスク | [06-cleanup-old-code.md](./06-cleanup-old-code.md) |
| ステータス | 未着手                                       |

## 概要

y-websocket サーバーの運用監視のため、ヘルスチェックエンドポイントとメトリクス収集機能を追加する。

## 作業内容

### 1. ヘルスチェックエンドポイントの追加

y-websocket サーバーに HTTP エンドポイントを追加:

`src/yjs-server/health.ts`:

```typescript
import http from 'http'

interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  uptime: number
  connections: number
  documents: number
  redis: 'connected' | 'disconnected'
}

export function createHealthServer(
  port: number,
  getMetrics: () => { connections: number; documents: number; redisConnected: boolean }
) {
  const startTime = Date.now()

  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const metrics = getMetrics()

      const status: HealthStatus = {
        status: metrics.redisConnected ? 'healthy' : 'unhealthy',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        connections: metrics.connections,
        documents: metrics.documents,
        redis: metrics.redisConnected ? 'connected' : 'disconnected',
      }

      res.writeHead(status.status === 'healthy' ? 200 : 503, {
        'Content-Type': 'application/json',
      })
      res.end(JSON.stringify(status))
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  server.listen(port, () => {
    console.log(`Health check server running on port ${port}`)
  })

  return server
}
```

### 2. メトリクス収集

`src/yjs-server/metrics.ts`:

```typescript
import { WebSocketServer } from 'ws'

export class MetricsCollector {
  private docs: Map<string, any>
  private wss: WebSocketServer
  private redisConnected: boolean = false

  constructor(docs: Map<string, any>, wss: WebSocketServer) {
    this.docs = docs
    this.wss = wss
  }

  setRedisStatus(connected: boolean) {
    this.redisConnected = connected
  }

  getMetrics() {
    return {
      connections: this.wss.clients.size,
      documents: this.docs.size,
      redisConnected: this.redisConnected,
    }
  }
}
```

### 3. index.ts への統合

```typescript
import { createHealthServer } from './health'
import { MetricsCollector } from './metrics'

async function main() {
  await initYRedis()

  const wss = new WebSocketServer({ port: Number(process.env.YJS_WS_PORT || 1234) })
  const docs = new Map<string, Y.Doc>()

  // メトリクスコレクター
  const metrics = new MetricsCollector(docs, wss)
  metrics.setRedisStatus(true) // Redis 接続成功時に設定

  // ヘルスチェックサーバー
  const healthPort = Number(process.env.YJS_HEALTH_PORT || 1235)
  createHealthServer(healthPort, () => metrics.getMetrics())

  // ... 既存のコード
}
```

### 4. 環境変数

| 変数名          | 説明                           | デフォルト |
| --------------- | ------------------------------ | ---------- |
| YJS_HEALTH_PORT | ヘルスチェックサーバーのポート | 1235       |

### 5. Docker / ECS 設定

`Dockerfile` にヘルスチェックを追加:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:1235/health || exit 1
```

ECS タスク定義のヘルスチェック:

```json
{
  "healthCheck": {
    "command": ["CMD-SHELL", "curl -f http://localhost:1235/health || exit 1"],
    "interval": 30,
    "timeout": 5,
    "retries": 3,
    "startPeriod": 60
  }
}
```

## ヘルスチェックレスポンス例

```json
{
  "status": "healthy",
  "uptime": 3600,
  "connections": 42,
  "documents": 15,
  "redis": "connected"
}
```

## 完了条件

- [ ] `/health` エンドポイントが正常なレスポンスを返す
- [ ] 接続数・ドキュメント数が正確に報告される
- [ ] Redis 接続状態が反映される
- [ ] ECS / ALB ヘルスチェックが機能する
- [ ] 異常時に 503 を返す

## 関連ファイル

- `src/yjs-server/health.ts`（新規作成）
- `src/yjs-server/metrics.ts`（新規作成）
- `src/yjs-server/index.ts`（更新）
- `Dockerfile`（更新）

## 完了

このタスクで Phase 3 のバックエンド移行が完了。

