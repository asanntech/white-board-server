import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { RoomService } from './room.service'
import { CreateRoomDto } from './room.dto'

@ApiTags('rooms')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({
    status: 201,
    description: 'Room created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
  })
  async createRoom(@Body() createRoomDto: CreateRoomDto) {
    const room = await this.roomService.createRoom(createRoomDto)
    return {
      success: true,
      data: room,
      message: 'Room created successfully',
    }
  }
}
