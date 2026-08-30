import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { SocialType } from '@my-common';

import { MetricsService } from '../metrics/metrics.service';
import { TelegramService } from '../telegram/telegram.service';
import { UserSocial } from '../user/entity/user-social.entity';

import { Conversation } from './entity/conversation.entity';
import { UserToConversation } from './entity/userToConversation.entity';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(UserToConversation)
    private readonly userToConversationRepository: Repository<UserToConversation>,

    private readonly metricsService: MetricsService,
  ) {}

  public async createConversation(
    social: SocialType,
    conv: Partial<Conversation>,
    userSocial?: UserSocial,
  ) {
    conv.social = social;
    const conversation = new Conversation(
      await this.conversationRepository.save(conv),
    );

    if (userSocial) {
      await this.iAmInConversation(userSocial, conversation.id);
    }

    this.metricsService.conversationCounter.inc({ social });

    return conversation;
  }

  public async findConversationById(
    social: SocialType,
    conversationId: number,
  ) {
    const userSocial = await this.conversationRepository.findOne({
      where: { social, conversationId },
      relations: [
        /* 'users' */
      ],
    });

    return userSocial;
  }

  public async saveConversation(conversation: Conversation) {
    return await this.conversationRepository.save(conversation);
  }

  /** Возвращает активные беседы в стабильном порядке для фоновой сверки. */
  public async findActiveConversations() {
    return await this.conversationRepository.find({
      where: { isLeaved: false },
      order: { id: 'ASC' },
    });
  }

  /** Возвращает недавно отключённые беседы для периодической проверки восстановления. */
  public async findRecentlyLeavedConversations(updatedSince: Date) {
    return await this.conversationRepository.find({
      where: {
        isLeaved: true,
        updatedAt: MoreThanOrEqual(updatedSince),
      },
      order: { id: 'ASC' },
    });
  }

  /** Входящий update из чата подтверждает, что бот снова в нём присутствует. */
  public restoreConversationFromInboundUpdate(conversation: Conversation) {
    if (!conversation.isLeaved) {
      return false;
    }

    conversation.isLeaved = false;
    // Роль бота неизвестна до следующей API-сверки.
    conversation.chatStatus = null;
    return true;
  }

  /** Сохраняет подтверждённые транспортом присутствие и роль бота в беседе. */
  public async syncConversationMembership(
    conversation: Conversation,
    membership: { isLeaved: boolean; chatStatus: string },
  ) {
    if (
      conversation.isLeaved === membership.isLeaved &&
      conversation.chatStatus === membership.chatStatus
    ) {
      return false;
    }

    conversation.isLeaved = membership.isLeaved;
    conversation.chatStatus = membership.chatStatus;
    await this.conversationRepository.save(conversation);
    return true;
  }

  /** Помечает беседу недоступной, когда транспорт подтверждает исключение бота. */
  public async markConversationAsLeaved(
    social: SocialType,
    conversationId: number,
  ) {
    return await this.conversationRepository.update(
      { social, conversationId },
      { isLeaved: true, chatStatus: 'kicked' },
    );
  }

  public async iAmInConversation(
    userSocial: UserSocial,
    conversationId: number,
  ) {
    const existPair = await this.userToConversationRepository.findOne({
      where: {
        userSocialId: userSocial.id,
        conversationId,
      },
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

    await this.conversationRepository.save({ ...conversation, users });
  }
}
