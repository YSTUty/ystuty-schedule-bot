export enum LocalePhrase {
  LanguageName = 'language_name',

  // Common
  Common_Error = 'common.error',
  Common_NoAccess = 'common.no_access',
  Common_Banned = 'common.banned',
  Common_Cooldown = 'common.cooldown',
  Common_Canceled = 'common.canceled',

  // Buttons
  Button_Cancel = 'button.cancel',
  Button_AuthLink = 'button.auth_link',
  Button_AuthLink_SocialConnect = 'button.auth_link_connect',
  Button_Profile = 'button.profile',
  Button_SelectGroup = 'button.select_group',
  Button_SelectGroup_X = 'button.select_group_x',

  Button_Schedule_Schedule = 'button.schedule.schedule',
  Button_Schedule_ForToday = 'button.schedule.for_today',
  Button_Schedule_ForTomorrow = 'button.schedule.for_tomorrow',
  Button_Schedule_ForWeek = 'button.schedule.for_week',
  Button_Schedule_ForNextWeek = 'button.schedule.for_next_week',

  // RegExps
  RegExp_Start = 'regexp.start',
  RegExp_Help = 'regexp.help',
  RegExp_Schedule_SelectGroup = 'regexp.schedule.select_group',
  RegExp_Schedule_For_OneDay = 'regexp.schedule.for_one_day',
  RegExp_Schedule_For_Week = 'regexp.schedule.for_week',

  // Pages
  Page_Start = 'page.start',
  Page_InitBot = 'page.init_bot',
  Page_Help = 'page.help',
  Page_Schedule_NearestSchedule = 'page.schedule.nearest_schedule',
  Page_Schedule_NotFoundToday = 'page.schedule.not_found_today',

  Page_Auth_NeedAuth = 'page.auth.need_auth',
  Page_Auth_Done = 'page.auth.done',
  Page_Auth_Cancel = 'page.auth.cancel',
  Page_Auth_Fail = 'page.auth.fail',

  Page_SocialConnect_Other = 'page.social_connect.other',
  Page_SocialConnect_NeedConnect = 'page.social_connect.need_connect',
  Page_SocialConnect_WaitConfirm = 'page.social_connect.wait_confirm',
  Page_SocialConnect_AlreadySent = 'page.social_connect.already_sent',

  Page_Profile_Info = 'page.profile.info',

  Page_SelectGroup_EnterNameWithExample = 'page.select_group.enter_name_with_example',
  Page_SelectGroup_Selected = 'page.select_group.selected',
  Page_SelectGroup_NotFound = 'page.select_group.not_found',
  Page_SelectGroup_Reset = 'page.select_group.reset',
}

export enum VkLocalePhrase {}

export enum TelegramLocalePhrase {
  Page_SelectYourGroup = 'page.telegram.select_your_group',
  Page_Schedule_Share = 'page.telegram.schedule.share',
  Page_Schedule_Title_ForToday = 'page.telegram.schedule.title.for_today',
  Page_Schedule_Title_ForTomorrow = 'page.telegram.schedule.title.for_tomorrow',
  Page_Schedule_Title_ForWeek = 'page.telegram.schedule.title.for_week',
  Page_Schedule_Title_ForNextWeek = 'page.telegram.schedule.title.for_next_week',
}

export type LocalePhraseType =
  | LocalePhrase
  | TelegramLocalePhrase
  | VkLocalePhrase;
