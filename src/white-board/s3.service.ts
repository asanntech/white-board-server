import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, S3ClientConfig } from '@aws-sdk/client-s3'
import { YjsSnapshotData } from './yjs/yjs.types'

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
   * スナップショットをS3に保存
   * @param roomId ルームID
   * @param data スナップショットデータ
   */
  async saveYjsSnapshot(roomId: string, data: YjsSnapshotData): Promise<void> {
    const key = `${roomId}/${data.timestamp}.json`

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
        Metadata: {
          roomId,
          timestamp: data.timestamp,
        },
      })
    )

    console.log(`Snapshot saved to S3: ${key}`)
  }

  /**
   * S3から最新のスナップショットを取得
   * @param roomId ルームID
   * @returns スナップショットデータ（存在しない場合はnull）
   */
  async getLatestYjsSnapshot(roomId: string): Promise<YjsSnapshotData | null> {
    try {
      const listResponse = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: `${roomId}/`,
          MaxKeys: 100,
        })
      )

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return null
      }

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

      const bodyString = await getResponse.Body?.transformToString()
      if (!bodyString) return null

      const parsedData: unknown = JSON.parse(bodyString)

      if (!this.isValidYjsSnapshotData(parsedData)) {
        console.error(`Invalid snapshot data structure for ${latestObject.Key}`)
        return null
      }

      return parsedData
    } catch (error) {
      console.error(`Failed to get latest snapshot for room ${roomId}:`, error)
      return null
    }
  }

  /**
   * スナップショットデータの型ガード
   */
  private isValidYjsSnapshotData(data: unknown): data is YjsSnapshotData {
    if (typeof data !== 'object' || data === null) {
      return false
    }

    const snapshot = data as Record<string, unknown>

    return (
      typeof snapshot.roomId === 'string' &&
      typeof snapshot.timestamp === 'string' &&
      typeof snapshot.fullState === 'string'
    )
  }
}
