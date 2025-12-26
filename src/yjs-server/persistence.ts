import * as Y from 'yjs'
import { DynamoDBService } from '../white-board/dynamodb.service'
import { S3Service } from '../white-board/s3.service'
import { Drawing } from '../white-board/drawing.types'

// debounce 用のタイマー管理
const saveTimers = new Map<string, NodeJS.Timeout>()
const DEBOUNCE_MS = 1000

export function setupPersistence(doc: Y.Doc, roomId: string, dynamoDBService: DynamoDBService): void {
  const yDrawings = doc.getMap<Drawing>('drawings')

  yDrawings.observe(() => {
    // 既存のタイマーをクリア
    const existingTimer = saveTimers.get(roomId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // debounce して保存
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const drawings = Array.from(yDrawings.values())
          await dynamoDBService.saveDrawings(roomId, drawings)
          saveTimers.delete(roomId)
        } catch (error) {
          console.error(`Failed to save drawings for room ${roomId}:`, error)
        }
      })()
    }, DEBOUNCE_MS)

    saveTimers.set(roomId, timer)
  })
}

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
