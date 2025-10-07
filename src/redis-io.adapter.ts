import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import type { Server, ServerOptions } from 'socket.io'

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>
  private pubClient?: Redis
  private subClient?: Redis

  connectToRedis(redisUrl: string) {
    this.pubClient = new Redis(redisUrl)
    this.subClient = this.pubClient.duplicate()
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient)
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as unknown as Server
    if (!this.adapterConstructor) {
      return server
    }
    server.adapter(this.adapterConstructor)
    return server
  }
}
