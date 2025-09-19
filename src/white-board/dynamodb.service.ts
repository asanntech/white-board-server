import { Injectable } from '@nestjs/common'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { Drawing, DrawingRecord, UndoRedoResult } from './drawing.types'

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

  private async updateDrawingForDelete(roomId: string, drawing: Drawing): Promise<void> {
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

  private async updateDrawingForRestore(roomId: string, drawing: Drawing): Promise<void> {
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
      ':updated_at': new Date().toISOString(),
    }

    console.log({ expressionAttributeValues })

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
}
