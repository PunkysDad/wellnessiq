import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from 'react-native-paper';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { appTheme } from '../theme/appTheme';
import { theme } from '../theme';
import { componentStyles as cs } from '../theme/componentStyles';
import { apiService } from '../services/apiService';
import { UserService } from '../services/userService';
import { getAuth } from 'firebase/auth';
import {
  ActivityStats,
  TagWithItems,
  TaggedItem,
} from '../interfaces/interfaces';
import TagContentBottomSheet from '../components/TagContentBottomSheet';
import HistoryListModal from '../components/HistoryListModal';

const SPORT_DISPLAY_MAP: Record<string, string> = {
  FOOTBALL: 'Football',
  BASKETBALL: 'Basketball',
  BASEBALL: 'Baseball',
  SOCCER: 'Soccer',
  HOCKEY: 'Hockey',
  GENERAL_FITNESS: 'General Fitness',
};

export default function HomeScreen() {
  const auth = getAuth();
  const userService = new UserService();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [activityStats, setActivityStats] = useState<ActivityStats>({
    totalChats: 0,
    totalWorkouts: 0,
    recentActivity: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [tagsWithItems, setTagsWithItems] = useState<TagWithItems[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());
  const [selectedItem, setSelectedItem] = useState<TaggedItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyModalType, setHistoryModalType] = useState<'chat' | 'workout'>('chat');

  // ── User resolution ────────────────────────────────────────────────────────
  const getCurrentUser = async () => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return null;
      const userData = await userService.checkUserExists(firebaseUser.uid);
      if (userData) return { user: userData, userId: userData.id };
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // ── Activity stats ─────────────────────────────────────────────────────────
  const loadActivityStats = async (userId: number) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const statsResult = await apiService.getUserStats(userId);
      if (statsResult.success) {
        setActivityStats({
          totalChats: statsResult.data.totalConversations || 0,
          totalWorkouts: statsResult.data.totalWorkouts || 0,
          recentActivity: statsResult.data.daysSinceLastActivity || 0,
        });
        setBackendConnected(true);
      } else {
        const [chatsResult, workoutsResult] = await Promise.all([
          apiService.getUserConversations(userId),
          apiService.getUserWorkouts(userId),
        ]);
        if (chatsResult.success && workoutsResult.success) {
          const allActivities = [
            ...chatsResult.data.map((c: any) => new Date(c.timestamp || c.createdAt)),
            ...workoutsResult.data.map((w: any) => new Date(w.createdAt)),
          ];
          const mostRecent = allActivities.length > 0
            ? Math.max(...allActivities.map(d => d.getTime()))
            : 0;
          const daysSince = mostRecent > 0
            ? Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24))
            : 0;
          setActivityStats({
            totalChats: chatsResult.data.length,
            totalWorkouts: workoutsResult.data.length,
            recentActivity: daysSince,
          });
          setBackendConnected(true);
        } else {
          setStatsError('Failed to load activity data');
        }
      }
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setStatsLoading(false);
    }
  };

  // ── Tags ───────────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const loadTagsWithContent = async (userId: number) => {
    setTagsLoading(true);
    try {
      const tagsResult = await apiService.getUserTags(userId);
      if (!tagsResult.success) return;
      const enriched: TagWithItems[] = await Promise.all(
        tagsResult.data.map(async (tag) => {
          const [convResult, workoutResult] = await Promise.all([
            apiService.getConversationsByTag(userId, tag.id),
            apiService.getWorkoutsByTag(userId, tag.id),
          ]);
          const chatItems: TaggedItem[] = (convResult.success ? convResult.data : []).map((c: any) => ({
            id: c.id,
            title: c.title || 'Coaching conversation',
            type: 'chat' as const,
            date: formatDate(c.createdAt),
          }));
          const workoutItems: TaggedItem[] = (workoutResult.success ? workoutResult.data : []).map((w: any) => ({
            id: w.id,
            title: w.title || `${w.position || ''} ${w.sport || ''} workout`.trim(),
            type: 'workout' as const,
            date: formatDate(w.createdAt),
          }));
          return { ...tag, items: [...chatItems, ...workoutItems] };
        })
      );
      const withContent = enriched.filter(t => t.items.length > 0);
      setTagsWithItems(withContent);
      setExpandedTags(new Set(withContent.map(t => t.id)));
    } catch (err) {
      console.error('Error loading tags:', err);
    } finally {
      setTagsLoading(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
  };

  const totalTaggedItems = tagsWithItems.reduce((sum, t) => sum + t.items.length, 0);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const initializeUser = async () => {
        setUserLoading(true);
        const result = await getCurrentUser();
        if (result) {
          setCurrentUser(result.user);
          setCurrentUserId(result.userId);
          await loadActivityStats(result.userId);
          await loadTagsWithContent(result.userId);
        } else {
          setStatsError('Please log in to view your activity stats');
        }
        setUserLoading(false);
      };
      initializeUser();
    }, [])
  );

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderStatCard = (
    label: string,
    value: number,
    icon: string,
    subtitle: string,
    onPress?: () => void,
    accentColor?: string,
  ) => {
    const accent = accentColor || appTheme.neonGreen;
    const cardStyle = [
      cs.statCard,
      onPress ? cs.statCardTouchable : null,
      { borderColor: accent + '60' },
    ];
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        {onPress && (
          <Icon name="touch-app" size={42} color={accent} style={cs.statTouchIndicator} />
        )}
        <View style={[styles.statIconWrapper, { backgroundColor: accent + '20' }]}>
          <Icon name={icon as any} size={20} color={accent} />
        </View>
        <Text style={cs.statValue}>{value}</Text>
        <Text style={cs.statLabel}>{label}</Text>
        <Text style={cs.statSubtitle}>{subtitle}</Text>
      </TouchableOpacity>
    );
  };

  const renderOverviewTab = () => (
    <View>
      {/* Profile glass card */}
      <BlurView intensity={20} tint="dark" style={cs.glassCardOrbAccent}>
        <View style={cs.cardPadding}>
          <View style={cs.rowBetween}>
            <View style={{ flex: 1 }}>
              <View style={[cs.rowStart, { marginBottom: 10 }]}>
                <View style={styles.avatarGlow}>
                  <Icon name="person" size={22} color={appTheme.white} />
                </View>
                <Text style={[cs.cardHeading, { marginLeft: 10, fontSize: 18 }]}>
                  {currentUser?.displayName || currentUser?.email || 'Athlete'}
                </Text>
              </View>
              <Text style={cs.cardBody}>
                {currentUser?.primarySport === 'GENERAL_FITNESS'
                  ? 'General Fitness 💪'
                  : `${SPORT_DISPLAY_MAP[currentUser?.primarySport] ?? currentUser?.primarySport ?? 'Sport'} · ${currentUser?.primaryPosition || 'Position'}`
                }
              </Text>
              <View style={[cs.badge, cs.purpleBadge]}>
                <Text style={[cs.badgeText, cs.purpleBadgeText]}>
                  {currentUser?.subscriptionTier || 'FREE'}
                </Text>
              </View>
            </View>
            {/* Decorative position orb */}
            <View style={styles.positionOrb}>
              <Icon name="sports" size={28} color={appTheme.purple} />
            </View>
          </View>
        </View>
      </BlurView>

      {/* Activity stats glass card */}
      <BlurView intensity={15} tint="dark" style={cs.glassCardOrb}>
        <View style={cs.cardPadding}>
          <View style={cs.rowBetween}>
            <Text style={cs.cardHeading}>Training Activity</Text>
            <TouchableOpacity
              onPress={() => currentUserId && loadActivityStats(currentUserId)}
              disabled={statsLoading || !currentUserId}
              style={styles.refreshBtn}
            >
              <Icon
                name="refresh"
                size={18}
                color={statsLoading ? appTheme.textMuted : appTheme.purple}
              />
            </TouchableOpacity>
          </View>

          {userLoading || statsLoading ? (
            <View style={cs.centered}>
              <ActivityIndicator size="small" color={appTheme.purple} />
              <Text style={[cs.cardCaption, { marginTop: 8 }]}>
                {userLoading ? 'Loading user data...' : 'Loading stats...'}
              </Text>
            </View>
          ) : !currentUserId ? (
            <View style={cs.centered}>
              <Text style={[cs.cardCaption, { color: '#f59e0b' }]}>
                Please log in to view your training stats
              </Text>
            </View>
          ) : statsError ? (
            <View style={cs.centered}>
              <Text style={[cs.cardCaption, { color: appTheme.purple, marginBottom: 8 }]}>{statsError}</Text>
              <TouchableOpacity onPress={() => loadActivityStats(currentUserId)} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={cs.statsGrid}>
              {renderStatCard('AI Chats', activityStats.totalChats, 'chat', 'Coaching sessions',
                () => { setHistoryModalType('chat'); setHistoryModalVisible(true); }, appTheme.neonGreen)}
              {renderStatCard('Workouts', activityStats.totalWorkouts, 'fitness-center', 'Generated plans',
                () => { setHistoryModalType('workout'); setHistoryModalVisible(true); }, appTheme.purple)}
              {renderStatCard('Days Ago', activityStats.recentActivity, 'access-time', 'Last activity', undefined, appTheme.cyan)}
              {renderStatCard('Total', activityStats.totalChats + activityStats.totalWorkouts, 'trending-up', 'AI interactions', undefined, appTheme.purpleLight)}
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );

  const renderTagsTab = () => (
    <View>
      <View style={[cs.rowBetween, { marginBottom: 16 }]}>
        <Text style={cs.cardHeading}>My Tagged Content</Text>
        {tagsWithItems.length > 0 && (
          <Text style={cs.cardCaption}>
            {tagsWithItems.length} tags · {totalTaggedItems} items
          </Text>
        )}
      </View>

      {tagsLoading ? (
        <View style={cs.centered}>
          <ActivityIndicator size="small" color={appTheme.purple} />
          <Text style={[cs.cardCaption, { marginTop: 8 }]}>Loading tags...</Text>
        </View>
      ) : tagsWithItems.length === 0 ? (
        <BlurView intensity={15} tint="dark" style={cs.glassCard}>
          <View style={cs.cardPadding}>
            <View style={cs.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="label-outline" size={32} color={appTheme.purple} />
              </View>
              <Text style={cs.emptyStateText}>No tagged content yet</Text>
              <Text style={cs.emptyStateCaption}>
                Tag your coaching chats and workout plans to organize them here
              </Text>
            </View>
          </View>
        </BlurView>
      ) : (
        tagsWithItems.map(tag => {
          const isExpanded = expandedTags.has(tag.id);
          return (
            <View key={tag.id} style={styles.tagGroup}>
              <TouchableOpacity
                style={[styles.tagPill, { backgroundColor: tag.color + '25', borderColor: tag.color + '80' }]}
                onPress={() => toggleTag(tag.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                <Text style={[styles.tagPillText, { color: tag.color }]}>{tag.name}</Text>
                <View style={[styles.tagCount, { backgroundColor: tag.color + '30', borderColor: tag.color + '50' }]}>
                  <Text style={[styles.tagCountText, { color: tag.color }]}>{tag.items.length}</Text>
                </View>
                <Icon
                  name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={18}
                  color={tag.color}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {isExpanded && tag.items.map(item => (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={styles.taggedItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedItem(item);
                    setSheetVisible(true);
                  }}
                >
                  <View style={[
                    styles.taggedItemIcon,
                    { backgroundColor: item.type === 'chat' ? appTheme.neonGreenDim : appTheme.purpleDim }
                  ]}>
                    <Icon
                      name={item.type === 'chat' ? 'chat' : 'fitness-center'}
                      size={16}
                      color={item.type === 'chat' ? appTheme.neonGreen : appTheme.purple}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taggedItemTitle} numberOfLines={2} ellipsizeMode="tail">
                      {item.title}
                    </Text>
                    <Text style={cs.cardCaption}>
                      {item.type === 'chat' ? 'Chat' : 'Workout'} · {item.date}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={appTheme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })
      )}
    </View>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Ambient gradient background */}
      <LinearGradient
        colors={['#080B14', '#0D0B1E', '#080B14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Purple orb glow top-right */}
      <View style={styles.orbTopRight} />
      {/* Green orb glow bottom-left */}
      <View style={styles.orbBottomLeft} />
      <View style={styles.orbMidRight} />

      {/* Header */}
      <View style={cs.screenHeader}>
        <Text style={cs.screenHeaderTitle}>Dashboard</Text>
        <Text style={cs.screenHeaderSubtitle}>
          {currentUser?.primarySport === 'GENERAL_FITNESS'
            ? 'General Fitness 💪'
            : currentUser?.primarySport
              ? `${SPORT_DISPLAY_MAP[currentUser.primarySport] ?? currentUser.primarySport} · ${currentUser.primaryPosition}`
              : 'Your training overview'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={cs.tabContainer}>
        {[
          { key: 'overview', label: 'Overview' },
          ...(currentUser?.subscriptionTier === 'TRIAL' || currentUser?.subscriptionTier === 'PREMIUM' || (currentUser?.subscriptionTier === 'BASIC' && tagsWithItems.length > 0)
            ? [{ key: 'tags', label: 'Tags' }]
            : []),
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[cs.tab, activeTab === tab.key && cs.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[cs.tabText, activeTab === tab.key && cs.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'tags' && renderTagsTab()}
      </ScrollView>

      <TagContentBottomSheet
        item={selectedItem}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        userId={currentUserId ?? 0}
      />
      <HistoryListModal
        visible={historyModalVisible}
        type={historyModalType}
        userId={currentUserId!}
        onClose={() => setHistoryModalVisible(false)}
        onSelectItem={(item) => {
          setHistoryModalVisible(false);
          setSelectedItem(item);
          setSheetVisible(true);
        }}
      />
    </View>
  );
}

// Screen-specific styles only (shared patterns live in componentStyles.ts)
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appTheme.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    // Blur via large shadow on iOS
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

  // Profile card elements
  avatarGlow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: appTheme.purpleDim,
    borderWidth: 1.5,
    borderColor: appTheme.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: appTheme.purpleDim,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stat card inner elements
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  // Refresh / retry
  refreshBtn: {
    padding: 8,
  },
  retryBtn: {
    backgroundColor: appTheme.purpleDim,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
  },
  retryBtnText: {
    color: appTheme.purple,
    fontSize: 13,
    fontWeight: '700',
  },

  // Tags
  tagGroup: {
    marginBottom: 20,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tagPillText: {
    fontWeight: '700',
    fontSize: 14,
  },
  tagCount: {
    marginLeft: 8,
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  tagCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taggedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: appTheme.border,
  },
  taggedItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taggedItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: appTheme.text,
    marginBottom: 2,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: appTheme.purpleDim,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
