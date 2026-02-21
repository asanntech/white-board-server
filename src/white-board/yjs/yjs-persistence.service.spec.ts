// uuidパッケージのESM問題を回避するため、最初にモック
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}))

import * as Y from 'yjs'
import { YjsPersistenceService } from './yjs-persistence.service'

describe('YjsPersistenceService', () => {
  let service: YjsPersistenceService
  let mockYjsRoomManager: any
  let mockDynamoDBService: any
  let mockS3Service: any

  beforeEach(() => {
    mockYjsRoomManager = {
      getDoc: jest.fn(),
      getOrCreateDoc: jest.fn(),
      setDoc: jest.fn(),
      deleteDoc: jest.fn(),
      hasDoc: jest.fn(),
      getAllRoomIds: jest.fn(),
    }

    mockDynamoDBService = {
      saveYjsUpdate: jest.fn(),
      getYjsUpdates: jest.fn(),
      getYjsUpdatesStats: jest.fn(),
      deleteYjsUpdates: jest.fn(),
    }

    mockS3Service = {
      saveYjsSnapshot: jest.fn(),
      getLatestYjsSnapshot: jest.fn(),
    }

    service = new YjsPersistenceService(mockYjsRoomManager, mockDynamoDBService, mockS3Service)
  })

  describe('saveUpdate', () => {
    const roomId = 'test-room-id'
    const update = new Uint8Array([1, 2, 3])

    it('DynamoDBに更新を保存する', async () => {
      mockDynamoDBService.getYjsUpdatesStats.mockResolvedValue({ count: 10, totalSize: 1000 })

      await service.saveUpdate(roomId, update)

      expect(mockDynamoDBService.saveYjsUpdate).toHaveBeenCalledWith(roomId, update)
    })

    it('閾値を超えた場合スナップショットを作成する（件数）', async () => {
      const doc = new Y.Doc()
      mockDynamoDBService.getYjsUpdatesStats.mockResolvedValue({ count: 100, totalSize: 1000 })
      mockYjsRoomManager.getDoc.mockReturnValue(doc)

      await service.saveUpdate(roomId, update)

      expect(mockS3Service.saveYjsSnapshot).toHaveBeenCalled()
      expect(mockDynamoDBService.deleteYjsUpdates).toHaveBeenCalledWith(roomId)
    })

    it('閾値を超えた場合スナップショットを作成する（サイズ）', async () => {
      const doc = new Y.Doc()
      mockDynamoDBService.getYjsUpdatesStats.mockResolvedValue({ count: 10, totalSize: 1024 * 1024 })
      mockYjsRoomManager.getDoc.mockReturnValue(doc)

      await service.saveUpdate(roomId, update)

      expect(mockS3Service.saveYjsSnapshot).toHaveBeenCalled()
      expect(mockDynamoDBService.deleteYjsUpdates).toHaveBeenCalledWith(roomId)
    })

    it('閾値未満の場合スナップショットを作成しない', async () => {
      mockDynamoDBService.getYjsUpdatesStats.mockResolvedValue({ count: 50, totalSize: 500 })

      await service.saveUpdate(roomId, update)

      expect(mockS3Service.saveYjsSnapshot).not.toHaveBeenCalled()
    })
  })

  describe('loadDocument', () => {
    const roomId = 'test-room-id'

    it('メモリ上にドキュメントがあればそれを返す', async () => {
      const existingDoc = new Y.Doc()
      mockYjsRoomManager.getDoc.mockReturnValue(existingDoc)

      const result = await service.loadDocument(roomId)

      expect(result).toBe(existingDoc)
      expect(mockS3Service.getLatestYjsSnapshot).not.toHaveBeenCalled()
    })

    it('メモリ上にない場合、新規ドキュメントを作成して返す', async () => {
      const newDoc = new Y.Doc()
      mockYjsRoomManager.getDoc.mockReturnValue(undefined)
      mockYjsRoomManager.getOrCreateDoc.mockReturnValue(newDoc)
      mockS3Service.getLatestYjsSnapshot.mockResolvedValue(null)
      mockDynamoDBService.getYjsUpdates.mockResolvedValue([])

      const result = await service.loadDocument(roomId)

      expect(result).toBe(newDoc)
      expect(mockYjsRoomManager.getOrCreateDoc).toHaveBeenCalledWith(roomId)
    })

    it('S3スナップショットがあれば適用する', async () => {
      const newDoc = new Y.Doc()
      const snapshotDoc = new Y.Doc()
      snapshotDoc.getMap('test').set('key', 'value')
      const snapshotState = Y.encodeStateAsUpdate(snapshotDoc)
      const snapshotBase64 = Buffer.from(snapshotState).toString('base64')

      mockYjsRoomManager.getDoc.mockReturnValue(undefined)
      mockYjsRoomManager.getOrCreateDoc.mockReturnValue(newDoc)
      mockS3Service.getLatestYjsSnapshot.mockResolvedValue({
        roomId,
        timestamp: new Date().toISOString(),
        fullState: snapshotBase64,
      })
      mockDynamoDBService.getYjsUpdates.mockResolvedValue([])

      const result = await service.loadDocument(roomId)

      expect(result.getMap('test').get('key')).toBe('value')
    })

    it('DynamoDBの更新があれば適用する', async () => {
      const newDoc = new Y.Doc()
      const updateDoc = new Y.Doc()
      updateDoc.getMap('test').set('dynamoKey', 'dynamoValue')
      const updateData = Y.encodeStateAsUpdate(updateDoc)

      mockYjsRoomManager.getDoc.mockReturnValue(undefined)
      mockYjsRoomManager.getOrCreateDoc.mockReturnValue(newDoc)
      mockS3Service.getLatestYjsSnapshot.mockResolvedValue(null)
      mockDynamoDBService.getYjsUpdates.mockResolvedValue([
        { room_id: roomId, created_at: '2024-01-01T00:00:00.000Z', update_data: updateData },
      ])

      const result = await service.loadDocument(roomId)

      expect(result.getMap('test').get('dynamoKey')).toBe('dynamoValue')
    })

    it('復元エラーが発生してもドキュメントを返す', async () => {
      const newDoc = new Y.Doc()
      mockYjsRoomManager.getDoc.mockReturnValue(undefined)
      mockYjsRoomManager.getOrCreateDoc.mockReturnValue(newDoc)
      mockS3Service.getLatestYjsSnapshot.mockRejectedValue(new Error('S3 error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await service.loadDocument(roomId)

      expect(result).toBe(newDoc)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('createSnapshot', () => {
    const roomId = 'test-room-id'

    it('ドキュメントが存在しない場合は何もしない', async () => {
      mockYjsRoomManager.getDoc.mockReturnValue(undefined)

      await service.createSnapshot(roomId)

      expect(mockS3Service.saveYjsSnapshot).not.toHaveBeenCalled()
    })

    it('S3にスナップショットを保存しDynamoDBから削除する', async () => {
      const doc = new Y.Doc()
      doc.getMap('test').set('key', 'value')
      mockYjsRoomManager.getDoc.mockReturnValue(doc)

      await service.createSnapshot(roomId)

      expect(mockS3Service.saveYjsSnapshot).toHaveBeenCalledWith(
        roomId,
        expect.objectContaining({
          roomId,
          fullState: expect.any(String),
          timestamp: expect.any(String),
        })
      )
      expect(mockDynamoDBService.deleteYjsUpdates).toHaveBeenCalledWith(roomId)
    })

    it('エラーが発生してもクラッシュしない', async () => {
      const doc = new Y.Doc()
      mockYjsRoomManager.getDoc.mockReturnValue(doc)
      mockS3Service.saveYjsSnapshot.mockRejectedValue(new Error('S3 error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(service.createSnapshot(roomId)).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
