# タスク 003: yjs:sync:request / yjs:sync イベントハンドラの実装

## 概要

クライアント接続時の初期同期を処理する。DB/S3 から Drawing[] を取得し、一時的に Y.Doc を構築してバイナリで返す。

## 作業内容

### 1. イベントハンドラの追加

`src/white-board/white-board.gateway.ts` に以下のハンドラを追加：

```typescript
import * as Y from 'yjs'

@SubscribeMessage('yjs:sync:request')
async handleYjsSyncRequest(
  client: Socket,
  params: { roomId: string }
): Promise<void> {
  try {
    // 1. DB/S3 から Drawing[] を取得（既存実装を流用）
    const latestSnapshot = await this.s3Service.getLatestSnapshot(params.roomId)
    const existingDrawings = await this.dynamoDBService.getDrawingRecordsByRoom(params.roomId)
    const allDrawings = this.dynamoDBService.mergeDrawings(latestSnapshot, existingDrawings)
    
    const drawings = allDrawings.flatMap((drawing) =>
      !drawing.is_deleted ? [this.dynamoDBService.convertFromDynamoDB(drawing)] : []
    )

    // 2. 一時的に Y.Doc を構築
    const yDoc = new Y.Doc()
    const yDrawings = yDoc.getMap<Drawing>('drawings')

    // 3. Drawing[] を Y.Map に投入
    yDoc.transact(() => {
      drawings.forEach((drawing) => {
        yDrawings.set(drawing.id, drawing)
      })
    })

    // 4. バイナリにエンコードして返す
    const state = Y.encodeStateAsUpdate(yDoc)
    client.emit('yjs:sync', { state: Array.from(state) })

    // 5. Y.Doc は破棄（メモリ解放）
    yDoc.destroy()
  } catch (error) {
    console.error('Failed to sync Yjs state:', error)
  }
}
```

## Socket.io イベント仕様

### クライアント → サーバー

| イベント名         | ペイロード           | 説明                   |
| ------------------ | -------------------- | ---------------------- |
| `yjs:sync:request` | `{ roomId: string }` | 初期状態同期リクエスト |

### サーバー → クライアント

| イベント名  | ペイロード            | 説明               |
| ----------- | --------------------- | ------------------ |
| `yjs:sync`  | `{ state: number[] }` | 初期状態同期レスポンス |

## 完了条件

- [ ] `yjs:sync:request` イベントハンドラが実装されている
- [ ] DB/S3 から既存の Drawing データを取得できる
- [ ] Drawing[] から Y.Doc を正しく構築できる
- [ ] バイナリエンコードした state を `yjs:sync` イベントで返せる
- [ ] Y.Doc が処理後に破棄される（メモリリーク防止）

## 関連ファイル

- `src/white-board/white-board.gateway.ts`
- `src/white-board/dynamodb.service.ts`
- `src/white-board/s3.service.ts`

## 備考

- サーバーは Y.Doc を常時保持しない（初期同期時のみ一時的に構築）
- `state` は `Uint8Array` を `number[]` に変換して送信
- 既存の DB/S3 データ構造（Drawing[]）は変更不要
- 既存の `join` イベントの `roomData` 送信ロジックを参考にできる

