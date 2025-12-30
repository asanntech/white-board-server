# タスク 004: 非推奨イベントの削除

## 概要

Yjs 導入により不要になった既存の Socket.io イベントハンドラを削除する。

## 作業内容

### 1. 削除対象イベントハンドラ

`src/white-board/white-board.gateway.ts` から以下のハンドラを削除：

| ハンドラ名         | イベント名   | 行数目安 |
| ------------------ | ------------ | -------- |
| `handleDrawing`    | `drawing`    | L45-L53  |
| `handleDrawingEnd` | `drawingEnd` | L55-L64  |
| `handleTransform`  | `transform`  | L66-L75  |
| `handleRemove`     | `remove`     | L77-L85  |
| `handleUndo`       | `undo`       | L87-L95  |
| `handleRedo`       | `redo`       | L97-L105 |

### 2. join イベントの修正

`handleJoin` 内の `roomData` 送信処理を削除：

```typescript
// 削除対象（L26-L39）
try {
  // 既存の描画データを取得してクライアントに送信
  const latestSnapshot = await this.s3Service.getLatestSnapshot(params.roomId)
  const existingDrawings = await this.dynamoDBService.getDrawingRecordsByRoom(params.roomId)
  const allDrawings = this.dynamoDBService.mergeDrawings(latestSnapshot, existingDrawings)
  if (allDrawings.length > 0) {
    const drawings = allDrawings.flatMap((drawing) =>
      !drawing.is_deleted ? [this.dynamoDBService.convertFromDynamoDB(drawing)] : []
    )
    client.emit('roomData', drawings)
  }
} catch (error) {
  console.error('Failed to load existing drawings:', error)
}
```

### 3. 削除後の join イベント

```typescript
@SubscribeMessage('join')
async handleJoin(client: Socket, params: { roomId: string }): Promise<void> {
  await client.join(params.roomId)
  // 他のクライアントに新しいユーザーの参加を通知
  client.to(params.roomId).emit('userEntered', client.id)
}
```

## 削除理由

これらのイベントは Yjs に置き換わり、フロントエンドで使用されなくなった：

- `drawing` → `yjs:update` に統合
- `drawingEnd` → `yjs:update` に統合
- `transform` → `yjs:update` に統合
- `remove` → `yjs:update` に統合
- `undo` → クライアント側で Yjs の UndoManager が処理
- `redo` → クライアント側で Yjs の UndoManager が処理
- `roomData` → `yjs:sync` に置き換え

## 完了条件

- [x] `drawing` イベントハンドラが削除されている
- [x] `drawingEnd` イベントハンドラが削除されている
- [x] `transform` イベントハンドラが削除されている
- [x] `remove` イベントハンドラが削除されている
- [x] `undo` イベントハンドラが削除されている
- [x] `redo` イベントハンドラが削除されている
- [x] `join` イベントから `roomData` 送信処理が削除されている
- [x] `pnpm build` が正常に完了する

## 関連ファイル

- `src/white-board/white-board.gateway.ts`

## 備考

- 削除前に新しい Yjs ハンドラ（タスク 002, 003）が実装済みであることを確認
- 削除後も DynamoDB/S3 サービスは `yjs:sync:request` で使用するため残す
- `UndoRedoResult` 型は使用されなくなるが、型定義ファイルからの削除は別途検討
