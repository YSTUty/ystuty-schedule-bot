import { SocialType } from '@my-common/constants';

import { UserSocial } from '../../user/entity/user-social.entity';

export type ScheduleNotifTransportResult = {
  messageId?: string | null;
};

export interface ScheduleNotifTransport {
  readonly social: SocialType;

  sendMessage(params: {
    recipient: UserSocial;
    text: string;
  }): Promise<ScheduleNotifTransportResult>;

  sendScheduleNotif(params: {
    recipient: UserSocial;
    text: string;
  }): Promise<ScheduleNotifTransportResult>;
}
