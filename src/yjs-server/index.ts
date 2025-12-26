import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

// @y/websocket-server には型定義がないため、手動で定義
// @ts-expect-error - @y/websocket-server には型定義がない
import { setupWSConnection } from '@y/websocket-server/utils'

// setupWSConnection の型定義
declare function setupWSConnection(
  conn: WebSocket,
  req: IncomingMessage,
  options?: { docName?: string }
): void

const port = process.env.YJS_WS_PORT || 1234

const wss = new WebSocketServer({ port: Number(port) })

wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
  // roomId を URL パスから取得（例: /room123）
  const roomId = req.url?.slice(1) || 'default'

  setupWSConnection(conn, req, { docName: roomId })
})

console.log(`y-websocket server running on port ${port}`)
