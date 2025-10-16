import 'dotenv/config'
import { io, Socket } from 'socket.io-client'

const url = `http://localhost:${process.env.PORT}/whiteboard`

const socket: Socket = io(url, {
  transports: ['websocket'],
  auth: { token: 'dummy-jwt' },
})

// 描画データのサンプル
const sampleDrawingData = {
  id: 'pen-1757668747567',
  type: 'pen',
  points: [7675.625, 8195.23828125, 7675.7890625, 8195.23828125, 7684.0859375, 8191.609375],
  stroke: '#333333',
  strokeWidth: 12,
  lineCap: 'round',
  lineJoin: 'round',
  x: 13450.551129217796,
  y: 869.2960864905099,
  rotation: 57.18960074104442,
  scaleX: 0.4193819180381164,
  scaleY: 1.0000000000000027,
  skewX: 1.1912777818806958e-15,
  skewY: 1.1912777818806958e-15,
}

socket.on('connect', () => {
  console.log('connected', socket.id)

  // メッセージのテスト
  socket.emit('message', { text: 'hello' }, (ack: any) => {
    console.log('ack from server:', ack)
  })

  // 描画データの送信テスト
  setTimeout(() => {
    console.log('Sending drawing data...')
    socket.emit('drawing', sampleDrawingData)
  }, 1000)
})

socket.on('message', (d) => console.log('message:', d))
socket.on('drawing', (d) => console.log('drawing received:', d))
socket.on('connect_error', (e) => console.error('connect_error:', e))
socket.on('error', (e) => console.error('error:', e))
socket.on('disconnect', (r) => console.warn('disconnected:', r))
