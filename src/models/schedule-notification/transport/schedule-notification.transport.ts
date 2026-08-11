import { SocialType } from '@my-common/constants';

import { UserSocial } from '../../user/entity/user-social.entity';

export type ScheduleNotificationTransportResult = {
  messageId?: string | null;
};

export interface ScheduleNotificationTransport {
  readonly social: SocialType;

  sendMessage(params: {
    recipient: UserSocial;
    text: string;
  }): Promise<ScheduleNotificationTransportResult>;

  sendScheduleNotification(params: {
    recipient: UserSocial;
    text: string;
  }): Promise<ScheduleNotificationTransportResult>;
}
