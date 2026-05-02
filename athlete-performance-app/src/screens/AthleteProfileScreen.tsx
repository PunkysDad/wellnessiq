import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Button } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { appTheme } from '../theme/appTheme';
import { theme } from '../theme';
import { componentStyles as cs } from '../theme/componentStyles';
import { apiService } from '../services/apiService';
import { UserService } from '../services/userService';
import { getAuth } from 'firebase/auth';
import { RootStackParamList } from '../types/types';
import { useUpgrade } from '../context/UpgradeContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const POSITION_ENUM_MAP: Record<string, string> = {
  'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'OL': 'OL',
  'TE': 'TE', 'LB': 'LB', 'DB': 'DB', 'DL': 'DL',
  'PG': 'PG', 'SG': 'SG', 'SF': 'SF', 'PF': 'PF', 'C': 'C',
  'Pitcher': 'PITCHER', 'Catcher': 'CATCHER', 'Infield': 'INFIELD', 'Outfield': 'OUTFIELD',
  'Goalkeeper': 'GOALKEEPER', 'Defender': 'DEFENDER', 'Midfielder': 'MIDFIELDER', 'Forward': 'FORWARD',
  'Center': 'CENTER', 'Winger': 'WINGER', 'Defenseman': 'DEFENSEMAN', 'Goalie': 'GOALIE',
};

const ENUM_POSITION_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_ENUM_MAP).map(([display, enumVal]) => [enumVal, display])
);

const SPORTS_CONFIG: Record<string, string[]> = {
  Football:   ['QB', 'RB', 'WR', 'OL', 'TE', 'LB', 'DB', 'DL'],
  Basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  Baseball:   ['Pitcher', 'Catcher', 'Infield', 'Outfield'],
  Soccer:     ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
  Hockey:     ['Center', 'Winger', 'Defenseman', 'Goalie'],
};

const ENUM_SPORT_MAP: Record<string, string> = {
  FOOTBALL: 'Football', BASKETBALL: 'Basketball', BASEBALL: 'Baseball',
  SOCCER: 'Soccer', HOCKEY: 'Hockey',
  GENERAL_FITNESS: 'General Fitness',
};

const FITNESS_GOALS = [
  { id: 'LOSE_WEIGHT', label: 'Lose Weight', emoji: '🔥' },
  { id: 'INCREASE_CARDIO_HEALTH', label: 'Increase Cardio Health', emoji: '❤️' },
  { id: 'INCREASE_STRENGTH_AND_MUSCLE_MASS', label: 'Increase Strength & Muscle Mass', emoji: '💪' },
  { id: 'INCREASE_STAMINA_AND_ENDURANCE', label: 'Increase Stamina & Endurance', emoji: '⚡' },
];

const TIER_LABELS: Record<string, { label: string; price: string }> = {
  TRIAL:   { label: 'Free Trial',  price: 'Limited access' },
  BASIC:   { label: 'Basic',       price: '$12.99/mo' },
  PREMIUM: { label: 'Premium',     price: '$19.99/mo' },
  NONE:    { label: 'No Plan',     price: '' },
};

