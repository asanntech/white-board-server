import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { documentConfig, operationIdFactory } from './generate-openapi'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  app.enableCors({
    origin: corsOrigins,
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
