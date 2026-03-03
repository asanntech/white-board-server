import { UseGuards } from '@nestjs/common'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import * as Y from 'yjs'
import { AuthGuard } from '../../auth/auth.guard'
import { YjsRoomManager } from './yjs-room.manager'
import { YjsPersistenceService } from './yjs-persistence.service'
import { YjsJoinParams, YjsUpdateParams, YjsSyncInitPayload } from './yjs.types'

/** サーバー間 Y.Doc 同期用イベント名 */
const SERVER_YJS_SYNC_EVENT = 'server:yjs-sync'

const wsCorsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

/**
 * Yjs専用WebSocketゲートウェイ
 *
 * イベント:
 *   join - ルーム参加、初期状態送信
 *   yjs-update - Yjs更新の受信・ブロードキャスト・永続化
 */
@WebSocketGateway({ cors: { origin: wsCorsOrigins, credentials: true } })
@UseGuards(AuthGuard)
export class YjsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server

  // クライアントが参加しているルームを追跡
  private clientRooms: Map<string, string> = new Map()

  constructor(
    private readonly yjsRoomManager: YjsRoomManager,
    private readonly yjsPersistenceService: YjsPersistenceService
  ) {}

  /**
   * Gateway初期化時に serverSideEmit リスナーを設定
   * 他インスタンスからの Y.Doc 更新を受信して適用
   */
  afterInit(server: Server): void {
    server.on(SERVER_YJS_SYNC_EVENT, (roomId: string, update: string) => {
      const doc = this.yjsRoomManager.getDoc(roomId)
      if (doc) {
        const updateData = Buffer.from(update, 'base64')
        Y.applyUpdate(doc, updateData)
        console.log(`Applied Y.Doc update from other instance for room ${roomId}`)
      }
    })
    console.log('YjsGateway initialized with server-side sync listener')
  }

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`)

    // クライアントが参加していたルームを取得
    const roomId = this.clientRooms.get(client.id)
    if (roomId) {
      this.clientRooms.delete(client.id)

      // ルームに誰もいなくなったらドキュメントをクリーンアップ
      this.checkAndCleanupRoom(roomId)
    }
  }

  /**
   * ルーム参加ハンドラ
   *
   * 1. Socket.ioルームに参加
   * 2. Y.Docを復元（または既存を取得）
   * 3. 現在の状態をクライアントに送信
   */
  @SubscribeMessage('join')
  async handleJoin(client: Socket, params: YjsJoinParams): Promise<void> {
    const { roomId } = params

    // Socket.ioルームに参加
    await client.join(roomId)
    this.clientRooms.set(client.id, roomId)

    try {
      // Y.Docを取得または復元
      const doc = await this.yjsPersistenceService.loadDocument(roomId)

      // 現在の状態をエンコードしてクライアントに送信
      const state = Y.encodeStateAsUpdate(doc)
      const payload: YjsSyncInitPayload = {
        roomId,
        state: Buffer.from(state).toString('base64'),
      }
      client.emit('yjs-sync-init', payload)

      // 他のクライアントに新しいユーザーの参加を通知
      client.to(roomId).emit('userEntered', client.id)
    } catch (error) {
      console.error(`Failed to handle join for room ${roomId}:`, error)
    }
  }

  /**
   * Yjs更新ハンドラ
   *
   * 1. 更新をY.Docに適用
   * 2. 他のクライアントにブロードキャスト
   * 3. 他インスタンスのY.Docに同期（serverSideEmit）
   * 4. DynamoDBに永続化
   */
  @SubscribeMessage('yjs-update')
  async handleYjsUpdate(client: Socket, params: YjsUpdateParams): Promise<void> {
    const { roomId, update } = params

    try {
      // Base64デコード
      const updateData = Buffer.from(update, 'base64')

      // Y.Docに適用
      const doc = this.yjsRoomManager.getDoc(roomId)
      if (doc) {
        Y.applyUpdate(doc, updateData)
      }

      // 他のクライアントにブロードキャスト
      client.to(roomId).emit('yjs-update', params)

      // 他インスタンスのY.Docに同期（Redis経由）
      this.server.serverSideEmit(SERVER_YJS_SYNC_EVENT, roomId, update)

      // DynamoDBに永続化
      await this.yjsPersistenceService.saveUpdate(roomId, updateData)
    } catch (error) {
      console.error(`Failed to handle yjs-update for room ${roomId}:`, error)
    }
  }

  /**
   * ルームに誰もいなくなったらメモリからY.Docを削除
   */
  private checkAndCleanupRoom(roomId: string): void {
    // Socket.ioルームのメンバー数を確認
    const room = this.server.sockets.adapter.rooms.get(roomId)
    if (!room || room.size === 0) {
      // メモリからドキュメントを削除（次回join時にDynamoDB/S3から復元）
      this.yjsRoomManager.deleteDoc(roomId)
      console.log(`Room ${roomId} cleaned up from memory`)
    }
  }
}