function DropdownRow({
  label, value, items, onSelect,
}: {
  label: string;
  value: string;
  items: string[];
  onSelect: (item: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.menuButton} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={styles.menuLabel}>{label}</Text>
        <View style={styles.menuButtonRight}>
          <Text style={styles.menuValue}>{value}</Text>
          <Icon name="arrow-drop-down" size={24} color={appTheme.textMuted} />
        </View>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={items}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, item === value && styles.modalItemSelected]}
                  onPress={() => { onSelect(item); setVisible(false); }}
                >
                  <Text style={[styles.modalItemText, item === value && styles.modalItemTextSelected]}>
                    {item}
                  </Text>
                  {item === value && <Icon name="check" size={20} color={appTheme.purple} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function ProfileEditScreen() {
  const navigation = useNavigation<NavigationProp>();
  const auth = getAuth();
  const userService = new UserService();
  const { onUpgradePress } = useUpgrade();

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('TRIAL');
  const [profileLoading, setProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    sport: 'Football',
    position: 'QB',
  });
  const [fitnessGoals, setFitnessGoals] = useState<string[]>([]);
  const [isGeneralFitness, setIsGeneralFitness] = useState(false);

  useEffect(() => {
    const resolveUser = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      const userData = await userService.checkUserExists(firebaseUser.uid);
      if (userData) {
        setCurrentUserId(userData.id);
        setSubscriptionTier(userData.subscriptionTier ?? 'TRIAL');
      }
    };
    resolveUser();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const result = await apiService.getUserProfile(currentUserId);
        if (result.success && result.data) {
          const u = result.data;
          if (u.primarySport === 'GENERAL_FITNESS') {
            setIsGeneralFitness(true);
            setFormData({ sport: 'General Fitness', position: '' });
            setFitnessGoals(Array.isArray(u.fitnessGoals) ? u.fitnessGoals : []);
          } else {
            setIsGeneralFitness(false);
            const displaySport = u.primarySport
              ? (ENUM_SPORT_MAP[u.primarySport] ?? u.primarySport)
              : 'Football';
            const displayPosition = u.primaryPosition
              ? (ENUM_POSITION_MAP[u.primaryPosition] ?? u.primaryPosition)
              : SPORTS_CONFIG[displaySport]?.[0] ?? '';
            setFormData({ sport: displaySport, position: displayPosition });
          }
          setSubscriptionTier(u.subscriptionTier ?? 'TRIAL');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [currentUserId]);

  const handleSave = async () => {
    if (!currentUserId) {
      Alert.alert('Error', 'User not authenticated. Please try again.');
      return;
    }
    setIsLoading(true);
    try {
      const result = isGeneralFitness
        ? await apiService.updateFitnessGoals(currentUserId, fitnessGoals)
        : await apiService.updateUserProfile(currentUserId, {
            primarySport: formData.sport.toUpperCase(),
            primaryPosition: POSITION_ENUM_MAP[formData.position] ?? null,
          });
      if (result.success) {
        Alert.alert('Profile Updated', 'Your profile has been successfully updated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFitnessGoal = (goalId: string) => {
    setFitnessGoals(prev =>
      prev.includes(goalId) ? prev.filter(g => g !== goalId) : [...prev, goalId]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Your subscription is managed by Apple. You\'ll be taken to your Apple subscription settings where you can cancel.\n\nYou\'ll keep access until the end of your current billing period.',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Manage in Settings',
          onPress: () => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions'),
        },
      ]
    );
  };

  const handleChangePlan = () => {
    onUpgradePress();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            setIsDeleting(true);
            console.log('DEBUG deleteAccount currentUserId:', currentUserId);
            console.log('DEBUG deleteAccount URL:', `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/${currentUserId}`);
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/${currentUserId}`,
                { method: 'DELETE' }
              );
              console.log('DEBUG deleteAccount response status:', response.status);
              const responseBody = await response.text();
              console.log('DEBUG deleteAccount response body:', responseBody);
              if (!response.ok) {
                throw new Error('Delete failed');
              }
              await getAuth().signOut();
              Alert.alert('Your account has been deleted');
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const tierInfo = TIER_LABELS[subscriptionTier] ?? TIER_LABELS.TRIAL;
  const hasActivePaidPlan = subscriptionTier === 'BASIC' || subscriptionTier === 'PREMIUM';

  return (
    <View style={styles.root}>
      {/* Ambient gradient background */}
      <LinearGradient
        colors={['#080B14', '#0D0B1E', '#080B14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />
      <View style={styles.orbMidRight} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="close" size={24} color={appTheme.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          disabled={isLoading || profileLoading}
        >
          <Text style={[styles.headerAction, (isLoading || profileLoading) && { opacity: 0.4 }]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {profileLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={appTheme.purple} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Athletic Information */}
          <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
            <View style={cs.cardPadding}>
              <Text style={cs.cardHeading}>Athletic Information</Text>
              <View style={{ height: 16 }} />
              {isGeneralFitness ? (
                <View style={styles.readOnlyRow}>
                  <Text style={styles.menuLabel}>Sport</Text>
                  <Text style={styles.menuValue}>General Fitness 💪</Text>
                </View>
              ) : (
                <>
                  <DropdownRow
                    label="Sport"
                    value={formData.sport}
                    items={Object.keys(SPORTS_CONFIG)}
                    onSelect={(sport) => setFormData({
                      sport,
                      position: SPORTS_CONFIG[sport][0],
                    })}
                  />
                  <DropdownRow
                    label="Position"
                    value={formData.position}
                    items={SPORTS_CONFIG[formData.sport] ?? []}
                    onSelect={(position) => setFormData({ ...formData, position })}
                  />
                </>
              )}
            </View>
          </BlurView>

          {/* Fitness Goals — only for General Fitness users */}
          {isGeneralFitness && (
            <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
              <View style={cs.cardPadding}>
                <Text style={cs.cardHeading}>Fitness Goals</Text>
                <Text style={styles.goalsSubtitle}>Select all that apply</Text>
                <View style={{ height: 12 }} />
                {FITNESS_GOALS.map(goal => {
                  const selected = fitnessGoals.includes(goal.id);
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={[styles.goalRow, selected && styles.goalRowSelected]}
                      onPress={() => toggleFitnessGoal(goal.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                      <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
                        {goal.label}
                      </Text>
                      {selected && (
                        <Icon name="check" size={20} color={appTheme.purple} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </BlurView>
          )}

          {/* Subscription */}
          <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
            <View style={cs.cardPadding}>
              <Text style={cs.cardHeading}>Subscription</Text>
              <View style={{ height: 16 }} />

              <View style={styles.tierRow}>
                <View>
                  <Text style={styles.tierName}>{tierInfo.label}</Text>
                  {tierInfo.price ? (
                    <Text style={styles.tierPrice}>{tierInfo.price}</Text>
                  ) : null}
                </View>
                <View style={[
                  styles.tierBadge,
                  hasActivePaidPlan && { backgroundColor: appTheme.purpleDim, borderColor: 'rgba(139,92,246,0.60)' },
                ]}>
                  <Text style={[
                    styles.tierBadgeText,
                    hasActivePaidPlan && { color: appTheme.purple },
                  ]}>
                    {subscriptionTier}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionActions}>
                {/* Always show upgrade/change plan */}
                <Button
                  mode="contained"
                  onPress={handleChangePlan}
                  buttonColor={appTheme.purple}
                  textColor={appTheme.white}
                  style={styles.subscriptionButton}
                  icon={hasActivePaidPlan ? 'swap-horiz' : 'arrow-upward'}
                >
                  {hasActivePaidPlan ? 'Change Plan' : 'Upgrade Now'}
                </Button>

                {/* Only show cancel when on a paid plan */}
                {hasActivePaidPlan && (
                  <Button
                    mode="outlined"
                    onPress={handleCancelSubscription}
                    textColor={appTheme.textMuted}
                    style={styles.cancelButton}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </View>
            </View>
          </BlurView>

          {/* Danger Zone */}
          <BlurView intensity={15} tint="dark" style={styles.dangerCard}>
            <View style={styles.dangerAccentStrip} />
            <View style={cs.cardPadding}>
              <Text style={[cs.cardHeading, { color: '#dc3545' }]}>Danger Zone</Text>
              <Text style={styles.dangerBody}>
                Permanently delete your account and all associated data. This action cannot be undone.
              </Text>
              <Button
                mode="outlined"
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                textColor="#dc3545"
                style={styles.dangerButton}
                icon="delete-forever"
              >
                Delete Account
              </Button>
            </View>
          </BlurView>

        </ScrollView>
      )}
    </View>
  );
}

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
  orbMidRight: {
    position: 'absolute',
    top: '45%',
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: appTheme.neonGreen,
    opacity: 0.06,
    shadowColor: appTheme.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    backgroundColor: 'rgba(8,11,20,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
  },
  headerButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: appTheme.white,
    letterSpacing: -0.5,
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '700',
    color: appTheme.purple,
  },

  content: {
    flex: 1,
    padding: theme.spacing.base,
    backgroundColor: 'transparent',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: 13,
    color: appTheme.textMuted,
  },

  // Subscription card
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: appTheme.white,
  },
  tierPrice: {
    fontSize: 13,
    color: appTheme.textMuted,
    marginTop: 2,
  },
  tierBadge: {
    backgroundColor: appTheme.bgElevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: appTheme.border,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: appTheme.textMuted,
    letterSpacing: 0.8,
  },
  subscriptionActions: {
    gap: theme.spacing.sm,
  },
  subscriptionButton: {
    borderRadius: 12,
  },
  cancelButton: {
    borderRadius: 12,
    borderColor: appTheme.border,
  },

  // Dropdown row
  menuButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: appTheme.border,
    borderRadius: 16,
    marginBottom: theme.spacing.base,
    backgroundColor: appTheme.bgElevated,
  },
  menuLabel: {
    fontSize: 15,
    color: appTheme.textMuted,
  },
  menuButtonRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuValue: {
    fontSize: 15,
    color: appTheme.white,
    fontWeight: '600',
    marginRight: 2,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: appTheme.border,
    borderRadius: 16,
    marginBottom: theme.spacing.base,
    backgroundColor: appTheme.bgElevated,
  },
  goalsSubtitle: {
    fontSize: 13,
    color: appTheme.textMuted,
    marginTop: 4,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    borderWidth: 1,
    borderColor: appTheme.border,
    borderRadius: 16,
    marginBottom: theme.spacing.sm,
    backgroundColor: appTheme.bgElevated,
  },
  goalRowSelected: {
    borderColor: appTheme.purple,
    backgroundColor: appTheme.purpleDim,
  },
  goalEmoji: {
    fontSize: 22,
    marginRight: theme.spacing.base,
  },
  goalLabel: {
    flex: 1,
    fontSize: 15,
    color: appTheme.text,
    fontWeight: '600',
  },
  goalLabelSelected: {
    color: appTheme.purple,
  },

  // Modal sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: appTheme.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: appTheme.border,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appTheme.white,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
    marginBottom: theme.spacing.sm,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
  },
  modalItemSelected: {
    backgroundColor: appTheme.purpleDim,
  },
  modalItemText: {
    fontSize: 15,
    color: appTheme.text,
  },
  modalItemTextSelected: {
    color: appTheme.purple,
    fontWeight: '700',
  },

  // Danger zone
  dangerCard: {
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#dc354560',
    overflow: 'hidden',
    marginBottom: theme.spacing.xl,
  },
  dangerAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#dc3545',
  },
  dangerBody: {
    fontSize: 14,
    color: appTheme.textMuted,
    marginTop: 12,
    marginBottom: theme.spacing.base,
    lineHeight: 20,
  },
  dangerButton: {
    alignSelf: 'flex-start',
    borderColor: '#dc354560',
    borderRadius: 12,
  },
});
