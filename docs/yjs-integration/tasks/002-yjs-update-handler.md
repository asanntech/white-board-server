# タスク 002: yjs:update イベントハンドラの実装

## 概要

クライアントから受信した Yjs の差分更新データを、同一ルームの他クライアントにリレー（転送）する。

## 作業内容

### 1. イベントハンドラの追加

`src/white-board/white-board.gateway.ts` に以下のハンドラを追加：

```typescript
@SubscribeMessage('yjs:update')
handleYjsUpdate(
  client: Socket,
  params: { roomId: string; update: number[] }
): void {
  // 送信元以外の同一ルームクライアントに転送
  client.to(params.roomId).emit('yjs:update', { update: params.update })
}
```

## Socket.io イベント仕様

### クライアント → サーバー

| イベント名   | ペイロード                             | 説明                 |
| ------------ | -------------------------------------- | -------------------- |
| `yjs:update` | `{ roomId: string, update: number[] }` | Yjs の差分更新データ |

### サーバー → クライアント

| イベント名   | ペイロード             | 説明                         |
| ------------ | ---------------------- | ---------------------------- |
| `yjs:update` | `{ update: number[] }` | 他クライアントからの差分更新 |

## 完了条件

- [ ] `yjs:update` イベントハンドラが実装されている
- [ ] 受信した update データが同一ルームの他クライアントにブロードキャストされる
- [ ] 送信元クライアントには転送されない

## 関連ファイル

- `src/white-board/white-board.gateway.ts`

## 備考

- サーバーは Y.Doc を保持せず、単純なリレーのみ行う
- `update` は `Uint8Array` のバイナリデータを `number[]` に変換したもの
- Yjs が CRDT により競合解消を自動処理するため、サーバー側でのマージ処理は不要

