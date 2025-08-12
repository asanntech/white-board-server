import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { writeFileSync } from 'fs'

export const documentConfig = new DocumentBuilder()
  .setTitle('API')
  .setDescription('APIドキュメント')
  .setVersion('1.0')
  .build()

export const operationIdFactory = (_, methodKey: string) => {
  return methodKey
}

async function generateOpenAPISchema() {
  const app = await NestFactory.create(AppModule)

  const document = SwaggerModule.createDocument(app, documentConfig, {
    operationIdFactory,
  })

  writeFileSync('./open-api.json', JSON.stringify(document, null, 2))
  await app.close()
}

generateOpenAPISchema()
