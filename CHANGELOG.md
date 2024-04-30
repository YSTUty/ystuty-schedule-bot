# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.3.2](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.3.1...v0.3.2) (2024-04-30)


### 🐛 Bug Fixes

* **auth:** add scene enter decorator ([cda10e5](https://github.com/YSTUty/ystuty-schedule-bot/commit/cda10e51a6dc99683d5b0810c8dd5be5b7fee7d9))
* **social:** fix no chat context in middleware ([3450cc8](https://github.com/YSTUty/ystuty-schedule-bot/commit/3450cc815d5409141ebac0ddd492192d9bcc1ce0))
* **ystuty:** fix calc offser for week ([5acc1d8](https://github.com/YSTUty/ystuty-schedule-bot/commit/5acc1d846fc263349a40688540f5e6c3397fd01e))


### 🌟 Feature Improvements

* extend regular expressions to search group ([44b001f](https://github.com/YSTUty/ystuty-schedule-bot/commit/44b001f3a7710ecd386769406c043517f8e78e86))
* **keyboard:** update keyboard pagination ([ed539c2](https://github.com/YSTUty/ystuty-schedule-bot/commit/ed539c23312eeb1817ec42ba0d4d4cc975e91e07))


### 🚀 Features

* **prometheus:** update `prom-client` and add `Pushgateway` ([2871804](https://github.com/YSTUty/ystuty-schedule-bot/commit/287180458851fea004886ba67ee493c6972e128d))
* **telegram:** add tags for formatting schedule message ([aada641](https://github.com/YSTUty/ystuty-schedule-bot/commit/aada6416ac332d6c9ad26e5d386090359e5027f5))
* **ystuty:** add api authorization by  `SCHEDULE_API_TOKEN` ([fecfa0c](https://github.com/YSTUty/ystuty-schedule-bot/commit/fecfa0c54ae5e934aac4e4cb078eb147ea33d21c))
* **ystuty:** add caching schedule ([6ec38cf](https://github.com/YSTUty/ystuty-schedule-bot/commit/6ec38cfda5d18b844bbdc307d0668f488add4da4))
* **ystuty:** add new schedule api support ([1b948e0](https://github.com/YSTUty/ystuty-schedule-bot/commit/1b948e0642e3d424acb40171b12a1d23d00c77d5))
* **ystuty:** update types for support new schedule api ([428ac91](https://github.com/YSTUty/ystuty-schedule-bot/commit/428ac91af7cce199ae04a7a45c072fe8e3b89779))


### 🧹 Chore

* **deps:** update `telegraf` version to `4.16` ([136326a](https://github.com/YSTUty/ystuty-schedule-bot/commit/136326a58ce56515f794d7beda140d9e76b74027))
* **docker:** add save `resolutions` for `package.json` ([6866f30](https://github.com/YSTUty/ystuty-schedule-bot/commit/6866f3021f676e2450b799fce8b6a123bb6accf1))
* **locale:** update for `schedule` ([9aa42c8](https://github.com/YSTUty/ystuty-schedule-bot/commit/9aa42c83cd58357a5eef17916f40581b1a4b33bb))
* **metrics:** `inc` on new user social ([a3d2f7e](https://github.com/YSTUty/ystuty-schedule-bot/commit/a3d2f7eed15780ca8aca4091a788451550ad15bb))
* **metrics:** add `groupings` for push gateway ([bd115de](https://github.com/YSTUty/ystuty-schedule-bot/commit/bd115de589066266bfe4caf6e0e3cf1af5c4d827))
* **metrics:** count only active users ([e286087](https://github.com/YSTUty/ystuty-schedule-bot/commit/e286087aef1c7cd69d53d7f8a699e54d3c4e86f9))
* **schedule:** remove html tags for answer inline query ([2cd61ab](https://github.com/YSTUty/ystuty-schedule-bot/commit/2cd61ab8823b9e75f12ccf18e679c2f3cd29d30d))
* **telegram:** mark user status on chat leave ([a322629](https://github.com/YSTUty/ystuty-schedule-bot/commit/a322629c9fcbf0e65c1e9bf1f622e64572794e90))
* update ical link ([cf039db](https://github.com/YSTUty/ystuty-schedule-bot/commit/cf039db35edcc0d40ae7792cdda787ba4c1c0a69))
* **ystu:** add more lesson types ([89ff9d7](https://github.com/YSTUty/ystuty-schedule-bot/commit/89ff9d7611d4088b373049892650740d0cfba700))
* **ystuty:** fix schedule api links ([000b5c7](https://github.com/YSTUty/ystuty-schedule-bot/commit/000b5c7fac3ffc9a75ce4e49b409c70f259b6a77))
* **ystuty:** move axios defaults to http module register ([a4fad1f](https://github.com/YSTUty/ystuty-schedule-bot/commit/a4fad1f965ef4574865410210e6c8478c7796bb3))
* **ystuty:** update `formateWeekDays` ([1f1390f](https://github.com/YSTUty/ystuty-schedule-bot/commit/1f1390f14450c9a5e77de6fa28ccb59cf6173d6e))

### [0.3.1](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.3.0...v0.3.1) (2023-09-28)


### 🚀 Features

* **common:** add exception for user message ([ae8d8f1](https://github.com/YSTUty/ystuty-schedule-bot/commit/ae8d8f14ff16df80b6d2086a5d8611f3bdf56ec7))
* **user:** add bool filed `hasDM` to `user-social` ([66b614e](https://github.com/YSTUty/ystuty-schedule-bot/commit/66b614edcf06a5ad0c5f61855e072abae588823e))


### 🧹 Chore

* **docker:** add `postgres` link to `app_srv` ([03ac466](https://github.com/YSTUty/ystuty-schedule-bot/commit/03ac46651df95b84d52cfced5626ab86798446e0))
* **social:** add cancel button in auth scene ([46c3bcd](https://github.com/YSTUty/ystuty-schedule-bot/commit/46c3bcd0d7825a57330fc95af90eb24b7e72c502))
* **social:** auto leave from auth scene in chats ([35b320d](https://github.com/YSTUty/ystuty-schedule-bot/commit/35b320d348869e7f7d2d9ce245e5b63ffa338362))
* **social:** remove `selectedGroupName` from user session ([583b659](https://github.com/YSTUty/ystuty-schedule-bot/commit/583b6598d051a8c2608b8bf37cce8238d6c29610))
* **user:** add `unique` option for `user` entity ([82b26c1](https://github.com/YSTUty/ystuty-schedule-bot/commit/82b26c108bcbdab01d140a2768a642e201ee1df4))


### 🐛 Bug Fixes

* **docker:** change postgres version to `14-bullseye` ([a709da4](https://github.com/YSTUty/ystuty-schedule-bot/commit/a709da41bf804ee28d3aaa581dcdca21115ee991))
* **social:** correct user id for vk user middleware ([d5ac9ce](https://github.com/YSTUty/ystuty-schedule-bot/commit/d5ac9ce17f7c95e216d2978410e294cf5654b735))
* **social:** fix display cancel button on auth ([4bcbd53](https://github.com/YSTUty/ystuty-schedule-bot/commit/4bcbd53beaf1529af5b1a652ee6a4a6a15afa16c))
* **social:** user profile button only in direct message ([e3528c9](https://github.com/YSTUty/ystuty-schedule-bot/commit/e3528c9e373e34fbc0d6d2577b55ad4247c2cf8b))

## [0.3.0](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.2.2...v0.3.0) (2023-09-14)


### 🐛 Bug Fixes

* **telegram:** add inline keyboard url button instead callback ([8a5f646](https://github.com/YSTUty/ystuty-schedule-bot/commit/8a5f6466803108bb3f1f6eed763693b0dcb8bdd1))
* **telegram:** edit message only from callback ([e580e5e](https://github.com/YSTUty/ystuty-schedule-bot/commit/e580e5ee4110e89f586e4f5a2db8f0ba6e1fa502))
* **telegram:** fix order of group validation ([70747a8](https://github.com/YSTUty/ystuty-schedule-bot/commit/70747a819004fb8ab0f8701e85fc71e8af4cc2e7))


### 🧹 Chore

* **auth:** update auth method; add cancellation auth check ([9250a08](https://github.com/YSTUty/ystuty-schedule-bot/commit/9250a08d59ef4c3c9a7a135c407040a3167ae83a))
* **common:** update filters ([0577509](https://github.com/YSTUty/ystuty-schedule-bot/commit/0577509ea190ba67c74b2ff61a247ffae3d617cc))
* **common:** update vk exception filter ([ff68a8e](https://github.com/YSTUty/ystuty-schedule-bot/commit/ff68a8e063ad2fe5bd2647b8fa04795dc445f6db))
* **locale:** add emoji ([6018063](https://github.com/YSTUty/ystuty-schedule-bot/commit/60180631e17f6d02f4567b115cba4d4b2e411b87))
* **social:** increase session ttl in redis ([2aa755b](https://github.com/YSTUty/ystuty-schedule-bot/commit/2aa755b3c58fb5600b5f74be0db9d6ed5c944007))


### 🚀 Features

* add `social-connect` model (auth) ([ddf9e79](https://github.com/YSTUty/ystuty-schedule-bot/commit/ddf9e7919d8e708537e7957a5657a29ceecf7457))
* add typeorm & postgres ([04ad43a](https://github.com/YSTUty/ystuty-schedule-bot/commit/04ad43a13fac38acbfb8ea6a33f4ecc1a486650a))
* **connect:** add rate limit for request auth ([c0f5410](https://github.com/YSTUty/ystuty-schedule-bot/commit/c0f54103c50c1bd10d96d4412aedc55063e7ac49))
* **social:** add profile button ([b3cef3c](https://github.com/YSTUty/ystuty-schedule-bot/commit/b3cef3cbc2ce905a8ac141c18edba47a8b1674df))

### [0.2.2](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.2.1...v0.2.2) (2023-09-11)


### 🧹 Chore

* **docker:** add healthcheck ([19a32af](https://github.com/YSTUty/ystuty-schedule-bot/commit/19a32afad73792fea44a7f740c19cf262df09a62))
* **docker:** update node version to `16` ([c313bb9](https://github.com/YSTUty/ystuty-schedule-bot/commit/c313bb94933d2af5d71a06b790d5ef9ed73687b6))
* **locale:** change hash to slash for web view link ([4438a29](https://github.com/YSTUty/ystuty-schedule-bot/commit/4438a298e76050227a409e5e7b752fe30829f508))
* **telegram:** skip await bot `launch` ([ec62259](https://github.com/YSTUty/ystuty-schedule-bot/commit/ec62259992da4072faa02a1e1d27dde88d498b7f))
* **vk:** update vk session redis option ([4282712](https://github.com/YSTUty/ystuty-schedule-bot/commit/42827121e438c052552d4e49553bc54a629f4226))


### 🐛 Bug Fixes

* **docker:** change healthcheck test url ([839ef1b](https://github.com/YSTUty/ystuty-schedule-bot/commit/839ef1bf221c41460135e9319b09551bc1db5a9c))

### [0.2.1](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.2.0...v0.2.1) (2023-09-05)


### 🧹 Chore

* **common:** update host type in exception filters ([2c7ebaf](https://github.com/YSTUty/ystuty-schedule-bot/commit/2c7ebaf543b3606f3adab94b10d53d6133a6dacd))
* **deps:** update ([6c1f18a](https://github.com/YSTUty/ystuty-schedule-bot/commit/6c1f18a814f05c6d732e58bc47164f504653d631))
* **docker:** add `restart` option for `redis` ([b062b1c](https://github.com/YSTUty/ystuty-schedule-bot/commit/b062b1ccdb1b77ba285561a206406c1c6763894c))


### 🔧 Code Refactoring

* update indent size & add editorconfig ([2560920](https://github.com/YSTUty/ystuty-schedule-bot/commit/2560920f7c7b71dbbc0930d41a5c5b83af0be6cf))


### 🚀 Features

* **env:** use `dotenv-expand` ([2520069](https://github.com/YSTUty/ystuty-schedule-bot/commit/25200697f6c04b3c7ad5454f36437cc479f055d6))

## [0.2.0](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.1.1...v0.2.0) (2023-09-05)


### 🧹 Chore

* **app:** add log app version ([8d7c28e](https://github.com/YSTUty/ystuty-schedule-bot/commit/8d7c28eee9ab5672ac38c91ca40c3d8f98cc4d98))
* **common:** check host type in exception filters ([51594f7](https://github.com/YSTUty/ystuty-schedule-bot/commit/51594f7bea6feb5531ad3cb3ad889fa24cead5c8))
* **docker:** rename `project_name` in makefile ([462d54f](https://github.com/YSTUty/ystuty-schedule-bot/commit/462d54f8283c25d99626b21b2823c1f0a0cd562d))
* **locale:** add support payload to `start` regexp ([29c916b](https://github.com/YSTUty/ystuty-schedule-bot/commit/29c916ba99bdd77ad929ba76a5d1d17b3d9bcf50))
* **project:** rename project to `ystuty-schedule-bot` ([2367e69](https://github.com/YSTUty/ystuty-schedule-bot/commit/2367e693dd9c10a5cd6ea79912eb127e34b4c0ab))
* **telegram:** no wait launch bot ([92e514e](https://github.com/YSTUty/ystuty-schedule-bot/commit/92e514eade353edac3a4886c266f9aad29ada740))
* update jest conf ([11ba6c6](https://github.com/YSTUty/ystuty-schedule-bot/commit/11ba6c6967cf6c00100b47bc2cdb1e70eb7dfe96))


### 🚀 Features

* **social:** add draw `webViewLink` on `start` ([eb0d2ea](https://github.com/YSTUty/ystuty-schedule-bot/commit/eb0d2eaf9d8762d3994d7abfefc9db123d318020))
* **social:** add support start payload & ref value for fast select group ([c37c5b1](https://github.com/YSTUty/ystuty-schedule-bot/commit/c37c5b19486c3a4c8c66a4614f2dfe68d3ca56c7))
* update structure ([ba2cce5](https://github.com/YSTUty/ystuty-schedule-bot/commit/ba2cce550ee86788a102a771c2041c68170480c9))


### 🐛 Bug Fixes

* **readme:** change server host on badges ([1f22d84](https://github.com/YSTUty/ystuty-schedule-bot/commit/1f22d848d5f96114295779031a6d4dd4eeff168d))
* **redis:** add redis prefix to options ([d8b3fbf](https://github.com/YSTUty/ystuty-schedule-bot/commit/d8b3fbf9e6f184517304601022cfd177bc05ba37))
* **telegram:** no clean scene session in middleware ([dc57e70](https://github.com/YSTUty/ystuty-schedule-bot/commit/dc57e709edf174228a3381691191da30700b7f81))
* **vk:** fix send method name ([0adf682](https://github.com/YSTUty/ystuty-schedule-bot/commit/0adf682617a28f2225687590c8fb1765838b5f44))

### [0.1.1](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.1.0...v0.1.1) (2022-09-16)


### 🧹 Chore

* **docker:** updated ports ([4eaa3eb](https://github.com/YSTUty/ystuty-schedule-bot/commit/4eaa3ebf4ccf4d5706a3fc884ec76401b16b522a))
* remove console.log ([e35d1b1](https://github.com/YSTUty/ystuty-schedule-bot/commit/e35d1b1ba496b5229f239deac98c34d0f77627bc))
* **vk:** remove `console.log` in middleware ([cbb5a20](https://github.com/YSTUty/ystuty-schedule-bot/commit/cbb5a20ebfe7058dd25bd44abbd5aaef5620f454))


### 🚀 Features

* **app:** added informer on app new version ([ac97f3e](https://github.com/YSTUty/ystuty-schedule-bot/commit/ac97f3ed174340ceefa21c10cf70e9eb42868f27))
* **metrics:** added metrics (prometheus) ([5566126](https://github.com/YSTUty/ystuty-schedule-bot/commit/5566126fcf6b39d6a4caf7e1a249fa5cba16aa1d))

## 0.1.0 (2022-09-15)


### 💙 Types

* **interface:** added `state` type to context ([b2d6af5](https://github.com/YSTUty/ystuty-schedule-bot/commit/b2d6af5b3e69404b76ffad1ee4618b0346b7eec0))


### 🐛 Bug Fixes

* **telegram:** added `await` for catching error ([3c5a0a4](https://github.com/YSTUty/ystuty-schedule-bot/commit/3c5a0a472054d13146150c1d9ec42700a1a7cca1))
* **telegram:** fixed `undefined` variable ([e2e80da](https://github.com/YSTUty/ystuty-schedule-bot/commit/e2e80da4870fe18192b713a6a433c86529c2bd8b))
* **telegram:** fixed bugs in scene ([b037c1b](https://github.com/YSTUty/ystuty-schedule-bot/commit/b037c1be2a1853c51c7b7dc53103ea3a3466f53d))
* **telegram:** fixed middleware and sessions ([3cf977f](https://github.com/YSTUty/ystuty-schedule-bot/commit/3cf977f68c1e5c93118274aee1faaef53dbaa73a))
* **tg:** fixed `undefined` member for `status` ([31348a8](https://github.com/YSTUty/ystuty-schedule-bot/commit/31348a8a95862c8a3fe52d497da249666256b84a))
* **types:** fixed typing ([2a5e6f3](https://github.com/YSTUty/ystuty-schedule-bot/commit/2a5e6f333a836480469b7107642a2e8b1b0a3928))
* **vk:** using `:` instead of `_` in session key ([49c7201](https://github.com/YSTUty/ystuty-schedule-bot/commit/49c720145ffeddd61debbfa8e5c543c400a2786f))
* **ystuty:** fixed empty groups ([d997f19](https://github.com/YSTUty/ystuty-schedule-bot/commit/d997f1998788e6726525f49368a74f0c32eb7eac))
* **ystuty:** fixed search group by name ([3b02c81](https://github.com/YSTUty/ystuty-schedule-bot/commit/3b02c815e3f9f0a8d67aa554b31b5c09df6fb8ae))
* **ystuty:** increased api `timeout` ([e98e5e3](https://github.com/YSTUty/ystuty-schedule-bot/commit/e98e5e3a9dbe296292c0d77b4fabfe62e8048660))


### 🧹 Chore

* added support reset group by `0` attr ([f0f77eb](https://github.com/YSTUty/ystuty-schedule-bot/commit/f0f77ebaf3000475276c93c1d123b1e9427f36aa))
* **bots:** suggest to select group name at start ([159d354](https://github.com/YSTUty/ystuty-schedule-bot/commit/159d3548f83acb16aa3b2154b646296ac374a7d3))
* **deps:** update ([28c4d15](https://github.com/YSTUty/ystuty-schedule-bot/commit/28c4d152724ede963773557179badf09f036398c))
* **deps:** updated ([e8e74b8](https://github.com/YSTUty/ystuty-schedule-bot/commit/e8e74b8060c5cc0d1306e0b03b181884d44b835e))
* **deps:** updated `vk-io-redis-storage` version ([0d58d38](https://github.com/YSTUty/ystuty-schedule-bot/commit/0d58d3803b23b288047befa89de3fc89b091ea9a))
* **deps:** updates ([9ba055a](https://github.com/YSTUty/ystuty-schedule-bot/commit/9ba055a40e821b40dc0bb4d26f745747730c50ae))
* **docker:** update ([22839b4](https://github.com/YSTUty/ystuty-schedule-bot/commit/22839b4c00896fde94d7dbc169b79c7333c97eeb))
* **docker:** update ([d4e44c9](https://github.com/YSTUty/ystuty-schedule-bot/commit/d4e44c929f339cef124555c3ade676e9c07e28d3))
* **locale:** updated phrases ([f87c502](https://github.com/YSTUty/ystuty-schedule-bot/commit/f87c50289d203814c281ff696457b24fd6907bd4))
* **modules:** added `register` method for modules ([1dcf255](https://github.com/YSTUty/ystuty-schedule-bot/commit/1dcf255cb50b83892f419325f3b3155b9aa7ce51))
* moved util functions to external file ([554defb](https://github.com/YSTUty/ystuty-schedule-bot/commit/554defbfd52f87367fe9d50f26fbe928575adde0))
* **schedule:** not enter scene on wrong group name ([5abe2cd](https://github.com/YSTUty/ystuty-schedule-bot/commit/5abe2cd1f08362147e2315939f79215106299bd4))
* **schedule:** removed an unnecessary new line ([993615f](https://github.com/YSTUty/ystuty-schedule-bot/commit/993615fd04f9fed048cea96f9757e7585b75653c))
* **select-group:** selecting group name only when appeal ([6007854](https://github.com/YSTUty/ystuty-schedule-bot/commit/6007854ea5ac342633f562562b50610185de259d))
* **session:** added session cleaning defaults ([953b68d](https://github.com/YSTUty/ystuty-schedule-bot/commit/953b68d82ab5741400decaa0d63ac4f1eefa87b1))
* **telegram:** answer `404` for inline query ([136e6f5](https://github.com/YSTUty/ystuty-schedule-bot/commit/136e6f5e6d12e24f9a7de372c82982398caadbc8))
* **vk:** renamed `vkMenuFactory` to `keyboardFactory` ([2af3e83](https://github.com/YSTUty/ystuty-schedule-bot/commit/2af3e839d08d6a3a26d0b49e7fac766848dbf7ca))
* **vk:** reply in conversation only when appeal ([69a7f5c](https://github.com/YSTUty/ystuty-schedule-bot/commit/69a7f5c1e8a51ae86643a041d5fd35d89a444931))
* **vk:** updated exceptions filter ([dfcdc13](https://github.com/YSTUty/ystuty-schedule-bot/commit/dfcdc135e0f855746ecc67005043feeb60944d0e))


### 🚀 Features

* added `glist` command for get groups list ([f4d9942](https://github.com/YSTUty/ystuty-schedule-bot/commit/f4d9942d3ded562a12fa559fac8a245f7f492ac2))
* added license file ([64c8435](https://github.com/YSTUty/ystuty-schedule-bot/commit/64c84359081343e9d9af5cffaf8d861ef9e0e72f))
* **bots:** added `help` command ([e0d2001](https://github.com/YSTUty/ystuty-schedule-bot/commit/e0d2001ef346e0bed9adf4c26775bc0cac6ba439))
* **bots:** added automatic ability to get group name from chat title ([3ff3a98](https://github.com/YSTUty/ystuty-schedule-bot/commit/3ff3a982705e59d2ae2cc017b14c945a35a7efac))
* **bots:** added guards and updated filters ([bb79b4a](https://github.com/YSTUty/ystuty-schedule-bot/commit/bb79b4a86dde8da5ff6a281e1a0416752febfffa))
* **docker:** added `locales` to volumes ([30d890f](https://github.com/YSTUty/ystuty-schedule-bot/commit/30d890f75bf4a042e043c0875482fec587470b64))
* **docker:** added docker ([b5ea3ee](https://github.com/YSTUty/ystuty-schedule-bot/commit/b5ea3eea5103e3eecf294ec3c12bf41171c28381))
* **docker:** optimized cache layers ([c6fa793](https://github.com/YSTUty/ystuty-schedule-bot/commit/c6fa793e5a5979a8afa2106e2deed6911418e9cf))
* init repos ([7c30903](https://github.com/YSTUty/ystuty-schedule-bot/commit/7c309031dee703e0acb56e4872f59798ec9ece43))
* **locale:** split `vk` and `telegram` locales ([0c0b9c8](https://github.com/YSTUty/ystuty-schedule-bot/commit/0c0b9c86546cabfd61d01ab33fe8a1049bd79066))
* **models:** added `telegram` bot ([c5803af](https://github.com/YSTUty/ystuty-schedule-bot/commit/c5803aff5777871d9ac778efef6c899081774828))
* **project:** added main links and logo ([8c6fee2](https://github.com/YSTUty/ystuty-schedule-bot/commit/8c6fee298b8d779fdf2ba9c3df23c9ae32b0eef0))
* **project:** adding basic dependencies ([4dde87e](https://github.com/YSTUty/ystuty-schedule-bot/commit/4dde87e78911d59e1abe90e53e383a5a5f354cc1))
* **project:** schedule bot ([6fe2bed](https://github.com/YSTUty/ystuty-schedule-bot/commit/6fe2bedfa95e329dcf3c8d57022da504497b9db5))
* **redis:** added redis & redlock ([ca1ad05](https://github.com/YSTUty/ystuty-schedule-bot/commit/ca1ad05ccd30c2a004d252725693d37d43ca6616))
* **telegram:** added command for calendar link ([aca8c98](https://github.com/YSTUty/ystuty-schedule-bot/commit/aca8c984089185fcfc26728a9a74b612966c46d6))
* **telegram:** added shedule to inline query ([52d2cde](https://github.com/YSTUty/ystuty-schedule-bot/commit/52d2cde8997941496b0f1abe8c7b560006c99da2))
* **vk:** added hide state for static keyboard ([ccfa3b6](https://github.com/YSTUty/ystuty-schedule-bot/commit/ccfa3b65f6fae8449ae620d72dee9a0f2143da28))
* **ystuty:** added cron `schedule` module ([3ee9e61](https://github.com/YSTUty/ystuty-schedule-bot/commit/3ee9e61e8cc57e17496f3686b93b008566ee6e2a))
* **ystuty:** added http axios module ([7071c66](https://github.com/YSTUty/ystuty-schedule-bot/commit/7071c66cfde0dc828e6a540feee705b52eb6ffaa))
* **ystuty:** added support `extramural` groups ([82faf4b](https://github.com/YSTUty/ystuty-schedule-bot/commit/82faf4ba88b136e6ec6c6fe0a849930801cd4d19))
