import { SocialType } from '@my-common';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MetricsService } from '../metrics/metrics.service';
import { TelegramService } from '../telegram/telegram.service';

import { UserSocial } from '../user/entity/user-social.entity';
import { Conversation } from './entity/conversation.entity';
import { UserToConversation } from './entity/userToConversation.entity';

@Injectable()
export class SocialService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(UserToConversation)
    private readonly userToConversationRepository: Repository<UserToConversation>,

    private readonly metricsService: MetricsService,
  ) {}

  public async onModuleInit() {
    try {
      this.metricsService.conversationCounter.remove('social');
      for (const social of Object.values(SocialType)) {
        const countConversation = await this.conversationRepository.count({
          social,
        });
        this.metricsService.conversationCounter.set(
          { social },
          countConversation,
        );
      }
    } catch (err) {
      console.log('[onModuleInit] Error loading metrics');
      console.error(err);
    }
  }

  public async createConversation(
    social: SocialType,
    conv: Partial<Conversation>,
    userSocial?: UserSocial,
  ) {
    if (!conv.users?.length) {
      conv.users = userSocial ? [userSocial] : [];
    }
    conv.social = social;
    const conversation = new Conversation(
      await this.conversationRepository.save(conv),
    );

    this.metricsService.conversationCounter.inc({ social });

    return conversation;
  }

  public async findConversationById(
    social: SocialType,
    conversationId: number,
  ) {
    const userSocial = await this.conversationRepository.findOne(
      { social, conversationId },
      {
        relations: [
          /* 'users' */
        ],
      },
    );

    return userSocial;
  }

  public async saveConversation(conversation: Conversation) {
    return await this.conversationRepository.save(conversation);
  }

  public async iAmInConversation(
    userSocial: UserSocial,
    conversationId: number,
  ) {
    const existPair = await this.userToConversationRepository.findOne({
      userSocialId: userSocial.id,
      conversationId,
    });
    if (!existPair) {
      await this.userToConversationRepository.save(
        new UserToConversation({ userSocialId: userSocial.id, conversationId }),
      );
    }
  }

  public async findUsersFromConversation(
    social: SocialType,
    conversationId: number,
  ) {
    return await this.userToConversationRepository.find({
      where: { conversationId },
      // relations: ['userSocial'],
    });
  }

  public async updateUsersToConversationRepository(
    conversation: Conversation,
    users: UserSocial[],
  ) {
    // return await this.userToConversationRepository.save(
    //   users.map(
    //     (user) =>
    //       new UserToConversation({
    //         conversationId: conversation.id,
    //         userSocialId: user.id,
    //       }),
    //   ),
    // );

    await this.conversationRepository.update(conversation, { users });
  }
}
