# Changelog

## [0.3.5](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.3.4...up-provider-v0.3.5) (2025-02-26)


### Bug Fixes

* Cleanup further but this can wait. ([4b35555](https://github.com/lukso-network/tools-up-provider/commit/4b3555535ee3027a02193ee8e12103c047ba9438))
* Repair initial ping. ([60a8b38](https://github.com/lukso-network/tools-up-provider/commit/60a8b3893914bb5347c4de6e7c4a3563dfceb26c))

## [0.3.4](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.3.3...up-provider-v0.3.4) (2025-02-22)


### Bug Fixes

* Repair initialization timing problem. #accounts was out of sync with accounts. ([84c09fe](https://github.com/lukso-network/tools-up-provider/commit/84c09fe67cd79b1f60d3d14519727501e9cf304a))

## [0.3.3](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.3.2...up-provider-v0.3.3) (2025-02-13)


### Bug Fixes

* Check for provider being null/undefined on global provider ([4cac4f0](https://github.com/lukso-network/tools-up-provider/commit/4cac4f08e44e3b2fb9603b3050b57f2b6fd50f74))
* Move to setEnabled for resume ([43381d8](https://github.com/lukso-network/tools-up-provider/commit/43381d810a8e7f5d52762d8ece92d10fa65d74f6))
* resume event handling on channel after it's setup. ([2faaf34](https://github.com/lukso-network/tools-up-provider/commit/2faaf343863c38727465f1e4050b49156d198e53))

## [0.3.2](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.3.1...up-provider-v0.3.2) (2025-01-24)


### Bug Fixes

* Add new sentTransaction event to each channel ([9d48dad](https://github.com/lukso-network/tools-up-provider/commit/9d48dad1b6a42d6ca08641fa55e23f15ba44052d))

## [0.3.1](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.3.0...up-provider-v0.3.1) (2025-01-10)


### Bug Fixes

* Fix recursion ([3290715](https://github.com/lukso-network/tools-up-provider/commit/3290715ec50ead56262cd040455e3be37531d161))

## [0.3.0](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.2.2...up-provider-v0.3.0) (2025-01-10)


### Features

* Allow proxies to work ([6518583](https://github.com/lukso-network/tools-up-provider/commit/6518583eecb71b454f5829aeff7a521ea3c7f287))

## [0.2.2](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.2.1...up-provider-v0.2.2) (2025-01-02)


### Bug Fixes

* Add some comments ([865f456](https://github.com/lukso-network/tools-up-provider/commit/865f456b479c084aa4d0a913628c4010f7d8d801))
* Some more cleanup ([4e63d76](https://github.com/lukso-network/tools-up-provider/commit/4e63d76a1b972a10756443177ebbb5f6595a90a8))
* Some upgrades ([09b7425](https://github.com/lukso-network/tools-up-provider/commit/09b74258e55c25bd8e6ce3f80ed4208555b91dac))

## [0.2.1](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.2.0...up-provider-v0.2.1) (2024-12-11)


### Bug Fixes

* Remove readme from packages folder and put it at the root ([054d914](https://github.com/lukso-network/tools-up-provider/commit/054d914d2055a38e3ddabc38d63eb21f23f84862))

## [0.2.0](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.7...up-provider-v0.2.0) (2024-12-10)


### Features

* Add new api to keep addresses and connected addresses separate ([f788de3](https://github.com/lukso-network/tools-up-provider/commit/f788de3a9c5393ee489e583a49caa12f9b07e747))


### Bug Fixes

* Refactor to new names ([51d0f79](https://github.com/lukso-network/tools-up-provider/commit/51d0f79ff3205be6a1633f830d7154a0666f9697))

## [0.1.7](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.6...up-provider-v0.1.7) (2024-12-10)


### Bug Fixes

* Refactor so all components use the same isEmptyAccount ([932304e](https://github.com/lukso-network/tools-up-provider/commit/932304e288e4e7186561928518a4c720f0e9949a))

## [0.1.6](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.5...up-provider-v0.1.6) (2024-12-07)


### Bug Fixes

* Switch to using null address ([447af37](https://github.com/lukso-network/tools-up-provider/commit/447af37acb9b2804831acd8d028e439f53fdc9cf))

## [0.1.5](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.4...up-provider-v0.1.5) (2024-12-07)


### Bug Fixes

* Add isEmptyAccount ([c383044](https://github.com/lukso-network/tools-up-provider/commit/c38304474bce213f0ba63bfcef47580aa9441a62))
* Add some more docs ([943123f](https://github.com/lukso-network/tools-up-provider/commit/943123f9040eccf05cbed0fb0065bd98674da6c6))
* Cleanup wrong null or undefined. ([fbae586](https://github.com/lukso-network/tools-up-provider/commit/fbae5866b8ae907e7aa59867219fb22d1198f1d2))
* Do some more repairs ([07b7dbb](https://github.com/lukso-network/tools-up-provider/commit/07b7dbb9bec0995748edc885c3b33a62f0733769))
* More work ([c84ea8e](https://github.com/lukso-network/tools-up-provider/commit/c84ea8e9c3864f22a31b09bf90929a8da1151a7a))
* Repair, unfortunately we cannot skip an account ([8d58881](https://github.com/lukso-network/tools-up-provider/commit/8d58881d024edb2baadb33dea0fd291511e1c9a1))

## [0.1.4](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.3...up-provider-v0.1.4) (2024-11-18)


### Bug Fixes

* Add lit dep ([cf4df29](https://github.com/lukso-network/tools-up-provider/commit/cf4df295e5eff82cde13584fa403775378733d6d))
* Add popup test. ([87ee8dc](https://github.com/lukso-network/tools-up-provider/commit/87ee8dc07fbe8e9447ae28f4e0c86978620b6160))
* Better optional types. ([f35c180](https://github.com/lukso-network/tools-up-provider/commit/f35c180743bd721a22136ccbc841198161ea3a05))
* Fix ([ac18ade](https://github.com/lukso-network/tools-up-provider/commit/ac18adee10dd99d7e66b898a71b8d34a4a725437))
* Further simplification of params ([b170fb1](https://github.com/lukso-network/tools-up-provider/commit/b170fb13946d2ba125435fc6bb293358825f2905))
* Repair ([def72c6](https://github.com/lukso-network/tools-up-provider/commit/def72c65b72f6e6c78d6a049b63bd66fe35f360a))
* Repair request parameters ([74208dd](https://github.com/lukso-network/tools-up-provider/commit/74208dd56fabc45791868bdba8c3eef14d985543))

## [0.1.3](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.2...up-provider-v0.1.3) (2024-10-30)


### Bug Fixes

* Add some more docs ([ff6e4ac](https://github.com/lukso-network/tools-up-provider/commit/ff6e4ac889a516f1995d38a513902bccb3ba830b))
* Repair docs since npmjs doesn't seem to render mermaid. ([41fbbe6](https://github.com/lukso-network/tools-up-provider/commit/41fbbe6cc48547dca1086fc73dd6400aa4849156))

## [0.1.2](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.1...up-provider-v0.1.2) (2024-10-30)


### Bug Fixes

* Release please not configured correctly ([d23f1cd](https://github.com/lukso-network/tools-up-provider/commit/d23f1cd87c47c772534c9626a9a1322b7f4e36ec))
* Repair ([29b0d21](https://github.com/lukso-network/tools-up-provider/commit/29b0d21235eb02eb074377e2942254fea1cb8328))

## [0.1.1](https://github.com/lukso-network/tools-up-provider/compare/up-provider-v0.1.0...up-provider-v0.1.1) (2024-10-29)


### Bug Fixes

* Add astro example ([060f216](https://github.com/lukso-network/tools-up-provider/commit/060f216276d6508a62e7db36065485cd06b7ebf3))
* Cleanup ([f94b3b4](https://github.com/lukso-network/tools-up-provider/commit/f94b3b418d7fe6c4d89f415e0d5b8890c748df58))
* Repair build (docs were causing problems) ([8d15fb8](https://github.com/lukso-network/tools-up-provider/commit/8d15fb89de01962c5447b77abd215d0b1c760079))
* Some more work. Cross frame security is going to be hard to circumvent. ([4186015](https://github.com/lukso-network/tools-up-provider/commit/4186015cc538f9c3f0312f5b0637631116e43363))
* Testing ([201adb3](https://github.com/lukso-network/tools-up-provider/commit/201adb322757e6171e0c0db4a458dc6c80405ddf))
