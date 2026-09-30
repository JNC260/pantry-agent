import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { OWNER_ID } from './owner';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Post('login')
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
