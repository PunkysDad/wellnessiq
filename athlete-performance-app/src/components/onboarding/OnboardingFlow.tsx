// src/components/onboarding/OnboardingFlow.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, Linking, Modal, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Purchases from 'react-native-purchases';
import { revenueCatService, SUBSCRIPTION_PRODUCTS } from '../../services/revenueCatService';
import { OnboardingData, OnboardingFlowProps } from '../../interfaces/interfaces';
import { appTheme } from '../../theme/appTheme';

// Sport and Position data
const SPORTS_DATA = {
  football: {
    name: 'Football',
    emoji: '🏈',
    positions: ['QB', 'RB', 'WR', 'OL', 'TE', 'LB', 'DB', 'DL']
  },
  basketball: {
    name: 'Basketball',
    emoji: '🏀',
    positions: ['PG', 'SG', 'SF', 'PF', 'C']
  },
  baseball: {
    name: 'Baseball',
    emoji: '⚾',
    positions: ['Pitcher', 'Catcher', 'Infield', 'Outfield']
  },
  soccer: {
    name: 'Soccer',
    emoji: '⚽',
    positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
  },
  hockey: {
    name: 'Hockey',
    emoji: '🏒',
    positions: ['Center', 'Winger', 'Defenseman', 'Goalie']
  },
  generalFitness: {
    name: 'General Fitness',
    emoji: '💪',
    positions: [] as string[],
  },
};

// Maps the internal sport key to the backend enum value used by onComplete.
// App.tsx applies .toUpperCase() to the sport before sending to the backend, so
// returning 'GENERAL_FITNESS' here survives the uppercase unchanged while other
// sports stay on the existing path (e.g. 'football' → 'FOOTBALL').
const resolveSportForCallback = (sport: string | null): string | null => {
  if (sport === 'generalFitness') return 'GENERAL_FITNESS';
  return sport;
};

