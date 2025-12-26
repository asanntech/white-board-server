import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

// @y/websocket-server には型定義がないため、手動で定義
// @ts-expect-error - @y/websocket-server には型定義がない
import { setupWSConnection } from '@y/websocket-server/utils'
import { verifyToken } from '../shared/jwt-verifier'

// setupWSConnection の型定義
declare function setupWSConnection(
  conn: WebSocket,
  req: IncomingMessage,
  options?: { docName?: string }
): void

const port = process.env.YJS_WS_PORT || 1234

const wss = new WebSocketServer({ port: Number(port) })

wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token')

  if (!token) {
    conn.close(4001, 'Unauthorized')
    return
  }

  // 認証チェック
  verifyToken(token)
    .then(() => {
      const roomId = url.pathname.slice(1) || 'default'
      setupWSConnection(conn, req, { docName: roomId })
    })
    .catch(() => {
      conn.close(4001, 'Unauthorized')
    })
})

console.log(`y-websocket server running on port ${port}`)
