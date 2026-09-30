import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { OWNER_ID } from './owner';

/**
 * POST /auth/login: checks the password against the bcrypt hash in
 * AUTH_PASSWORD_HASH and returns a 7-day JWT. Rate-limited per IP.
 */
@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  async login(@Body() { password }: LoginDto) {
    const valid = await bcrypt.compare(
      password,
      process.env.AUTH_PASSWORD_HASH ?? '',
    );

    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    const token = await this.jwtService.signAsync({ sub: OWNER_ID });
    return { token };
  }
}
