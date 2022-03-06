import { Global, Inject, Module } from '@nestjs/common';
import * as xEnv from '@my-environment';
import * as nestVk from 'nestjs-vk';

import { MainMiddleware } from './middleware/main.middleware';

import { VKMenuFactory } from './vk-menu.factory';
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
            VKMenuFactory,
            VkService,
            VkUpdate,
            SelectGroupScene,
        ],
        exports: [...middlewares, VKMenuFactory, VkService],
    }),
})
export class VkModule {}