// Subscription tiers (BASIC & PREMIUM only)
const SUBSCRIPTION_TIERS = [
  {
    id: 'BASIC',
    name: 'Basic',
    monthlyPrice: '$12.99/month',
    emoji: '⭐',
    features: [
      'AI coaching for your position',
      'Position-specific workout plans',
    ],
    popular: false
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    monthlyPrice: '$19.99/month',
    emoji: '🚀',
    features: [
      'Approximately twice the amount of AI coaching chats than Basic',
      'Approximately twice the amount of workout plans than Basic',
      'WellnessIQ tagging system to organize your chats and workouts',
      'Early access to new features'
    ],
    popular: true
  }
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ user, onComplete, startAtStep, currentTier }) => {
  // General-Fitness-only rebrand: skip sport + position steps; everyone is
  // onboarded as GENERAL_FITNESS. Sport-selection UI is left in place but
  // unreachable for new signups. Upgrade flow (App.tsx passes startAtStep=3)
  // is unaffected.
  const [currentStep, setCurrentStep] = useState(startAtStep ?? 3);
  const initialStep = startAtStep ?? 3;
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    sport: 'generalFitness',
    position: null,
    subscriptionTier: null,
    billingCycle: 'monthly'
  });
  const [showGeneralFitnessModal, setShowGeneralFitnessModal] = useState(false);

  const handleSportSelection = (sport: string) => {
    if (sport === 'generalFitness') {
      setShowGeneralFitnessModal(true);
    } else {
      setOnboardingData(prev => ({ ...prev, sport, position: null }));
      setCurrentStep(2);
    }
  };

  const handleGeneralFitnessConfirm = () => {
    setShowGeneralFitnessModal(false);
    setOnboardingData(prev => ({ ...prev, sport: 'generalFitness', position: null }));
    setCurrentStep(3);
  };

  const handleGeneralFitnessDismiss = () => {
    setShowGeneralFitnessModal(false);
  };

  const handlePositionSelection = (position: string) => {
    setOnboardingData(prev => ({ ...prev, position }));
    setCurrentStep(3);
  };

  const syncSubscriptionToBackend = async (userId: number, tier: 'BASIC' | 'PREMIUM' | 'TRIAL') => {
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/${userId}/subscription`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionTier: tier }),
        }
      );
      if (!res.ok) {
        console.error('Failed to sync subscription tier to backend:', await res.text());
      }
    } catch (err) {
      console.error('Error syncing subscription to backend:', err);
    }
  };

  const handleSubscriptionSelection = async (tierData: { tier: string, billing: 'monthly' | 'annual' }) => {
    setIsLoading(true);
    try {
      const packages = await revenueCatService.getAvailablePackages();

      const targetProductId = tierData.tier === 'PREMIUM'
        ? SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY
        : SUBSCRIPTION_PRODUCTS.BASIC_MONTHLY;

      const packageToPurchase = packages.find(pkg =>
        pkg.product.identifier === targetProductId
      );

      if (!packageToPurchase) {
        throw new Error(`Subscription package not found: ${targetProductId}`);
      }

      const subscriptionInfo = await revenueCatService.purchaseSubscription(packageToPurchase);

      // Sync confirmed tier to backend so API enforcement stays in sync
      try {
        const firebaseUid = user?.uid;
        if (firebaseUid) {
          const userRes = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/firebase/${firebaseUid}`
          );
          const userData = await userRes.json();
          await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/${userData.id}/subscription`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscriptionTier: subscriptionInfo.tier }),
            }
          );
        }
      } catch (syncErr) {
        // Non-fatal — user has paid, don't block onboarding completion
        console.error('Backend subscription sync failed:', syncErr);
      }

      onComplete({
        ...onboardingData,
        sport: resolveSportForCallback(onboardingData.sport),
        subscriptionTier: subscriptionInfo.tier,
        billingCycle: tierData.billing,
      });

    } catch (error: any) {
      const msg = error?.message ?? '';
      let errorMessage = 'Failed to process subscription. Please try again.';

      if (msg.includes('cancelled')) {
        errorMessage = 'Purchase was cancelled. You can try again anytime.';
      } else if (msg.includes('pending')) {
        errorMessage = 'Payment is pending approval. Check back in a few minutes.';
      } else if (msg.includes('not found')) {
        errorMessage = 'Subscription option temporarily unavailable. Please try again.';
      }

      Alert.alert(
        'Subscription Error',
        errorMessage,
        [
          { text: 'Try Again', onPress: () => setIsLoading(false) },
          {
            text: 'Skip for Now',
            style: 'cancel',
            onPress: () => onComplete({
              ...onboardingData,
              sport: resolveSportForCallback(onboardingData.sport),
              subscriptionTier: 'TRIAL',
              billingCycle: tierData.billing,
            }),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackButton = () => {
    if (currentStep > initialStep) {
      // General Fitness skips step 2 (positions), so back from step 3 goes to step 1
      if (currentStep === 3 && onboardingData.sport === 'generalFitness') {
        setCurrentStep(1);
      } else {
        setCurrentStep(currentStep - 1);
      }
    } else {
      onComplete({
        sport: null,
        position: null,
        subscriptionTier: null,
        billingCycle: 'monthly',
      });
    }
  };

  const renderSportSelection = () => (
    <View style={styles.root}>
      <LinearGradient
        colors={['#080B14', '#0D0B1E', '#080B14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to WellnessIQ!</Text>
          <Text style={styles.subtitle}>What sport do you want to master?</Text>
          <Text style={styles.stepIndicator}>Step 1 of 3</Text>

          <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
            {Object.entries(SPORTS_DATA).map(([key, sport]) => (
              <TouchableOpacity
                key={key}
                style={styles.optionCard}
                onPress={() => handleSportSelection(key)}
              >
                <Text style={styles.optionEmoji}>{sport.emoji}</Text>
                <Text style={styles.optionText}>{sport.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal
        visible={showGeneralFitnessModal}
        transparent
        animationType="fade"
        onRequestClose={handleGeneralFitnessDismiss}
      >
        <Pressable style={styles.modalOverlay} onPress={handleGeneralFitnessDismiss}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalEmoji}>💪</Text>
            <Text style={styles.modalTitle}>General Fitness</Text>
            <Text style={styles.modalBody}>
              General Fitness coaching is tailored to your personal fitness goals rather than a specific sport. Note that once selected, you won't be able to switch to a sport-specific program — this keeps your coaching experience focused and consistent.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={handleGeneralFitnessConfirm}
            >
              <Text style={styles.modalPrimaryButtonText}>Got it, Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={handleGeneralFitnessDismiss}
            >
              <Text style={styles.modalSecondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  const renderPositionSelection = () => {
    const selectedSport = onboardingData.sport ? SPORTS_DATA[onboardingData.sport] : null;
    if (!selectedSport) return null;

    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#080B14', '#0D0B1E', '#080B14']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.orbTopRight} />
        <View style={styles.orbBottomLeft} />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.content}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Choose Your Position</Text>
            <Text style={styles.subtitle}>
              Select your primary position in {selectedSport.name}
            </Text>
            <Text style={styles.stepIndicator}>Step 2 of 3</Text>

            <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
              {selectedSport.positions.map((position) => (
                <TouchableOpacity
                  key={position}
                  style={styles.optionCard}
                  onPress={() => handlePositionSelection(position)}
                >
                  <Text style={styles.optionEmoji}>{selectedSport.emoji}</Text>
                  <Text style={styles.optionText}>{position}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    );
  };

  const renderSubscriptionSelection = () => (
    <View style={styles.root}>
      <LinearGradient
        colors={['#080B14', '#0D0B1E', '#080B14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          {(currentStep > initialStep || currentTier) && (
            <TouchableOpacity style={styles.backButton} onPress={handleBackButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Select the plan that works best for you
          </Text>
          <Text style={styles.stepIndicator}>
            {onboardingData.sport === 'generalFitness' ? 'Step 2 of 2' : 'Step 3 of 3'}
          </Text>

          <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
            {/* Free Trial Option — only shown to brand new users with no tier */}
            {!currentTier && (
              <TouchableOpacity
                style={styles.trialCard}
                onPress={() => onComplete({
                  ...onboardingData,
                  sport: resolveSportForCallback(onboardingData.sport),
                  subscriptionTier: 'TRIAL',
                  billingCycle: 'monthly',
                })}
              >
                <View style={styles.subscriptionHeader}>
                  <Text style={styles.subscriptionEmoji}>🎯</Text>
                  <View style={styles.subscriptionInfo}>
                    <Text style={styles.subscriptionName}>Start Free Trial</Text>
                    <Text style={styles.trialPrice}>No credit card required</Text>
                  </View>
                </View>
                <View style={styles.featuresList}>
                  <Text style={styles.featureText}>• 3 AI coaching questions</Text>
                  <Text style={styles.featureText}>• 1 position-specific workout plan</Text>
                  <Text style={styles.featureText}>• Upgrade anytime</Text>
                </View>
              </TouchableOpacity>
            )}

            {!currentTier && <Text style={styles.orDivider}>— or subscribe for full access —</Text>}

            {/* Paid Tiers — hide the tier the user already has */}
            {SUBSCRIPTION_TIERS.filter((tier) => tier.id !== currentTier).map((tier) => (
              <View key={tier.id} style={styles.tierSection}>
                <TouchableOpacity
                  style={[styles.subscriptionCard, tier.popular && styles.popularCard]}
                  onPress={() => handleSubscriptionSelection({ tier: tier.id, billing: 'monthly' })}
                >
                  {tier.popular && <Text style={styles.popularBadge}>MOST POPULAR</Text>}

                  <View style={styles.subscriptionHeader}>
                    <Text style={styles.subscriptionEmoji}>{tier.emoji}</Text>
                    <View style={styles.subscriptionInfo}>
                      <Text style={styles.subscriptionName}>{tier.name}</Text>
                      <Text style={styles.subscriptionPrice}>{tier.monthlyPrice}</Text>
                    </View>
                  </View>

                  <View style={styles.featuresList}>
                    {tier.features.map((feature, index) => (
                      <Text key={index} style={styles.featureText}>• {feature}</Text>
                    ))}
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            {!currentTier && (
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={async () => {
                  try {
                    await Purchases.restorePurchases();
                    Alert.alert('Success', 'Your purchases have been restored.');
                  } catch (error: any) {
                    Alert.alert('Restore Failed', error?.message ?? 'Unable to restore purchases. Please try again.');
                  }
                }}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>
            )}

            <View style={styles.legalLinks}>
              <Text
                style={styles.legalLinkText}
                onPress={() => Linking.openURL('https://wellnessiq-app.info/privacy.html')}
              >
                Privacy Policy
              </Text>
              <Text style={styles.legalDivider}>|</Text>
              <Text
                style={styles.legalLinkText}
                onPress={() => Linking.openURL('https://wellnessiq-app.info/terms.html')}
              >
                Terms of Use
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );

  // Main render logic
  if (currentStep === 1) return renderSportSelection();
  if (currentStep === 2) return renderPositionSelection();
  if (currentStep === 3) return renderSubscriptionSelection();

  return null;
};

const styles = StyleSheet.create({
  root: {
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
    backgroundColor: '#7C3AED',
    opacity: 0.12,
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: 100,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#39FF14',
    opacity: 0.10,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: appTheme.white,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: appTheme.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  stepIndicator: {
    textAlign: 'center',
    fontSize: 13,
    color: appTheme.textMuted,
    marginBottom: 30,
    fontWeight: '600',
  },
  optionsContainer: {
    flex: 1,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  optionEmoji: {
    fontSize: 32,
    marginRight: 20,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '700',
    color: appTheme.white,
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: appTheme.purple,
    fontWeight: '700',
  },
  tierSection: {
    marginBottom: 24,
  },
  subscriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 24,
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  popularCard: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: appTheme.purple,
    borderWidth: 1.5,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: appTheme.purple,
    color: appTheme.white,
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: appTheme.white,
    marginBottom: 4,
  },
  subscriptionPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: appTheme.purple,
  },
  featuresList: {
    paddingLeft: 4,
  },
  featureText: {
    fontSize: 14,
    color: appTheme.textMuted,
    marginBottom: 6,
    lineHeight: 22,
  },
  trialCard: {
    backgroundColor: 'rgba(57,255,20,0.08)',
    borderWidth: 1.5,
    borderColor: appTheme.neonGreen + '60',
    borderRadius: 24,
    padding: 24,
    marginBottom: 8,
  },
  trialPrice: {
    fontSize: 14,
    color: appTheme.neonGreen,
    fontWeight: '500',
    marginTop: 2,
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 13,
    color: appTheme.textMuted,
    marginVertical: 16,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  restoreButtonText: {
    fontSize: 14,
    color: appTheme.textMuted,
    fontWeight: '500',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  legalLinkText: {
    fontSize: 12,
    color: appTheme.purple,
  },
  legalDivider: {
    fontSize: 12,
    color: appTheme.textMuted,
    marginHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: appTheme.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0D0B1E',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: appTheme.white,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  modalBody: {
    fontSize: 15,
    color: appTheme.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalPrimaryButton: {
    width: '100%',
    backgroundColor: appTheme.purple,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appTheme.white,
  },
  modalSecondaryButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: appTheme.border,
  },
  modalSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: appTheme.textMuted,
  },
});
