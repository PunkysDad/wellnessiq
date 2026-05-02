import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAuth } from 'firebase/auth';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  Button,
  RadioButton,
  Checkbox,
  TextInput,
  Chip,
  Divider,
} from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { appTheme } from '../theme/appTheme';
import { theme } from '../theme';
import { componentStyles as cs } from '../theme/componentStyles';
import { workoutApiService } from '../services/workoutApiService';
import { UserService } from '../services/userService';
import { WorkoutData, WorkoutRequest } from '../interfaces/interfaces';
import { RootStackParamList } from '../types/types';
import TrialLimitModal from '../components/TrialLimitModal';
import { useUpgrade } from '../context/UpgradeContext';

type WorkoutRequestNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EQUIPMENT_OPTIONS = {
  'Basic':          ['Body weight only', 'Resistance bands', 'Dumbbells', 'Kettlebells'],
  'Gym Access':     ['Full gym', 'Barbells', 'Cable machine', 'Leg press'],
  'Sport Specific': ['Agility ladder', 'Cones', 'Medicine ball', 'Plyometric box'],
  'Field/Court':    ['Track access', 'Field access', 'Court access'],
};

const FOCUS_OPTIONS = {
  'Strength':          ['Upper body power', 'Lower body power', 'Core stability', 'Functional strength'],
  'Speed/Agility':     ['Linear speed', 'Change of direction', 'First step quickness', 'Reaction time'],
  'Conditioning':      ['Aerobic base', 'Anaerobic power', 'Sport-specific endurance', 'Recovery'],
  'Injury Prevention': ['Joint mobility', 'Muscle imbalances', 'Movement quality', 'Prehab exercises'],
};

const ENUM_SPORT_MAP: Record<string, string> = {
  FOOTBALL: 'Football', BASKETBALL: 'Basketball', BASEBALL: 'Baseball',
  SOCCER: 'Soccer', HOCKEY: 'Hockey',
  GENERAL_FITNESS: 'General Fitness',
};

const FITNESS_GOAL_LABELS: Record<string, string> = {
  LOSE_WEIGHT: 'Lose Weight',
  INCREASE_CARDIO_HEALTH: 'Cardio Health',
  INCREASE_STRENGTH_AND_MUSCLE_MASS: 'Strength & Muscle',
  INCREASE_STAMINA_AND_ENDURANCE: 'Stamina & Endurance',
};
const ENUM_POSITION_MAP: Record<string, string> = {
  QB: 'QB', RB: 'RB', WR: 'WR', OL: 'OL', TE: 'TE', LB: 'LB', DB: 'DB', DL: 'DL',
  PG: 'PG', SG: 'SG', SF: 'SF', PF: 'PF', C: 'C',
  PITCHER: 'Pitcher', CATCHER: 'Catcher', INFIELD: 'Infield', OUTFIELD: 'Outfield',
  GOALKEEPER: 'Goalkeeper', DEFENDER: 'Defender', MIDFIELDER: 'Midfielder', FORWARD: 'Forward',
  CENTER: 'Center', WINGER: 'Winger', DEFENSEMAN: 'Defenseman', GOALIE: 'Goalie',
};

