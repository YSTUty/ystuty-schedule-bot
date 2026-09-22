import { Global, Module } from '@nestjs/common';
import * as nestjsVk from 'nestjs-vk';

import * as xEnv from '@my-environment';

import { MainMiddleware } from './middleware/main.middleware';
import { VkBroadcasterModule } from './model/broadcaster/vk-broadcaster.module';
import { VkGroupPicker } from './model/group-selection/vk-group-picker';
import { VkGroupSelectionKeyboardFactory } from './model/group-selection/vk-group-selection-keyboard.factory';
import { VkGroupSelectionUpdate } from './model/group-selection/vk-group-selection.update';
import { VkSelectGroupScene } from './model/group-selection/vk-select-group.scene';
import { VkScheduleNotifModule } from './model/schedule-notif/vk-schedule-notif.module';
import { VkScheduleKeyboardFactory } from './model/schedule/vk-schedule-keyboard.factory';
import { VkScheduleUpdate } from './model/schedule/vk-schedule.update';
import { AuthScene } from './scene/auth.scene';
import { VkFeedbackScene } from './scene/feedback.scene';
import { VkFeedbackKeyboardFactory } from './scene/vk-feedback-keyboard.factory';
import { VkFeedbackUpdate } from './update/feedback.update';
import { MainUpdate } from './update/main.update';
import { VkFeedbackDeliveryService } from './vk-feedback-delivery.service';
import { VKKeyboardFactory } from './vk-keyboard.factory';
import { VkUnreadDialogRecoveryService } from './vk-unread-dialog-recovery.service';
import { VkService } from './vk.service';

const baseProviders = [
  VkService,
  VKKeyboardFactory,
  VkScheduleKeyboardFactory,
  VkGroupSelectionKeyboardFactory,
  VkGroupPicker,
  VkFeedbackKeyboardFactory,
  VkFeedbackDeliveryService,
  VkUnreadDialogRecoveryService,
];
const middlewares = [MainMiddleware];
const providers = [
  ...middlewares,
  // Приоритет применения слушателей
  MainUpdate,
  VkFeedbackUpdate,
  VkScheduleUpdate,
  VkGroupSelectionUpdate,
  AuthScene,
  VkFeedbackScene,
  VkSelectGroupScene,
];

@Global()
@Module({})
export class VkModule {
  static register() {
    return {
      module: VkModule,
      imports: [
        VkBroadcasterModule,
        VkScheduleNotifModule,
        nestjsVk.VkModule.forManagers(false),
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
