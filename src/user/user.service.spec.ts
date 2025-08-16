import { Test, TestingModule } from '@nestjs/testing'
import { UserService } from './user.service'
import { PrismaService } from '@/prisma/prisma.service'

describe('UsersService', () => {
  let service: UserService

  const mockUser = {
    id: 'abc123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
  }

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  }

  const mockUserService = {
    create: jest.fn(),
    findById: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserData = {
        id: 'abc123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      }

      mockUserService.create.mockResolvedValue(mockUser)

      const result = await service.create(createUserData)

      expect(mockUserService.create).toHaveBeenCalledWith(createUserData)
      expect(result).toEqual(mockUser)
    })

    it('should throw an error when user creation fails', async () => {
      const createUserData = {
        id: 'abc123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      }

      const error = new Error('Database connection failed')
      mockUserService.create.mockRejectedValue(error)

      await expect(service.create(createUserData)).rejects.toThrow('Database connection failed')
      expect(mockUserService.create).toHaveBeenCalledWith(createUserData)
    })
  })

  describe('findById', () => {
    it('should find a user by id successfully', async () => {
      const userId = 'abc123'
      mockUserService.findById.mockResolvedValue(mockUser)

      const result = await service.findById(userId)

      expect(mockUserService.findById).toHaveBeenCalledWith(userId)
      expect(result).toEqual(mockUser)
    })

    it('should return null when user is not found', async () => {
      const userId = 'abc123'
      mockUserService.findById.mockResolvedValue(null)

      const result = await service.findById(userId)

      expect(mockUserService.findById).toHaveBeenCalledWith(userId)
      expect(result).toBeNull()
    })

    it('should throw an error when database query fails', async () => {
      const userId = 'abc123'
      const error = new Error('Database query failed')
      mockUserService.findById.mockRejectedValue(error)

      await expect(service.findById(userId)).rejects.toThrow('Database query failed')
      expect(mockUserService.findById).toHaveBeenCalledWith(userId)
    })
  })
})
