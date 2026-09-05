# iOS Setup Instructions

## Overview

This guide will help you add iOS targets to your Safari Web Extension project so it works on iPhone/iPad.

**Important Note**: The extension will work when accessing Grok via **Safari on iOS**, but **NOT** with the native Grok app. iOS doesn't allow third-party extensions to inject content into native apps.

## Prerequisites

- Xcode 15+ (with iOS SDK)
- Apple Developer account (for code signing)
- iOS device or simulator for testing

## Steps to Add iOS Targets

### Step 1: Add iOS App Target

1. Open the project in Xcode: `Grok Chat Saver.xcodeproj`
2. Click on the project name in the navigator (top item)
3. Click the **"+"** button at the bottom of the targets list
4. Select **"App"** under iOS
5. Configure:
   - **Product Name**: `SparXion Chat Xport`
   - **Team**: Your development team
   - **Organization Identifier**: `sparxion.com` (or your identifier)
   - **Bundle Identifier**: `sparxion.com.Chat-Xport` (iOS)
   - **Language**: Swift
   - **Interface**: SwiftUI
   - **Storage**: None
   - **Include Tests**: Optional
6. Click **Finish**

### Step 2: Configure iOS App Target

1. Select the new iOS app target
2. In **General** tab:
   - Set **Deployment Info** → **iOS**: 15.0+ (Safari Web Extensions require iOS 15+)
   - Set **Supported Destinations**: iPhone, iPad
3. In **Build Settings**:
   - Set **Product Bundle Identifier**: `sparxion.com.Chat-Xport` (iOS)
   - Set **Development Team**: Your team
4. In **Build Phases**:
   - Remove any auto-generated files you don't need
   - Add files from `iOS (App)` folder:
     - `GrokChatSaverApp.swift`
     - `ContentView.swift`
   - Add files from `Shared (App)` folder:
     - `ViewController.swift`
     - `Resources/` folder contents
     - `Assets.xcassets`

### Step 3: Add iOS Extension Target

1. Click the **"+"** button again in targets
2. Select **"Safari Web Extension"** under iOS
3. Configure:
   - **Product Name**: `SparXion Chat Xport Extension`
   - **Team**: Your development team
   - **Bundle Identifier**: `sparxion.com.Chat-Xport.Extension` (iOS)
   - **Language**: Swift
4. Click **Finish**

### Step 4: Configure iOS Extension Target

1. Select the iOS extension target
2. In **General** tab:
   - Set **Deployment Info** → **iOS**: 15.0+
3. In **Build Settings**:
   - Set **Product Bundle Identifier**: `sparxion.com.Chat-Xport.Extension` (iOS)
   - Set **Development Team**: Your team
   - Set **Info.plist File**: `iOS (Extension)/Info.plist`
4. In **Build Phases**:
   - Add files from `Shared (Extension)` folder:
     - `SafariWebExtensionHandler.swift`
     - `Resources/` folder (all contents)
   - Add `Info.plist` from `iOS (Extension)/Info.plist`

### Step 5: Link Extension to App

1. Select the iOS **App** target (not extension)
2. Go to **General** tab
3. Under **Frameworks, Libraries, and Embedded Content**, click **"+**
4. Add the **SparXion Chat Xport Extension.appex**
5. Set it to **"Embed & Sign"**

### Step 6: Update Shared Files

The `ViewController.swift` in `Shared (App)` already has iOS support with `#if os(iOS)` checks, so it should work as-is.

### Step 7: Build and Test

1. Select an iOS simulator or connected device
2. Select the **iOS App** scheme (not macOS)
3. Build and run (⌘R)
4. The app should launch on iOS
5. Go to **Settings → Safari → Extensions** to enable the extension

## Testing on iOS

1. **Build and install** the app on your iPhone/iPad
2. Open **Settings → Safari → Extensions**
3. Enable **"SparXion Chat Xport"**
4. Open **Safari** (not the Grok app)
5. Navigate to **grok.com**
6. You should see the **"Download chat (Markdown)"** button appear on Grok chat pages

## Important Limitations

- ✅ **Works**: Grok accessed via Safari on iOS
- ❌ **Doesn't work**: Native Grok iOS app (iOS security prevents this)
- ⚠️ **Note**: Content scripts on iOS Safari may have some limitations compared to macOS, but basic DOM manipulation and button injection should work

## Troubleshooting

### Extension doesn't appear in Settings
- Make sure you've enabled it in **Settings → Safari → Extensions**
- Check that the extension target is properly embedded in the app target
- Verify code signing is set up correctly

### Button doesn't appear on Grok
- Make sure you're using **Safari**, not the Grok app
- Check that the extension is enabled in Safari settings
- Verify the content script is loading (check Safari Web Inspector if possible)

### Build errors
- Ensure all files are added to the correct targets
- Check that `Info.plist` paths are correct
- Verify bundle identifiers match between app and extension

## Next Steps

After setting up iOS targets, you can:
- Test the extension on a real iOS device
- Submit to the App Store (requires paid Apple Developer account)
- Share with others via TestFlight
