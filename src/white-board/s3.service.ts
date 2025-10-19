import { Injectable } from '@nestjs/common'
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3'
import { DrawingRecord } from './drawing.types'

export interface SnapshotData {
  roomId: string
  timestamp: string
  drawingsCount: number
  drawings: DrawingRecord[]
}

export interface SnapshotWithKey extends SnapshotData {
  s3Key: string
}

@Injectable()
export class S3Service {
  private readonly client: S3Client
  private readonly bucketName: string

  constructor() {
    const config: S3ClientConfig = {
      region: process.env.AWS_REGION,
      endpoint: process.env.AWS_S3_ENDPOINT ?? undefined,
    }

    // 本番（ECS等）はIAMロールに委譲。ローカルでのみ静的キーが揃っていれば使用する
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    }

    this.client = new S3Client(config)
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'white-board-snapshots-dev'
  }

  /**
   * S3にスナップショットを保存
   * @param roomId ルームID
   * @param drawings 描画データの配列
   * @returns S3のキー
   */
  async saveSnapshot(roomId: string, drawingRecords: DrawingRecord[]): Promise<void> {
    const timestamp = new Date().toISOString()
    const key = `${roomId}/${timestamp}.json`

    const snapshotData = {
      roomId,
      timestamp,
      drawingsCount: drawingRecords.length,
      drawings: drawingRecords,
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(snapshotData, null, 2),
        ContentType: 'application/json',
        Metadata: {
          roomId,
          timestamp,
          drawingsCount: drawingRecords.length.toString(),
        },
      })
    )

    console.log(`Snapshot saved to S3: ${key}`)
  }

  /**
   * S3から対象room_idの最新スナップショットを取得
   * @param roomId ルームID
   * @returns スナップショットデータ
   */
  async getLatestSnapshot(roomId: string): Promise<DrawingRecord[]> {
    try {
      const listResponse = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: `${roomId}/`,
          MaxKeys: 100,
        })
      )

      // オブジェクトが存在しない場合
      if (!listResponse.Contents || listResponse.Contents.length === 0) return []

      // 最新のオブジェクトを取得
      const latestObject = listResponse.Contents.reduce((max, current) => {
        if (!max.LastModified || !current.LastModified) return max
        return new Date(max.LastModified).getTime() > new Date(current.LastModified).getTime() ? max : current
      }, listResponse.Contents[0])

      const getResponse = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: latestObject.Key,
        })
      )

      // ストリームをテキストに変換
      const bodyString = await getResponse.Body?.transformToString()
      if (!bodyString) return []

      // JSONをパース
      const parsedData: unknown = JSON.parse(bodyString)

      // 型検証
      if (!this.isValidSnapshotData(parsedData)) {
        console.error(`Invalid snapshot data structure for ${latestObject.Key}`)
        return []
      }

      return parsedData.drawings
    } catch (error) {
      console.error(`Failed to get latest snapshot for room ${roomId}:`, error)
      throw error
    }
  }

  /**
   * スナップショットデータの型ガード
   */
  private isValidSnapshotData(data: unknown): data is SnapshotData {
    if (typeof data !== 'object' || data === null) {
      return false
    }

    const snapshot = data as Record<string, unknown>

    return (
      typeof snapshot.roomId === 'string' &&
      typeof snapshot.timestamp === 'string' &&
      typeof snapshot.drawingsCount === 'number' &&
      Array.isArray(snapshot.drawings)
    )
  }
}
