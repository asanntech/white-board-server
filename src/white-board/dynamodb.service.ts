import { Injectable } from '@nestjs/common'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { YjsUpdateRecord } from './yjs/yjs.types'

@Injectable()
export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient
  private readonly tableName: string

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? 'local',
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT ?? undefined,
    })

    this.client = DynamoDBDocumentClient.from(dynamoClient)
    this.tableName = process.env.DYNAMODB_TABLE_NAME as string
  }

  /**
   * Yjs更新をDynamoDBに保存
   * @param roomId ルームID
   * @param update Yjs更新データ（Uint8Array）
   */
  async saveYjsUpdate(roomId: string, update: Uint8Array): Promise<void> {
    const timestamp = new Date().toISOString()
    const updateId = `${timestamp}#${uuid()}`

    const record: YjsUpdateRecord = {
      room_id: roomId,
      created_at: updateId,
      update_data: update,
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
      })
    )
  }

  /**
   * 指定されたルームのYjs更新を全て取得
   * @param roomId ルームID
   * @returns Yjs更新レコードの配列
   */
  async getYjsUpdates(roomId: string): Promise<YjsUpdateRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'room_id = :room_id',
        ExpressionAttributeValues: {
          ':room_id': roomId,
        },
      })
    )

    return (result.Items || []) as YjsUpdateRecord[]
  }

  /**
   * Yjs更新の統計情報を取得
   * @param roomId ルームID
   * @returns レコード数と合計データサイズ
   */
  async getYjsUpdatesStats(roomId: string): Promise<{ count: number; totalSize: number }> {
    const updates = await this.getYjsUpdates(roomId)
    const count = updates.length
    const totalSize = updates.reduce((sum, update) => {
      return sum + (update.update_data?.length || 0)
    }, 0)

    return { count, totalSize }
  }

  /**
   * 指定されたルームのYjs更新を全て物理削除
   * @param roomId ルームID
   */
  async deleteYjsUpdates(roomId: string): Promise<void> {
    const updates = await this.getYjsUpdates(roomId)

    if (updates.length === 0) return

    // 25件ずつバッチ処理（DynamoDBの制限）
    const batchSize = 25
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)

      const deleteRequests = batch.map((record) => ({
        DeleteRequest: {
          Key: {
            room_id: roomId,
            created_at: record.created_at,
          },
        },
      }))

      await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: deleteRequests,
          },
        })
      )

      console.log(`Deleted ${batch.length} Yjs updates from DynamoDB for room ${roomId}`)
    }
  }
}
