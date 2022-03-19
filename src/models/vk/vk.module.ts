import { Global, Module } from '@nestjs/common';
import * as xEnv from '@my-environment';
import * as nestVk from 'nestjs-vk';

import { MainMiddleware } from './middleware/main.middleware';

import { VKKeyboardFactory } from './vk-keyboard.factory';
import { VkUpdate } from './vk.update';
import { VkService } from './vk.service';
import { SelectGroupScene } from './scene/select-group.scene';

const middlewares = [MainMiddleware];

@Global()
@Module({
    ...(xEnv.SOCIAL_VK_GROUP_TOKEN && {
        imports: [
            nestVk.VkModule.forRootAsync({
                inject: [MainMiddleware],
                useFactory: async (featuresMiddleware: MainMiddleware) => ({
                    token: xEnv.SOCIAL_VK_GROUP_TOKEN,
                    options: {
                        pollingGroupId: xEnv.SOCIAL_VK_GROUP_ID,
                        apiMode: 'sequential',
                    },
                    useSessionManager: false,
                    useSceneManager: false,
                    useHearManager: false,
                    // launchOptions: false,
                    // notReplyMessage: true,
                    middlewaresBefore: [featuresMiddleware.middlewaresBefore],
                    middlewaresAfter: [featuresMiddleware.middlewaresAfter],
                }),
            }),
        ],
        providers: [
            ...middlewares,
            VKKeyboardFactory,
            VkService,
            VkUpdate,
            SelectGroupScene,
        ],
        exports: [...middlewares, VKKeyboardFactory, VkService],
    }),
})
export class VkModule {}
