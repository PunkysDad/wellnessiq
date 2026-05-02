import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { Divider, ActivityIndicator as PaperIndicator, Portal } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/types';
import FormattedMessage from '../components/FormattedMessage';
import TrialLimitModal from '../components/TrialLimitModal';
import { apiService, TrialLimitError } from '../services/apiService';
import { TagResponse } from '../interfaces/interfaces';
import { useUpgrade } from '../context/UpgradeContext';
import { appTheme } from '../theme/appTheme';
import { componentStyles as cs } from '../theme/componentStyles';
import ENV_CONFIG from '../config/environment';

const TAG_COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface UserProfile {
  id: number;
  primarySport: string;
  primaryPosition: string;
  subscriptionTier?: string;
}

const parseYesNoQuestions = (text: string): string[] => {
  const lines = text.split('\n');
  return lines
    .filter(line => line.trim().startsWith('[YES/NO]'))
    .map(line => line.trim().replace('[YES/NO]', '').trim());
};

const COACHING_TIPS = [
  {
    sport: 'Football',
    bad:  "How do I read defenses better?",
    good: "How do I identify Cover 2 versus Cover 4 based on safety depth and corner alignment at the snap?",
  },
  {
    sport: 'Basketball',
    bad:  "How do I get better on offense?",
    good: "As a PG, how do I read a hedge-and-recover ball screen defense to decide between the pull-up, pocket pass, or reset?",
  },
  {
    sport: 'Baseball',
    bad:  "How do I hit better?",
    good: "How do I recognize a pitcher's curveball out of the hand versus a fastball based on spin and release point?",
  },
  {
    sport: 'Soccer',
    bad:  "How do I play better defensively?",
    good: "As a center back, how do I decide when to step and press versus hold my line when a striker receives the ball with their back to goal?",
  },
  {
    sport: 'Hockey',
    bad:  "How do I read plays better?",
    good: "As a defenseman, how do I identify an opposing winger's breakout pattern to anticipate an intercept opportunity at the blue line?",
  },
];

const GENERAL_FITNESS_COACHING_TIPS = [
  {
    category: 'Strength',
    bad: 'How do I get stronger?',
    good: 'How do I increase my squat and deadlift strength while avoiding lower back strain, given I train 3 days per week with a full gym?',
  },
  {
    category: 'Muscle Development',
    bad: 'How do I get my triceps stronger?',
    good: 'How do I build tricep strength and size while maintaining shoulder flexibility and avoiding elbow joint stress?',
  },
  {
    category: 'Endurance',
    bad: 'How can I run farther?',
    good: 'How can I build my running endurance from 2 miles to 5 miles over 8 weeks without overtraining or injury?',
  },
  {
    category: 'Cardio Fitness',
    bad: 'How do I get in better cardio shape?',
    good: 'How can I increase my VO2 Max and overall cardiovascular endurance using a stationary bike and 4 available training days per week?',
  },
];