export default function WorkoutRequestScreen() {
  const navigation = useNavigation<WorkoutRequestNavigationProp>();
  const route = useRoute();
  const { chatFocusAreas, chatSessionId } = (route.params as { chatFocusAreas?: string; chatSessionId?: string }) ?? {};
  const hasChatContext = !!chatFocusAreas;
  const userService = new UserService();

  const [userSport, setUserSport] = useState('');
  const [userPosition, setUserPosition] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isGeneralFitness, setIsGeneralFitness] = useState(false);
  const [userFitnessGoals, setUserFitnessGoals] = useState<string[]>([]);
  const [additionalEquipment, setAdditionalEquipment] = useState('');
  const [specialFocusAreas, setSpecialFocusAreas] = useState('');

  const [formData, setFormData] = useState<WorkoutRequest>({
    sport: '',
    position: '',
    experienceLevel: 'intermediate',
    trainingPhase: 'off-season',
    equipment: [],
    timeAvailable: 60,
    trainingFocus: [],
    specialRequests: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [trialLimitVisible, setTrialLimitVisible] = useState(false);
  const [modalType, setModalType] = useState<'trial' | 'budgetBasic' | 'budgetPremium'>('trial');
  const [userSubscriptionTier, setUserSubscriptionTier] = useState<string | undefined>();
  const { onUpgradePress } = useUpgrade();

  useEffect(() => {
    if (chatFocusAreas) {
      setSpecialFocusAreas(chatFocusAreas);
    }
  }, [chatFocusAreas]);

  useFocusEffect(
    useCallback(() => {
      const loadUserProfile = async () => {
        setProfileLoading(true);
        try {
          const firebaseUser = getAuth().currentUser;
          if (!firebaseUser) return;
          const userData = await userService.checkUserExists(firebaseUser.uid);
          if (userData) {
            const displaySport = ENUM_SPORT_MAP[userData.primarySport] ?? userData.primarySport ?? '';
            const displayPosition = ENUM_POSITION_MAP[userData.primaryPosition] ?? userData.primaryPosition ?? '';
            setCurrentUserId(userData.id);
            setUserSport(displaySport);
            setUserPosition(displayPosition);
            setUserSubscriptionTier(userData.subscriptionTier);
            setFormData(prev => ({ ...prev, sport: userData.primarySport ?? displaySport, position: displayPosition }));
            if (userData.primarySport === 'GENERAL_FITNESS') {
              setIsGeneralFitness(true);
              setUserPosition('');
              setUserFitnessGoals(Array.isArray(userData.fitnessGoals) ? userData.fitnessGoals : []);
            } else {
              setIsGeneralFitness(false);
              setUserFitnessGoals([]);
            }
          }
        } catch (err) {
          console.error('Failed to load user profile:', err);
        } finally {
          setProfileLoading(false);
        }
      };
      loadUserProfile();
    }, [])
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (formData.equipment.length === 0) newErrors.equipment = 'Please select at least one equipment option';
    if (!hasChatContext && formData.trainingFocus.length === 0) newErrors.trainingFocus = 'Please select at least one training focus';
    if (formData.timeAvailable < 15) newErrors.timeAvailable = 'Minimum workout time is 15 minutes';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitRequest = async () => {
    if (!validateForm()) {
      Alert.alert('Form Error', 'Please fix the highlighted fields');
      return;
    }
    let resolvedUserId = currentUserId;
    if (!resolvedUserId) {
      try {
        const firebaseUser = getAuth().currentUser;
        if (!firebaseUser) throw new Error('Not authenticated');
        const userResponse = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/firebase/${firebaseUser.uid}`
        );
        const userData = await userResponse.json();
        resolvedUserId = userData.id;
        setCurrentUserId(resolvedUserId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('Monthly AI budget reached')) {
          if (userSubscriptionTier === 'PREMIUM') {
            setModalType('budgetPremium');
          } else {
            setModalType('budgetBasic');
          }
          setTrialLimitVisible(true);
        } else if (
          message.includes('Trial') || message.includes('trial') ||
          message.includes('limit reached') || message.includes('budget reached') ||
          message.includes('subscription')
        ) {
          setModalType('trial');
          setTrialLimitVisible(true);
        } else {
          Alert.alert('Error', message || 'Failed to generate workout. Please try again.');
        }
      }
    }
    setIsLoading(true);
    try {
      const requestWithExtras: WorkoutRequest = {
        ...formData,
        additionalEquipment: additionalEquipment || undefined,
        specialFocusAreas: specialFocusAreas || undefined,
      };
      const response = await workoutApiService.generateWorkout(requestWithExtras, resolvedUserId!);
      if (response.success && response.data) {
        const workoutData: WorkoutData = {
          ...response.data,
          sport: formData.sport,
          position: formData.position,
        };
        const readyMessage = isGeneralFitness
          ? `Your General Fitness workout is ready. Duration: ${response.data.estimatedDuration} minutes`
          : `Your ${formData.position} workout is ready. Duration: ${response.data.estimatedDuration} minutes`;
        Alert.alert(
          'Workout Generated!',
          readyMessage,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View Workout', onPress: () => navigation.navigate('WorkoutDisplay', { workoutData }) },
          ]
        );
      } else {
        throw new Error(response.error || 'Failed to generate workout');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Monthly AI budget reached')) {
        if (userSubscriptionTier === 'PREMIUM') {
          setModalType('budgetPremium');
        } else {
          setModalType('budgetBasic');
        }
        setTrialLimitVisible(true);
      } else if (
        message.includes('Trial') || message.includes('trial') ||
        message.includes('limit reached') || message.includes('budget reached') ||
        message.includes('subscription')
      ) {
        setModalType('trial');
        setTrialLimitVisible(true);
      } else {
        Alert.alert('Error', message || 'Failed to generate workout. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEquipment = (item: string) => {
    const updated = formData.equipment.includes(item)
      ? formData.equipment.filter(e => e !== item)
      : [...formData.equipment, item];
    setFormData({ ...formData, equipment: updated });
    if (errors.equipment) setErrors({ ...errors, equipment: '' });
  };

  const toggleFocus = (item: string) => {
    const updated = formData.trainingFocus.includes(item)
      ? formData.trainingFocus.filter(f => f !== item)
      : [...formData.trainingFocus, item];
    setFormData({ ...formData, trainingFocus: updated });
    if (errors.trainingFocus) setErrors({ ...errors, trainingFocus: '' });
  };

  const renderEquipmentSection = () => (
    <BlurView intensity={15} tint="dark" style={[cs.glassCardOrb, errors.equipment && styles.errorCard]}>
      <View style={cs.cardPadding}>
        <Text style={cs.cardHeading}>Available Equipment</Text>
        {errors.equipment && <Text style={styles.errorText}>{errors.equipment}</Text>}
        <View style={{ height: 12 }} />
        {Object.entries(EQUIPMENT_OPTIONS).map(([category, items]) => (
          <View key={category} style={styles.optionGroup}>
            <Text style={styles.categoryLabel}>{category}</Text>
            {items.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.checkboxRow}
                onPress={() => toggleEquipment(item)}
                activeOpacity={0.7}
              >
                <Checkbox
                  status={formData.equipment.includes(item) ? 'checked' : 'unchecked'}
                  onPress={() => toggleEquipment(item)}
                  color={appTheme.purple}
                />
                <Text style={styles.optionLabel}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </BlurView>
  );

  const renderFocusSection = () => (
    <BlurView intensity={15} tint="dark" style={[cs.glassCardOrb, errors.trainingFocus && styles.errorCard]}>
      <View style={cs.cardPadding}>
        <Text style={cs.cardHeading}>Training Focus</Text>
        {errors.trainingFocus && <Text style={styles.errorText}>{errors.trainingFocus}</Text>}
        <View style={{ height: 12 }} />
        {Object.entries(FOCUS_OPTIONS).map(([category, items]) => (
          <View key={category} style={styles.optionGroup}>
            <Text style={styles.categoryLabel}>{category}</Text>
            <View style={styles.chipContainer}>
              {items.map(item => (
                <Chip
                  key={item}
                  mode={formData.trainingFocus.includes(item) ? 'flat' : 'outlined'}
                  selected={formData.trainingFocus.includes(item)}
                  onPress={() => toggleFocus(item)}
                  style={[styles.chip, formData.trainingFocus.includes(item) && styles.chipSelected]}
                  selectedColor={appTheme.purple}
                  textStyle={{ fontSize: 12, color: formData.trainingFocus.includes(item) ? appTheme.purple : appTheme.textMuted }}
                >
                  {item}
                </Chip>
              ))}
            </View>
          </View>
        ))}
      </View>
    </BlurView>
  );

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

      <TrialLimitModal
        visible={trialLimitVisible}
        limitType="workout"
        modalType={modalType}
        onDismiss={() => setTrialLimitVisible(false)}
        onUpgrade={() => {
          setTrialLimitVisible(false);
          onUpgradePress();
        }}
      />

      <View style={styles.header}>
        {hasChatContext ? (
          <TouchableOpacity
            style={styles.backToChatButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Coaching' })}
          >
            <Icon name="arrow-back" size={20} color={appTheme.purple} />
            <Text style={styles.backToChatText}>Back to Chat</Text>
          </TouchableOpacity>
        ) : (
          <Icon name="fitness-center" size={22} color={appTheme.neonGreen} />
        )}
        <Text style={styles.headerTitle}>Generate Workout</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Training For */}
        <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
          <View style={cs.cardPadding}>
            <View style={cs.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={cs.cardHeading}>Training For</Text>
                {profileLoading ? (
                  <ActivityIndicator size="small" color={appTheme.purple} style={{ marginTop: 4 }} />
                ) : isGeneralFitness ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.trainingForText}>General Fitness 💪</Text>
                    {userFitnessGoals.length > 0 ? (
                      <View style={styles.goalChipContainer}>
                        {userFitnessGoals.map(goal => (
                          <View key={goal} style={styles.goalChip}>
                            <Text style={styles.goalChipText}>
                              {FITNESS_GOAL_LABELS[goal] ?? goal}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.goalEmptyText}>Set your focus areas in Profile</Text>
                    )}
                  </View>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.trainingForText}>
                      {userSport || '—'} · {userPosition || '—'}
                    </Text>
                    {userPosition ? (
                      <View style={[cs.badge, cs.purpleBadge, { marginTop: 6 }]}>
                        <Text style={[cs.badgeText, cs.purpleBadgeText]}>{userPosition}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              <Icon name="sports" size={32} color={appTheme.neonGreen} />
            </View>
          </View>
        </BlurView>

        {/* Experience Level & Training Phase */}
        {!hasChatContext && (
        <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
          <View style={cs.cardPadding}>
            <Text style={cs.cardHeading}>Experience Level</Text>
            <View style={{ height: 12 }} />
            <RadioButton.Group
              onValueChange={(v) => setFormData({ ...formData, experienceLevel: v as any })}
              value={formData.experienceLevel}
            >
              {[
                { value: 'beginner',     label: 'Beginner (0–1 years)' },
                { value: 'intermediate', label: 'Intermediate (2–4 years)' },
                { value: 'advanced',     label: 'Advanced (5+ years)' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.radioRow}
                  onPress={() => setFormData({ ...formData, experienceLevel: opt.value as any })}
                  activeOpacity={0.7}
                >
                  <RadioButton value={opt.value} color={appTheme.purple} />
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </RadioButton.Group>

            {!isGeneralFitness && (
              <>
                <Divider style={styles.divider} />

                <Text style={cs.cardHeading}>Training Phase</Text>
                <View style={{ height: 12 }} />
                <RadioButton.Group
                  onValueChange={(v) => setFormData({ ...formData, trainingPhase: v as any })}
                  value={formData.trainingPhase}
                >
                  {[
                    { value: 'off-season',  label: 'Off-season (Skill building)' },
                    { value: 'pre-season',  label: 'Pre-season (Peak preparation)' },
                    { value: 'in-season',   label: 'In-season (Maintenance)' },
                    { value: 'post-season', label: 'Post-season (Recovery)' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.radioRow}
                      onPress={() => setFormData({ ...formData, trainingPhase: opt.value as any })}
                      activeOpacity={0.7}
                    >
                      <RadioButton value={opt.value} color={appTheme.purple} />
                      <Text style={styles.optionLabel}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </RadioButton.Group>
              </>
            )}
          </View>
        </BlurView>
        )}

        {/* Time Available */}
        {!hasChatContext && (
        <BlurView intensity={15} tint="dark" style={[cs.glassCardOrb, errors.timeAvailable && styles.errorCard]}>
          <View style={cs.cardPadding}>
            <Text style={cs.cardHeading}>Time Available (minutes)</Text>
            {errors.timeAvailable && <Text style={styles.errorText}>{errors.timeAvailable}</Text>}
            <TextInput
              mode="outlined"
              value={formData.timeAvailable.toString()}
              onChangeText={(text) => {
                const minutes = parseInt(text) || 0;
                setFormData({ ...formData, timeAvailable: minutes });
                if (errors.timeAvailable && minutes >= 15) setErrors({ ...errors, timeAvailable: '' });
              }}
              keyboardType="numeric"
              placeholder="e.g., 60"
              style={styles.textInput}
              outlineColor={appTheme.border}
              activeOutlineColor={appTheme.purple}
              textColor={appTheme.text}
              placeholderTextColor={appTheme.textMuted}
            />
            <View style={styles.chipContainer}>
              {[30, 45, 60, 90].map(t => (
                <Chip
                  key={t}
                  mode={formData.timeAvailable === t ? 'flat' : 'outlined'}
                  onPress={() => setFormData({ ...formData, timeAvailable: t })}
                  style={[styles.chip, formData.timeAvailable === t && styles.chipSelected]}
                  selectedColor={appTheme.purple}
                  textStyle={{ fontSize: 12, color: formData.timeAvailable === t ? appTheme.purple : appTheme.textMuted }}
                >
                  {t}min
                </Chip>
              ))}
            </View>
          </View>
        </BlurView>
        )}

        {renderEquipmentSection()}

        <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
          <View style={cs.cardPadding}>
            <Text style={cs.cardHeading}>Additional Equipment (Optional)</Text>
            <TextInput
              mode="outlined"
              value={additionalEquipment}
              onChangeText={setAdditionalEquipment}
              placeholder="e.g., weighted vest, jump rope, resistance bands..."
              style={styles.textInput}
              outlineColor={appTheme.border}
              activeOutlineColor={appTheme.purple}
              textColor={appTheme.text}
              placeholderTextColor={appTheme.textMuted}
            />
          </View>
        </BlurView>

        {!hasChatContext && renderFocusSection()}

        <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
          <View style={cs.cardPadding}>
            <Text style={cs.cardHeading}>Special Focus Areas (Optional)</Text>
            <TextInput
              mode="outlined"
              multiline={true}
              numberOfLines={3}
              editable={!hasChatContext}
              value={specialFocusAreas}
              onChangeText={setSpecialFocusAreas}
              placeholder="e.g., improved forearm strength, increased vertical jump..."
              style={[styles.textInput, hasChatContext && styles.lockedInput, hasChatContext && { minHeight: 80 }]}
              outlineColor={appTheme.border}
              activeOutlineColor={appTheme.purple}
              textColor={appTheme.text}
              placeholderTextColor={appTheme.textMuted}
            />
            {hasChatContext && (
              <View style={styles.lockedHintRow}>
                <Icon name="lock" size={14} color={appTheme.textMuted} />
                <Text style={styles.lockedHintText}>
                  Pre-filled from your AI coaching session — describes the workout focus recommended by your coach
                </Text>
              </View>
            )}
          </View>
        </BlurView>

        {/* <Card style={styles.card}>
          <Card.Content>
            <Text style={cs.cardHeading}>Special Requests (Optional)</Text>
            <TextInput
              mode="outlined"
              value={formData.specialRequests}
              onChangeText={(text) => setFormData({ ...formData, specialRequests: text })}
              placeholder="Any specific needs, injuries to work around, or goals?"
              multiline
              numberOfLines={3}
              style={styles.textInput}
              outlineColor={appTheme.border}
              activeOutlineColor={appTheme.purple}
              textColor={appTheme.text}
              placeholderTextColor={appTheme.textMuted}
            />
          </Card.Content>
        </Card> */}

        <Button
          mode="contained"
          onPress={handleSubmitRequest}
          loading={isLoading}
          disabled={isLoading}
          style={styles.generateButton}
          buttonColor={appTheme.purple}
          textColor={appTheme.white}
          contentStyle={styles.buttonContent}
          theme={{ colors: { onSurfaceDisabled: appTheme.white } }}
        >
          {isLoading ? 'Generating workout...' : 'Generate My Workout'}
        </Button>

        {/* Cost info card with neon green left accent */}
        <BlurView intensity={15} tint="dark" style={styles.costCard}>
          <View style={styles.costAccentStrip} />
          <View style={cs.cardPadding}>
            <View style={styles.costRow}>
              <Icon name="info" size={16} color={appTheme.neonGreen} />
              <Text style={styles.costText}>
                AI-generated workouts are personalised for your position and goals.
              </Text>
            </View>
          </View>
        </BlurView>

      </ScrollView>
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
    alignItems: 'center',
    padding: theme.spacing.base,
    backgroundColor: 'rgba(8,11,20,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
  },
  headerTitle: {
    marginLeft: theme.spacing.sm,
    fontSize: 17,
    fontWeight: '900',
    color: appTheme.white,
    letterSpacing: -0.5,
  },
  backToChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backToChatText: {
    color: appTheme.purple,
    fontSize: 14,
    fontWeight: '600',
  },
  lockedInput: {
    backgroundColor: appTheme.bgElevated,
    opacity: 0.6,
    borderColor: appTheme.neonGreen,
    borderWidth: 1,
  },
  lockedHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  lockedHintText: {
    fontSize: 12,
    color: appTheme.textMuted,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    padding: theme.spacing.base,
    backgroundColor: 'transparent',
  },

  errorCard: {
    borderColor: '#dc354560',
    borderWidth: 1.5,
  },
  trainingForText: {
    fontSize: 18,
    fontWeight: '800',
    color: appTheme.white,
  },
  goalChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  goalChip: {
    backgroundColor: appTheme.purpleDim,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: appTheme.purple,
  },
  goalChipText: {
    fontSize: 11,
    color: appTheme.purple,
    fontWeight: '600',
  },
  goalEmptyText: {
    marginTop: 6,
    fontSize: 12,
    color: appTheme.textMuted,
    fontStyle: 'italic',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: appTheme.textMuted,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  optionGroup: {
    marginBottom: theme.spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  optionLabel: {
    marginLeft: theme.spacing.sm,
    fontSize: 15,
    color: appTheme.text,
    flex: 1,
  },
  divider: {
    marginVertical: theme.spacing.md,
    backgroundColor: appTheme.border,
  },
  textInput: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: appTheme.bgElevated,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  chip: {
    marginBottom: theme.spacing.xs,
    borderColor: appTheme.border,
  },
  chipSelected: {
    backgroundColor: appTheme.purpleDim,
    borderColor: appTheme.purple,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  generateButton: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: 20,
  },
  buttonContent: {
    paddingVertical: theme.spacing.sm,
  },
  costCard: {
    borderRadius: 40,
    borderWidth: 1,
    borderColor: appTheme.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.xl,
  },
  costAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: appTheme.neonGreen,
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 40,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  costText: {
    marginLeft: theme.spacing.sm,
    flex: 1,
    fontSize: 12,
    color: appTheme.textMuted,
    lineHeight: 18,
  },
});
