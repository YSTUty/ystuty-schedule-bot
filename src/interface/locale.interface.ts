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
  Button_Broadcast = 'button.broadcast.title',
  Button_Broadcast_Create = 'button.broadcast.create',
  Button_Broadcast_Status = 'button.broadcast.status',
  Button_Broadcast_Current = 'button.broadcast.current',
  Button_Broadcast_List = 'button.broadcast.list',
  Button_Broadcast_Delete = 'button.broadcast.delete',
  Button_Broadcast_BackToMenu = 'button.broadcast.back_to_menu',
  Button_Broadcast_BackToList = 'button.broadcast.back_to_list',
  Button_Broadcast_CreateQueue = 'button.broadcast.create_queue',
  Button_Broadcast_Resume = 'button.broadcast.resume',
  Button_Broadcast_Pause = 'button.broadcast.pause',
  Button_Broadcast_Terminate = 'button.broadcast.terminate',
  Button_Broadcast_ModeToggle = 'button.broadcast.mode_toggle',
  Button_Broadcast_SelectRecipients = 'button.broadcast.select_recipients',
  Button_Broadcast_AudienceAll = 'button.broadcast.audience_all',
  Button_Broadcast_AudienceManual = 'button.broadcast.audience_manual',
  Button_Broadcast_Back = 'button.broadcast.back',
  Button_Broadcast_BackToSettings = 'button.broadcast.back_to_settings',

  Button_Schedule_Schedule = 'button.schedule.schedule',
  Button_Schedule_ForToday = 'button.schedule.for_today',
  Button_Schedule_ForTomorrow = 'button.schedule.for_tomorrow',
  Button_Schedule_ForWeek = 'button.schedule.for_week',
  Button_Schedule_ForNextWeek = 'button.schedule.for_next_week',
  Button_Schedule_Teacher = 'button.schedule.teacher',
  Button_Schedule_MyTeacher = 'button.schedule.my_teacher',

  Button_Groups_ListInstAndGroups = 'button.groups.list_inst_and_groups',
  Button_Groups_ListGroups = 'button.groups.list_groups',
  Button_Groups_ListInstitutes = 'button.groups.list_institutes',
  Button_Groups_ChangeInstitute = 'button.groups.change_institute',

  // RegExps
  RegExp_Start = 'regexp.start',
  RegExp_Help = 'regexp.help',
  RegExp_Schedule_SelectGroup = 'regexp.schedule.select_group',
  RegExp_Schedule_For_OneDay = 'regexp.schedule.for_one_day',
  RegExp_Schedule_For_Week = 'regexp.schedule.for_week',

  // Errors
  Error_SelectGroup_OnlyAdminOrOwner = 'error.select_group.only_admin_or_owner',
  Error_Bot_NotAdmin = 'error.bot.conversation_not_admin',

  // Pages
  Page_Start = 'page.start',
  Page_InitBot = 'page.init_bot',
  Page_Help = 'page.help',
  Page_Schedule_NearestSchedule = 'page.schedule.nearest_schedule',
  Page_Schedule_NotFoundToday = 'page.schedule.not_found_today',
  Page_Schedule_TeachersList = 'page.schedule.teachers_list',
  Page_Schedule_TeacherSelected = 'page.schedule.teacher_selected',
  Page_Schedule_TeacherNotFound = 'page.schedule.teacher_not_found',
  Page_Schedule_TeacherSearchHint = 'page.schedule.teacher_search_hint',
  Page_Schedule_TeacherNotSelected = 'page.schedule.teacher_not_selected',
  Page_Schedule_WeekTitle = 'page.schedule.week_title',
  Page_Schedule_TeacherWeekTitle = 'page.schedule.teacher_week_title',

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

  Page_Broadcast_PrivateOnly = 'page.broadcast.private_only',
  Page_Broadcast_Settings = 'page.broadcast.settings',
  Page_Broadcast_SelectRecipients = 'page.broadcast.select_recipients',
  Page_Broadcast_SendSample = 'page.broadcast.send_sample',
  Page_Broadcast_Ready = 'page.broadcast.ready',
  Page_Broadcast_Queued = 'page.broadcast.queued',
  Page_Broadcast_Canceled = 'page.broadcast.canceled',
  Page_Broadcast_AlreadyActive = 'page.broadcast.already_active',
  Page_Broadcast_NoRecipients = 'page.broadcast.no_recipients',
  Page_Broadcast_MessageNotFound = 'page.broadcast.message_not_found',
  Page_Broadcast_SendCommandHint = 'page.broadcast.send_command_hint',
  Page_Broadcast_SettingsReadyHint = 'page.broadcast.settings_ready_hint',
  Page_Broadcast_SourceRequired = 'page.broadcast.source_required',
  Page_Broadcast_NewSample = 'page.broadcast.new_sample',
  Page_Broadcast_QueueStatus = 'page.broadcast.queue_status',
  Page_Broadcast_Menu = 'page.broadcast.menu',
  Page_Broadcast_CampaignsList = 'page.broadcast.campaigns_list',
  Page_Broadcast_CampaignDetails = 'page.broadcast.campaign_details',
  Page_Broadcast_CampaignDeleted = 'page.broadcast.campaign_deleted',
  Page_Broadcast_CampaignDeleteUsage = 'page.broadcast.campaign_delete_usage',
  Page_Broadcast_CampaignNotFound = 'page.broadcast.campaign_not_found',
  Page_Broadcast_Progress = 'page.broadcast.progress',

  // Broadcast notifications
  Broadcast_Notification_QueueCreated = 'broadcast.notification.queue_created',
  Broadcast_Notification_AudienceAll = 'broadcast.notification.audience_all',
  Broadcast_Notification_Settings = 'broadcast.notification.settings',
  Broadcast_Notification_Recipients = 'broadcast.notification.recipients',
  Broadcast_Notification_Menu = 'broadcast.notification.menu',
  Broadcast_Notification_Create = 'broadcast.notification.create',
  Broadcast_Notification_Status = 'broadcast.notification.status',
  Broadcast_Notification_Current = 'broadcast.notification.current',
  Broadcast_Notification_List = 'broadcast.notification.list',
  Broadcast_Notification_Campaign = 'broadcast.notification.campaign',
  Broadcast_Notification_Deleted = 'broadcast.notification.deleted',
  Broadcast_Notification_NotFound = 'broadcast.notification.not_found',
  Broadcast_Notification_Paused = 'broadcast.notification.paused',
  Broadcast_Notification_Resumed = 'broadcast.notification.resumed',
  Broadcast_Notification_Terminated = 'broadcast.notification.terminated',
  Broadcast_Notification_ModeChanged = 'broadcast.notification.mode_changed',
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
