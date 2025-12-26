import 'dotenv/config'
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import * as Y from 'yjs'

// CJS のため named import ではなく namespace import を使用
// @ts-expect-error - @y/websocket-server に型定義なし
import * as ywsUtils from '@y/websocket-server/utils'
import { verifyToken } from '../shared/jwt-verifier'
import { loadInitialData, setupPersistence } from './persistence'
import { createDynamoDBService, createS3Service } from './services'
import { initYRedis, bindDocToRedis } from './y-redis-provider'

// 型を付けて取り出し
type SetupWSConnection = (
  conn: WebSocket,
  req: IncomingMessage,
  options?: { doc?: Y.Doc; docName?: string }
) => void
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const setupWSConnection = (ywsUtils as any).setupWSConnection as SetupWSConnection

const port = Number(process.env.YJS_WS_PORT || 1234)
const dynamoDBService = createDynamoDBService()
const s3Service = createS3Service()
const docs = new Map<string, Y.Doc>()
const initializingDocs = new Map<string, Promise<Y.Doc>>()

// ドキュメント作成時に初期データロードと永続化をセットアップ
async function getOrCreateDoc(roomId: string): Promise<Y.Doc> {
  // 既存のドキュメントがあれば返す
  const existingDoc = docs.get(roomId)
  if (existingDoc) {
    return existingDoc
  }

  // 初期化中のドキュメントがあれば待機
  const initializing = initializingDocs.get(roomId)
  if (initializing) {
    return initializing
  }

  // 新規ドキュメントを作成・初期化
  const initPromise = (async () => {
    const doc = new Y.Doc()

    // 既存データをロード
    await loadInitialData(doc, roomId, dynamoDBService, s3Service)

    // 永続化をセットアップ
    setupPersistence(doc, roomId, dynamoDBService)

    // Redis にバインド（他インスタンスと同期）
    await bindDocToRedis(doc, roomId)

    docs.set(roomId, doc)
    initializingDocs.delete(roomId)

    return doc
  })()

  initializingDocs.set(roomId, initPromise)
  return initPromise
}

// サーバー起動時に Redis を初期化
async function main() {
  try {
    await initYRedis()
  } catch (error) {
    console.error('Failed to initialize y-redis, continuing without Redis sync:', error)
    // Redis 初期化に失敗してもサーバーは起動を続ける
  }

  const wss = new WebSocketServer({ port })

  wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('token')

    if (!token) {
      conn.close(4001, 'Unauthorized')
      return
    }

    verifyToken(token)
      .then(async () => {
        const roomId = url.pathname.slice(1) || 'default'
        // ドキュメントを取得（初期データロード含む）
        const doc = await getOrCreateDoc(roomId)
        setupWSConnection(conn, req, { doc, docName: roomId })
      })
      .catch(() => {
        conn.close(4001, 'Unauthorized')
      })
  })

  console.log(`y-websocket server running on port ${port}`)
}

main().catch((error) => {
  console.error('Failed to start y-websocket server:', error)
  process.exit(1)
})
