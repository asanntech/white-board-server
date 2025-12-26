import { createClient, RedisClientType } from 'redis'
import * as Y from 'yjs'

let redisClient: RedisClientType | null = null
let redisSub: RedisClientType | null = null

export async function initYRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  redisClient = createClient({ url: redisUrl })
  redisSub = redisClient.duplicate()

  redisClient.on('error', (err) => console.error('Redis Client Error:', err))
  redisSub.on('error', (err) => console.error('Redis Subscriber Error:', err))

  await redisClient.connect()
  await redisSub.connect()

  console.log('Redis connected for Y.Doc sync')
}

export async function bindDocToRedis(doc: Y.Doc, roomId: string): Promise<void> {
  if (!redisClient || !redisSub) {
    console.warn('Redis not initialized, skipping doc binding')
    return
  }

  const channel = `yjs:${roomId}`

  // 他インスタンスからの更新を購読
  await redisSub.subscribe(channel, (message) => {
    try {
      const update = Buffer.from(message, 'base64')
      Y.applyUpdate(doc, update, 'redis')
    } catch (error) {
      console.error(`Failed to apply Redis update for room ${roomId}:`, error)
    }
  })

  // ローカル更新を他インスタンスに配信
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    // Redis 経由で受信した更新は再配信しない
    if (origin === 'redis') return

    const encoded = Buffer.from(update).toString('base64')
    redisClient?.publish(channel, encoded).catch((error) => {
      console.error(`Failed to publish update for room ${roomId}:`, error)
    })
  })

  console.log(`Y.Doc bound to Redis channel: ${channel}`)
}

export async function destroyYRedis(): Promise<void> {
  if (redisSub) {
    await redisSub.quit()
    redisSub = null
  }
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
  console.log('Redis connections closed')
}
