import { UseGuards } from '@nestjs/common'
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { DrawingData } from './drawing.types'
import { AuthGuard } from '../auth/auth.guard'

@WebSocketGateway({ namespace: 'white-board' })
@UseGuards(AuthGuard)
export class WhiteBoardGateway {
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): string {
    console.log('Received message from client:', client.id, payload)
    return 'Hello world!'
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket, params: { roomId: string }): Promise<void> {
    console.log('Received join request for room:', params.roomId)
    await client.join(params.roomId)
    client.to(params.roomId).emit('join', client.id)
  }

  @SubscribeMessage('drawing')
  handleDrawing(client: Socket, params: { roomId: string; drawings: DrawingData[] }): void {
    console.log('Received drawing data:', params.drawings)
    client.to(params.roomId).emit('drawing', params.drawings)
  }

  @SubscribeMessage('transform')
  handleTransform(client: Socket, params: { roomId: string; drawings: DrawingData[] }): void {
    console.log('Received transform data:', params.drawings)
    client.to(params.roomId).emit('transform', params.drawings)
  }

  @SubscribeMessage('remove')
  handleRemove(client: Socket, params: { roomId: string; ids: string[] }): void {
    console.log('Received remove id:', params.ids)
    client.to(params.roomId).emit('remove', params.ids)
  }

  @SubscribeMessage('undo')
  handleUndo(client: Socket, params: { roomId: string; ids: string[] }): void {
    console.log('Received undo')
    client.to(params.roomId).emit('undo', params.ids)
  }

  @SubscribeMessage('redo')
  handleRedo(client: Socket, params: { roomId: string; drawings: DrawingData[] }): void {
    console.log('Received redo')
    client.to(params.roomId).emit('redo', params.drawings)
  }
}
