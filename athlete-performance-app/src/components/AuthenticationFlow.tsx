import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useAuth } from '../hooks/useSimpleAuth';

const AuthenticationFlow: React.FC = () => {
  const { onFacebookSignIn } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);

  const handleFacebookLogin = async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('🔵 Starting Facebook login...');
      await onFacebookSignIn();
      console.log('✅ Facebook login successful!');
      // Navigation to main app happens automatically via auth state change
    } catch (error) {
      console.error('❌ Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong during login. Please try again.';
      Alert.alert(
        'Login Failed', 
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Logo/Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>⚡</Text>
          <Text style={styles.appName}>Athlete Performance</Text>
        </View>
        <Text style={styles.subtitle}>
          Showcase your skills, track your progress, connect with recruiters
        </Text>
      </View>

      {/* Authentication Section */}
      <View style={styles.authSection}>
        <TouchableOpacity 
          style={[styles.facebookButton, loading && styles.buttonDisabled]}
          onPress={handleFacebookLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Text style={styles.facebookIcon}>f</Text>
              <Text style={styles.buttonText}>Continue with Facebook</Text>
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.comingSoonText}>
          Email registration coming soon!
        </Text>
      </View>

      {/* Footer Section */}
      <View style={styles.footerSection}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
        <View style={styles.featuresContainer}>
          <Text style={styles.featureText}>✓ Upload sports videos</Text>
          <Text style={styles.featureText}>✓ AI-powered skill assessment</Text>
          <Text style={styles.featureText}>✓ Connect with college recruiters</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
  },
  headerSection: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  authSection: {
    flex: 1,
    justifyContent: 'center',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  facebookIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 12,
    backgroundColor: '#1465CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  footerSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  featuresContainer: {
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
});

export default AuthenticationFlow;