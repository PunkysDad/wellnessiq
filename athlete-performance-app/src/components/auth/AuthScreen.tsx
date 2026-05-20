// src/components/auth/AuthScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, OAuthProvider, User } from 'firebase/auth';

// Firebase configuration from your app.config.js
const firebaseConfig = {
  apiKey: "AIzaSyAOuvLI7rp5jPzLVgKk2ckh84UHgO8ZGb8",
  projectId: "wellnessiq-92112",
  storageBucket: "wellnessiq-92112.firebasestorage.app",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);

      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Apple Sign-In is not available on this device');
        return;
      }

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Apple credential:', credential);

      // Create Firebase credential
      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce: credential.realUserStatus !== undefined ? 'nonce' : undefined,
      });

      // Sign in to Firebase
      const result = await signInWithCredential(auth, firebaseCredential);
      console.log('Firebase sign-in successful:', result.user);

      // Call success callback
      onAuthSuccess(result.user);

    } catch (error: any) {
      console.error('Apple Sign-In error:', error);
      
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in flow
        console.log('User canceled Apple Sign-In');
        return;
      }
      
      Alert.alert(
        'Sign-In Error',
        error.message || 'Failed to sign in with Apple. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* App Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>WellnessIQ</Text>
          <Text style={styles.tagline}>Master YOUR Health & Wellness</Text>
          <Text style={styles.subtitle}>AI-powered Fitness Coach</Text>
        </View>

        {/* Authentication Section */}
        <View style={styles.authSection}>
          <Text style={styles.welcomeText}>Welcome to WellnessIQ</Text>
          <Text style={styles.descriptionText}>
            Sign in to access your AI-powered personal fitness coach.
          </Text>

          {/* Apple Sign-In Button */}
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.appleIcon}>🍎</Text>
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to WellnessIQ's Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0066FF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  authSection: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 300,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  appleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});