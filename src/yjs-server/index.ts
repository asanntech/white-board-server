import 'dotenv/config'
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

// CJS のため named import ではなく namespace import を使用
// @ts-expect-error - @y/websocket-server に型定義なし
import * as ywsUtils from '@y/websocket-server/utils'
import { verifyToken } from '../shared/jwt-verifier'

// 型を付けて取り出し
type SetupWSConnection = (conn: WebSocket, req: IncomingMessage, options?: { docName?: string }) => void
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const setupWSConnection = (ywsUtils as any).setupWSConnection as SetupWSConnection

const port = Number(process.env.YJS_WS_PORT || 1234)
const wss = new WebSocketServer({ port })

wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token')

  if (!token) {
    conn.close(4001, 'Unauthorized')
    return
  }

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
