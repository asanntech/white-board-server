import { UseGuards } from '@nestjs/common'
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import * as Y from 'yjs'
import { Drawing } from './drawing.types'
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

  @SubscribeMessage('yjs:update')
  handleYjsUpdate(client: Socket, params: { roomId: string; update: number[] }): void {
    client.to(params.roomId).emit('yjs:update', { update: params.update })
  }

  @SubscribeMessage('yjs:sync:request')
  async handleYjsSyncRequest(client: Socket, params: { roomId: string }): Promise<void> {
    const yDoc = new Y.Doc()
    try {
      const latestSnapshot = await this.s3Service.getLatestSnapshot(params.roomId)
      const existingDrawings = await this.dynamoDBService.getDrawingRecordsByRoom(params.roomId)
      const allDrawings = this.dynamoDBService.mergeDrawings(latestSnapshot, existingDrawings)

      const drawings = allDrawings.flatMap((drawing) =>
        !drawing.is_deleted ? [this.dynamoDBService.convertFromDynamoDB(drawing)] : []
      )

      const yDrawings = yDoc.getMap<Drawing>('drawings')

      yDoc.transact(() => {
        drawings.forEach((drawing) => {
          yDrawings.set(drawing.id, drawing)
        })
      })

      const state = Y.encodeStateAsUpdate(yDoc)
      client.emit('yjs:sync', { state: Array.from(state) })
    } catch (error) {
      console.error('Failed to sync Yjs state:', error)
    } finally {
      yDoc.destroy()
    }
  }
}
