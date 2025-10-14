import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { SwaggerModule } from '@nestjs/swagger'
import { documentConfig, operationIdFactory } from '../generate-openapi'
import { writeFileSync } from 'fs'

async function main() {
  const app = await NestFactory.create(AppModule)
  const document = SwaggerModule.createDocument(app, documentConfig, { operationIdFactory })
  writeFileSync('./open-api.json', JSON.stringify(document, null, 2))
  await app.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
