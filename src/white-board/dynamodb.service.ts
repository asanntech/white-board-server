import { Injectable } from '@nestjs/common'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { Drawing, DrawingRecord, Transform } from './drawing.types'

@Injectable()
export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient
  private readonly tableName: string

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION,
      endpoint: process.env.AWS_ENDPOINT,
    })

    this.client = DynamoDBDocumentClient.from(dynamoClient)
    this.tableName = process.env.DYNAMODB_TABLE_NAME as string
  }

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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    }
  }

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
    }
  }

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
    const promises = drawings.map((drawing) => this.saveDrawing(roomId, drawing))
    return await Promise.all(promises)
  }

  async getDrawingsByRoom(roomId: string): Promise<Drawing[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'room_id = :room_id',
        ExpressionAttributeValues: {
          ':room_id': roomId,
        },
        ScanIndexForward: true, // タイムスタンプ順でソート
      })
    )

    const items = (result.Items || []) as DrawingRecord[]

    return items.filter((item) => !item.is_deleted).map((item) => this.convertFromDynamoDB(item))
  }

  async deleteDrawing(roomId: string, drawingId: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawingId,
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

  async deleteDrawings(roomId: string, drawingIds: string[]): Promise<void> {
    const promises = drawingIds.map((drawingId) => this.deleteDrawing(roomId, drawingId))
    await Promise.all(promises)
  }

  async updateDrawingTransform(
    roomId: string,
    drawingId: string,
    transformData: Partial<Transform>
  ): Promise<void> {
    const updateExpressionParts: string[] = []
    const expressionAttributeValues: Record<string, any> = {
      ':updated_at': new Date().toISOString(),
    }

    // 各変形パラメータを動的に追加
    if (transformData.x !== undefined) {
      updateExpressionParts.push('x = :x')
      expressionAttributeValues[':x'] = transformData.x
    }
    if (transformData.y !== undefined) {
      updateExpressionParts.push('y = :y')
      expressionAttributeValues[':y'] = transformData.y
    }
    if (transformData.rotation !== undefined) {
      updateExpressionParts.push('rotation = :rotation')
      expressionAttributeValues[':rotation'] = transformData.rotation
    }
    if (transformData.scaleX !== undefined) {
      updateExpressionParts.push('scale_x = :scale_x')
      expressionAttributeValues[':scale_x'] = transformData.scaleX
    }
    if (transformData.scaleY !== undefined) {
      updateExpressionParts.push('scale_y = :scale_y')
      expressionAttributeValues[':scale_y'] = transformData.scaleY
    }
    if (transformData.skewX !== undefined) {
      updateExpressionParts.push('skew_x = :skew_x')
      expressionAttributeValues[':skew_x'] = transformData.skewX
    }
    if (transformData.skewY !== undefined) {
      updateExpressionParts.push('skew_y = :skew_y')
      expressionAttributeValues[':skew_y'] = transformData.skewY
    }

    // updated_atは常に更新
    updateExpressionParts.push('updated_at = :updated_at')

    if (updateExpressionParts.length === 0) {
      return // 更新する項目がない場合は何もしない
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          room_id: roomId,
          drawing_id: drawingId,
        },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )
  }

  async updateDrawingsTransform(roomId: string, drawings: Drawing[]): Promise<void> {
    const promises = drawings.map((drawing) => {
      if (!drawing.id) {
        throw new Error('Drawing ID is required for transform update')
      }
      return this.updateDrawingTransform(roomId, drawing.id, {
        x: drawing.x,
        y: drawing.y,
        rotation: drawing.rotation,
        scaleX: drawing.scaleX,
        scaleY: drawing.scaleY,
        skewX: drawing.skewX,
        skewY: drawing.skewY,
      })
    })
    await Promise.all(promises)
  }
}
