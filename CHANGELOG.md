# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
