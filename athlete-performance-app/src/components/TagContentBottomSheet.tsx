import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { appTheme } from '../theme/appTheme';
import { theme } from '../theme';
import { componentStyles as cs } from '../theme/componentStyles';
import { TagResponse, TaggedItem } from '../interfaces/interfaces';
import { apiService } from '../services/apiService';
import FormattedMessage from './FormattedMessage';
import YoutubePlayerModal from './YoutubePlayerModal';

interface Props {
  item: TaggedItem | null;
  visible: boolean;
  onClose: () => void;
  userId: number;
}

const TAG_COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

const parseWorkoutData = (content: any) => {
  // Try to use structured exercises array first
  if (content.exercises && Array.isArray(content.exercises) && content.exercises.length > 0) {
    return {
      title: content.workoutTitle || content.title || '',
      description: content.positionFocus || content.description || '',
      exercises: content.exercises,
    };
  }
  // Fall back to parsing generatedContent JSON string
  if (content.generatedContent) {
    try {
      const parsed = JSON.parse(content.generatedContent);
      if (parsed.exercises && Array.isArray(parsed.exercises)) {
        return {
          title: parsed.workoutTitle || parsed.title || '',
          description: parsed.positionFocus || parsed.description || '',
          exercises: parsed.exercises,
        };
      }
    } catch {
      // Not JSON — return as plain text fallback
    }
    return { title: '', description: '', exercises: [], rawText: content.generatedContent };
  }
  return { title: '', description: '', exercises: [], rawText: null };
};

