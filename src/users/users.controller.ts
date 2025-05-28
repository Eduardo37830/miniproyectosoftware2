import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, VerifyEmailDto } from './user.dto'; // Changed from RegisterUserDto to CreateUserDto
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

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailData: VerifyEmailDto){    
    const { email, code } = verifyEmailData;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('User already verified');
    }

    if (user.verificationCode !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      throw new UnauthorizedException('Verification code has expired');
    }

    return this.usersService.verifyUser(user.id);
  }
}
