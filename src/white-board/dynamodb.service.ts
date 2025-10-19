import { Injectable } from '@nestjs/common'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { Drawing, DrawingRecord, UndoRedoResult } from './drawing.types'
import { S3Service } from './s3.service'

@Injectable()
export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient
  private readonly tableName: string
  private readonly maxRecordsBeforeSnapshot = 100
  private readonly maxDataSizeBeforeSnapshot = 1024 * 1024 // 1MB in bytes

  constructor(private readonly s3Service: S3Service) {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? 'local',
      endpoint: process.env.AWS_DYNAMODB_ENDPOINT ?? undefined,
    })

    this.client = DynamoDBDocumentClient.from(dynamoClient)
    this.tableName = process.env.DYNAMODB_TABLE_NAME as string
  }

  /**
   * 描画データをDynamoDBに変換
   * @param roomId ルームID
   * @param drawing 描画データ
   * @returns DynamoDBに変換した描画データ
   */
  convertToDynamoDB(roomId: string, drawing: Drawing): DrawingRecord {
    const timestamp = Date.now()
    const drawingId = drawing.id || `${timestamp}#${uuid()}`

    return {
      room_id: roomId,
      drawing_id: drawingId,
      type: drawing.type,
      points: drawing.points,
      stroke: drawing.stroke,
      stroke_width: drawing.strokeWidth,
      x: drawing.x,
      y: drawing.y,
      rotation: drawing.rotation,
      scale_x: drawing.scaleX,
      scale_y: drawing.scaleY,
      skew_x: drawing.skewX,
      skew_y: drawing.skewY,
      line_cap: drawing.lineCap,
      line_join: drawing.lineJoin,
      opacity: drawing.opacity,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    }
  }

  /**
   * DynamoDBに変換した描画データを描画データに変換
   * @param item DynamoDBに変換した描画データ
   * @returns 描画データ
   */
  convertFromDynamoDB(item: DrawingRecord): Drawing {
    return {
      id: item.drawing_id,
      type: item.type,
      points: item.points,
      stroke: item.stroke,
      strokeWidth: item.stroke_width,
      x: item.x,
      y: item.y,
      rotation: item.rotation,
      scaleX: item.scale_x,
      scaleY: item.scale_y,
      skewX: item.skew_x,
      skewY: item.skew_y,
      lineCap: item.line_cap,
      lineJoin: item.line_join,
      opacity: item.opacity,
    }
  }

  /**
   * 描画データを保存
   * @param roomId ルームID
   * @param drawing 描画データ
   * @returns 保存した描画データ
   */
  async saveDrawing(roomId: string, drawing: Drawing): Promise<DrawingRecord> {
    const item = this.convertToDynamoDB(roomId, drawing)
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    )
    return item
  }

  async saveDrawings(roomId: string, drawings: Drawing[]): Promise<DrawingRecord[]> {
    // 保存後、レコード数とデータサイズをチェック
    await this.checkAndCreateSnapshot(roomId)

    const promises = drawings.map((drawing) => this.saveDrawing(roomId, drawing))
    const savedDrawings = await Promise.all(promises)

    return savedDrawings
  }

  /**
   * 指定されたroomIdの描画データを取得
   * @param roomId ルームID
   * @returns 指定されたroomIdの描画データ
   */
  async getDrawingRecordsByRoom(roomId: string): Promise<DrawingRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'room_id = :room_id',
        ExpressionAttributeValues: {
          ':room_id': roomId,
        },
      })
    )

    return (result.Items || []) as DrawingRecord[]
  }

  /**
   * 指定されたroomIdとdrawingIdのレコードが存在するかチェック
   * @param roomId ルームID
   * @param drawingId 描画ID
   * @returns レコードが存在する場合はtrue、存在しない場合はfalse
   */
  private async checkDrawingExists(roomId: string, drawingId: string): Promise<boolean> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawingId,
        },
      })
    )

    return !!result.Item
  }

  /**
   * 描画レコードを作成
   * @param roomId ルームID
   * @param drawing 描画データ
   */
  private async createDrawing(roomId: string, drawing: Drawing): Promise<void> {
    const item = this.convertToDynamoDB(roomId, drawing)
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    )
  }

  /**
   * 描画レコードを削除
   * @param roomId ルームID
   * @param drawing 描画データ
   */
  async deleteDrawing(roomId: string, drawing: Drawing): Promise<void> {
    const exists = await this.checkDrawingExists(roomId, drawing.id)

    if (!exists) {
      await this.createDrawing(roomId, drawing)
      return
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawing.id,
        },
        UpdateExpression: 'SET is_deleted = :is_deleted, updated_at = :updated_at, deleted_at = :deleted_at',
        ExpressionAttributeValues: {
          ':is_deleted': true,
          ':updated_at': new Date().toISOString(),
          ':deleted_at': new Date().toISOString(),
        },
      })
    )
  }

  async deleteDrawings(roomId: string, drawings: Drawing[]): Promise<void> {
    const promises = drawings.map((drawing) => this.deleteDrawing(roomId, drawing))
    await Promise.all(promises)
  }

  /**
   * 描画レコードを更新
   * @param roomId ルームID
   * @param undoRedoResult 更新結果
   */
  async updateDrawing(roomId: string, undoRedoResult: UndoRedoResult): Promise<void> {
    const promises = undoRedoResult.objects.map(async (drawing) => {
      if (!drawing.id) {
        throw new Error('Drawing ID is required for update')
      }

      switch (undoRedoResult.action) {
        case 'delete':
          return this.updateDrawingForDelete(roomId, drawing)
        case 'restore':
          return this.updateDrawingForRestore(roomId, drawing)
        case 'transform':
          return this.updateDrawingForTransform(roomId, drawing)
        default:
          throw new Error(`Unknown action: ${undoRedoResult.action as string}`)
      }
    })

    await Promise.all(promises)
  }

  /**
   * 描画レコードを削除
   * @param roomId ルームID
   * @param drawing 描画データ
   */
  private async updateDrawingForDelete(roomId: string, drawing: Drawing): Promise<void> {
    const exists = await this.checkDrawingExists(roomId, drawing.id)

    if (!exists) {
      await this.createDrawing(roomId, drawing)
      return
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawing.id,
        },
        UpdateExpression: 'SET is_deleted = :is_deleted, updated_at = :updated_at, deleted_at = :deleted_at',
        ExpressionAttributeValues: {
          ':is_deleted': true,
          ':updated_at': new Date().toISOString(),
          ':deleted_at': new Date().toISOString(),
        },
      })
    )
  }

  /**
   * 描画レコードを復元
   * @param roomId ルームID
   * @param drawing 描画データ
   */
  private async updateDrawingForRestore(roomId: string, drawing: Drawing): Promise<void> {
    const exists = await this.checkDrawingExists(roomId, drawing.id)

    if (!exists) {
      await this.createDrawing(roomId, drawing)
      return
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawing.id,
        },
        UpdateExpression: 'SET is_deleted = :is_deleted, updated_at = :updated_at, deleted_at = :deleted_at',
        ExpressionAttributeValues: {
          ':is_deleted': false,
          ':updated_at': new Date().toISOString(),
          ':deleted_at': null,
        },
      })
    )
  }

  /**
   * 描画レコードを変換
   * @param roomId ルームID
   * @param drawing 描画データ
   */
  private async updateDrawingForTransform(roomId: string, drawing: Drawing): Promise<void> {
    const updateExpressionParts: string[] = [
      '#type = :type',
      'points = :points',
      'stroke = :stroke',
      'stroke_width = :stroke_width',
      'x = :x',
      'y = :y',
      'rotation = :rotation',
      'scale_x = :scale_x',
      'scale_y = :scale_y',
      'skew_x = :skew_x',
      'skew_y = :skew_y',
      'line_cap = :line_cap',
      'line_join = :line_join',
      'opacity = :opacity',
      'updated_at = :updated_at',
    ]

    const expressionAttributeNames: Record<string, string> = {
      '#type': 'type',
    }

    const expressionAttributeValues: Record<string, any> = {
      ':type': drawing.type,
      ':points': drawing.points,
      ':stroke': drawing.stroke,
      ':stroke_width': drawing.strokeWidth,
      ':x': drawing.x ?? null,
      ':y': drawing.y ?? null,
      ':rotation': drawing.rotation ?? null,
      ':scale_x': drawing.scaleX ?? null,
      ':scale_y': drawing.scaleY ?? null,
      ':skew_x': drawing.skewX ?? null,
      ':skew_y': drawing.skewY ?? null,
      ':line_cap': drawing.lineCap ?? null,
      ':line_join': drawing.lineJoin ?? null,
      ':opacity': drawing.opacity ?? null,
      ':updated_at': new Date().toISOString(),
    }

    // レコードの存在確認
    const exists = await this.checkDrawingExists(roomId, drawing.id)

    if (!exists) {
      await this.createDrawing(roomId, drawing)
      return
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawing.id,
        },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )
  }

  async updateDrawings(roomId: string, drawings: Drawing[]): Promise<void> {
    const promises = drawings.map(async (drawing) => {
      if (!drawing.id) {
        throw new Error('Drawing ID is required for update')
      }
      return this.updateDrawingForTransform(roomId, drawing)
    })
    await Promise.all(promises)
  }

  /**
   * レコード数とデータサイズをチェックし、閾値を超えた場合はS3にフルバックアップのスナップショットを保存
   * 条件: レコード数が100件以上 または データサイズが1MB以上
   * @param roomId ルームID
   */
  private async checkAndCreateSnapshot(roomId: string): Promise<void> {
    try {
      // レコード数とデータサイズを取得
      const { count, totalSize } = await this.getRecordsStats(roomId)

      // 閾値チェック
      const shouldCreateSnapshot =
        count >= this.maxRecordsBeforeSnapshot || totalSize >= this.maxDataSizeBeforeSnapshot

      if (shouldCreateSnapshot) {
        // 1. 過去の最新スナップショットを取得（存在する場合）
        const snapshotRecords = await this.s3Service.getLatestSnapshot(roomId)

        // 2. DynamoDBから現在の全描画データを取得
        const drawingRecords = await this.getDrawingRecordsByRoom(roomId)

        // 3. 過去のスナップショットと現在のデータを結合してフルバックアップを作成
        const fullBackup = this.mergeDrawings(snapshotRecords, drawingRecords)

        // 4. フルバックアップをS3に保存
        await this.s3Service.saveSnapshot(roomId, fullBackup)

        // 5. DynamoDBのレコードを物理削除（全て削除）
        await this.deleteOldRecords(roomId)
      }
    } catch (error) {
      console.error(`Failed to check and create snapshot for room ${roomId}:`, error)
      // エラーが発生してもメインの処理は継続
    }
  }

  /**
   * 指定されたroomIdのレコード統計情報を取得
   * @param roomId ルームID
   * @returns レコード数と合計データサイズ（バイト）
   */
  private async getRecordsStats(roomId: string): Promise<{ count: number; totalSize: number }> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'room_id = :room_id',
        ExpressionAttributeValues: {
          ':room_id': roomId,
        },
      })
    )

    const items = (result.Items || []) as DrawingRecord[]

    // レコード数
    const count = items.length

    // 合計データサイズを計算（JSON文字列化してバイト数を取得）
    const totalSize = items.reduce((sum, item) => {
      const itemJson = JSON.stringify(item)
      return sum + Buffer.byteLength(itemJson, 'utf8')
    }, 0)

    return { count, totalSize }
  }

  /**
   * 過去のスナップショットと現在のデータを結合
   * 重複するIDがある場合は新しいデータ（currentDrawings）を優先
   * @param previousDrawings 過去のスナップショットの描画データ
   * @param currentDrawings 現在のDynamoDBの描画データ
   * @returns 結合された描画データ
   */
  mergeDrawings(previousDrawings: DrawingRecord[], currentDrawings: DrawingRecord[]): DrawingRecord[] {
    // IDをキーとしたMapを作成（重複を排除）
    const drawingMap = new Map<string, DrawingRecord>()

    // 過去のスナップショットデータを追加
    previousDrawings.forEach((drawing) => {
      drawingMap.set(drawing.drawing_id, drawing)
    })

    // 現在のデータを追加（既存のIDがある場合は上書き）
    currentDrawings.forEach((drawing) => {
      drawingMap.set(drawing.drawing_id, drawing)
    })

    // Mapから配列に変換
    return Array.from(drawingMap.values())
  }

  /**
   * 古いレコードをDynamoDBから物理削除（BatchWriteCommandを使用）
   * スナップショットはS3に保存されているため、物理削除しても問題なし
   * @param roomId ルームID
   */
  private async deleteOldRecords(roomId: string): Promise<void> {
    // 全てのレコードを取得
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'room_id = :room_id',
        ExpressionAttributeValues: {
          ':room_id': roomId,
        },
      })
    )

    const items = (result.Items || []) as DrawingRecord[]

    if (items.length === 0) return

    // 25件ずつバッチ処理（DynamoDBの制限）
    const batchSize = 25
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)

      // BatchWriteCommandで一括削除
      const deleteRequests = batch.map((record) => ({
        DeleteRequest: {
          Key: {
            room_id: roomId,
            drawing_id: record.drawing_id,
          },
        },
      }))

      const response = await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: deleteRequests,
          },
        })
      )

      console.log(`Deleted ${batch.length} items from DynamoDB for room ${roomId}`)

      // 未処理アイテムがある場合はエラーを出力
      if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
        const unprocessedKeys = Object.keys(response.UnprocessedItems)
        console.error(`Failed to process ${unprocessedKeys.length} items: ${unprocessedKeys.join(', ')}`)
      }
    }
  }
}
