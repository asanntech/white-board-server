import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { documentConfig, operationIdFactory } from './generate-openapi'
import { RedisIoAdapter } from './redis-io.adapter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const redisAdapter = new RedisIoAdapter(app)
  redisAdapter.connectToRedis(redisUrl)
  app.useWebSocketAdapter(redisAdapter)

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  })

  const document = SwaggerModule.createDocument(app, documentConfig, {
    operationIdFactory,
  })

  SwaggerModule.setup('api', app, document)

  await app.listen(process.env.PORT ?? 4000)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap()