export default function CoachingScreen() {
  const [isInChat, setIsInChat]       = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [inputText, setInputText]     = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scrollViewRef                 = useRef<ScrollView>(null);
  const auth                          = getAuth();

  const [conversationId, setConversationId]   = useState<number | null>(null);
  const [sessionId, setSessionId]             = useState<string | null>(null);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [existingTags, setExistingTags]       = useState<TagResponse[]>([]);
  const [assignedTagIds, setAssignedTagIds]   = useState<Set<number>>(new Set());
  const [tagsLoading, setTagsLoading]         = useState(false);
  const [newTagName, setNewTagName]           = useState('');
  const [newTagColor, setNewTagColor]         = useState('#007AFF');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [savingTag, setSavingTag]             = useState(false);

  const [trialLimitVisible, setTrialLimitVisible] = useState(false);
  const [modalType, setModalType] = useState<'trial' | 'budgetBasic' | 'budgetPremium'>('trial');
  const [suggestWorkout, setSuggestWorkout] = useState(false);
  const [workoutFocusSummary, setWorkoutFocusSummary] = useState<string | null>(null);
  const [yesNoQuestions, setYesNoQuestions] = useState<string[]>([]);
  const [yesNoAnswers, setYesNoAnswers] = useState<Record<number, boolean | null>>({});
  const [showYesNoPanel, setShowYesNoPanel] = useState(false);
  const [yesNoPanelExpanded, setYesNoPanelExpanded] = useState(false);
  const yesNoPanelAnim = useRef(new Animated.Value(0)).current;
  const { onUpgradePress } = useUpgrade();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const backendUrl = ENV_CONFIG.BACKEND_URL;

  useEffect(() => {
    const fetchUserProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const res = await fetch(`${backendUrl}/api/v1/users/firebase/${currentUser.uid}`);
        if (res.ok) setUserProfile(await res.json());
      } catch (e) {
        console.error('Error fetching user profile:', e);
      }
    };
    fetchUserProfile();
  }, []);

  const startChatSession = () => {
    if (!userProfile) {
      Alert.alert('Error', 'Unable to load your profile. Please try again.');
      return;
    }
    const welcomeText = userProfile.primarySport === 'GENERAL_FITNESS'
      ? `Hey! I'm your personal AI fitness coach. I can help with workout planning, training techniques, and reaching your fitness goals. What do you want to work on?`
      : `Hey! I'm your personal AI coach. I know you're a ${userProfile.primaryPosition} in ${userProfile.primarySport}, so I can help with position-specific training, game IQ, and strategy. What do you want to work on?`;
    setMessages([{
      id: '1',
      text: welcomeText,
      isUser: false,
      timestamp: new Date(),
    }]);
    setConversationId(null);
    setSessionId(null);
    setAssignedTagIds(new Set());
    setSuggestWorkout(false);
    setWorkoutFocusSummary(null);
    setYesNoQuestions([]);
    setYesNoAnswers({});
    setShowYesNoPanel(false);
    setYesNoPanelExpanded(false);
    Animated.timing(yesNoPanelAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setIsInChat(true);
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isLoading || !userProfile) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setInputText('');
    setIsLoading(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await fetch(
        `${backendUrl}/api/v1/coaching/analyze?userId=${userProfile.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sport: userProfile.primarySport,
            situation: { question: userMsg.text, position: userProfile.primaryPosition },
            sessionId: sessionId,
          }),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        let backendMessage: string | null = null;
        try { backendMessage = JSON.parse(errText)?.message ?? null; } catch { /* not JSON */ }
        const msg = backendMessage ?? `HTTP ${res.status}: ${errText}`;

        if (backendMessage && backendMessage.includes('Monthly AI budget reached')) {
          if (userProfile?.subscriptionTier === 'PREMIUM') {
            setModalType('budgetPremium');
          } else {
            setModalType('budgetBasic');
          }
          setTrialLimitVisible(true);
          return;
        }

        if (
          backendMessage &&
          (backendMessage.includes('Trial') ||
            backendMessage.includes('trial') ||
            backendMessage.includes('limit reached') ||
            backendMessage.includes('budget reached') ||
            backendMessage.includes('subscription'))
        ) {
          setModalType('trial');
          setTrialLimitVisible(true);
          return;
        }

        throw new Error(msg);
      }
      const data = await res.json();
      if (conversationId === null && data.conversationId) {
        setConversationId(data.conversationId);
      }
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
      if (data.suggestWorkout) {
        setSuggestWorkout(true);
      } else {
        setSuggestWorkout(false);
      }
      if (data.workoutFocusSummary) {
        setWorkoutFocusSummary(data.workoutFocusSummary);
      }
      const questions = parseYesNoQuestions(data.recommendation);
      if (questions.length > 0) {
        setYesNoQuestions(questions);
        setYesNoAnswers(Object.fromEntries(questions.map((_, i) => [i, null])));
        setShowYesNoPanel(true);
        Animated.spring(yesNoPanelAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      } else {
        setYesNoQuestions([]);
        setYesNoAnswers({});
        setShowYesNoPanel(false);
        setYesNoPanelExpanded(false);
        Animated.timing(yesNoPanelAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.recommendation,
        isUser: false,
        timestamp: new Date(),
      }]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      if (error instanceof TrialLimitError) {
        setModalType('trial');
        setTrialLimitVisible(true);
        return;
      }
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${error.message || 'Unable to connect to coaching server'}`,
        isUser: false,
        timestamp: new Date(),
      }]);
      Alert.alert('Coaching Error', error.message || 'Unable to reach the coaching server.', [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const endChatSession = () => {
    setIsInChat(false);
    setMessages([]);
    setInputText('');
    setConversationId(null);
    setSessionId(null);
    setAssignedTagIds(new Set());
    setSuggestWorkout(false);
    setWorkoutFocusSummary(null);
    setYesNoQuestions([]);
    setYesNoAnswers({});
    setShowYesNoPanel(false);
    setYesNoPanelExpanded(false);
    Animated.timing(yesNoPanelAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const openTagModal = async () => {
    if (!conversationId) {
      Alert.alert('Send a message first', 'Ask your coach a question before adding tags.');
      return;
    }
    if (!userProfile) return;
    setTagModalVisible(true);
    setTagsLoading(true);
    try {
      const result = await apiService.getUserTags(userProfile.id);
      if (result.success) setExistingTags(result.data);
    } finally {
      setTagsLoading(false);
    }
  };

  const toggleTagAssignment = async (tagId: number) => {
    if (!conversationId || !userProfile) return;
    const isAssigned = assignedTagIds.has(tagId);
    try {
      if (isAssigned) {
        await apiService.removeTagFromConversation(userProfile.id, conversationId, tagId);
        setAssignedTagIds(prev => { const next = new Set(prev); next.delete(tagId); return next; });
      } else {
        await apiService.addTagToConversation(userProfile.id, conversationId, tagId);
        setAssignedTagIds(prev => new Set(prev).add(tagId));
      }
    } catch {
      Alert.alert('Error', 'Failed to update tag. Please try again.');
    }
  };

  const handleCreateAndAssignTag = async () => {
    if (!newTagName.trim() || !userProfile) return;
    setSavingTag(true);
    try {
      const result = await apiService.createTag(userProfile.id, newTagName.trim(), newTagColor);
      if (!result.success) { Alert.alert('Error', result.error || 'Failed to create tag.'); return; }
      const newTag = result.data;
      setExistingTags(prev => [...prev, newTag]);
      if (conversationId) {
        await apiService.addTagToConversation(userProfile.id, conversationId, newTag.id);
        setAssignedTagIds(prev => new Set(prev).add(newTag.id));
      }
      setNewTagName('');
      setNewTagColor('#007AFF');
      setShowNewTagInput(false);
    } finally {
      setSavingTag(false);
    }
  };

  if (isInChat) {
    return (
      <View style={styles.chatContainer}>
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
          limitType="chat"
          modalType={modalType}
          onDismiss={() => setTrialLimitVisible(false)}
          onUpgrade={() => {
            setTrialLimitVisible(false);
            onUpgradePress();
          }}
        />

        <Portal>
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
                  <TouchableOpacity onPress={() => setTagModalVisible(false)} style={{ padding: 8 }}>
                    <Icon name="close" size={20} color={appTheme.white} />
                  </TouchableOpacity>
                </View>

                {tagsLoading ? (
                  <PaperIndicator style={{ marginVertical: 20 }} color={appTheme.purple} />
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
                            style={styles.cancelButton}
                            onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.createButton, (!newTagName.trim() || savingTag) && { opacity: 0.5 }]}
                            onPress={handleCreateAndAssignTag}
                            disabled={!newTagName.trim() || savingTag}
                          >
                            {savingTag
                              ? <ActivityIndicator size="small" color={appTheme.white} />
                              : <Text style={styles.createButtonText}>Create & Add</Text>
                            }
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
                  style={[styles.createButton, { marginTop: 16, alignSelf: 'stretch', alignItems: 'center' }]}
                  onPress={() => setTagModalVisible(false)}
                >
                  <Text style={styles.createButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </Portal>

        <Modal
          visible={yesNoPanelExpanded}
          transparent
          animationType="slide"
          onRequestClose={() => setYesNoPanelExpanded(false)}
        >
          <TouchableOpacity
            style={styles.yesNoBackdrop}
            activeOpacity={1}
            onPress={() => setYesNoPanelExpanded(false)}
          />
          <View style={styles.yesNoSheet}>
            {/* Drag handle */}
            <View style={styles.yesNoSheetHandle} />
            <Text style={styles.yesNoSheetTitle}>Answer to continue</Text>
            <Text style={styles.yesNoSheetSubtitle}>
              Your coach needs a few answers before proceeding.
            </Text>

            <ScrollView
              style={styles.yesNoSheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {yesNoQuestions.map((question, index) => (
                <View key={index} style={styles.yesNoRow}>
                  <Text style={styles.yesNoQuestion}>{question}</Text>
                  <View style={styles.yesNoButtons}>
                    <TouchableOpacity
                      style={[styles.yesNoButton, yesNoAnswers[index] === true && styles.yesNoButtonSelected]}
                      onPress={() => setYesNoAnswers(prev => ({ ...prev, [index]: true }))}
                    >
                      <Text style={[styles.yesNoButtonText, yesNoAnswers[index] === true && styles.yesNoButtonTextSelected]}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.yesNoButton, yesNoAnswers[index] === false && styles.yesNoButtonSelectedNo]}
                      onPress={() => setYesNoAnswers(prev => ({ ...prev, [index]: false }))}
                    >
                      <Text style={[styles.yesNoButtonText, yesNoAnswers[index] === false && styles.yesNoButtonTextSelected]}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.yesNoSubmitButton,
                Object.values(yesNoAnswers).some(v => v === null) && styles.yesNoSubmitButtonDisabled
              ]}
              disabled={Object.values(yesNoAnswers).some(v => v === null)}
              onPress={() => {
                const answersText = yesNoQuestions
                  .map((q, i) => `${i + 1}. ${q}: ${yesNoAnswers[i] ? 'Yes' : 'No'}`)
                  .join('\n');
                setYesNoPanelExpanded(false);
                setShowYesNoPanel(false);
                setYesNoQuestions([]);
                setYesNoAnswers({});
                setTimeout(() => sendMessage(answersText), 300);
              }}
            >
              <Text style={styles.yesNoSubmitButtonText}>Submit Answers</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={endChatSession} style={styles.backButton}>
              <Icon name="arrow-back" size={24} color={appTheme.white} />
            </TouchableOpacity>
            <View style={styles.chatHeaderContent}>
              <Text style={styles.chatHeaderTitle}>AI Coach</Text>
              <Text style={styles.chatHeaderSubtitle}>
                {userProfile?.primarySport === 'GENERAL_FITNESS'
                  ? 'General Fitness'
                  : `${userProfile?.primarySport} • ${userProfile?.primaryPosition}`
                }
              </Text>
            </View>
            <View style={styles.statusIndicator}>
              <Icon name="circle" size={8} color={appTheme.neonGreen} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[styles.messageWrapper, message.isUser ? styles.userMessageWrapper : styles.aiMessageWrapper]}
              >
                <View style={[styles.messageBubble, message.isUser ? styles.userMessage : styles.aiMessage]}>
                  <FormattedMessage text={message.text} isUser={message.isUser} />
                </View>
              </View>
            ))}
            {suggestWorkout && (
              <TouchableOpacity
                style={styles.workoutOfferButton}
                onPress={() => {
                  Alert.alert(
                    'Create Workout Plan',
                    'This will end your current chat session and take you to the workout generator. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue',
                        onPress: () => {
                          endChatSession();
                          navigation.navigate('WorkoutRequest', {
                            chatFocusAreas: workoutFocusSummary ?? '',
                            chatSessionId: sessionId ?? undefined,
                          });
                        },
                      },
                    ]
                  );
                }}
              >
                <Icon name="fitness-center" size={18} color={appTheme.white} />
                <Text style={styles.workoutOfferButtonText}>Create Workout Plan</Text>
              </TouchableOpacity>
            )}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={appTheme.purple} />
                <Text style={styles.loadingText}>Coach is thinking...</Text>
              </View>
            )}
          </ScrollView>

          {conversationId !== null && (userProfile?.subscriptionTier === 'PREMIUM' || userProfile?.subscriptionTier === 'TRIAL') && (
            <View style={styles.tagBar}>
              <TouchableOpacity style={styles.tagBarButton} onPress={openTagModal}>
                <Icon name="label" size={16} color={appTheme.purple} />
                <Text style={styles.tagBarButtonText}>
                  {assignedTagIds.size > 0 ? `Tags (${assignedTagIds.size})` : 'Add Tag'}
                </Text>
              </TouchableOpacity>
              {assignedTagIds.size > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagChipScroll}>
                  {existingTags
                    .filter(t => assignedTagIds.has(t.id))
                    .map(t => (
                      <View key={t.id} style={[styles.tagChip, { borderColor: t.color, backgroundColor: t.color + '20' }]}>
                        <Text style={[styles.tagChipText, { color: t.color }]}>{t.name}</Text>
                      </View>
                    ))}
                </ScrollView>
              )}
            </View>
          )}

          {showYesNoPanel && (
            <TouchableOpacity
              style={styles.reviewAnswerButton}
              onPress={() => setYesNoPanelExpanded(true)}
            >
              <Icon name="quiz" size={16} color={appTheme.white} />
              <Text style={styles.reviewAnswerButtonText}>
                Review & Answer ({yesNoQuestions.length} questions)
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about your position, training, strategy..."
              placeholderTextColor={appTheme.textMuted}
              multiline
              maxLength={500}
              editable={!isLoading}
              blurOnSubmit={true}
              onSubmitEditing={() => sendMessage()}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              <Icon name="send" size={20} color={(!inputText.trim() || isLoading) ? appTheme.textMuted : appTheme.white} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

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

      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
        {/* Start New Conversation */}
        <BlurView intensity={20} tint="dark" style={cs.glassCardOrbAccent}>
          <View style={cs.cardPadding}>
            <View style={styles.cardHeader}>
              <Icon name="psychology" size={22} color={appTheme.neonGreen} />
              <Text style={cs.cardHeading}>Start New Conversation</Text>
            </View>
            <Text style={cs.cardBody}>
              Get personalized coaching for YOUR position. Ask about training, game strategy, skill development, or anything to improve your game.
            </Text>
            <TouchableOpacity
              style={[styles.beginButton, { opacity: userProfile ? 1 : 0.5 }]}
              onPress={startChatSession}
              disabled={!userProfile}
            >
              <Text style={styles.beginButtonText}>{userProfile ? 'Begin AI Coaching Session' : 'Loading...'}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Tips card */}
        <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
          <View style={styles.tipsAccentStrip} />
          <View style={cs.cardPadding}>
            <View style={styles.cardHeader}>
              <Icon name="lightbulb" size={22} color={appTheme.neonGreen} />
              <Text style={cs.cardHeading}>
                {userProfile?.primarySport === 'GENERAL_FITNESS'
                  ? 'Tips for Better Fitness Questions'
                  : 'Tips for Better Coaching Questions'}
              </Text>
            </View>
            <Text style={styles.tipsIntro}>
              {userProfile?.primarySport === 'GENERAL_FITNESS'
                ? "Specific questions get specific answers. Here's how to get the most out of your AI fitness coach:"
                : "Specific questions get specific answers. Here's how to get the most out of your AI coach:"}
            </Text>
            {userProfile?.primarySport === 'GENERAL_FITNESS'
              ? GENERAL_FITNESS_COACHING_TIPS.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipSport}>{tip.category}</Text>
                    <View style={styles.tipBad}>
                      <View style={styles.tipBadge}>
                        <Icon name="close" size={12} color={appTheme.white} />
                      </View>
                      <Text style={styles.tipBadText}>{tip.bad}</Text>
                    </View>
                    <Icon name="arrow-downward" size={16} color={appTheme.textMuted} style={styles.tipArrow} />
                    <View style={styles.tipGood}>
                      <View style={[styles.tipBadge, styles.tipBadgeGood]}>
                        <Icon name="check" size={12} color={appTheme.white} />
                      </View>
                      <Text style={styles.tipGoodText}>{tip.good}</Text>
                    </View>
                    {i < GENERAL_FITNESS_COACHING_TIPS.length - 1 && <View style={styles.tipDivider} />}
                  </View>
                ))
              : COACHING_TIPS.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipSport}>{tip.sport}</Text>
                    <View style={styles.tipBad}>
                      <View style={styles.tipBadge}>
                        <Icon name="close" size={12} color={appTheme.white} />
                      </View>
                      <Text style={styles.tipBadText}>{tip.bad}</Text>
                    </View>
                    <Icon name="arrow-downward" size={16} color={appTheme.textMuted} style={styles.tipArrow} />
                    <View style={styles.tipGood}>
                      <View style={[styles.tipBadge, styles.tipBadgeGood]}>
                        <Icon name="check" size={12} color={appTheme.white} />
                      </View>
                      <Text style={styles.tipGoodText}>{tip.good}</Text>
                    </View>
                    {i < COACHING_TIPS.length - 1 && <View style={styles.tipDivider} />}
                  </View>
                ))}
            <View style={styles.tipsHighlight}>
              <Icon name="info" size={14} color={appTheme.purple} style={{ marginTop: 1 }} />
              <Text style={styles.tipsHighlightText}>
                Focus on specific game situations, formations, reads, or decisions — the more precise your question, the more actionable the answer.
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
  screen: { flex: 1, backgroundColor: 'transparent', padding: 16 },

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

  // Landing card elements
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  beginButton: {
    backgroundColor: appTheme.purple,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  beginButtonText: {
    color: appTheme.white,
    fontSize: 15,
    fontWeight: '600',
  },
  tipsAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: appTheme.neonGreen,
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 40,
  },

  tipsIntro: { fontSize: 13, color: appTheme.textMuted, lineHeight: 19, marginBottom: 16 },
  tipSport: { fontSize: 11, fontWeight: '700', color: appTheme.purple, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  tipRow: { marginBottom: 4 },
  tipBad: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  tipGood: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  tipBadgeGood: { backgroundColor: '#22c55e' },
  tipBadText: { flex: 1, fontSize: 13, color: appTheme.textMuted, fontStyle: 'italic', lineHeight: 18 },
  tipGoodText: { flex: 1, fontSize: 13, color: appTheme.text, fontWeight: '500', lineHeight: 18 },
  tipArrow: { marginLeft: 4, marginVertical: 2 },
  tipDivider: { height: 1, backgroundColor: appTheme.border, marginVertical: 12 },
  tipsHighlight: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: appTheme.bgElevated, borderRadius: 12, padding: 10, marginTop: 16, gap: 6 },
  tipsHighlightText: { flex: 1, fontSize: 12, color: appTheme.textMuted, fontWeight: '500', lineHeight: 17 },

  // Chat
  chatContainer: { flex: 1, backgroundColor: 'transparent' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(8,11,20,0.95)', borderBottomWidth: 1, borderBottomColor: appTheme.border },
  backButton: { marginRight: 12 },
  chatHeaderContent: { flex: 1 },
  chatHeaderTitle: { fontSize: 17, fontWeight: '800', color: appTheme.white },
  chatHeaderSubtitle: { fontSize: 13, color: appTheme.textMuted, marginTop: 1 },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 12, color: appTheme.neonGreen },

  messagesContainer: { flex: 1, backgroundColor: 'transparent' },
  messagesContent: { padding: 16 },
  messageWrapper: { marginBottom: 12 },
  userMessageWrapper: { alignItems: 'flex-end' },
  aiMessageWrapper: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  userMessage: { backgroundColor: appTheme.purple, borderBottomRightRadius: 4 },
  aiMessage: { backgroundColor: appTheme.bgCard, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: appTheme.border },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  loadingText: { fontSize: 14, color: appTheme.textMuted, fontStyle: 'italic' },
  workoutOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.neonGreen,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  workoutOfferButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  reviewAnswerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.purple,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: appTheme.borderAccent,
  },
  reviewAnswerButtonText: {
    color: appTheme.white,
    fontSize: 14,
    fontWeight: '700',
  },
  yesNoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  yesNoSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    backgroundColor: 'rgba(8,11,20,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: appTheme.borderAccent,
    padding: 24,
    paddingBottom: 40,
  },
  yesNoSheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: appTheme.borderAccent,
    alignSelf: 'center',
    marginBottom: 20,
  },
  yesNoSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: appTheme.white,
    marginBottom: 6,
  },
  yesNoSheetSubtitle: {
    fontSize: 13,
    color: appTheme.textMuted,
    marginBottom: 20,
    lineHeight: 18,
  },
  yesNoSheetScroll: {
    flex: 1,
  },
  yesNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
  },
  yesNoQuestion: {
    flex: 1,
    fontSize: 14,
    color: appTheme.white,
    lineHeight: 20,
  },
  yesNoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  yesNoButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appTheme.border,
    backgroundColor: appTheme.bgElevated,
  },
  yesNoButtonSelected: {
    backgroundColor: appTheme.neonGreen,
    borderColor: appTheme.neonGreen,
  },
  yesNoButtonSelectedNo: {
    backgroundColor: appTheme.purple,
    borderColor: appTheme.purple,
  },
  yesNoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: appTheme.textMuted,
  },
  yesNoButtonTextSelected: {
    color: '#000000',
  },
  yesNoSubmitButton: {
    backgroundColor: appTheme.purple,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  yesNoSubmitButtonDisabled: {
    opacity: 0.4,
  },
  yesNoSubmitButtonText: {
    color: appTheme.white,
    fontSize: 15,
    fontWeight: '700',
  },

  tagBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(8,11,20,0.90)', borderTopWidth: 1, borderTopColor: appTheme.border, gap: 10 },
  tagBarButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: appTheme.purple, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  tagBarButtonText: { color: appTheme.purple, fontSize: 13, fontWeight: '600' },
  tagChipScroll: { flex: 1 },
  tagChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  tagChipText: { fontSize: 12, fontWeight: '500' },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, backgroundColor: 'rgba(8,11,20,0.95)', borderTopWidth: 1, borderTopColor: appTheme.border },
  textInput: { flex: 1, borderWidth: 1, borderColor: appTheme.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginRight: 12, maxHeight: 100, fontSize: 15, backgroundColor: appTheme.bgElevated, color: appTheme.text },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: appTheme.purple, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: appTheme.border },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#000000', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: appTheme.border, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: appTheme.white },
  tagList: { gap: 4 },
  tagRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8 },
  tagDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  tagRowName: { flex: 1, fontSize: 15, color: appTheme.text },
  createTagButton: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 },
  createTagText: { color: appTheme.purple, fontSize: 15, fontWeight: '500' },
  newTagForm: { gap: 12 },
  newTagInput: { borderWidth: 1, borderColor: appTheme.border, borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: appTheme.bgElevated, color: appTheme.text },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchSelected: { borderWidth: 3, borderColor: appTheme.white },
  newTagActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  cancelButtonText: { color: appTheme.textMuted, fontSize: 15 },
  createButton: { backgroundColor: appTheme.purple, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  createButtonText: { color: appTheme.white, fontSize: 15, fontWeight: '600' },
});
