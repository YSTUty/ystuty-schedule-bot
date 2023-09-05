import { Injectable, Logger } from '@nestjs/common';
import { IMessageContext } from '@my-interfaces/vk';

import { YSTUtyService } from '../ystuty/ystuty.service';

@Injectable()
export class VkService {
  private readonly logger = new Logger(VkService.name);

  constructor(public readonly ystutyService: YSTUtyService) {}

  public parseChatTitle(ctx: IMessageContext, str: string) {
    const groupName = this.ystutyService.parseGroupName(str);
    if (groupName) {
      ctx.sessionConversation.selectedGroupName = groupName;
      this.logger.log(`Group name automation selected: "${groupName}"`);
      ctx.send(`Group name automation selected: ${groupName}`);
      return true;
    } else {
      this.logger.log(`Group name not found from "${str}"`);
    }
    return false;
  }
}
