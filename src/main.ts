import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { documentConfig, operationIdFactory } from './generate-openapi'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
bootstrap()
