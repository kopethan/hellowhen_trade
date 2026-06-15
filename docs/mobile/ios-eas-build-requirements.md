# iOS EAS build requirements

Hellowhen iOS production builds must use an EAS macOS image with Xcode 26 or newer for App Store submission. The mobile `production`, `preview`, and `development` EAS profiles pin the iOS image to `macos-sequoia-15.6-xcode-26.0` so builds use Xcode 26 and Node.js 20.19.4 instead of the older Expo SDK 51 auto image.

The `expo-iap` dependency resolves the CocoaPod `openiap`, which requires a higher iOS deployment target than the Expo SDK 51 default. The mobile app config sets the iOS deployment target to `15.0` through `expo-build-properties`, which is applied during prebuild.

Recommended command from the repo root:

```powershell
cd apps/mobile
npx eas build --platform ios --profile production --clear-cache
```

Use `--clear-cache` for the first rebuild after changing build image or native build properties so CocoaPods is resolved from the updated configuration.
