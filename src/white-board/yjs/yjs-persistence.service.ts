import { Injectable } from '@nestjs/common'
import * as Y from 'yjs'
import { YjsRoomManager } from './yjs-room.manager'
import { DynamoDBService } from '../dynamodb.service'
import { S3Service } from '../s3.service'

/**
 * Yjsドキュメントの永続化サービス
 *
 * 責務:
 *   - Yjs更新のDynamoDB保存
 *   - S3スナップショットの作成・復元
 *   - ルーム参加時のドキュメント復元
 */
@Injectable()
export class YjsPersistenceService {
  // スナップショット作成の閾値
  private readonly maxUpdatesBeforeSnapshot = 100
  private readonly maxUpdateSizeBeforeSnapshot = 1024 * 1024 // 1MB

  constructor(
    private readonly yjsRoomManager: YjsRoomManager,
    private readonly dynamoDBService: DynamoDBService,
    private readonly s3Service: S3Service
  ) {}

  /**
   * Yjs更新をDynamoDBに保存
   */
  async saveUpdate(roomId: string, update: Uint8Array): Promise<void> {
    await this.dynamoDBService.saveYjsUpdate(roomId, update)

    // スナップショット作成が必要か確認
    await this.checkAndCreateSnapshot(roomId)
  }

  /**
   * ルームのY.Docを復元（join時に使用）
   *
   * 1. メモリ上にドキュメントがあればそれを返す
   * 2. なければS3スナップショット + DynamoDB更新から復元
   */
  async loadDocument(roomId: string): Promise<Y.Doc> {
    // メモリ上に既にあればそれを返す
    const existingDoc = this.yjsRoomManager.getDoc(roomId)
    if (existingDoc) {
      return existingDoc
    }

    // 新しいドキュメントを作成
    const doc = this.yjsRoomManager.getOrCreateDoc(roomId)

    try {
      // S3から最新スナップショットを取得
      const snapshot = await this.s3Service.getLatestYjsSnapshot(roomId)
      if (snapshot) {
        const snapshotData = Buffer.from(snapshot.fullState, 'base64')
        Y.applyUpdate(doc, snapshotData)
      }

      // DynamoDBから残りの更新を取得して適用
      const updates = await this.dynamoDBService.getYjsUpdates(roomId)
      for (const update of updates) {
        Y.applyUpdate(doc, update.update_data)
      }
    } catch (error) {
      console.error(`Failed to load document for room ${roomId}:`, error)
    }

    return doc
  }

  /**
   * スナップショット作成が必要か確認し、必要なら作成
   */
  private async checkAndCreateSnapshot(roomId: string): Promise<void> {
    const stats = await this.dynamoDBService.getYjsUpdatesStats(roomId)

    if (stats.count >= this.maxUpdatesBeforeSnapshot || stats.totalSize >= this.maxUpdateSizeBeforeSnapshot) {
      await this.createSnapshot(roomId)
    }
  }

  /**
   * S3にスナップショットを作成し、DynamoDBの古い更新を削除
   */
  async createSnapshot(roomId: string): Promise<void> {
    const doc = this.yjsRoomManager.getDoc(roomId)
    if (!doc) return

    try {
      // 現在の状態をエンコード
      const fullState = Y.encodeStateAsUpdate(doc)
      const fullStateBase64 = Buffer.from(fullState).toString('base64')

      // S3に保存
      await this.s3Service.saveYjsSnapshot(roomId, {
        roomId,
        timestamp: new Date().toISOString(),
        fullState: fullStateBase64,
      })

      // DynamoDBの古い更新を削除
      await this.dynamoDBService.deleteYjsUpdates(roomId)
    } catch (error) {
      console.error(`Failed to create snapshot for room ${roomId}:`, error)
    }
  }
}
