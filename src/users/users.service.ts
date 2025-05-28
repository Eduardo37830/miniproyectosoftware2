import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User as UserInterface } from './user.interface';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './user.dto';
import { EmailService } from '../email/email.service'; // Import EmailService

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService, // Inject EmailService
  ) {}

  async register(
    createUserDto: CreateUserDto,
  ): Promise<
    Omit<
      UserInterface,
      'verificationCode' | 'verificationExpires' | 'role' | 'refreshToken'
    >
  > {
    const { name, email, password } = createUserDto;

    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const verificationExpires = new Date();
    verificationExpires.setMinutes(verificationExpires.getMinutes() + 5);

    const newUser = new this.userModel({
      name,
      email,
      passwordHash: hashedPassword,
      isVerified: false,
      verificationCode,
      verificationExpires,
    });

    let savedUser: UserDocument;
    try {
      savedUser = await newUser.save();
    } catch (error) {
      console.error('Error saving user:', error);
      throw new InternalServerErrorException('Error saving user to database');
    }

    try {
      await this.emailService.sendVerificationEmail(email, verificationCode);
    } catch (error) {
      // Log the error, but don't necessarily block user registration if email fails.
      // You might want a more sophisticated retry mechanism or a way to flag users whose email failed.
      console.error(
        'Failed to send verification email during registration:',
        error,
      );
    }

    return {
      _id: savedUser.id.toString() as string, // Ensure _id is string
      name: savedUser.name,
      email: savedUser.email,
      isVerified: savedUser.isVerified,
      // Timestamps are not explicitly in UserInterface but are good to return
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt,
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .exec(); // Ensure passwordHash is selected

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isVerified) {
      throw new BadRequestException(
        'Account not verified. Please check your email for a verification code.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id.toString() as string, // Use _id from user document
      email: user.email,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'), // Corrected to JWT_SECRET from .env
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION'),
    });

    return { accessToken };
  }

  async verifyUser(
    id: string,
  ): Promise<
    Omit<
      UserInterface,
      | 'verificationCode'
      | 'verificationExpires'
      | 'role'
      | 'refreshToken'
      | 'passwordHash'
    >
  > {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    const savedUser = await user.save();
    return {
      _id: savedUser.id.toString() as string,
      name: savedUser.name,
      email: savedUser.email,
      isVerified: savedUser.isVerified,
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt,
    };
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }
}
