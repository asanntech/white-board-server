import { UseGuards } from '@nestjs/common'
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { Drawing, UndoRedoResult } from './drawing.types'
import { AuthGuard } from '../auth/auth.guard'
import { DynamoDBService } from './dynamodb.service'
import { S3Service } from './s3.service'

const wsCorsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

@WebSocketGateway({ cors: { origin: wsCorsOrigins, credentials: true } })
@UseGuards(AuthGuard)
export class WhiteBoardGateway {
  constructor(
    private readonly dynamoDBService: DynamoDBService,
    private readonly s3Service: S3Service
  ) {}

  @SubscribeMessage('join')
  async handleJoin(client: Socket, params: { roomId: string }): Promise<void> {
    await client.join(params.roomId)

    try {
      // 既存の描画データを取得してクライアントに送信
      const latestSnapshot = await this.s3Service.getLatestSnapshot(params.roomId)
      const existingDrawings = await this.dynamoDBService.getDrawingRecordsByRoom(params.roomId)
      const allDrawings = this.dynamoDBService.mergeDrawings(latestSnapshot, existingDrawings)
      if (allDrawings.length > 0) {
        const drawings = allDrawings.flatMap((drawing) =>
          !drawing.is_deleted ? [this.dynamoDBService.convertFromDynamoDB(drawing)] : []
        )
        client.emit('roomData', drawings)
      }
    } catch (error) {
      console.error('Failed to load existing drawings:', error)
    }

    // 他のクライアントに新しいユーザーの参加を通知
    client.to(params.roomId).emit('userEntered', client.id)
  }

  @SubscribeMessage('drawing')
  async handleDrawing(client: Socket, params: { roomId: string; drawings: Drawing[] }): Promise<void> {
    try {
      client.to(params.roomId).emit('drawing', params.drawings)
      await this.dynamoDBService.saveDrawings(params.roomId, params.drawings)
    } catch (error) {
      console.error('Failed to save drawing data to DynamoDB:', error)
    }
  }

  @SubscribeMessage('drawingEnd')
  async handleDrawingEnd(client: Socket, params: { roomId: string; drawing: Drawing }): Promise<void> {
    try {
      client.to(params.roomId).emit('drawingEnd', params.drawing)
      // DynamoDBで描画データを更新
      await this.dynamoDBService.updateDrawings(params.roomId, [params.drawing])
    } catch (error) {
      console.error('Failed to update transform data in DynamoDB:', error)
    }
  }

  @SubscribeMessage('transform')
  async handleTransform(client: Socket, params: { roomId: string; drawings: Drawing[] }): Promise<void> {
    try {
      client.to(params.roomId).emit('transform', params.drawings)
      // DynamoDBで描画データを更新
      await this.dynamoDBService.updateDrawings(params.roomId, params.drawings)
    } catch (error) {
      console.error('Failed to update transform data in DynamoDB:', error)
    }
  }

  @SubscribeMessage('remove')
  async handleRemove(client: Socket, params: { roomId: string; drawings: Drawing[] }): Promise<void> {
    try {
      client.to(params.roomId).emit('remove', params.drawings)
      await this.dynamoDBService.deleteDrawings(params.roomId, params.drawings)
    } catch (error) {
      console.error('Failed to delete drawings from DynamoDB:', error)
    }
  }

  @SubscribeMessage('undo')
  async handleUndo(client: Socket, params: { roomId: string; undoResult: UndoRedoResult }): Promise<void> {
    try {
      client.to(params.roomId).emit('undoDrawings', params.undoResult)
      await this.dynamoDBService.updateDrawing(params.roomId, params.undoResult)
    } catch (error) {
      console.error('Failed to undo drawings in DynamoDB:', error)
    }
  }

  @SubscribeMessage('redo')
  async handleRedo(client: Socket, params: { roomId: string; redoResult: UndoRedoResult }): Promise<void> {
    try {
      client.to(params.roomId).emit('redoDrawings', params.redoResult)
      await this.dynamoDBService.updateDrawing(params.roomId, params.redoResult)
    } catch (error) {
      console.error('Failed to redo drawings in DynamoDB:', error)
    }
  }
}
