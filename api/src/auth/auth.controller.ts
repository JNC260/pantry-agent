import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Post('login')
  async login(@Body('password') password: string) {
    console.log('hash from env:', process.env.AUTH_PASSWORD);
    const valid = await bcrypt.compare(
      password ?? '',
      process.env.AUTH_PASSWORD ?? '',
    );

    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    const token = await this.jwtService.signAsync({ sub: 'owner' });
    return { token };
  }
}
