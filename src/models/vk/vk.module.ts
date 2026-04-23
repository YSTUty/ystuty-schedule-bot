import { Global, Module } from '@nestjs/common';
import * as nestjsVk from 'nestjs-vk';

import * as xEnv from '@my-environment';

import { MainMiddleware } from './middleware/main.middleware';
import { AuthScene } from './scene/auth.scene';
import { SelectGroupScene } from './scene/select-group.scene';
import { MainUpdate } from './update/main.update';
import { ScheduleUpdate } from './update/schedule.update';
import { VKKeyboardFactory } from './vk-keyboard.factory';
import { VkService } from './vk.service';

const baseProviders = [VkService, VKKeyboardFactory];
const middlewares = [MainMiddleware];
const providers = [
  ...middlewares,
  // Приоритет применения слушателей
  MainUpdate,
  ScheduleUpdate,
  AuthScene,
  SelectGroupScene,
];

@Global()
@Module({})
export class VkModule {
  static register() {
    return {
      module: VkModule,
      imports: [
        nestjsVk.VkModule.forManagers({
          useSessionManager: false,
          useSceneManager: false,
          useHearManager: false,
        }),
        nestjsVk.VkModule.forRootAsync({
          inject: [...middlewares],
          useFactory: async (mainMiddleware: MainMiddleware) => ({
            token: xEnv.SOCIAL_VK_GROUP_TOKEN,
            options: {
              pollingGroupId: xEnv.SOCIAL_VK_GROUP_ID!,
              apiMode: 'sequential',
            },
            launchOptions: false,
            // notReplyMessage: true,
            middlewaresBefore: [mainMiddleware.middlewaresBefore],
            middlewaresAfter: [mainMiddleware.middlewaresAfter],
          }),
        }),
      ],
      providers: [...baseProviders, ...providers],
      exports: [...baseProviders, ...middlewares],
    };
  }
}
