import { Injectable } from '@nestjs/common';

import { YSTUtyService } from '../ystuty/ystuty.service';

@Injectable()
export class VkService {
    constructor(public readonly ystutyService: YSTUtyService) {}
}
