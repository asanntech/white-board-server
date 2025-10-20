import { Controller, Post, Body, HttpStatus, HttpCode, Get, Param, NotFoundException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiOkResponse } from '@nestjs/swagger'
import { RoomService } from './room.service'
import { CreateRoomDto, GetRoomCreatorResponseDto } from './room.dto'

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
    const room = await this.roomService.create(createRoomDto)
    return {
      success: true,
      data: room,
      message: 'Room created successfully',
    }
  }

  @Get(':id/creator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get creator userId of a room' })
  @ApiOkResponse({ type: GetRoomCreatorResponseDto })
  @ApiResponse({ status: 200, description: 'Creator fetched successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getRoomCreator(@Param('id') roomId: string): Promise<GetRoomCreatorResponseDto> {
    const room = await this.roomService.findById(roomId)
    if (!room) throw new NotFoundException('Room not found')

    return {
      createdBy: room.createdBy,
    }
  }
}
