import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { DrawingData } from './drawing.types'

@WebSocketGateway({ namespace: 'white-board' })
export class WhiteBoardGateway {
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): string {
    console.log('Received message from client:', client.id, payload)
    return 'Hello world!'
  }

  @SubscribeMessage('drawing')
  handleDrawing(client: Socket, drawingData: DrawingData): void {
    console.log('Received drawing data:', drawingData)
    client.broadcast.emit('drawing', drawingData)
  }
}
