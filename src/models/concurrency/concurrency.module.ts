import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';

import { ConcurrencyService } from './concurrency.service';
import { DebounceRegistryService } from './debounce-registry.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [ConcurrencyService, DebounceRegistryService],
  exports: [ConcurrencyService, DebounceRegistryService],
})
export class ConcurrencyModule {}
