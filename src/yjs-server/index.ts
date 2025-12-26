import 'dotenv/config'
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import * as Y from 'yjs'

// CJS のため named import ではなく namespace import を使用
// @ts-expect-error - @y/websocket-server に型定義なし
import * as ywsUtils from '@y/websocket-server/utils'
import { verifyToken } from '../shared/jwt-verifier'
import { setupPersistence } from './persistence'
import { createDynamoDBService } from './services'

// 型を付けて取り出し
type SetupWSConnection = (
  conn: WebSocket,
  req: IncomingMessage,
  options?: { doc?: Y.Doc; docName?: string }
) => void
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const setupWSConnection = (ywsUtils as any).setupWSConnection as SetupWSConnection

const port = Number(process.env.YJS_WS_PORT || 1234)
const wss = new WebSocketServer({ port })
const dynamoDBService = createDynamoDBService()
const docs = new Map<string, Y.Doc>()

// ドキュメント作成時に永続化をセットアップ
function getOrCreateDoc(roomId: string): Y.Doc {
  let doc = docs.get(roomId)
  if (!doc) {
    doc = new Y.Doc()
    setupPersistence(doc, roomId, dynamoDBService)
    docs.set(roomId, doc)
  }
  return doc
}

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
      const doc = getOrCreateDoc(roomId)
      setupWSConnection(conn, req, { doc, docName: roomId })
    })
    .catch(() => {
      conn.close(4001, 'Unauthorized')
    })
})

console.log(`y-websocket server running on port ${port}`)
