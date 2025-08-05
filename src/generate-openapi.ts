import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { writeFileSync } from 'fs'

async function generateOpenAPISchema() {
  const app = await NestFactory.create(AppModule)
  const config = new DocumentBuilder().setTitle('API').setDescription('APIドキュメント').setVersion('1.0').build()
  const document = SwaggerModule.createDocument(app, config)

  writeFileSync('./open-api.json', JSON.stringify(document, null, 2))
  await app.close()
}

generateOpenAPISchema()
