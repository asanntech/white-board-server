import { UseGuards } from '@nestjs/common'
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { Drawing } from './drawing.types'
import { AuthGuard } from '../auth/auth.guard'
import { DynamoDBService } from './dynamodb.service'

@WebSocketGateway({ namespace: 'white-board' })
@UseGuards(AuthGuard)
export class WhiteBoardGateway {
  constructor(private readonly dynamoDBService: DynamoDBService) {}

  @SubscribeMessage('join')
  async handleJoin(client: Socket, params: { roomId: string }): Promise<void> {
    console.log('Received join request for room:', params.roomId)
    await client.join(params.roomId)

    try {
      // 既存の描画データを取得してクライアントに送信
      const existingDrawings = await this.dynamoDBService.getDrawingsByRoom(params.roomId)
      if (existingDrawings.length > 0) {
        client.emit('roomData', existingDrawings)
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
      // DynamoDBに保存
      const savedDrawings = await this.dynamoDBService.saveDrawings(params.roomId, params.drawings)
      const drawings = savedDrawings.map((drawing) => this.dynamoDBService.convertFromDynamoDB(drawing))
      // 他のクライアントにブロードキャスト
      client.to(params.roomId).emit('drawing', drawings)
    } catch (error) {
      console.error('Failed to save drawing data to DynamoDB:', error)
    }
  }

  @SubscribeMessage('transform')
  async handleTransform(client: Socket, params: { roomId: string; drawings: Drawing[] }): Promise<void> {
    console.log('Received transform data:', params.drawings)

    try {
      // DynamoDBに保存
      await this.dynamoDBService.saveDrawings(params.roomId, params.drawings)
    } catch (error) {
      console.error('Failed to save transform data to DynamoDB:', error)
    }

    client.to(params.roomId).emit('transform', params.drawings)
  }

  @SubscribeMessage('remove')
  async handleRemove(client: Socket, params: { roomId: string; ids: string[] }): Promise<void> {
    try {
      // DynamoDBでis_deletedフラグをtrueに更新
      await this.dynamoDBService.deleteDrawings(params.roomId, params.ids)

      // 他のクライアントに削除を通知
      client.to(params.roomId).emit('remove', params.ids)
    } catch (error) {
      console.error('Failed to delete drawings from DynamoDB:', error)
    }
  }

  @SubscribeMessage('undo')
  handleUndo(client: Socket, params: { roomId: string; ids: string[] }): void {
    client.to(params.roomId).emit('undo', params.ids)
  }

  @SubscribeMessage('redo')
  handleRedo(client: Socket, params: { roomId: string; drawings: Drawing[] }): void {
    client.to(params.roomId).emit('redo', params.drawings)
  }
}
