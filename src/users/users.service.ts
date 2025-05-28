import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User as UserInterface } from './user.interface';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
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
      throw new InternalServerErrorException('Error saving user to database');
    }

    console.log(
      `Sending verification email to ${email} with code: ${verificationCode}`,
    );

    return {
      _id: (savedUser._id as unknown as { toString(): string }).toString(),
      name: savedUser.name,
      email: savedUser.email,
      isVerified: savedUser.isVerified,
    };
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      throw new ConflictException('Invalid email or password');
    } else if (!user.isVerified) {
      throw new ConflictException('Email not verified');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ConflictException('Invalid email or password');
    }

    const payload = {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    return { accessToken };
  }

  verifyUser(id: string) {
    return this.userModel.findByIdAndUpdate(id, {
      isVerified: true,
      verificationCode: null,
      verificationExpires: null,
    }).exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }
}
