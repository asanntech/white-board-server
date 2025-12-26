# 3.4 初期データロード機能

## メタ情報

| 項目       | 値                                       |
| ---------- | ---------------------------------------- |
| 優先度     | P3                                       |
| 見積もり   | 0.5 日                                   |
| 依存タスク | [03-json-persistence.md](./03-json-persistence.md) |
| ステータス | 未着手                                   |

## 概要

ルーム初期化時に DynamoDB/S3 から既存の描画データを取得し、Y.Doc に復元する。これにより、既存データとの互換性を維持しつつ、新規接続クライアントに過去のデータを提供する。

## 作業内容

### 1. 初期データロード関数の実装

`src/yjs-server/persistence.ts` に追加:

```typescript
import { S3Service } from '../white-board/s3.service'

export async function loadInitialData(
  doc: Y.Doc,
  roomId: string,
  dynamoDBService: DynamoDBService,
  s3Service: S3Service
): Promise<void> {
  try {
    // S3 から最新スナップショットを取得
    const snapshotRecords = await s3Service.getLatestSnapshot(roomId)

    // DynamoDB から差分データを取得
    const dynamoRecords = await dynamoDBService.getDrawingRecordsByRoom(roomId)

    // マージ（DynamoDB のデータを優先）
    const mergedRecords = dynamoDBService.mergeDrawings(snapshotRecords, dynamoRecords)

    // Y.Doc に適用
    const yDrawings = doc.getMap<Drawing>('drawings')
    
    doc.transact(() => {
      mergedRecords.forEach((record) => {
        if (!record.is_deleted) {
          const drawing = dynamoDBService.convertFromDynamoDB(record)
          yDrawings.set(drawing.id, drawing)
        }
      })
    })

    console.log(`Loaded ${mergedRecords.length} drawings for room ${roomId}`)
  } catch (error) {
    console.error(`Failed to load initial data for room ${roomId}:`, error)
    // エラーが発生しても空のドキュメントで継続
  }
}
```

### 2. ドキュメント初期化フローの更新

`src/yjs-server/index.ts`:

```typescript
import { loadInitialData, setupPersistence } from './persistence'
import { createDynamoDBService } from '../white-board/dynamodb.service'
import { S3Service } from '../white-board/s3.service'

const dynamoDBService = createDynamoDBService()
const s3Service = new S3Service()
const docs = new Map<string, Y.Doc>()
const initializingDocs = new Map<string, Promise<Y.Doc>>()

async function getOrCreateDoc(roomId: string): Promise<Y.Doc> {
  // 既存のドキュメントがあれば返す
  const existingDoc = docs.get(roomId)
  if (existingDoc) {
    return existingDoc
  }

  // 初期化中のドキュメントがあれば待機
  const initializing = initializingDocs.get(roomId)
  if (initializing) {
    return initializing
  }

  // 新規ドキュメントを作成・初期化
  const initPromise = (async () => {
    const doc = new Y.Doc()

    // 既存データをロード
    await loadInitialData(doc, roomId, dynamoDBService, s3Service)

    // 永続化をセットアップ
    setupPersistence(doc, roomId, dynamoDBService)

    docs.set(roomId, doc)
    initializingDocs.delete(roomId)

    return doc
  })()

  initializingDocs.set(roomId, initPromise)
  return initPromise
}
```

### 3. 接続ハンドラの更新

```typescript
wss.on('connection', async (conn, req) => {
  // 認証チェック
  const isAuthenticated = await authenticate(req)
  if (!isAuthenticated) {
    conn.close(4001, 'Unauthorized')
    return
  }

  const url = new URL(req.url || '', 'http://localhost')
  const roomId = url.pathname.slice(1) || 'default'

  // ドキュメントを取得（初期データロード含む）
  const doc = await getOrCreateDoc(roomId)

  // y-websocket の接続をセットアップ
  setupWSConnection(conn, req, { doc, docName: roomId })
})
```

## 完了条件

- [ ] 新規ルーム接続時に既存データが Y.Doc に復元される
- [ ] S3 スナップショットと DynamoDB 差分が正しくマージされる
- [ ] 削除済み（is_deleted: true）のデータが除外される
- [ ] 複数クライアントの同時接続でもデータが一貫している
- [ ] データロード失敗時でもサーバーがクラッシュしない

## 関連ファイル

- `src/yjs-server/persistence.ts`（更新）
- `src/yjs-server/index.ts`（更新）

## 次のタスク

- [06-cleanup-old-code.md](./06-cleanup-old-code.md)

