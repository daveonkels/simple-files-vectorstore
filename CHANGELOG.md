# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7] - 2025-03-31

### Added
- Support for `WATCH_CONFIG_FILE` environment variable to specify a JSON configuration file with a `watchList` array of directories/files to watch
- New `WatchConfig` interface in types.ts to define the structure of the configuration file
- Comprehensive test suite for the new feature in `src/__tests__/watchConfig.test.ts`
- Documentation in README.md for the new feature

### Changed
- Updated error message when no directories are specified to mention both `WATCH_DIRECTORIES` and `WATCH_CONFIG_FILE` options
- Made `WATCH_CONFIG_FILE` and `WATCH_DIRECTORIES` mutually exclusive, with `WATCH_CONFIG_FILE` taking precedence if both are set

## [0.1.6] - Previous version

Initial release with basic functionality.
