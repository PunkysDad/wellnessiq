import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, StatusBar, Linking, Platform, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getApps, initializeApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence exists in the React Native bundle
import { initializeAuth, getReactNativePersistence, getAuth, onAuthStateChanged, signOut, signInWithCredential, OAuthProvider, GoogleAuthProvider } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { revenueCatService } from './src/services/revenueCatService';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import HomeScreen from './src/screens/HomeScreen';
import AthleteProfileScreen from './src/screens/AthleteProfileScreen';
import PerformanceScreen from './src/screens/PerformanceScreen';
import CoachingScreen from './src/screens/CoachingScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WorkoutRequestScreen from './src/screens/WorkoutRequestScreen';
import WorkoutDisplayScreen from './src/screens/WorkoutDisplayScreen';

import { OnboardingFlow } from './src/components/onboarding/OnboardingFlow';
import { UserService } from './src/services/userService';
import { RootStackParamList } from './src/types/types';
import { appTheme } from './src/theme/appTheme';
import { UpgradeProvider } from './src/context/UpgradeContext';

const firebaseConfig = {
  apiKey: "AIzaSyDfnrY68FW1Qz9awIrnZoDbOCBvXVpIcBU",
  authDomain: "wellnessiq-92112.firebaseapp.com",
  projectId: "wellnessiq-92112",
  storageBucket: "wellnessiq-92112.firebasestorage.app",
};

console.log('Firebase config loaded:', firebaseConfig);

const missingFirebaseVars = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingFirebaseVars.length > 0) {
  console.error('Missing Firebase config vars:', missingFirebaseVars);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}

// Configure Google Sign-In once at module level (Android only)
if (Platform.OS === 'android') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

const userService = new UserService();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Loading Screen ───────────────────────────────────────────────────────────
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={appTheme.purple} />
    <Text style={styles.loadingText}>Loading WellnessIQ...</Text>
  </View>
);

// ─── Auth Screen ──────────────────────────────────────────────────────────────
const AuthScreen: React.FC<{ onAuthSuccess: (user: any) => void }> = ({ onAuthSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);

  // useEffect(() => {
  //   const apiKey = Platform.OS === 'ios'
  //     ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
  //     : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  //   if (apiKey) {
  //     Purchases.configure({ apiKey });
  //   }
  // }, []);

  // ── Apple Sign-In (iOS only) ─────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Apple Sign-In is not available on this device');
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: credential.identityToken!,
        rawNonce: credential.realUserStatus !== undefined ? 'nonce' : undefined,
      });
      const result = await signInWithCredential(auth, firebaseCredential);
      onAuthSuccess(result.user);
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign-In Error', error.message || 'Failed to sign in with Apple. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google Sign-In (Android only) ───────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      // idToken lives on signInResult.data in v13+ of the library
      const idToken = (signInResult as any)?.data?.idToken ?? (signInResult as any)?.idToken;
      if (!idToken) throw new Error('Google Sign-In did not return an ID token.');
      const firebaseCredential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, firebaseCredential);
      onAuthSuccess(result.user);
    } catch (error: any) {
      // Code 12501 = user cancelled on Android
      if (error.code === '12501' || error.code === 'SIGN_IN_CANCELLED') return;
      Alert.alert('Sign-In Error', error.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await Purchases.restorePurchases();
      Alert.alert('Success', 'Your purchases have been restored.', [
        {
          text: 'OK',
          onPress: () => {
            if (Platform.OS === 'ios') handleAppleSignIn();
            else handleGoogleSignIn();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message ?? 'Unable to restore purchases. Please try again.');
    }
  };

  return (
    <View style={styles.authContainer}>
      <StatusBar barStyle="light-content" backgroundColor={appTheme.bg} />
      <LinearGradient
        colors={['#080B14', '#0D0B1E', '#080B14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      <SafeAreaView style={styles.authNavSafeArea}>
        <View style={styles.authNav}>
          <Text style={styles.authNavLogo}>
            Wellness<Text style={styles.authNavLogoAccent}>IQ</Text>
          </Text>
        </View>
      </SafeAreaView>

      <View style={styles.authHero}>
        <Text style={styles.authHeroTitle}>Master YOUR Health & Wellness</Text>
        <Text style={styles.authHeroSubtitle}>AI-powered Fitness Coach</Text>
      </View>

      <BlurView intensity={20} tint="dark" style={styles.authCard}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={appTheme.white} size="small" />
              : <Text style={styles.appleButtonText}>Continue with Apple</Text>
            }
          </TouchableOpacity>
        )}

        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#3c4043" size="small" />
            ) : (
              <View style={styles.googleButtonInner}>
                <Text style={styles.googleLogo}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestorePurchases}>
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing, you agree to WellnessIQ's{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://wellnessiqapp.info/terms.html')}>
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://wellnessiqapp.info/privacy.html')}>
            Privacy Policy
          </Text>
        </Text>
      </BlurView>

      <View style={styles.authFooter}>
        <Text style={styles.authFooterText}>WellnessIQ — Powered by Claude</Text>
      </View>
    </View>
  );
};

