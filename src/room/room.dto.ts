import { IsString, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name',
    example: 'My Whiteboard Room',
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description: 'User ID who creates the room',
    example: 'user123',
  })
  @IsString()
  @IsNotEmpty()
  createdBy: string
}

export class GetRoomCreatorResponseDto {
  @ApiProperty({
    description: 'User ID who created the room',
    example: 'user123',
  })
  @IsString()
  @IsNotEmpty()
  createdBy: string
}
