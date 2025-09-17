import { ApiProperty } from '@nestjs/swagger'
import * as jwt from 'jsonwebtoken'

export class AuthVerifyRequestDto {
  @ApiProperty({ description: 'IDトークン', example: 'eyJraWQiOiExample...IDToken' })
  idToken: string
}

export class AuthVerifyResponseDto {
  constructor(payload: jwt.JwtPayload) {
    this.userId = payload.sub as string
    this.roomId = payload.room_id as string
    this.lastName = payload.family_name as string
    this.firstName = payload.given_name as string
    this.email = payload.email as string
    this.exp = payload.exp as number
    this.iat = payload.iat as number
  }

  @ApiProperty({ description: 'ユーザーID', example: 'abc123' })
  userId: string

  @ApiProperty({ description: 'ルームID', example: 'abc123' })
  roomId: string

  @ApiProperty({ description: '姓', example: '山田' })
  lastName: string

  @ApiProperty({ description: '名', example: '太郎' })
  firstName: string

  @ApiProperty({ description: 'メールアドレス', example: 'yamada.taro@example.com' })
  email: string

  @ApiProperty({ description: '有効期限', example: 1717987200 })
  exp: number

  @ApiProperty({ description: '作成日時', example: 1717987200 })
  iat: number
}
