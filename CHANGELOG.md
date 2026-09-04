# Changelog

## [0.4.1](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.4.0...v0.4.1) (2026-09-04)

### 🚀 Features

* **broadcast:** add activity audience filters ([a3ddb08](https://github.com/YSTUty/ystuty-schedule-bot/commit/a3ddb0860389b70259d562726bbb66f6a1a4a21f))
* **metrics:** add broadcast and schedule availability metrics ([3b8b667](https://github.com/YSTUty/ystuty-schedule-bot/commit/3b8b66727c139841fb9eeab6a761468a0d13c280))
* **metrics:** track schedule notification creation ([524a8a3](https://github.com/YSTUty/ystuty-schedule-bot/commit/524a8a35163a4355866c580a22247e773c759cf8))
* **telegram:** add styled keyboard buttons ([56e0da1](https://github.com/YSTUty/ystuty-schedule-bot/commit/56e0da1b4e251b8f321ab7518b765a143d8f344f))

### 🐛 Bug Fixes

* **broadcast:** retry telegram rate-limited deliveries ([211d00e](https://github.com/YSTUty/ystuty-schedule-bot/commit/211d00ebfdf6b223e8c2d4843a6590e2a3846cdf))
* **ci:** serialize docker image publishing ([4344a99](https://github.com/YSTUty/ystuty-schedule-bot/commit/4344a996d38d7017a92be7bbb479c737ecaf22e2))
* **feedback:** retry admin delivery after rate limits ([bdc96e7](https://github.com/YSTUty/ystuty-schedule-bot/commit/bdc96e750283225fa317f676412285c44ea1f102))
* **metrics:** disable http exception filter for bot updates ([f306813](https://github.com/YSTUty/ystuty-schedule-bot/commit/f30681318074343f076a4542c40c7d747f969912))
* **schedule:** separate target footer from weekly schedule ([afd5449](https://github.com/YSTUty/ystuty-schedule-bot/commit/afd544963de24d700fa6a9040e0a7a7adb1e049f))
* **schedule:** separate target footer from weekly schedule ([35912dd](https://github.com/YSTUty/ystuty-schedule-bot/commit/35912dd2d5b52f71ec3768a97a67d6ead4a88d2b))
* **transports:** handle redis session outages and queued updates ([ae4c36f](https://github.com/YSTUty/ystuty-schedule-bot/commit/ae4c36f583ba40ff7dc8a1aa2bc97d6c7fd692e4))
* **vk:** ignore typing activity failures ([88d0b49](https://github.com/YSTUty/ystuty-schedule-bot/commit/88d0b49bcb133a621af83e10af4282cc50a86b6f))
* **vk:** log failed api methods ([1212778](https://github.com/YSTUty/ystuty-schedule-bot/commit/1212778ec12f4e6b9add22c58ae53297c55e93e9))

### 📖 Documentation

* **monitoring:** add compatible grafana schedule dashboard ([e108ac4](https://github.com/YSTUty/ystuty-schedule-bot/commit/e108ac4b587f54cbf89675ed12102cadd69687c8))
* **monitoring:** expand schedule bot grafana dashboard ([fc4f393](https://github.com/YSTUty/ystuty-schedule-bot/commit/fc4f393a598fe248f3bf4a24eec1ef084e217036))

### 🔧 Code Refactoring

* **telegram:** migrate to `nestjs-telega` ([a8b7418](https://github.com/YSTUty/ystuty-schedule-bot/commit/a8b74189c20d6ba9a9b0b385c313bfb1632e2e89))

### 🐱‍💻 Tests

* **schedule:** stabilize formatter clock ([58a6470](https://github.com/YSTUty/ystuty-schedule-bot/commit/58a647073003cb6a571fd65d67e4874ce94f8b46))

## [0.4.0](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.3.5...v0.4.0) (2026-08-31)

### 🧹 Chore

* add logger for `uncaughtException` / `unhandledRejection` ([d19f12a](https://github.com/YSTUty/ystuty-schedule-bot/commit/d19f12a87f6b4c89daa2bd81da4cb5c6c279c619))
* **app:** display messenger services status by env ([8107643](https://github.com/YSTUty/ystuty-schedule-bot/commit/8107643c6d14a31567bf83a1df049b9c868c7e3f))
* **deps:** update ([7d56863](https://github.com/YSTUty/ystuty-schedule-bot/commit/7d56863cceee185e6407dde73907de0c049dff20))
* **docker:** run migrations before production startup ([fbb0349](https://github.com/YSTUty/ystuty-schedule-bot/commit/fbb03492771eb1b40d82377646111adb0b14ccaf))
* **docker:** update `pgadmin4` version ([fda5038](https://github.com/YSTUty/ystuty-schedule-bot/commit/fda50382803489f846b01ba70d7a9a2f57bf82ad))
* **filter:** update order to switch error content formatter ([66a51e2](https://github.com/YSTUty/ystuty-schedule-bot/commit/66a51e212da04bd940d9d8b3ae3434ece59b4c2f))
* **fix:** update code after update deps ([d26e844](https://github.com/YSTUty/ystuty-schedule-bot/commit/d26e844664b030a9378b5cff87181bf59736977c))
* **husky:** update ([2c39c1d](https://github.com/YSTUty/ystuty-schedule-bot/commit/2c39c1d64f3d09a17ba1666df17c8dad3f9f493c))
* **lint:** resolve safe eslint violations ([d64da9d](https://github.com/YSTUty/ystuty-schedule-bot/commit/d64da9db4661a04b95857a0e08bcb64d7b51ca11))
* **locale:** correct error message of user not rights change group name ([18edcfd](https://github.com/YSTUty/ystuty-schedule-bot/commit/18edcfde9c463b79f465242a93e87397b00f566b))
* **locale:** not show empty group ([d6a7066](https://github.com/YSTUty/ystuty-schedule-bot/commit/d6a7066be1458fab8fa4f09617922b08d48156bd))
* **metrics:** reconcile domain metrics after restart ([a3d53a1](https://github.com/YSTUty/ystuty-schedule-bot/commit/a3d53a1aea93a88bc4810d3a2eaab33f88943ca7))
* **prettier:** format code with sorting imports ([09e14cc](https://github.com/YSTUty/ystuty-schedule-bot/commit/09e14cc1d0540430675799184b638e71ba96b42f))
* **readme:** update header ([4b6ef58](https://github.com/YSTUty/ystuty-schedule-bot/commit/4b6ef585154ce68d397e10ff952ab2b9b8a91dec))
* **social-connect:** add logger for http catchs ([e902102](https://github.com/YSTUty/ystuty-schedule-bot/commit/e902102c444272ce38903f8165586627d7a576df))
* **social-connect:** set `timeout` `15s` for check auth request ([c68b135](https://github.com/YSTUty/ystuty-schedule-bot/commit/c68b135822e1c65e3949ad64c04ee5dd244eea17))
* **social:** add chat `status` and `type` (for telegram) ([676bf18](https://github.com/YSTUty/ystuty-schedule-bot/commit/676bf180b3433e0ca3ac7add63635c2784b89673))
* **telegram:** fix check bot in empty ctx `from` ([6852fa7](https://github.com/YSTUty/ystuty-schedule-bot/commit/6852fa72bfad52c141b4e77fd9aba09e23f5bc7c))
* **telegram:** improve work with event `my_chat_member`; fix check empty `ctx.from` ([c2fe4bc](https://github.com/YSTUty/ystuty-schedule-bot/commit/c2fe4bca6f464bba280956fbc1d530510696c3be))
* update docker & makefile ([9820cb4](https://github.com/YSTUty/ystuty-schedule-bot/commit/9820cb41b0c273dd2d6c17b4d4154958f97a7371))
* **vk:** add dubug for empty `ctx.peerId` ([f6e0736](https://github.com/YSTUty/ystuty-schedule-bot/commit/f6e07366ac27c1b0e1026dbda5995255f446d1c0))
* **vk:** replace url to app button ([b44d404](https://github.com/YSTUty/ystuty-schedule-bot/commit/b44d40420ec3ed788cb61e0c9781e2c13a40b097))
* **vk:** update `nestjs-vk` message event decorator ([da04f12](https://github.com/YSTUty/ystuty-schedule-bot/commit/da04f1228ea22e724b1e509203de85a3da1291e3))
* **vk:** upgrade `nestjs-vk` to `v4.8.0` ([982f621](https://github.com/YSTUty/ystuty-schedule-bot/commit/982f6213276592f0759de0c2b5bbbb2a77dc1325))
* **workspace:** sync changes ([9da92ad](https://github.com/YSTUty/ystuty-schedule-bot/commit/9da92ad886e4c5f9fc7580fe192ee513868b63cb))

### 🚀 Features

* add `unauth` feature (command) ([4779ddc](https://github.com/YSTUty/ystuty-schedule-bot/commit/4779ddc7ae4c19a8552a0431e0ce228ab1192820))
* add update profile feature and `isRewoke` state for user ([c822f9a](https://github.com/YSTUty/ystuty-schedule-bot/commit/c822f9a226d1ed3129b32b6d2ac056ac9ddb7504))
* **bot:** improve private chat onboarding and schedule links ([45c66c3](https://github.com/YSTUty/ystuty-schedule-bot/commit/45c66c3d458d2ac0b0d3248d517a4bc3715a4619))
* **broadcast:** add audience filters ([6fa18fe](https://github.com/YSTUty/ystuty-schedule-bot/commit/6fa18fe7cd7365ca75edb634f42c7b4638440494))
* **broadcast:** add audience history and feedback controls ([5e6f720](https://github.com/YSTUty/ystuty-schedule-bot/commit/5e6f7204e682b21a1a6e97c1716e9d38c0478323))
* **broadcast:** add audience history filters ([d3ae2d6](https://github.com/YSTUty/ystuty-schedule-bot/commit/d3ae2d67e496c1b63c82fe7c639fbe4dc0c9e24a))
* **broadcast:** add interactive group audience filters ([bc4e7dc](https://github.com/YSTUty/ystuty-schedule-bot/commit/bc4e7dc47afc40c8ed73262d8f37693cf9af01c6))
* **broadcast:** add managed messenger broadcast module ([7a7167b](https://github.com/YSTUty/ystuty-schedule-bot/commit/7a7167bd3a65aee937c7fb7fe6c8c154c705d56d))
* **broadcast:** add personal notification opt-out ([69e4607](https://github.com/YSTUty/ystuty-schedule-bot/commit/69e460750fbc15eac59a6e06647e2968c6fbba3e))
* **broadcast:** add progress reporting, queue controls and delivery mode ([9abf7fe](https://github.com/YSTUty/ystuty-schedule-bot/commit/9abf7fec4babd843cf3e33837a918a9aadc36ed0))
* **broadcast:** add recipient action buttons ([f1603e3](https://github.com/YSTUty/ystuty-schedule-bot/commit/f1603e35af33a6758fe0c355063d640101a26c32))
* **broadcast:** add recipient action keyboards ([a62aa70](https://github.com/YSTUty/ystuty-schedule-bot/commit/a62aa709629ed348a944762b142763fcd8e8024c))
* **broadcast:** add reusable campaign settings and callback safeguards ([1bd4e21](https://github.com/YSTUty/ystuty-schedule-bot/commit/1bd4e21da1b9632d4ed1bff6f563a3e13253dbbc))
* **broadcast:** add selective recipients and localized controls ([951e8c3](https://github.com/YSTUty/ystuty-schedule-bot/commit/951e8c344857aaa8353e4d674727fee60f4fc90f))
* **broadcast:** localize notifications ([b59ee7f](https://github.com/YSTUty/ystuty-schedule-bot/commit/b59ee7f65ad80fc3ee055fe221cf7a0579fc948f))
* **broadcast:** manage campaign history with inline controls ([a0056bd](https://github.com/YSTUty/ystuty-schedule-bot/commit/a0056bd1fad2b781e43594aef65fdaf222384172))
* **broadcast:** refine audience and feedback wizard flow ([6421359](https://github.com/YSTUty/ystuty-schedule-bot/commit/6421359d1dbb51e75ae1735c71f72be83cc3602b))
* **broadcast:** refine audience filters and recipient action settings ([44b2a38](https://github.com/YSTUty/ystuty-schedule-bot/commit/44b2a38aefc67630e80912f0f1e392313ebeaf79))
* **broadcast:** reuse versioned campaign settings safely ([e6a8679](https://github.com/YSTUty/ystuty-schedule-bot/commit/e6a86796f494ffc687836df5da1f6e38269b8f54))
* **broadcast:** show configured recipient action labels ([7fec8c1](https://github.com/YSTUty/ystuty-schedule-bot/commit/7fec8c1f9e3accf193d0ac93a61c3b87afaf2ee6))
* **broadcast:** support vk broadcast attachments ([7cdf09f](https://github.com/YSTUty/ystuty-schedule-bot/commit/7cdf09fce8beeb2c5fd247c1dd9ce76458d808dc))
* **commands:** add help fallback and schedule aliases ([79b38ce](https://github.com/YSTUty/ystuty-schedule-bot/commit/79b38ced7b98b0e6d2be959c7be183d1d14873af))
* **common:** add html escaping utility ([7298b0c](https://github.com/YSTUty/ystuty-schedule-bot/commit/7298b0c304fd6e3400c8df9f89f7fa3cc705eedb))
* **concurrency:** add local and distributed synchronization ([5ba507f](https://github.com/YSTUty/ystuty-schedule-bot/commit/5ba507f4052cf39988ff34511476e76b55436bd1))
* **conversations:** reconcile bot membership in chats ([86f04cb](https://github.com/YSTUty/ystuty-schedule-bot/commit/86f04cb464d8fb87478d56607e20d39f4868c5a9))
* **database:** add typeorm migrations ([622883a](https://github.com/YSTUty/ystuty-schedule-bot/commit/622883adbfe9f991ef6678edbf3b25b6692f5e1f))
* **deps:** update `nestjs` to v11 and other modules ([6ce4a64](https://github.com/YSTUty/ystuty-schedule-bot/commit/6ce4a642bc91dc5d08c67a78506338fea13fc351))
* **feedback:** add guided feedback collection ([73b03c0](https://github.com/YSTUty/ystuty-schedule-bot/commit/73b03c0df4ada11219ee57ab9342c6efc87f2684))
* **feedback:** add user feedback flow ([e924ad6](https://github.com/YSTUty/ystuty-schedule-bot/commit/e924ad6bb9915834a43a01c2c3fc92e6e67078d9))
* **schedule-notif:** support conversation schedule notifications ([c3a516c](https://github.com/YSTUty/ystuty-schedule-bot/commit/c3a516c82aa2591191d8c5cf47601718979af2fc))
* **schedule:** add detailed schedule presentation ([9a6b477](https://github.com/YSTUty/ystuty-schedule-bot/commit/9a6b47721598ac7c64d1a928b1e7308590f97993))
* **schedule:** add personal schedule notification settings ([4eb17cc](https://github.com/YSTUty/ystuty-schedule-bot/commit/4eb17ccbe94a99e291c79b3313afab481dea6f91))
* **schedule:** add teacher schedule selection for tg and vk ([fa1acd7](https://github.com/YSTUty/ystuty-schedule-bot/commit/fa1acd75b7ec7f04597c1185404d4c2dffb2625a))
* **schedule:** add verbal teacher schedule commands ([8b3877a](https://github.com/YSTUty/ystuty-schedule-bot/commit/8b3877ae6c44ba5dd1491f31206d4bd8d53d1700))
* **schedule:** check schedule result on error for notice ([aaf6b9b](https://github.com/YSTUty/ystuty-schedule-bot/commit/aaf6b9b8da35ff632e74dc0ba56ab1514d2ab605))
* **schedule:** clarify group and teacher selection ([cea1982](https://github.com/YSTUty/ystuty-schedule-bot/commit/cea1982c4ff4f2c2b255e68855ac446c17669dcc))
* **schedule:** normalize group names in message handlers ([48ce522](https://github.com/YSTUty/ystuty-schedule-bot/commit/48ce5227cbc96294d7d72f3b04b8337e6b5f1281))
* **teacher:** add name search fallback for dm ([f0320fb](https://github.com/YSTUty/ystuty-schedule-bot/commit/f0320fb8a5410ee7c8d2bd2a170c652b651147cb))
* **telegram:** add `sendMessageDraft` ctx method ([a75bea9](https://github.com/YSTUty/ystuty-schedule-bot/commit/a75bea91e97a40fb9cf22a4735f27a7b747b3ce8))
* **telegram:** add admin send adv message with callback user button ([6d9e94b](https://github.com/YSTUty/ystuty-schedule-bot/commit/6d9e94badd0f49d4a24538c99c99dc5cf0f83c4a))
* **telegram:** add custom `apiRoot` ([866bdbe](https://github.com/YSTUty/ystuty-schedule-bot/commit/866bdbef629a2edc14f4d67efbb8c0a7c9567bb2))
* **telegram:** add feature for select group from list (with select institute for filter) ([ed87f6f](https://github.com/YSTUty/ystuty-schedule-bot/commit/ed87f6f123bf5eb13d6ced862455bb7c55ff46d8))
* **telegram:** add personalized command menus ([f304d75](https://github.com/YSTUty/ystuty-schedule-bot/commit/f304d751e0892d22f30827886dd98501d3443e77))
* **vk:** acknowledge unhandled callback events ([2659cc1](https://github.com/YSTUty/ystuty-schedule-bot/commit/2659cc12ade00d18d43c7e9fb19e85305ecbab03))
* **vk:** add institute and group selection flow ([b999ff8](https://github.com/YSTUty/ystuty-schedule-bot/commit/b999ff88ec2be99991d8366a14868889ac92d332))
* **welcome:** add private chat feature card ([5303fea](https://github.com/YSTUty/ystuty-schedule-bot/commit/5303feaf134b117e29560213d3887971d4215f97))

### 🐛 Bug Fixes

* **bot:** harden telegram and vk middleware error handling ([fa1e2d6](https://github.com/YSTUty/ystuty-schedule-bot/commit/fa1e2d60e16afe5345952a21809ea6a2da308a46))
* **broadcast:** handle active campaigns and source replies ([2e20b67](https://github.com/YSTUty/ystuty-schedule-bot/commit/2e20b671beab3e6ccc70fbd1d8a9b94387f8c9db))
* **broadcast:** handle scene callbacks and settings template data ([5e16146](https://github.com/YSTUty/ystuty-schedule-bot/commit/5e16146733704fd0387e3fdc1ae98b89d883936d))
* **broadcast:** send telegram forward keyboards separately ([83fc624](https://github.com/YSTUty/ystuty-schedule-bot/commit/83fc624ae0631039efab93dcfe79bfffb4bbd472))
* **broadcast:** split queues by messenger transport ([b8b660b](https://github.com/YSTUty/ystuty-schedule-bot/commit/b8b660b9bc384593cbf06c5e9fa6463dbcf591e2))
* **broadcast:** support feedback button post-click modes ([d9022be](https://github.com/YSTUty/ystuty-schedule-bot/commit/d9022be11077a4b68b9dee20ac22d1089631cd1f))
* **common:** add feature suuport `toJSON` for `BigInt` ([ac12a49](https://github.com/YSTUty/ystuty-schedule-bot/commit/ac12a4949cf75966e8b112766d7eede3ff47e542))
* **conversations:** reconcile recently restored bot memberships ([3721d17](https://github.com/YSTUty/ystuty-schedule-bot/commit/3721d17a603e32487840ac1bd8c61a458449eb78))
* **conversations:** track bot membership lifecycle ([ab3a575](https://github.com/YSTUty/ystuty-schedule-bot/commit/ab3a57599cf19f3015acefd4c5d0a4fba4122066))
* **conversation:** track bot removal from vk chats ([b5a5681](https://github.com/YSTUty/ystuty-schedule-bot/commit/b5a56816214fdcc469e5ab22c86817101e6d27a9))
* **database:** align migrations with entity metadata ([2d51567](https://github.com/YSTUty/ystuty-schedule-bot/commit/2d5156750c6142a0fb764d667ab99ce29fddd72f))
* **db:** model conversation memberships explicitly ([f3fea87](https://github.com/YSTUty/ystuty-schedule-bot/commit/f3fea871dd6d7d20252a3992d006245eaae46e8c))
* **deps:** downgrade `@nestjs/typeorm` to `11.0.0` ([9d2f377](https://github.com/YSTUty/ystuty-schedule-bot/commit/9d2f3774bd3c6d8e5cfd8e4a548ed0cb7f1245ee))
* **entities:** align nullable fields with strict types ([2c7acf3](https://github.com/YSTUty/ystuty-schedule-bot/commit/2c7acf35468a10248276b186d94897b22d3349fa))
* **husky:** load nvm for git hooks ([38d5c76](https://github.com/YSTUty/ystuty-schedule-bot/commit/38d5c76003cdddabfbba502778c919ebde6e72a5))
* **oauth:** align auth info response fields ([5ae9678](https://github.com/YSTUty/ystuty-schedule-bot/commit/5ae9678d67eb009251d3cc010f1227e87c095c12))
* **schedule-notification:** improve editing flows and vk keyboard limits ([1b41ffc](https://github.com/YSTUty/ystuty-schedule-bot/commit/1b41ffc6c01d78ab1dc7843e6f5155b0dc3fc1e4))
* **schedule-notification:** stabilize notification flows and keyboards ([ebf758f](https://github.com/YSTUty/ystuty-schedule-bot/commit/ebf758f5a40a9b26bf61ce9c103b5d545342b4fa))
* **schedule-notif:** normalize manual group input ([5e3e991](https://github.com/YSTUty/ystuty-schedule-bot/commit/5e3e991afc2bb1b0a0e93dbad2040905502944ee))
* **schedule:** deduplicate reference data refresh logs ([deb6c73](https://github.com/YSTUty/ystuty-schedule-bot/commit/deb6c7362293a67a2b561d730ee9c925b5c3e3c0))
* **schedule:** fix typo in weekly schedule ([58ac676](https://github.com/YSTUty/ystuty-schedule-bot/commit/58ac67680d02eda48e728af5b5e633cc007e4017))
* **schedule:** format dates in `Moscow` timezone ([cb05a53](https://github.com/YSTUty/ystuty-schedule-bot/commit/cb05a53d58ac9886dbc5aea90a3832adabdf892a))
* **schedule:** isolate teacher list pagination state ([ac635b5](https://github.com/YSTUty/ystuty-schedule-bot/commit/ac635b5bdd86c9e02facfa3781a222eaa62817f9))
* **telegram:** acknowledge callbacks before processing ([9906777](https://github.com/YSTUty/ystuty-schedule-bot/commit/9906777f9f82de3421af6b9c1c357a8c863a7aa9))
* **telegram:** defer unhandled private message fallback ([0b35eab](https://github.com/YSTUty/ystuty-schedule-bot/commit/0b35eabe7bb058b027b40b706276fd348df3cedd))
* **telegram:** fix undefined last name ([e40d1f0](https://github.com/YSTUty/ystuty-schedule-bot/commit/e40d1f09ba5412dc0c0f42abbc042bed6de43520))
* **telegram:** handle group selection callbacks ([ce2a40c](https://github.com/YSTUty/ystuty-schedule-bot/commit/ce2a40c6d85b1252f7196621016882ab209f85c8))
* **telegram:** persist group selected from chat callback ([2f64cfd](https://github.com/YSTUty/ystuty-schedule-bot/commit/2f64cfd1c87f03ba152d2c5b5417705ab7453dae))
* **transports:** reply only to unhandled private texts ([54f9221](https://github.com/YSTUty/ystuty-schedule-bot/commit/54f92211fd20e765e106017cf8a6726b2d104fe4))
* **transports:** retry redis session load on transient failures ([f61d879](https://github.com/YSTUty/ystuty-schedule-bot/commit/f61d8792277067268941f5fc375c3fd3f522378e))
* **user:** preserve nullable social relation ([a0cb317](https://github.com/YSTUty/ystuty-schedule-bot/commit/a0cb317657386b62346dcec9e002fc2f99eb145f))
* **vk:** continue message event handlers after admin guard skip ([2f7d7fd](https://github.com/YSTUty/ystuty-schedule-bot/commit/2f7d7fd1a428b0eef8ab69f0ce1e96361276096b))
* **vk:** derive peer context lazily ([ad54a87](https://github.com/YSTUty/ystuty-schedule-bot/commit/ad54a87cfae72eca111a3087d113d182ed5b0427))
* **vk:** handle scene cancellation from callback events ([16de5b4](https://github.com/YSTUty/ystuty-schedule-bot/commit/16de5b46a39b84790943e59a74c13753291ba61c))
* **vk:** make message event acknowledgements idempotent ([05ac2e3](https://github.com/YSTUty/ystuty-schedule-bot/commit/05ac2e3f4483f19a5f09fef0f6682d05f44f2b4e))
* **vk:** normalize peer context in middleware ([7b2a6ba](https://github.com/YSTUty/ystuty-schedule-bot/commit/7b2a6ba55d4f3443d6ef9a6bcd4236ea54c37ca3))
* **vk:** normalize peer context in middleware if unset ([b5aa2ae](https://github.com/YSTUty/ystuty-schedule-bot/commit/b5aa2ae9575e956adb8029f1608813f50a3c3684))
* **vk:** recreate sticker broadcasts after feedback ([98736a7](https://github.com/YSTUty/ystuty-schedule-bot/commit/98736a74f1ed6b5abcd534cbbeb63c6b53dca3b1))
* **vk:** render recipient action scenes on entry ([1dd8314](https://github.com/YSTUty/ystuty-schedule-bot/commit/1dd8314ebd4c5a203ed257675a53b6a8e1d9dc89))
* **vk:** track message subscription change ([6bbbfd2](https://github.com/YSTUty/ystuty-schedule-bot/commit/6bbbfd23273e2a1720da9a53e36490d1e3432898))

### 🌟 Feature Improvements

* **bot:** defer private text fallback and clarify help guidance ([61c47ea](https://github.com/YSTUty/ystuty-schedule-bot/commit/61c47ea60599ba4ec09d4aac1da7b25af0a6d2a9))
* **core:** align shared messenger code and strict null checks ([122e798](https://github.com/YSTUty/ystuty-schedule-bot/commit/122e798776d98d7f2665175f9450feb64c521a0a))
* **guard:** add silent skips and telegram chat type checks ([783b3b9](https://github.com/YSTUty/ystuty-schedule-bot/commit/783b3b99e1ff2917f25be855855e81506aa1ac12))
* **locales:** polish ru copy and validate templates ([f9730ea](https://github.com/YSTUty/ystuty-schedule-bot/commit/f9730ea7bd89ab068edb6b65f5aed9bfa5a932c5))

### 📖 Documentation

* **project:** add info architecture and todo docs ([2a02bd1](https://github.com/YSTUty/ystuty-schedule-bot/commit/2a02bd1e6b9bff7fc6ab150423f11a8e2e6e548f))
* refresh project documentation and backlog ([d2c253c](https://github.com/YSTUty/ystuty-schedule-bot/commit/d2c253c0464cdbe2d5581f7c826a5140eaf4b172))
* **todo:** refresh completed tasks ([75fa86b](https://github.com/YSTUty/ystuty-schedule-bot/commit/75fa86b22bd6e2bbbe0302612253cf8cad72ea85))

### ☯ Styling

* **locales:** add emojis to broadcast and feedback controls ([3255180](https://github.com/YSTUty/ystuty-schedule-bot/commit/3255180a2e722e547715c5f5eb1fcc9db6e7a262))
* **locales:** simplify help messages ([c95d73f](https://github.com/YSTUty/ystuty-schedule-bot/commit/c95d73fff1bc35fe84a89dd1aa47fd22d1333cbc))

### 🔧 Code Refactoring

* **conversation:** persist selected chat group ([b1cbde1](https://github.com/YSTUty/ystuty-schedule-bot/commit/b1cbde19d47eb3b55210e2b8880e96063266ba49))
* **keyboard:** split pagination builders by transport ([08e5874](https://github.com/YSTUty/ystuty-schedule-bot/commit/08e58742a9a57af32cd79777a1a2249067272547))
* **schedule-notif:** shorten module naming ([c26aff9](https://github.com/YSTUty/ystuty-schedule-bot/commit/c26aff907c0c0c4aa4716998dac11e997d31a974))
* **schedule:** rename ystuty module ([c760666](https://github.com/YSTUty/ystuty-schedule-bot/commit/c7606667c08d84fb29820c46f62a59d46579c61e))
* update types ([1923436](https://github.com/YSTUty/ystuty-schedule-bot/commit/192343668c251984317f2fc32217d4b6e1457322))
* **user:** guard inactive messenger auth flow ([ce9af14](https://github.com/YSTUty/ystuty-schedule-bot/commit/ce9af14b47c41557132d9a57bf281ced7c4ed81b))

### 💪 Performance Improvements

* **conversations:** cache transport admin lookups ([d0d3014](https://github.com/YSTUty/ystuty-schedule-bot/commit/d0d30141ac13e3bf1492ad000af8d3a3504da11f))

### 🐱‍💻 Tests

* **concurrency:** cover distributed lock failures ([f929c7e](https://github.com/YSTUty/ystuty-schedule-bot/commit/f929c7e64531c203ee4a24604c64775feab9db4c))
* **telegram:** add group pattern admin check ([3ef97ea](https://github.com/YSTUty/ystuty-schedule-bot/commit/3ef97ea52937ee888c5bd4e1b8d141bd4ac74d9d))
* **transports:** expand vk and telegram coverage ([cf31593](https://github.com/YSTUty/ystuty-schedule-bot/commit/cf31593dfa0c407d172db3a825b1133eaa20aeeb))

### 🔨 Build System

* **docker:** upgrade runtime to node 24 ([424333e](https://github.com/YSTUty/ystuty-schedule-bot/commit/424333e78f416085aa1d0db14b133a00456755ed))
* **release:** replace `standard-version` with `release-it` ([5f620ce](https://github.com/YSTUty/ystuty-schedule-bot/commit/5f620ceaa322a42f23ad0f73a697e732e6c232de))

### 🛠️ CI

* add build and test workflow ([8b5b28c](https://github.com/YSTUty/ystuty-schedule-bot/commit/8b5b28cc5b9151adeeb5bdc9da55a93cab247d04))
* **deploy:** publish multi-arch docker images to `ghcr.io` ([7f10bdb](https://github.com/YSTUty/ystuty-schedule-bot/commit/7f10bdb81783929ed87ef2621f5d3e505fcafc69))
* **deploy:** set lower repository name ([7fe5d1c](https://github.com/YSTUty/ystuty-schedule-bot/commit/7fe5d1c55db37f5f19b1c7db1835399c9be073dd))

### [0.3.5](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.3.4...v0.3.5) (2024-09-11)


### 🧹 Chore

* **social:** fix no resave unchanged values ([b104d9f](https://github.com/YSTUty/ystuty-schedule-bot/commit/b104d9f135de62d17be7c6a8719bb01c8a222625))
* **social:** not inc users with not has `DM` ([5de443e](https://github.com/YSTUty/ystuty-schedule-bot/commit/5de443e44db5c1887299de6f7b1c57e2bd5ee645))
* **user-social:** transform `socialId` to bigint ([a219789](https://github.com/YSTUty/ystuty-schedule-bot/commit/a2197894d0c91e79f303a53ecec6cc09616d31b8))
* **util:** improve regexp pattern for group name ([2344966](https://github.com/YSTUty/ystuty-schedule-bot/commit/234496664a9dcd57461dfb2c237bf51bc422843a))
* **vk:** update test display list groups & teachers ([04c2ef1](https://github.com/YSTUty/ystuty-schedule-bot/commit/04c2ef1615417e9794b984ba3edc60be9814ccef))


### 🐛 Bug Fixes

* **vk:** fix typos in state name ([9c2ce1f](https://github.com/YSTUty/ystuty-schedule-bot/commit/9c2ce1f5271277b5a6eddae83268da2335b2249d))


### 🚀 Features

* **social:** add entity for social `conversation` ([a7f7550](https://github.com/YSTUty/ystuty-schedule-bot/commit/a7f7550eb18e4336f69c56092f1f5bfd9e178bad))

### [0.3.4](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.3.3...v0.3.4) (2024-09-11)


### 🐛 Bug Fixes

* **user:** remove length from `avatarUrl` user social entity ([ee04a85](https://github.com/YSTUty/ystuty-schedule-bot/commit/ee04a8570d460c911eec7aa76f5dd12266c5b5f1))
* **util:** improve regexp pattern for group name ([a7ef7cb](https://github.com/YSTUty/ystuty-schedule-bot/commit/a7ef7cb751450127d56d9b790227ea93303e3430))


### 🧹 Chore

* **social-connect:** format axios error log ([051e511](https://github.com/YSTUty/ystuty-schedule-bot/commit/051e511ccd9a51e99c9f17476d1e27e75ffc052b))
* **social:** save user `displayname` on `createUserSocial` ([21545f2](https://github.com/YSTUty/ystuty-schedule-bot/commit/21545f2dca3b5f8815ec314a8e97d772c02e56b2))
* **util:** add catching of compile `tg` phrase error ([65d3bb3](https://github.com/YSTUty/ystuty-schedule-bot/commit/65d3bb35e12ca679a015196ec7ee39629c478386))
* **vk:** add check `cancel` condition for exit from scene ([09ff0a1](https://github.com/YSTUty/ystuty-schedule-bot/commit/09ff0a1a26d17fd1654a226ec9828aaabbb5f8b0))

### [0.3.3](https://github.com/YSTUty/ystuty-schedule-bot/compare/v0.3.2...v0.3.3) (2024-09-06)


### 🐛 Bug Fixes

* **schedule:** fix calc week ([a0c5e90](https://github.com/YSTUty/ystuty-schedule-bot/commit/a0c5e9098c4e078ac38965559b5c8ac4720d5492))
* **telegram:** check of empty `reply_parameters.message_id` ([cea54ca](https://github.com/YSTUty/ystuty-schedule-bot/commit/cea54ca317877ff5f540b19d7fb96eeee942ee87))


### 🧹 Chore

* add locale to `toLocaleDateString` ([9f58f58](https://github.com/YSTUty/ystuty-schedule-bot/commit/9f58f587bf4f2263e0bd72361e6fd0bd7dcd2eea))
* add more `await` for messenger api execution (safe catcher) ([2b06d7c](https://github.com/YSTUty/ystuty-schedule-bot/commit/2b06d7c1c85fe8b399d2fef67f80dfc11f70cefd))
* **common:** telegram exception reply target message ([45c25c4](https://github.com/YSTUty/ystuty-schedule-bot/commit/45c25c4fbf42249cc87b9c2b658c61b507451187))
* **loacle:** fix typos ([bb86fdf](https://github.com/YSTUty/ystuty-schedule-bot/commit/bb86fdfe6c6d87abe5d24e64ab3797e49da72270))
* remove deprecated `YSTUTY_PARSER_URL` ([a931f7d](https://github.com/YSTUty/ystuty-schedule-bot/commit/a931f7d81ad39126a1a4ff74125ff5f6f81f54c2))
* remove old semester schedule ([1ce2d31](https://github.com/YSTUty/ystuty-schedule-bot/commit/1ce2d31067c71fcb343bbca4324c633f6c323b7a))
* **telegram:** add test `update_profile` command ([e13a5e7](https://github.com/YSTUty/ystuty-schedule-bot/commit/e13a5e7742e37295b5537981ec638d1cd58cbbda))
* translate info msg to ru in `parseChatTitle` ([5a564fa](https://github.com/YSTUty/ystuty-schedule-bot/commit/5a564facc39b5e17b34f9c1eccaa164140de8ca6))
* **tsconfig:** up target to `es2018` ([e5adc5d](https://github.com/YSTUty/ystuty-schedule-bot/commit/e5adc5d26ea726af905b9daa05fe3cb28cd805b2))


### 🚀 Features

* **teacher:** add simple features for teacher schedule (telegram only) ([a8be191](https://github.com/YSTUty/ystuty-schedule-bot/commit/a8be1912830bea5b4970927a49dbf90cf2a18c60))

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
