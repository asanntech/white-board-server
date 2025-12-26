import { AuthService } from './auth.service'
import * as jwt from 'jsonwebtoken'
import { UserService } from '@/user/user.service'
import { PrismaService } from '@/prisma/prisma.service'
import { RoomService } from '@/room/room.service'
import { verifyToken } from '../shared/jwt-verifier'

jest.mock('../shared/jwt-verifier')

describe('AuthService', () => {
  let service: AuthService
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>

  beforeEach(() => {
    service = new AuthService(new UserService(new PrismaService()), new RoomService(new PrismaService()))
    jest.clearAllMocks()
  })

  describe('extractToken', () => {
    it('should extract token from Authorization header', () => {
      const mockRequest: any = {
        headers: { authorization: 'Bearer abc.def.ghi' },
      }

      const token = service.extractToken(mockRequest)
      expect(token).toBe('abc.def.ghi')
    })

    it('should return null if Authorization header is missing or invalid', () => {
      expect(service.extractToken({ headers: {} } as any)).toBeNull()
      expect(service.extractToken({ headers: { authorization: 'Basic xxxxx' } } as any)).toBeNull()
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const mockToken = 'abc.def.ghi'
      const mockPayload = { sub: 'user123', email: 'user@example.com' } as jwt.JwtPayload

      mockVerifyToken.mockResolvedValue(mockPayload)

      const payload = await service.verifyToken(mockToken)

      expect(mockVerifyToken).toHaveBeenCalledWith(mockToken)
      expect(payload).toEqual(mockPayload)
    })

    it('should throw BadRequestException if token is invalid format', async () => {
      const error = new Error('ERR_INVALID_TOKEN_FORMAT')
      mockVerifyToken.mockRejectedValue(error)

      await expect(service.verifyToken('invalid.token')).rejects.toThrow('Invalid token format')
    })

    it('should throw UnauthorizedException if token verification fails', async () => {
      const error = new Error('ERR_TOKEN_VERIFICATION_FAILED')
      mockVerifyToken.mockRejectedValue(error)

      await expect(service.verifyToken('invalid.token')).rejects.toThrow('Token verification failed')
    })

    it('should throw UnauthorizedException if unexpected JWT payload type', async () => {
      const error = new Error('ERR_UNEXPECTED_JWT_PAYLOAD')
      mockVerifyToken.mockRejectedValue(error)

      await expect(service.verifyToken('invalid.token')).rejects.toThrow('Unexpected JWT payload type')
    })
  })
})
