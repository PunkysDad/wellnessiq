import { ReactNode } from 'react';
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cost?: number;
}

export interface ActivityStats {
  totalChats: number;
  totalWorkouts: number;
  recentActivity: number;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  description: string;
  positionBenefit?: string;
  gameApplication?: string;
  injuryPrevention?: string;
  coachingCue?: string;
  videoUrl?: string;
  videoTitle?: string;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  exercises: Exercise[];
  focusAreas: string[];
  createdAt: string;
}

export interface WorkoutData extends WorkoutPlan {
  sport: string;
  position: string;
  workoutTitle?: string;
  positionFocus?: string;
  generatedContent?: string;
}

export interface WorkoutRequest {
  sport: string;
  position: string | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  trainingPhase: 'off-season' | 'pre-season' | 'in-season' | 'post-season' | 'GENERAL';
  equipment: string[];
  timeAvailable: number;
  trainingFocus: string[];
  specialRequests?: string;
  additionalEquipment?: string | null;
  specialFocusAreas?: string | null;
}

export interface WorkoutResponse {
  success: boolean;
  data?: WorkoutData;
  error?: string;
  cost?: number;
}

// -------------------------------------------------------------------------
// Tag interfaces — mirror the backend TagController response DTOs
// -------------------------------------------------------------------------

export interface TagResponse {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface TaggedConversationResponse {
  id: number;
  title: string | null;
  conversationType: string | null;
  createdAt: string;
}

export interface TaggedWorkoutResponse {
  id: number;
  title: string | null;
  sport: string | null;
  position: string | null;
  createdAt: string;
}

export interface TaggedItem {
  id: number;
  title: string;
  type: 'chat' | 'workout';
  date: string;
}

// A tag enriched with its associated content items, used by the Tags screen
export interface TagWithItems extends TagResponse {
  items: TaggedItem[];
}

export interface TrialLimitModalProps {
  visible: boolean;
  limitType: 'chat' | 'workout';
  modalType?: 'trial' | 'budgetBasic' | 'budgetPremium';
  onDismiss: () => void;
  onUpgrade: () => void;
}

export interface UpgradeContextValue {
  onUpgradePress: () => void;
}

export interface UpgradeProviderProps {
  onUpgradePress: () => void;
  children: ReactNode;
}
export interface OnboardingFlowProps {
  user: any;
  onComplete: (data: OnboardingData) => void;
  startAtStep?: number;
}

export interface OnboardingData {
  sport: string | null;
  position: string | null;
  subscriptionTier: string | null;
  billingCycle: 'monthly' | 'annual';
}

export interface OnboardingFlowProps {
  user: any; // Firebase user
  onComplete: (data: OnboardingData) => void;
  startAtStep?: number;
  currentTier?: string;
}
export interface CreateUserRequest {
  email: string;
  firebaseUid: string;
  displayName: string;
  primarySport?: string;
  primaryPosition?: string;
  age?: number | null;
  subscriptionTier?: string;
  billingCycle?: string;
}

export interface UserResponse {
  id: number;
  firebaseUid: string;
  email?: string;
  displayName?: string;
  subscriptionTier: string;
  primarySport?: string;
  primaryPosition?: string;
  fitnessGoals?: string[];
  createdAt: string;
  isActive: boolean;
}

export interface YoutubeVideoResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
}