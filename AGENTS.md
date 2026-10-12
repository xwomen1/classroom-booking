# Repository Guidelines

## Project Structure & Module Organization

This repository contains several related projects. `code/booking_classroom` is the React Native/TypeScript Android app; its feature modules and shared code live under `src/modules`, `src/shared`, and `src/core`. App tests are in `src/__tests__` and module test folders. `code/booking-server` is the Java 17/Spring Boot API, with production code under `src/main` and tests under `src/test`. `tunghv2` contains the SmartLock simulator and `tunghv3` a legacy gateway; treat them as separate projects. Root-level PDFs and TeX files are project documentation and diagrams.

## Build, Test, and Development Commands

Run app commands from `code/booking_classroom`:

- `npm ci` installs the locked JavaScript dependencies.
- `npm start` starts Metro; `npm run android` launches the Android app.
- `npm test` runs Jest; `npm run lint` runs ESLint.
- `npm run build:android:debug` or `npm run build:android:release` builds the Android APK.

Run backend commands from `code/booking-server`:

- `mvn spring-boot:run` starts the local API.
- `mvn test` runs the backend integration tests.

## Coding Style & Naming Conventions

Follow the existing TypeScript formatting: Prettier config is in `.prettierrc.js`, ESLint config in `.eslintrc.js`, and TypeScript settings in `tsconfig.json`. Keep feature-specific code within its module; use descriptive component and type names in PascalCase, and functions and variables in camelCase. Follow neighboring Java package, class, and test naming patterns; use standard Maven layout.

## Testing Guidelines

Add or update tests alongside the affected app module or under the backend's `src/test` tree. Use Jest test files matching the existing `*.test.ts` or `*.test.tsx` patterns and Maven's standard test naming. Run the relevant test command above when changing behavior; no repository-wide coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent history uses short, direct commit subjects, often describing the affected feature or fix (for example, `fix room filter` or `sync api be`). Keep commits focused and use imperative subjects. PRs should summarize the behavior change, identify affected app/server areas, link related issues when available, and include screenshots for UI changes. Note relevant test/build commands and their results.

## Security & Configuration

Do not commit credentials, OneIoT tokens, local database files, generated APKs, or build output. Keep machine-specific settings in ignored local configuration or environment variables; review the relevant project README before enabling remote sync or remote database profiles.
