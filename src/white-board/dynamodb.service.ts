import { Injectable } from '@nestjs/common'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { Drawing, DrawingRecord } from './drawing.types'

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
}
