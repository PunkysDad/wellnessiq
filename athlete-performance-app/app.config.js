import 'dotenv/config';

export default {
  expo: {
    owner: "jboo575",
    name: "WellnessIQ",
    slug: "wellnessiq-app", 
    version: "1.1.0",
    orientation: "default",
    jsEngine: 'hermes',
    newArchEnabled: true,
    updates: {
      url: "https://u.expo.dev/098c9bb2-221e-4228-a6ab-ced864da153a",
      channel: "production"
    },
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.justinbooth.wellnessiq",
      googleServicesFile: "./GoogleService-Info.plist",
      runtimeVersion: "1.1.0",
      usesAppleSignIn: true,
      icon: "./assets/icon.png",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIDeviceFamily: [1],
        UIUserInterfaceStyle: "Dark",
        UIRequiresFullScreen: true,
        UISupportedInterfaceOrientations: [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight"
        ]
      }
    },
    android: {
      runtimeVersion: {
        policy: "appVersion"
      },
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#FFFFFF"
      },
      package: "com.justinbooth.wellnessiq",
      googleServicesFile: "./google-services.json"
    },
    web: {
      bundler: "metro"
    },
    "extra": {
      "eas": {
        "projectId": "098c9bb2-221e-4228-a6ab-ced864da153a"
      }
    },
    plugins: [
      "expo-dev-client",
      "expo-apple-authentication",
      "@react-native-google-signin/google-signin",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            buildToolsVersion: "34.0.0"
          },
          ios: {
            useFrameworks: "static",
            deploymentTarget: "15.1"
          }
        }
      ]
    ]
  }
};