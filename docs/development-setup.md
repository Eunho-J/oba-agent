# Development Setup

Updated: 2026-05-30

## Installed locally

- JDK 21: `/opt/homebrew/opt/openjdk@21`
- Gradle 8: `/opt/homebrew/opt/gradle@8`
- Android command-line tools: `/opt/homebrew/share/android-commandlinetools`
- Android SDK packages:
  - `platform-tools`
  - `platforms;android-35`
  - `build-tools;35.0.0`

The zsh environment is configured in `~/.zshrc` and `~/.zprofile`:

```zsh
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/opt/gradle@8/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

## Verification

```bash
java -version
gradle -v
sdkmanager --version
adb version
npm test
npm run qa:e2e
npm run qa:legacy-runtime-scan
cd apps/android && ./gradlew :app:assembleDebug
```

Expected Android artifact:

```text
apps/android/app/build/outputs/apk/debug/app-debug.apk
```

## Notes

`apps/android/local.properties` is intentionally untracked and points this machine to:

```properties
sdk.dir=/opt/homebrew/share/android-commandlinetools
```

## Local agent QA

- `npm run qa:e2e` runs the local demo harness without Browser or standalone Playwright. It verifies recall, Obsidian vault memory, ggui render shaping, ApiFuse confirmation guard, internal-only self-evolution candidates, registry publish/rollback, and cleanup.
- Browser-facing checks use the Codex Browser plugin. Do not add standalone Playwright to this repo's QA path.
- `npm run qa:legacy-runtime-scan` proves the archived vendor mirror is documentation-only and no runtime code depends on the removed legacy workflow runtime.
