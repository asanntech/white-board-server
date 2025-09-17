import { Test, TestingModule } from '@nestjs/testing'
import { RoomService } from './room.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRoomDto } from './room.dto'

describe('RoomService', () => {
  let service: RoomService
  // let prismaService: PrismaService

  const mockPrismaService = {
    room: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    service = module.get<RoomService>(RoomService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createRoom', () => {
    it('should create a room successfully', async () => {
      const createRoomDto: CreateRoomDto = {
        name: 'Test Room',
        createdBy: 'user123',
      }

      const mockRoom = {
        id: 'room-uuid',
        name: 'Test Room',
        createdBy: 'user123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.room.create.mockResolvedValue(mockRoom)

      const result = await service.create(createRoomDto)

      expect(mockPrismaService.room.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Room',
          createdBy: 'user123',
        },
      })
      expect(result).toEqual(mockRoom)
    })

    it('should handle database errors', async () => {
      const createRoomDto: CreateRoomDto = {
        name: 'Test Room',
        createdBy: 'user123',
      }

      const error = new Error('Database connection failed')
      mockPrismaService.room.create.mockRejectedValue(error)

      await expect(service.create(createRoomDto)).rejects.toThrow('Database connection failed')
      expect(mockPrismaService.room.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Room',
          createdBy: 'user123',
        },
      })
    })

    it('should create room with empty name', async () => {
      const createRoomDto: CreateRoomDto = {
        name: '',
        createdBy: 'user123',
      }

      const mockRoom = {
        id: 'room-uuid',
        name: '',
        createdBy: 'user123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.room.create.mockResolvedValue(mockRoom)

      const result = await service.create(createRoomDto)

      expect(mockPrismaService.room.create).toHaveBeenCalledWith({
        data: {
          name: '',
          createdBy: 'user123',
        },
      })
      expect(result).toEqual(mockRoom)
    })
  })
})
