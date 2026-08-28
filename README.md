<p align="center"><img src="https://ystuty.github.io/docs/assets/img/YSTUty_logo-text-without-bg-shadow.png" width="150"></p>

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/YSTUty/ystuty-schedule-bot?style=flat-square" alt="GitHub package.json version"/>
  <img src="https://img.shields.io/github/last-commit/YSTUty/ystuty-schedule-bot?style=flat-square" alt="GitHub last commit"/>
  <br/>
  <a href="https://vk.com/ss_ystu"><img src="https://img.shields.io/badge/Bot-Use%20in%20VK-2787F5?style=flat-square&logo=vk" alt="Открыть бота во VK"/></a>
  <a href="https://t.me/ss_ystu_bot"><img src="https://img.shields.io/badge/Bot-Use%20in%20Telegram-229ED9?style=flat-square&logo=telegram" alt="Открыть бота в Telegram"/></a>
  <br/>
  <img src="https://img.shields.io/badge/dynamic/json?color=ced&style=flat-square&logo=GraphQL&label=%D0%94%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D0%BE%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF&suffix=%20%F0%9F%8E%93&query=$.groups&url=https://gg-api.ystuty.ru/s/schedule/v1/schedule/count" alt="Количество доступных групп"/>
  <img src="https://img.shields.io/badge/dynamic/json?color=ced&style=flat-square&logo=GraphQL&label=%D0%94%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D0%BE%20%D0%BF%D1%80%D0%B5%D0%BF%D0%BE%D0%B4%D0%B0%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D0%B5%D0%B9&suffix=%20%F0%9F%91%A8%E2%80%8D%F0%9F%8F%AB&query=$.teachers&url=https://gg-api.ystuty.ru/s/schedule/v1/schedule/count" alt="Количество доступных преподавателей"/>
  <br/>
  <a href="https://view.ystuty.ru"><img src="https://img.shields.io/badge/View%20schedule-YSTUty-9cf?style=flat-square&logo=Internet%20Explorer" alt="view.ystuty.ru"/></a>
</p>

# [YSTUty] Schedule Bot

Бот с расписанием ЯГТУ для [Telegram](https://t.me/ss_ystu_bot) и
[VK](https://vk.com/ss_ystu). Данные получает из
[[YSTUty.Service] Schedule API](https://github.com/YSTUty/ystuty-service-schedule).

## Возможности

- расписание на сегодня, завтра и неделю;
- выбор учебной группы или преподавателя;
- ежедневная рассылка расписания по выбранному времени;
- работа в личных сообщениях и беседах;
- приглашение бота в беседу из VK;
- привязка профиля YSTUty через `social-connect`.

## Запуск для разработки

Для работы нужны PostgreSQL, Redis и переменные окружения для Telegram, VK и
внешних сервисов. Установите зависимости и запустите приложение:

```bash
yarn
yarn start:dev
```

## Проверки

```bash
yarn build
yarn lint
yarn test
```

## License

[MIT](LICENSE)
