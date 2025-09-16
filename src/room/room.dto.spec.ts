/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { validate } from 'class-validator'
import { CreateRoomDto } from './room.dto'

describe('CreateRoomDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new CreateRoomDto()
      dto.name = 'Test Room'
      dto.createdBy = 'user123'

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should fail validation when name is empty', async () => {
      const dto = new CreateRoomDto()
      dto.name = ''
      dto.createdBy = 'user123'

      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('name')
      expect(errors[0].constraints).toHaveProperty('isNotEmpty')
    })

    it('should fail validation when name is not provided', async () => {
      const dto = new CreateRoomDto()
      dto.createdBy = 'user123'

      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('name')
      expect(errors[0].constraints).toHaveProperty('isNotEmpty')
    })

    it('should fail validation when name is not a string', async () => {
      const dto = new CreateRoomDto()
      dto.name = 123 as any
      dto.createdBy = 'user123'

      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('name')
      expect(errors[0].constraints).toHaveProperty('isString')
    })

    it('should fail validation when createdBy is empty', async () => {
      const dto = new CreateRoomDto()
      dto.name = 'Test Room'
      dto.createdBy = ''

      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('createdBy')
      expect(errors[0].constraints).toHaveProperty('isNotEmpty')
    })

    it('should fail validation when createdBy is not provided', async () => {
      const dto = new CreateRoomDto()
      dto.name = 'Test Room'

      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('createdBy')
      expect(errors[0].constraints).toHaveProperty('isNotEmpty')
    })

    it('should fail validation when createdBy is not a string', async () => {
      const dto = new CreateRoomDto()
      dto.name = 'Test Room'
      dto.createdBy = 123 as any

      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('createdBy')
      expect(errors[0].constraints).toHaveProperty('isString')
    })

    it('should fail validation when both fields are invalid', async () => {
      const dto = new CreateRoomDto()
      dto.name = 123 as any
      dto.createdBy = 456 as any

      const errors = await validate(dto)
      expect(errors).toHaveLength(2)

      const nameError = errors.find((error) => error.property === 'name')
      const createdByError = errors.find((error) => error.property === 'createdBy')

      expect(nameError?.constraints).toHaveProperty('isString')
      expect(createdByError?.constraints).toHaveProperty('isString')
    })

    it('should pass validation with whitespace-only strings', async () => {
      const dto = new CreateRoomDto()
      dto.name = '   '
      dto.createdBy = '   '

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should pass validation with special characters', async () => {
      const dto = new CreateRoomDto()
      dto.name = 'Room with 特殊文字 & symbols!'
      dto.createdBy = 'user@example.com'

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })
  })
})
