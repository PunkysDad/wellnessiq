import React, { useState, useEffect } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Button,
  Chip,
  IconButton,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { theme } from '../theme';
import { appTheme } from '../theme/appTheme';
import { componentStyles as cs } from '../theme/componentStyles';
import { Exercise, WorkoutData, TagResponse } from '../interfaces/interfaces';
import FormattedMessage from '../components/FormattedMessage';
import YoutubePlayerModal from '../components/YoutubePlayerModal';
import { RootStackParamList } from '../types/types';
import { apiService } from '../services/apiService';
import { getAuth } from 'firebase/auth';

export default function WorkoutDisplayScreen() {
  type WorkoutRequestNavigationProp = NativeStackNavigationProp<RootStackParamList>;
  const route = useRoute();
  const navigation = useNavigation<WorkoutRequestNavigationProp>();
  const { workoutData } = route.params as { workoutData: WorkoutData };
  const insets = useSafeAreaInsets();

  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [existingTags, setExistingTags] = useState<TagResponse[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<Set<number>>(new Set());
  const [tagsLoading, setTagsLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#007AFF');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [savingTag, setSavingTag] = useState(false);

  const [youtubeModalVisible, setYoutubeModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedExerciseVideoUrl, setSelectedExerciseVideoUrl] = useState<string | undefined>(undefined);
  const [selectedExerciseVideoTitle, setSelectedExerciseVideoTitle] = useState<string | undefined>(undefined);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);

  const TAG_COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];

  const getCurrentUserId = async (): Promise<number | null> => {
    try {
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) return null;
      const result = await apiService.getUserByFirebaseUid(firebaseUser.uid);
      if (result.success && result.data) {
        setSubscriptionTier(result.data.subscriptionTier || null);
        return result.data.id;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    getCurrentUserId();
  }, []);

  const openTagModal = async () => {
    setTagModalVisible(true);
    setTagsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const result = await apiService.getUserTags(userId);
      if (result.success) setExistingTags(result.data);
    } finally {
      setTagsLoading(false);
    }
  };

  const toggleTagAssignment = async (tagId: number) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const isAssigned = assignedTagIds.has(tagId);
    try {
      if (isAssigned) {
        await apiService.removeTagFromWorkout(userId, Number(workoutData.id), tagId);
        setAssignedTagIds(prev => { const next = new Set(prev); next.delete(tagId); return next; });
      } else {
        await apiService.addTagToWorkout(userId, Number(workoutData.id), tagId);
        setAssignedTagIds(prev => new Set(prev).add(tagId));
      }
    } catch {
      Alert.alert('Error', 'Failed to update tag. Please try again.');
    }
  };

  const handleCreateAndAssignTag = async () => {
    if (!newTagName.trim()) return;
    setSavingTag(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const result = await apiService.createTag(userId, newTagName.trim(), newTagColor);
      if (!result.success) { Alert.alert('Error', result.error || 'Failed to create tag.'); return; }
      const newTag = result.data;
      setExistingTags(prev => [...prev, newTag]);
      await apiService.addTagToWorkout(userId, Number(workoutData.id), newTag.id);
      setAssignedTagIds(prev => new Set(prev).add(newTag.id));
      setNewTagName('');
      setNewTagColor('#007AFF');
      setShowNewTagInput(false);
    } finally {
      setSavingTag(false);
    }
  };

  const renderTagModal = () => (
    <Modal
      visible={tagModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setTagModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Tags</Text>
            <IconButton icon="close" size={20} iconColor={appTheme.white} onPress={() => setTagModalVisible(false)} />
          </View>

          {tagsLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={appTheme.purple} />
          ) : (
            <>
              {existingTags.length > 0 && (
                <View style={styles.tagList}>
                  {existingTags.map(tag => {
                    const assigned = assignedTagIds.has(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        style={[styles.tagRow, assigned && { backgroundColor: tag.color + '20' }]}
                        onPress={() => toggleTagAssignment(tag.id)}
                      >
                        <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                        <Text style={styles.tagRowName}>{tag.name}</Text>
                        {assigned && <Icon name="check" size={18} color={tag.color} style={styles.tagCheck} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Divider style={{ marginVertical: 12, backgroundColor: appTheme.border }} />

              {showNewTagInput ? (
                <View style={styles.newTagForm}>
                  <TextInput
                    style={styles.newTagInput}
                    placeholder="Tag name"
                    placeholderTextColor={appTheme.textMuted}
                    value={newTagName}
                    onChangeText={setNewTagName}
                    maxLength={100}
                    autoFocus
                  />
                  <View style={styles.colorRow}>
                    {TAG_COLORS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorSwatch, { backgroundColor: c }, newTagColor === c && styles.colorSwatchSelected]}
                        onPress={() => setNewTagColor(c)}
                      />
                    ))}
                  </View>
                  <View style={styles.newTagActions}>
                    <Button mode="text" textColor={appTheme.textMuted} onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}>
                      Cancel
                    </Button>
                    <Button
                      mode="contained"
                      buttonColor={appTheme.purple}
                      onPress={handleCreateAndAssignTag}
                      loading={savingTag}
                      disabled={!newTagName.trim() || savingTag}
                    >
                      Create & Add
                    </Button>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.createTagButton} onPress={() => setShowNewTagInput(true)}>
                  <Icon name="add" size={18} color={appTheme.purple} />
                  <Text style={styles.createTagText}>Create new tag</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <Button mode="contained" buttonColor={appTheme.purple} textColor={appTheme.white} onPress={() => setTagModalVisible(false)} style={{ marginTop: 16 }}>
            Done
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderCustomTabBar = () => (
    <View style={[styles.customTabBar, { paddingBottom: insets.bottom || 8 }]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Home' }], index: 0 } }] })}
      >
        <Icon name="home" size={24} color={appTheme.silver} />
        <Text style={styles.tabLabel}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Home' }, { name: 'Profile' }], index: 1 } }] })}
      >
        <Icon name="person" size={24} color={appTheme.silver} />
        <Text style={styles.tabLabel}>Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabItem, styles.activeTab]}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Workouts' })}
      >
        <Icon name="fitness-center" size={24} color={appTheme.neonGreen} />
        <Text style={[styles.tabLabel, styles.activeTabLabel]}>Workouts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Home' }, { name: 'Profile' }, { name: 'Workouts' }, { name: 'Coaching' }], index: 3 } }] })}
      >
        <Icon name="psychology" size={24} color={appTheme.silver} />
        <Text style={styles.tabLabel}>Coaching</Text>
      </TouchableOpacity>
    </View>
  );

  const parseWorkoutContent = () => {
    if (workoutData.exercises && workoutData.exercises.length > 0) {
      return {
        title: workoutData.workoutTitle || workoutData.title,
        description: workoutData.positionFocus || workoutData.description,
        exercises: workoutData.exercises,
      };
    }
    return { title: workoutData.title, description: workoutData.description, exercises: [] };
  };

  const { title: workoutTitle, description: workoutDescription, exercises } = parseWorkoutContent();

  const handleSaveWorkout = async () => {
    try {
      setSavedToLibrary(true);
      Alert.alert('Workout Saved!', 'This workout has been added to your personal library.', [{ text: 'OK' }]);
    } catch {
      Alert.alert('Save Failed', 'Unable to save workout. Please try again.', [{ text: 'OK' }]);
    }
  };

  const toggleExerciseDetails = (index: number) => {
    setExpandedExercise(expandedExercise === index ? null : index);
  };

  const renderExercise = (exercise: Exercise, index: number) => {
    const isExpanded = expandedExercise === index;
    const isGeneralFitness = workoutData.sport === 'GENERAL_FITNESS';
    const positionBenefitLabel = isGeneralFitness ? '❤️‍🩺 Physical Benefit' : '🎯 Position Benefit';
    const gameApplicationLabel = isGeneralFitness ? '👊 Functional Strength Benefit' : '🏈 Game Application';
    const coachingCueLabel = isGeneralFitness ? '💡 Trainer Advice' : '💬 Coaching Cue';
    return (
      <BlurView key={index} intensity={15} tint="dark" style={styles.exerciseCard}>
        <TouchableOpacity onPress={() => toggleExerciseDetails(index)}>
          <View style={styles.exerciseCardInner}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseStats}>
                  {exercise.sets} sets • {exercise.reps} reps
                  {exercise.restSeconds && ` • ${Math.floor(exercise.restSeconds / 60)}:${(exercise.restSeconds % 60).toString().padStart(2, '0')} rest`}
                </Text>
              </View>
              <Icon name={isExpanded ? 'expand-less' : 'expand-more'} size={24} color={appTheme.textMuted} />
            </View>
            <Text style={styles.exerciseDescription}>{exercise.description}</Text>
            {isExpanded && (
              <View style={styles.expandedContent}>
                <Divider style={[styles.sectionDivider, { backgroundColor: appTheme.border }]} />
                {exercise.positionBenefit && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{positionBenefitLabel}</Text>
                    <Text style={styles.detailText}>{exercise.positionBenefit}</Text>
                  </View>
                )}
                {exercise.gameApplication && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{gameApplicationLabel}</Text>
                    <Text style={styles.detailText}>{exercise.gameApplication}</Text>
                  </View>
                )}
                {exercise.coachingCue && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{coachingCueLabel}</Text>
                    <Text style={[styles.detailText, styles.coachingCue]}>"{exercise.coachingCue}"</Text>
                  </View>
                )}
                {exercise.injuryPrevention && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>🛡️ Injury Prevention</Text>
                    <Text style={styles.detailText}>{exercise.injuryPrevention}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.showExamplesButton}
                  onPress={() => { setSelectedExercise(exercise.name); setSelectedExerciseVideoUrl(exercise.videoUrl); setSelectedExerciseVideoTitle(exercise.videoTitle); setYoutubeModalVisible(true); }}
                >
                  <Text style={styles.showExamplesText}>▶ Show Examples</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </BlurView>
    );
  };

  return (
    <View style={styles.screen}>
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

      {renderTagModal()}
      <YoutubePlayerModal
        visible={youtubeModalVisible}
        exerciseName={selectedExercise}
        onClose={() => {
          setYoutubeModalVisible(false);
          setSelectedExerciseVideoTitle(undefined);
        }}
        workoutId={Number(workoutData.id)}
        savedVideoId={selectedExerciseVideoUrl}
        savedVideoTitle={selectedExerciseVideoTitle}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={appTheme.white}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Home' }], index: 0 } }] })}
        />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{workoutTitle}</Text>
          <Text style={styles.headerSubtitle}>
            {workoutData.sport === 'GENERAL_FITNESS'
              ? 'General Fitness 💪'
              : `${workoutData.sport} • ${workoutData.position}`
            }
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Overview card */}
        <BlurView intensity={20} tint="dark" style={cs.glassCardOrbAccent}>
          <View style={styles.overviewAccentStrip} />
          <View style={cs.cardPadding}>
            <View style={styles.overviewHeader}>
              <Icon name="fitness-center" size={20} color={appTheme.neonGreen} />
              <Text style={styles.overviewTitle}>Workout Overview</Text>
            </View>
            <Text style={styles.overviewDescription}>{workoutDescription}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{workoutData.estimatedDuration}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{workoutData.focusAreas.length}</Text>
                <Text style={styles.statLabel}>Focus Areas</Text>
              </View>
            </View>
            <View style={styles.focusAreasContainer}>
              <Text style={styles.focusAreasLabel}>Focus Areas:</Text>
              <View style={styles.focusAreasChips}>
                {workoutData.focusAreas.map((area, index) => (
                  <Chip
                    key={index}
                    mode="outlined"
                    textStyle={styles.chipText}
                    style={styles.focusChip}
                  >
                    {area}
                  </Chip>
                ))}
              </View>
            </View>
          </View>
        </BlurView>

        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>Workout Details</Text>
          {exercises.length > 0 ? (
            exercises.map((exercise, index) => renderExercise(exercise, index))
          ) : workoutData.generatedContent ? (
            <FormattedMessage text={workoutData.generatedContent} isUser={false} />
          ) : (
            <BlurView intensity={15} tint="dark" style={styles.placeholderCard}>
              <View style={cs.cardPadding}>
                <Text style={{ textAlign: 'center', color: appTheme.textMuted }}>Loading workout details...</Text>
              </View>
            </BlurView>
          )}
        </View>

        {(subscriptionTier === 'PREMIUM' || subscriptionTier === 'TRIAL') && (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={openTagModal}
              style={styles.outlineButton}
              textColor={appTheme.purple}
              contentStyle={styles.buttonContent}
              icon="tag"
            >
              {assignedTagIds.size > 0 ? `Tags (${assignedTagIds.size})` : 'Add Tag'}
            </Button>
          </View>
        )}

        {(subscriptionTier === 'PREMIUM' || subscriptionTier === 'TRIAL') && assignedTagIds.size > 0 && (
          <View style={styles.assignedTagsRow}>
            {existingTags
              .filter(t => assignedTagIds.has(t.id))
              .map(t => (
                <Chip
                  key={t.id}
                  style={[styles.assignedTagChip, { backgroundColor: t.color + '20', borderColor: t.color }]}
                  textStyle={{ color: t.color, fontSize: 12 }}
                  mode="outlined"
                >
                  {t.name}
                </Chip>
              ))}
          </View>
        )}

        <View style={styles.metadataCard}>
          <Text style={styles.metadataText}>
            Generated on {new Date(workoutData.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.metadataText}>Workout ID: {workoutData.id}</Text>
        </View>
      </ScrollView>

      {renderCustomTabBar()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },

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
    backgroundColor: 'rgba(8,11,20,0.95)',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
  },
  headerContent: { flex: 1, marginHorizontal: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: appTheme.white },
  headerSubtitle: { fontSize: 12, color: appTheme.textMuted, marginTop: 2 },

  content: { flex: 1, padding: 16, backgroundColor: 'transparent' },

  // Overview card
  overviewAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: appTheme.neonGreen,
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 40,
  },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  overviewTitle: { marginLeft: 8, fontWeight: '700', fontSize: 15, color: appTheme.white },
  overviewDescription: { fontSize: 14, lineHeight: 20, color: appTheme.white, marginBottom: 16 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appTheme.bgElevated,
    borderRadius: 20,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appTheme.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: appTheme.border },
  statValue: { fontSize: 24, fontWeight: '900', color: appTheme.white },
  statLabel: { fontSize: 12, color: appTheme.textMuted, marginTop: 2 },

  focusAreasContainer: { marginTop: 4 },
  focusAreasLabel: { fontSize: 13, fontWeight: '600', color: appTheme.textMuted, marginBottom: 6 },
  focusAreasChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  focusChip: { borderColor: appTheme.borderAccent, backgroundColor: appTheme.purpleDim, marginBottom: 4 },
  chipText: { fontSize: 12, color: appTheme.purple },

  exercisesSection: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: appTheme.white, marginBottom: 10 },
  exerciseCard: {
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: appTheme.border,
    overflow: 'hidden',
  },
  exerciseCardInner: { padding: 16 },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: appTheme.white },
  exerciseStats: { fontSize: 13, color: appTheme.neonGreen, marginTop: 2, fontWeight: '500' },
  exerciseDescription: { fontSize: 13, lineHeight: 18, color: appTheme.white },
  expandedContent: { marginTop: 8 },
  sectionDivider: { marginBottom: 8 },
  detailSection: { marginBottom: 8 },
  detailLabel: { fontSize: 13, fontWeight: '600', color: appTheme.text, marginBottom: 4 },
  detailText: { fontSize: 13, lineHeight: 18, color: appTheme.white },
  coachingCue: { fontStyle: 'italic', color: appTheme.white },
  placeholderCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: appTheme.border,
    overflow: 'hidden',
  },
  showExamplesButton: { marginTop: 8, borderWidth: 1, borderColor: appTheme.neonGreen, borderRadius: 16, paddingVertical: 10, alignItems: 'center' as const, backgroundColor: appTheme.neonGreenDim },
  showExamplesText: { color: appTheme.neonGreen, fontSize: 14, fontWeight: '600' as const },

  actionButtons: { marginTop: 20, gap: 10 },
  outlineButton: { borderColor: appTheme.purple, borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },

  assignedTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingHorizontal: 2 },
  assignedTagChip: { marginBottom: 4 },

  metadataCard: { marginTop: 16, marginBottom: 32, paddingHorizontal: 4 },
  metadataText: { fontSize: 12, color: appTheme.textMuted, marginBottom: 2 },

  customTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8,11,20,0.95)',
    borderTopWidth: 1,
    borderTopColor: appTheme.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  activeTab: {},
  tabLabel: { fontSize: 12, color: appTheme.silver, marginTop: 4 },
  activeTabLabel: { color: appTheme.neonGreen, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: appTheme.border, padding: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: appTheme.white },
  tagList: { gap: 4 },
  tagRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8 },
  tagDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  tagRowName: { flex: 1, fontSize: 15, color: appTheme.text },
  tagCheck: { marginLeft: 'auto' },
  createTagButton: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 },
  createTagText: { color: appTheme.purple, fontSize: 15, fontWeight: '500' },
  newTagForm: { gap: 12 },
  newTagInput: { borderWidth: 1, borderColor: appTheme.border, borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: appTheme.bgElevated, color: appTheme.text },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchSelected: { borderWidth: 3, borderColor: appTheme.white },
  newTagActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