export default function TagContentBottomSheet({ item, visible, onClose, userId }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [youtubeModalVisible, setYoutubeModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedExerciseVideoId, setSelectedExerciseVideoId] = useState<string | undefined>(undefined);
  const [selectedExerciseVideoTitle, setSelectedExerciseVideoTitle] = useState<string | undefined>(undefined);

  // Title editing state
  const [displayTitle, setDisplayTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  // Tag state
  const [existingTags, setExistingTags] = useState<TagResponse[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<Set<number>>(new Set());
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#007AFF');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [savingTag, setSavingTag] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!item || !visible) return;
    setDisplayTitle(item?.title ?? '');
    fetchContent(item);
    loadUserTags();
  }, [item, visible]);

  const fetchContent = async (item: TaggedItem) => {
    setLoading(true);
    setError(null);
    setContent(null);
    try {
      if (item.type === 'chat') {
        const result = await apiService.getConversationById(item.id);
        if (result.success) {
          if (result.data?.sessionId) {
            const sessionResult = await apiService.getConversationsBySession(result.data.sessionId);
            if (sessionResult.success && Array.isArray(sessionResult.data) && sessionResult.data.length > 1) {
              setContent({ ...result.data, sessionConversations: sessionResult.data });
            } else {
              setContent(result.data);
            }
          } else {
            setContent(result.data);
          }
        } else {
          setError('Failed to load conversation');
        }
      } else {
        const result = await apiService.getWorkoutById(item.id);
        if (result.success) setContent(result.data);
        else setError('Failed to load workout');
      }
    } catch {
      setError('Something went wrong loading this content');
    } finally {
      setLoading(false);
    }
  };

  const loadUserTags = async () => {
    if (!userId) return;
    try {
      const result = await apiService.getUserTags(userId);
      if (result.success) setExistingTags(result.data);
    } catch {
      // non-fatal; tag UI just won't populate
    }
  };

  const openTagModal = () => {
    setTagModalVisible(true);
  };

  const toggleTagAssignment = async (tagId: number) => {
    if (!item || !userId) return;
    const isAssigned = assignedTagIds.has(tagId);
    try {
      if (isAssigned) {
        if (item.type === 'chat') {
          await apiService.removeTagFromConversation(userId, item.id, tagId);
        } else {
          await apiService.removeTagFromWorkout(userId, item.id, tagId);
        }
        setAssignedTagIds(prev => { const next = new Set(prev); next.delete(tagId); return next; });
      } else {
        if (item.type === 'chat') {
          await apiService.addTagToConversation(userId, item.id, tagId);
        } else {
          await apiService.addTagToWorkout(userId, item.id, tagId);
        }
        setAssignedTagIds(prev => new Set(prev).add(tagId));
      }
    } catch {
      Alert.alert('Error', 'Failed to update tag. Please try again.');
    }
  };

  const handleCreateAndAssignTag = async () => {
    if (!newTagName.trim() || !userId || !item) return;
    setSavingTag(true);
    try {
      const result = await apiService.createTag(userId, newTagName.trim(), newTagColor);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to create tag.');
        return;
      }
      const newTag = result.data;
      setExistingTags(prev => [...prev, newTag]);
      if (item.type === 'chat') {
        await apiService.addTagToConversation(userId, item.id, newTag.id);
      } else {
        await apiService.addTagToWorkout(userId, item.id, newTag.id);
      }
      setAssignedTagIds(prev => new Set(prev).add(newTag.id));
      setNewTagName('');
      setNewTagColor('#007AFF');
      setShowNewTagInput(false);
    } finally {
      setSavingTag(false);
    }
  };

  const handleClose = () => {
    setContent(null);
    setDisplayTitle('');
    setTagModalVisible(false);
    setAssignedTagIds(new Set());
    setNewTagName('');
    setNewTagColor('#007AFF');
    setShowNewTagInput(false);
    setSavingTag(false);
    onClose();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.dragHandle} />
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Icon
            name={item?.type === 'chat' ? 'chat' : 'fitness-center'}
            size={18}
            color={appTheme.neonGreen}
          />
          <Text style={styles.headerType}>
            {item?.type === 'chat' ? 'Coaching Chat' : 'Workout Plan'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerEditButton}
            onPress={() => {
              Alert.prompt(
                'Rename',
                'Enter a new title',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Save',
                    onPress: async (newTitle) => {
                      if (!newTitle?.trim() || !item) return;
                      setSavingTitle(true);
                      try {
                        const result = item.type === 'chat'
                          ? await apiService.updateConversationTitle(item.id, newTitle.trim())
                          : await apiService.updateWorkoutTitle(item.id, newTitle.trim());
                        if (result.success) {
                          setDisplayTitle(newTitle.trim());
                        }
                      } catch {
                        Alert.alert('Error', 'Failed to update title.');
                      } finally {
                        setSavingTitle(false);
                      }
                    },
                  },
                ],
                'plain-text',
                displayTitle || item?.title || ''
              );
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="edit" size={18} color={appTheme.purple} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="close" size={22} color={appTheme.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.headerTitle} numberOfLines={2}>{displayTitle || item?.title}</Text>
      <Text style={styles.headerDate}>{item?.date}</Text>
    </View>
  );

  const renderAddTagButton = () => (
    <TouchableOpacity style={styles.addTagButton} onPress={openTagModal}>
      <Icon name="label" size={16} color={appTheme.purple} />
      <Text style={styles.addTagButtonText}>
        {assignedTagIds.size > 0 ? `Tags (${assignedTagIds.size})` : 'Add Tag'}
      </Text>
    </TouchableOpacity>
  );

  const renderTagModal = () => (
    <Modal
      visible={tagModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setTagModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.tagModalOverlay}
        activeOpacity={1}
        onPress={() => setTagModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
        <TouchableWithoutFeedback>
          <View style={styles.tagModalContainer}>
            <View style={styles.tagModalHeader}>
              <Text style={styles.tagModalTitle}>Add Tags</Text>
              <TouchableOpacity onPress={() => setTagModalVisible(false)} style={{ padding: 8 }}>
                <Icon name="close" size={20} color={appTheme.white} />
              </TouchableOpacity>
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
                          {assigned && <Icon name="check" size={18} color={tag.color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={styles.tagModalDivider} />

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
                      <TouchableOpacity
                        style={styles.newTagCancel}
                        onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}
                      >
                        <Text style={styles.newTagCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.newTagCreate, (!newTagName.trim() || savingTag) && { opacity: 0.5 }]}
                        onPress={handleCreateAndAssignTag}
                        disabled={!newTagName.trim() || savingTag}
                      >
                        {savingTag
                          ? <ActivityIndicator size="small" color={appTheme.white} />
                          : <Text style={styles.newTagCreateText}>Create & Add</Text>}
                      </TouchableOpacity>
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

            <TouchableOpacity
              style={[styles.newTagCreate, { marginTop: 16, alignSelf: 'stretch', alignItems: 'center' }]}
              onPress={() => setTagModalVisible(false)}
            >
              <Text style={styles.newTagCreateText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );

  const cleanQuestion = (msg: string): string => {
    if (!msg) return '';
    // If message looks like an answer submission (numbered list), show a friendly label
    if (/^\d+\.\s/.test(msg.trim())) {
      return 'Assessment answers';
    }
    const questionMarker = 'question:';
    const idx = msg?.toLowerCase().indexOf(questionMarker) ?? -1;
    return idx !== -1 ? msg.substring(idx + questionMarker.length).trim() : msg;
  };

  const renderChatContent = () => {
    if (!content) return null;

    const thread: any[] = Array.isArray(content.sessionConversations) && content.sessionConversations.length > 1
      ? [...content.sessionConversations].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      : [content];

    return (
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {thread.map((entry, index) => {
          const question = cleanQuestion(entry.userMessage).replace(/\[YES\/NO\]/gi, '').trim();
          return (
            <React.Fragment key={entry.id ?? index}>
              <View style={styles.questionBubble}>
                <Text style={styles.questionLabel}>Your question</Text>
                <Text style={styles.questionText}>{question}</Text>
              </View>

              <View style={styles.responseContainer}>
                <Text style={styles.responseLabel}>Coach response</Text>
                <FormattedMessage text={entry.claudeResponse} isUser={false} />
              </View>

              {index < thread.length - 1 && <View style={styles.threadDivider} />}
            </React.Fragment>
          );
        })}

        <Text style={styles.metadata}>
          {content.sport} • {content.position} • {content.conversationType?.replace(/_/g, ' ')}
        </Text>
        {userId ? renderAddTagButton() : null}
        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  const renderWorkoutContent = () => {
    if (!content) return null;
    const { title, description, exercises, rawText } = parseWorkoutData(content);
    const isGeneralFitness = content.sport === 'GENERAL_FITNESS';
    const positionBenefitLabel = isGeneralFitness ? '❤️‍🩺 Physical Benefit' : '🎯 Position Benefit';
    const gameApplicationLabel = isGeneralFitness ? '👊 Functional Strength Benefit' : '🏈 Game Application';
    const coachingCueLabel = isGeneralFitness ? '💡 Trainer Advice' : '💬 Coaching Cue';

    return (
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {[content.sport, content.position, content.difficultyLevel].filter(Boolean).map((val) => (
            <View key={val} style={styles.chip}>
              <Text style={styles.chipText}>{val}</Text>
            </View>
          ))}
        </View>

        {title ? <Text style={styles.workoutTitle}>{title}</Text> : null}
        {description ? <Text style={styles.workoutDescription}>{description}</Text> : null}

        {exercises.length > 0 ? (
          exercises.map((exercise: any, index: number) => {
            const isExpanded = expandedExercise === index;
            return (
              <TouchableOpacity
                key={index}
                style={styles.exerciseItem}
                onPress={() => setExpandedExercise(isExpanded ? null : index)}
                activeOpacity={0.7}
              >
                <View style={styles.exerciseHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseStats}>
                      {exercise.sets} sets • {exercise.reps} reps
                      {exercise.restSeconds ? ` • ${Math.floor(exercise.restSeconds / 60)}:${(exercise.restSeconds % 60).toString().padStart(2, '0')} rest` : ''}
                    </Text>
                  </View>
                  <Icon
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={appTheme.textMuted}
                  />
                </View>

                {exercise.description ? (
                  <Text style={styles.exerciseDescription}>{exercise.description}</Text>
                ) : null}

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.expandedDivider} />
                    {exercise.positionBenefit ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>{positionBenefitLabel}</Text>
                        <Text style={styles.detailText}>{exercise.positionBenefit}</Text>
                      </View>
                    ) : null}
                    {exercise.gameApplication ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>{gameApplicationLabel}</Text>
                        <Text style={styles.detailText}>{exercise.gameApplication}</Text>
                      </View>
                    ) : null}
                    {exercise.coachingCue ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>{coachingCueLabel}</Text>
                        <Text style={[styles.detailText, styles.coachingCue]}>"{exercise.coachingCue}"</Text>
                      </View>
                    ) : null}
                    {exercise.injuryPrevention ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>🛡️ Injury Prevention</Text>
                        <Text style={styles.detailText}>{exercise.injuryPrevention}</Text>
                      </View>
                    ) : null}
                    {/* Video button — shown when exercise is expanded */}
                    {exercise.videoId ? (
                      <TouchableOpacity
                        style={styles.watchAgainButton}
                        onPress={() => {
                          setSelectedExercise(exercise.name);
                          setSelectedExerciseVideoId(exercise.videoId);
                          setSelectedExerciseVideoTitle(exercise.videoTitle);
                          setYoutubeModalVisible(true);
                        }}
                      >
                        <Text style={styles.watchAgainText}>▶ Watch Again</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.showExamplesButton}
                        onPress={() => {
                          setSelectedExercise(exercise.name);
                          setSelectedExerciseVideoId(undefined);
                          setSelectedExerciseVideoTitle(undefined);
                          setYoutubeModalVisible(true);
                        }}
                      >
                        <Text style={styles.showExamplesText}>▶ Show Examples</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        ) : rawText ? (
          <FormattedMessage text={rawText} isUser={false} />
        ) : (
          <Text style={{ color: appTheme.textMuted }}>No workout content available.</Text>
        )}

        {userId ? renderAddTagButton() : null}
        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {renderHeader()}

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={appTheme.purple} />
              <Text style={[styles.metadata, { marginTop: theme.spacing.sm }]}>
                Loading content...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Icon name="error-outline" size={36} color={appTheme.textMuted} />
              <Text style={[styles.metadata, { marginTop: theme.spacing.sm, color: appTheme.purple }]}>
                {error}
              </Text>
            </View>
          ) : (
            item?.type === 'chat' ? renderChatContent() : renderWorkoutContent()
          )}
        </KeyboardAvoidingView>
      </Animated.View>

      <YoutubePlayerModal
        visible={youtubeModalVisible}
        exerciseName={selectedExercise}
        onClose={() => {
          setYoutubeModalVisible(false);
          setSelectedExerciseVideoId(undefined);
          setSelectedExerciseVideoTitle(undefined);
        }}
        workoutId={Number(content?.id) || 0}
        savedVideoId={selectedExerciseVideoId}
        savedVideoTitle={selectedExerciseVideoTitle}
      />

      {renderTagModal()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: 'rgba(8,11,20,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: appTheme.borderAccent,
  },

  header: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: appTheme.borderAccent,
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: '#000'
  },
  headerType: {
    fontSize: 13,
    color: appTheme.neonGreen,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: appTheme.white,
    marginBottom: theme.spacing.xs,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerEditButton: {
    padding: 4,
  },
  headerDate: {
    fontSize: 12,
    color: appTheme.textMuted,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: appTheme.purple,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  addTagButtonText: {
    color: appTheme.purple,
    fontSize: 14,
    fontWeight: '600',
  },
  tagModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  tagModalContainer: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: appTheme.border,
    padding: 24,
    maxHeight: '70%',
  },
  tagModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tagModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appTheme.white,
  },
  tagModalDivider: {
    height: 1,
    backgroundColor: appTheme.border,
    marginVertical: 12,
  },
  tagList: { gap: 4 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  tagDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  tagRowName: {
    flex: 1,
    fontSize: 15,
    color: appTheme.text,
  },
  createTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 6,
  },
  createTagText: {
    color: appTheme.purple,
    fontSize: 15,
    fontWeight: '500',
  },
  newTagForm: { gap: 12 },
  newTagInput: {
    borderWidth: 1,
    borderColor: appTheme.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: appTheme.bgElevated,
    color: appTheme.text,
  },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchSelected: { borderWidth: 3, borderColor: appTheme.white },
  newTagActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  newTagCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  newTagCancelText: { color: appTheme.textMuted, fontSize: 15 },
  newTagCreate: {
    backgroundColor: appTheme.purple,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newTagCreateText: { color: appTheme.white, fontSize: 15, fontWeight: '600' },

  scrollContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    backgroundColor: 'transparent',
  },

  questionBubble: {
    backgroundColor: appTheme.bgElevated,
    borderRadius: 16,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: appTheme.purple,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: appTheme.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  questionText: {
    fontSize: 15,
    color: appTheme.text,
    lineHeight: 22,
  },

  responseContainer: {
    marginBottom: theme.spacing.base,
  },
  threadDivider: {
    height: 1,
    backgroundColor: appTheme.border,
    marginVertical: theme.spacing.base,
  },
  responseLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: appTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },

  metadata: {
    fontSize: 11,
    color: appTheme.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.base,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.base,
  },
  chip: {
    backgroundColor: appTheme.purpleDim,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
  },
  chipText: {
    fontSize: 13,
    color: appTheme.purple,
    fontWeight: '600',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPadding: {
    height: 40,
  },
  workoutTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: appTheme.white,
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 14,
    color: appTheme.white,
    lineHeight: 20,
    marginBottom: 16,
  },
  exerciseItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: appTheme.border,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: appTheme.white,
    marginBottom: 4,
  },
  exerciseStats: {
    fontSize: 13,
    color: appTheme.neonGreen,
    fontWeight: '600',
    marginBottom: 6,
  },
  exerciseDescription: {
    fontSize: 13,
    color: appTheme.white,
    lineHeight: 18,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  expandedContent: {
    marginTop: 8,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: appTheme.border,
    marginBottom: 12,
    marginTop: 4,
  },
  detailSection: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: appTheme.text,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 18,
    color: appTheme.white,
  },
  coachingCue: {
    fontStyle: 'italic',
    color: appTheme.white,
  },
  showExamplesButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: appTheme.neonGreen,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center' as const,
    backgroundColor: appTheme.neonGreenDim,
  },
  showExamplesText: {
    color: appTheme.neonGreen,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  watchAgainButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: appTheme.purple,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center' as const,
    backgroundColor: appTheme.purpleDim,
  },
  watchAgainText: {
    color: appTheme.purple,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
