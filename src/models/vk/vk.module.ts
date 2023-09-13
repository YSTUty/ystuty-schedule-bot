import { Global, Module } from '@nestjs/common';
import * as xEnv from '@my-environment';
import * as nestVk from 'nestjs-vk';

import { VKKeyboardFactory } from './vk-keyboard.factory';
import { VkService } from './vk.service';

import { MainMiddleware } from './middleware/main.middleware';
import { MainUpdate } from './update/main.update';
import { ScheduleUpdate } from './update/schedule.update';
import { SelectGroupScene } from './scene/select-group.scene';
import { AuthScene } from './scene/auth.scene';

const middlewares = [MainMiddleware];
const providers = [
  ...middlewares,
  // updates
  MainUpdate,
  ScheduleUpdate,
  AuthScene,
  SelectGroupScene,
];

@Global()
@Module({})
export class VkModule {
  static register() {
    if (!xEnv.SOCIAL_VK_GROUP_TOKEN) {
      return { module: VkModule };
    }

    return {
      module: VkModule,
      imports: [
        nestVk.VkModule.forManagers({
          useSessionManager: false,
          useSceneManager: false,
          useHearManager: false,
        }),
        nestVk.VkModule.forRootAsync({
          inject: [MainMiddleware],
          useFactory: async (mainMiddleware: MainMiddleware) => ({
            token: xEnv.SOCIAL_VK_GROUP_TOKEN,
            options: {
              pollingGroupId: xEnv.SOCIAL_VK_GROUP_ID,
              apiMode: 'sequential',
            },
            // launchOptions: false,
            // notReplyMessage: true,
            middlewaresBefore: [mainMiddleware.middlewaresBefore],
            middlewaresAfter: [mainMiddleware.middlewaresAfter],
          }),
        }),
      ],
      providers: [        VkService,
        VKKeyboardFactory,
        ...providers,

      ],
      exports: [...middlewares, VKKeyboardFactory, VkService],
    };
  }
}
