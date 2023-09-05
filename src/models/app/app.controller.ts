import { Controller, Get } from '@nestjs/common';
@Controller()
export class AppController {
  public readonly timeStart = Date.now();

  @Get('uptime')
  getTime() {
    return { uptime: Date.now() - this.timeStart };
  }
}