// ─── Main Tabs ────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, any> = {
            Home: 'home',
            Profile: 'person',
            Workouts: 'fitness-center',
            Coaching: 'psychology',
          };
          return <Icon name={icons[route.name] ?? 'circle'} size={size} color={color} />;
        },
        tabBarActiveTintColor: appTheme.neonGreen,
        tabBarInactiveTintColor: appTheme.textMuted,
        tabBarStyle: {
          backgroundColor: 'rgba(8,11,20,0.97)',
          borderTopWidth: 1,
          borderTopColor: appTheme.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: appTheme.navy },
        headerTintColor: appTheme.white,
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={AthleteProfileScreen} />
      <Tab.Screen
        name="Workouts"
        component={WorkoutRequestScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="fitness-center" size={size} color={color} />,
          headerStyle: { backgroundColor: appTheme.navy },
          headerTintColor: appTheme.white,
          headerTitleStyle: { fontWeight: '700' },
          headerTitle: 'Generate Workout',
        }}
      />
      <Tab.Screen name="Coaching" component={CoachingScreen} />
    </Tab.Navigator>
  );
}

// ─── Root Stack ───────────────────────────────────────────────────────────────
function RootStack() {
  const headerTheme = {
    headerStyle: { backgroundColor: appTheme.navy },
    headerTintColor: appTheme.white,
    headerTitleStyle: { fontWeight: '700' as const },
  };
  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile', ...headerTheme }} />
      <Stack.Screen name="WorkoutDisplay" component={WorkoutDisplayScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WorkoutRequest" component={WorkoutRequestScreen} options={{ title: 'Generate Workout', ...headerTheme }} />
    </Stack.Navigator>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [showSubscription, setShowSubscription] = useState(false);

  const handleUpgradeSubscription = async () => {
    if (user) {
      try {
        const fresh = await userService.checkUserExists(user.uid);
        if (fresh) setUserProfile(fresh);
      } catch {
        // use stale profile if refresh fails
      }
    }
    setShowSubscription(true);
  };

  const handleSubscriptionComplete = async (onboardingData: {
    sport: string | null;
    position: string | null;
    subscriptionTier: string | null;
    billingCycle: 'monthly' | 'annual';
  }) => {
    setShowSubscription(false);
    if (!onboardingData.subscriptionTier) return;
    if (userProfile) {
      try {
        await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/${userProfile.id}/subscription`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionTier: onboardingData.subscriptionTier }),
          }
        );
        setUserProfile((prev: any) => ({ ...prev, subscriptionTier: onboardingData.subscriptionTier }));
      } catch (err) {
        console.error('Failed to update subscription:', err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          try {
            await revenueCatService.initialize(firebaseUser.uid);
          } catch (rcErr) {
            console.error('RevenueCat init error:', rcErr);
          }
          try {
            const existingUser = await userService.checkUserExists(firebaseUser.uid);
            setUser(firebaseUser);
            setUserProfile(existingUser ?? null);
            console.log('existingUser:', JSON.stringify(existingUser));
            console.log('primarySport:', existingUser?.primarySport);
            console.log('primaryPosition:', existingUser?.primaryPosition);
            console.log('showOnboarding decision:', !existingUser || !existingUser.primarySport || (!existingUser.primaryPosition && existingUser?.primarySport?.toUpperCase() !== 'GENERAL_FITNESS'));
            setShowOnboarding(!existingUser || !existingUser.primarySport || (!existingUser.primaryPosition && existingUser.primarySport?.toUpperCase() !== 'GENERAL_FITNESS'));
            if (existingUser) {
              try {
                await revenueCatService.syncTierIfChanged(
                  existingUser.id,
                  existingUser.subscriptionTier
                );
                // Re-fetch profile in case tier was updated by sync
                const refreshed = await userService.checkUserExists(firebaseUser.uid);
                if (refreshed) setUserProfile(refreshed);
              } catch (syncErr) {
                console.error('RevenueCat sync error on launch:', syncErr);
              }
            }
          } catch {
            setUser(firebaseUser);
            setUserProfile(null);
            setShowOnboarding(false);
          }
        } else {
          setUser(null);
          setUserProfile(null);
          setShowOnboarding(false);
        }
      } finally {
        setInitializing(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── AppState foreground sync ─────────────────────────────────────────────
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (user && userProfile?.id) {
          try {
            await revenueCatService.syncTierIfChanged(userProfile.id, userProfile.subscriptionTier);
            const fresh = await userService.checkUserExists(user.uid);
            if (fresh) setUserProfile(fresh);
          } catch (err) {
            console.error('Foreground tier sync error:', err);
          }
        }
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [user, userProfile]);

  const handleAuthSuccess = (authenticatedUser: any) => {
    console.log('Authentication successful for:', authenticatedUser.uid);
  };

  const handleOnboardingComplete = async (onboardingData: {
    sport: string | null;
    position: string | null;
    subscriptionTier: string | null;
    billingCycle: 'monthly' | 'annual';
  }) => {
    try {
      const userData: any = {
        email: user.email || '',
        firebaseUid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'WellnessIQ Athlete',
        primarySport: onboardingData.sport?.toUpperCase(),
        subscriptionTier: onboardingData.subscriptionTier ?? 'TRIAL',
        billingCycle: onboardingData.billingCycle,
        age: null,
      };

      if (onboardingData.position) {
        userData.primaryPosition = onboardingData.position.toUpperCase();
      }
      const newUser = await userService.createUser(userData);
      setUserProfile(newUser);
      setShowOnboarding(false);
    } catch {
      Alert.alert('Onboarding Error', 'Failed to save your profile. Please try again.', [{ text: 'OK' }]);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(auth); } catch (error) { console.error('Sign out error:', error); }
  };

  if (initializing) return <PaperProvider><LoadingScreen /></PaperProvider>;
  if (!user) return <PaperProvider><AuthScreen onAuthSuccess={handleAuthSuccess} /></PaperProvider>;
  if (showOnboarding) return <PaperProvider><OnboardingFlow user={user} onComplete={handleOnboardingComplete} /></PaperProvider>;

  if (showSubscription) {
    return (
      <PaperProvider>
        <OnboardingFlow
          user={user}
          onComplete={handleSubscriptionComplete}
          startAtStep={3}
          currentTier={userProfile?.subscriptionTier ?? undefined}
        />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <UpgradeProvider onUpgradePress={handleUpgradeSubscription}>
        <NavigationContainer>
          <RootStack />
        </NavigationContainer>
      </UpgradeProvider>
    </PaperProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appTheme.bg,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: appTheme.textMuted,
  },
  authContainer: {
    flex: 1,
    backgroundColor: appTheme.bg,
  },
  // Ambient glow orbs
  orbTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: appTheme.orbPurple,
    opacity: 0.12,
    shadowColor: appTheme.orbPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: 100,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: appTheme.neonGreen,
    opacity: 0.10,
    shadowColor: appTheme.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
  },
  authNavSafeArea: {
    backgroundColor: 'rgba(8,11,20,0.95)',
  },
  authNav: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  authNavLogo: {
    fontSize: 32,
    fontWeight: '900',
    color: appTheme.white,
  },
  authNavLogoAccent: {
    color: appTheme.neonGreen,
  },
  authHero: {
    backgroundColor: 'transparent',
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  authHeroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: appTheme.white,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -1,
  },
  authHeroSubtitle: {
    fontSize: 15,
    color: appTheme.textMuted,
    textAlign: 'center',
  },
  authCard: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1,
    borderTopColor: appTheme.border,
  },
  // ── Apple button (iOS) ──
  appleButton: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  appleButtonText: {
    color: appTheme.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // ── Google button (Android) ──
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleLogo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#3c4043',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  restoreButtonText: {
    fontSize: 14,
    color: appTheme.textMuted,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 12,
    color: appTheme.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  termsLink: {
    color: appTheme.purple,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  authFooter: {
    backgroundColor: 'rgba(8,11,20,0.95)',
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: appTheme.border,
  },
  authFooterText: {
    fontSize: 13,
    color: appTheme.textMuted,
  },
  devButton: {
    borderWidth: 2,
    borderColor: appTheme.purple,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 24,
  },
  devButtonText: {
    color: appTheme.purple,
    fontSize: 16,
    fontWeight: '600',
  },
});
