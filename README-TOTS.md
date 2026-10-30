# Tots

Tots is a bots app for Android, built on top of [T3 Code](https://github.com/pingdotgg/t3code). It works like Grok Bot, OpenAI Dots or Claude Duet: you talk with bots and teams of bots, not with a coding tool.

> [!IMPORTANT]
> Tots is an **unofficial** fork. It is not made by, endorsed by, or tied to T3 Tools Inc. For T3 Code itself, use the [official project](https://github.com/pingdotgg/t3code).

## What it does

- **Bots.** A bot is a long-lived T3 Code thread with a name, a role, an emoji and a color. The T3 Code server is the source of truth: the app finds bots on your server and lets you save them.
- **Chats.** Each bot has one continuous main chat. You can also start fresh threads with the same bot.
- **Memory.** Each bot keeps a short memory file on the server, shared by all its threads, so a new thread still knows your preferences and earlier work.
- **Teams.** A lead bot hands out work to its teammates. The team chat merges their threads, and bot-to-bot messages show as cards.
- **Scheduled.** Routines that run on a timer, built on T3 Code scheduled tasks.

All Tots code lives in `apps/mobile/src/features/bots` and `apps/mobile/src/features/tots`. The T3 Code server and contracts are not changed, so Tots works with a stock T3 Code server.

## Build the Android APK

You build with your own [Expo](https://expo.dev) account. Nothing in this repo points at a Tots account.

1. Create an Expo project and note its owner (your Expo user or org) and project id.
2. Pick your own Android package name, for example `com.yourname.tots`.
3. Set these values as EAS environment variables (`eas env:create`) for the `preview` environment, so local runs and EAS build servers see the same values:

   | Variable                 | Value                        |
   | ------------------------ | ---------------------------- |
   | `T3CODE_EAS_OWNER`       | your Expo owner              |
   | `T3CODE_EAS_PROJECT_ID`  | your Expo project id         |
   | `T3CODE_ANDROID_PACKAGE` | your package name            |
   | `T3CODE_APP_NAME`        | `Tots` (or any name)         |
   | `T3CODE_BRAND`           | `tots` (uses the Tots icons) |

   Also export them in your shell before you run `eas`, because `app.config.ts` reads them locally too.

4. In `apps/mobile/eas.json`, change `T3CODE_ANDROID_PACKAGE` in the `tots-apk` profile to your package name.
5. Build from `apps/mobile`:

   ```sh
   npx eas-cli@latest build --platform android --profile tots-apk
   ```

   The profile builds an arm64-v8a APK on the `bots` update channel.

6. Ship JavaScript-only changes as an over-the-air update:

   ```sh
   APP_VARIANT=preview npx eas-cli@latest update --channel bots --platform android --environment preview --message "..."
   ```

Push notifications need your own Firebase project: set `T3CODE_ANDROID_GOOGLE_SERVICES_FILE` to your `google-services.json` path. Never commit that file.

Pair the app with your T3 Code server the same way as the official app.

## License

MIT, like T3 Code. See [LICENSE](./LICENSE). The original copyright belongs to T3 Tools Inc.
