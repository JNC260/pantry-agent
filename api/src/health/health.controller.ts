import { Controller, Get } from '@nestjs/common';

// Unauthenticated liveness check for the deploy platform and uptime monitors.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}
