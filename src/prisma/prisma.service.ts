import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL ?? PrismaService.composeUrlFromParts()
    super(url ? { datasources: { db: { url } } } : undefined)
  }

  private static composeUrlFromParts(): string | undefined {
    const host = process.env.DB_HOST
    const port = process.env.DB_PORT ?? '5432'
    const db = process.env.DB_NAME
    const user = process.env.DB_USER
    const password = process.env.DB_PASSWORD

    if (!host || !db || !user || !password) return undefined

    const encUser = encodeURIComponent(user)
    const encPass = encodeURIComponent(password)
    return `postgresql://${encUser}:${encPass}@${host}:${port}/${db}?schema=public`
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
