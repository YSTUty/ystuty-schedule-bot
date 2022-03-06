export enum LocalePhrase {
    LanguageName = 'language_name',

    // Common
    Common_Error = 'common.error',
    Common_NoAccess = 'common.no_access',
    Common_Cooldown = 'common.cooldown',
    Common_Canceled = 'common.canceled',

    // Buttons
    Button_Cancel = 'button.cancel',

    Button_Schedule_Schedule = 'button.schedule.schedule',
    Button_Schedule_ForToday = 'button.schedule.for_today',
    Button_Schedule_ForTomorrow = 'button.schedule.for_tomorrow',
    Button_Schedule_ForWeek = 'button.schedule.for_week',
    Button_Schedule_ForNextWeek = 'button.schedule.for_next_week',

    // RegExps
    RegExp_Start = 'regexp.start',
    RegExp_Schedule_SelectGroup = 'regexp.schedule.select_group',
    RegExp_Schedule_For_OneDay = 'regexp.schedule.for_one_day',
    RegExp_Schedule_For_Week = 'regexp.schedule.for_week',

    // Pages
    Page_Start = 'page.start',
    Page_Schedule_NearestSchedule = 'page.schedule.nearest_schedule',
    Page_Schedule_NotFoundToday = 'page.schedule.not_found_today',

    Page_SelectGroup_EnterNameWithExample = 'page.select_group.enter_name_with_example',
    Page_SelectGroup_Selected = 'page.select_group.selected',
    Page_SelectGroup_NotFound = 'page.select_group.not_found',
    Page_SelectGroup_Reset = 'page.select_group.reset',
}

export type ILocale = Record<LocalePhrase, string>;
