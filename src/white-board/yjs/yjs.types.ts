import * as Y from 'yjs'

/**
 * ホワイトボード用 Yjs ドキュメント構造
 *
 * Y.Doc（メモリ上で管理）:
 *   drawings: Y.Map<string, Y.Map<string, any>>  // drawingId -> 描画プロパティ
 *   drawingOrder: Y.Array<string>                // Z-index（重なり順）管理
 *   deletedDrawings: Y.Map<string, boolean>      // 論理削除の追跡
 *   meta: Y.Map<string, any>                     // ルームメタデータ
 *
 * 永続化:
 *   - 更新発生時 → DynamoDBに保存（更新バイナリ）
 *   - 閾値超過時 → S3にスナップショット → DynamoDB物理削除
 */

// Y.Mapに保存される描画プロパティ
export interface YjsDrawingProperties {
  type: string
  points: number[]
  stroke: string
  strokeWidth: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  lineCap: string
  lineJoin: string
  opacity: number
}

// Y.Mapに保存されるルームメタデータ
export interface YjsRoomMeta {
  roomId: string
  createdAt: string
  lastModifiedAt: string
}

// 同期メッセージの種類
export enum YjsSyncMessageType {
  Sync = 0,
}

// WebSocketイベントのパラメータ
export interface YjsJoinParams {
  roomId: string
}

export interface YjsUpdateParams {
  roomId: string
  update: string // Base64エンコードされたUint8Array
}

// ルーム参加時に送信する初期同期データ
export interface YjsSyncInitPayload {
  roomId: string
  state: string // Base64エンコードされたドキュメント状態
}

// DynamoDBに保存するYjs更新レコード
// スナップショット後にまとめて物理削除される
export interface YjsUpdateRecord {
  room_id: string // パーティションキー
  created_at: string // ソートキー（ISO8601形式）
  update_data: Uint8Array // Y.encodeStateAsUpdate()の結果
}

// S3に保存するYjsスナップショット
export interface YjsSnapshotData {
  roomId: string
  timestamp: string
  fullState: string // Base64エンコード（Y.encodeStateAsUpdate全体）
}

// Y.Map操作用のヘルパー型
// Y.Mapのキーはstring固定、値の型のみ指定
export type YjsDrawingMap = Y.Map<Y.Map<unknown>>
export type YjsDrawingOrderArray = Y.Array<string>
export type YjsDeletedDrawingsMap = Y.Map<boolean>
export type YjsMetaMap = Y.Map<unknown>
