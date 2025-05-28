import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './user.dto'; // Changed from RegisterUserDto to CreateUserDto
import { User as UserInterface } from './user.interface'; // Aliased import

@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() createUserDto: CreateUserDto, // Changed from RegisterUserDto to CreateUserDto
  ): Promise<
    Omit<
      UserInterface,
      | 'verificationCode' // Removed 'passwordHash'
      | 'verificationExpires'
      | 'role'
      | 'refreshToken'
    >
  > {
    return this.usersService.register(createUserDto);
  }
}
