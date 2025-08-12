import { ApiProperty } from '@nestjs/swagger'
import * as jwt from 'jsonwebtoken'

export class AuthVerifyRequestDto {
  @ApiProperty({ description: 'IDトークン', example: 'eyJraWQiOiExample...IDToken' })
  idToken: string
}

export class AuthVerifyResponseDto {
  constructor(payload: jwt.JwtPayload) {
    this.sub = payload.sub as string
    this.exp = payload.exp as number
    this.iat = payload.iat as number
  }

  @ApiProperty({ description: 'ユーザーID', example: 'abc123' })
  sub: string

  @ApiProperty({ description: '有効期限', example: 1717987200 })
  exp: number

  @ApiProperty({ description: '作成日時', example: 1717987200 })
  iat: number
}
