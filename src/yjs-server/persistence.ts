import * as Y from 'yjs'
import { DynamoDBService } from '../white-board/dynamodb.service'
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
