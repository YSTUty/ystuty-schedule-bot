import { Global, Module } from '@nestjs/common';
import * as xEnv from '@my-environment';
import * as nestVk from 'nestjs-vk';

import { MainMiddleware } from './middleware/main.middleware';

import { VKKeyboardFactory } from './vk-keyboard.factory';
import { VkUpdate } from './update/vk.update';
import { VkService } from './vk.service';
import { SelectGroupScene } from './scene/select-group.scene';

const middlewares = [MainMiddleware];

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
            providers: [
                ...middlewares,
                VKKeyboardFactory,
                VkService,
                VkUpdate,
                SelectGroupScene,
            ],
            exports: [...middlewares, VKKeyboardFactory, VkService],
        };
    }
}
