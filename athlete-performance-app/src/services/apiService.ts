import { ActivityStats, ApiResponse, TagResponse, TaggedConversationResponse, TaggedWorkoutResponse } from '../interfaces/interfaces';
import ENV_CONFIG from '../config/environment';

const BASE_URL = ENV_CONFIG.BACKEND_URL;

// Errors thrown by the backend trial/subscription enforcement contain this flag
// so screens can distinguish a limit error from a generic network failure.
export class TrialLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrialLimitError';
  }
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    };
    console.log(`API Call: ${config.method || 'GET'} ${url}`);
    const response = await fetch(url, config);

    if (!response.ok) {
      // Attempt to read the backend error body — this is where trial/subscription
      // messages live (e.g. "Trial chat limit reached (3 questions)...")
      let backendMessage: string | null = null;
      try {
        const errorBody = await response.json();
        // Spring Boot wraps errors in { message: "..." } or { error: "..." }
        backendMessage = errorBody?.message ?? errorBody?.error ?? null;
      } catch {
        // body wasn't JSON — fall through to statusText
      }

      const errorMessage = backendMessage ?? `HTTP ${response.status}: ${response.statusText}`;

      // Surface trial/subscription limit errors as a typed error so callers
      // can show the paywall instead of a generic alert.
      if (
        backendMessage &&
        (backendMessage.includes('Trial') ||
          backendMessage.includes('trial') ||
          backendMessage.includes('subscription') ||
          backendMessage.includes('budget reached') ||
          backendMessage.includes('limit reached'))
      ) {
        throw new TrialLimitError(backendMessage);
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { data, success: true };
  } catch (error) {
    // Re-throw TrialLimitError so callers can catch it specifically
    if (error instanceof TrialLimitError) throw error;

    console.error('API Error:', error);
    return {
      data: {} as T,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export const apiService = {
  // Health check
  async checkHealth(): Promise<ApiResponse<{ status: string }>> {
    return apiCall('/actuator/health');
  },

  // User stats
  async getUserStats(userId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}/stats`);
  },

  // Trial status — returns trialChatsUsed and trialWorkoutsUsed for the user
  async getTrialStatus(userId: number): Promise<ApiResponse<{ subscriptionTier: string; trialChatsUsed: number; trialWorkoutsUsed: number }>> {
    return apiCall(`/api/v1/users/${userId}/trial-status`);
  },

  // Conversation history
  async getUserConversations(userId: number): Promise<ApiResponse<any[]>> {
    return apiCall(`/api/v1/conversations/user/${userId}`);
  },

  // Workout history
  async getUserWorkouts(userId: number): Promise<ApiResponse<any[]>> {
    return apiCall(`/api/v1/workouts/user/${userId}`);
  },

  // Get single user profile
  async getUserProfile(userId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}`);
  },

  // Get user by Firebase UID
  async getUserByFirebaseUid(firebaseUid: string): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/firebase/${firebaseUid}`);
  },

  // Update user profile
  async updateUserProfile(
    userId: number,
    data: {
      displayName?: string | null;
      primarySport?: string | null;
      primaryPosition?: string | null;
      age?: number | null;
    }
  ): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update user profile including fitnessGoals
  async updateUserProfileFull(
    userId: number,
    data: {
      displayName?: string | null;
      primarySport?: string | null;
      primaryPosition?: string | null;
      age?: number | null;
      fitnessGoals?: string[] | null;
    }
  ): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update just the user's fitness goals (General Fitness users)
  async updateFitnessGoals(userId: number, fitnessGoals: string[]): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}/fitness-goals`, {
      method: 'PUT',
      body: JSON.stringify({ fitnessGoals }),
    });
  },

  // -------------------------------------------------------------------------
  // Single item fetches — used by TagContentBottomSheet
  // -------------------------------------------------------------------------

  async getConversationById(conversationId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/conversations/${conversationId}`);
  },

  async getConversationsBySession(sessionId: string): Promise<ApiResponse<any[]>> {
    return apiCall(`/api/v1/conversations/session/${sessionId}`);
  },

  async getWorkoutById(workoutId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/workouts/${workoutId}`);
  },

  async updateConversationTitle(conversationId: number, title: string): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/conversations/${conversationId}/title`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  },

  async updateWorkoutTitle(workoutId: number, title: string): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/workouts/${workoutId}/title`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  },

  // -------------------------------------------------------------------------
  // Tag endpoints
  // -------------------------------------------------------------------------

  async getUserTags(userId: number): Promise<ApiResponse<TagResponse[]>> {
    return apiCall(`/api/v1/users/${userId}/tags`);
  },

  async addTagToWorkout(userId: number, workoutPlanId: number, tagId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}/tags/workouts/${workoutPlanId}`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
  },

  async removeTagFromWorkout(userId: number, workoutPlanId: number, tagId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}/tags/workouts/${workoutPlanId}/${tagId}`, {
      method: 'DELETE',
    });
  },

  async addTagToConversation(userId: number, conversationId: number, tagId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}/tags/conversations/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
  },

  async removeTagFromConversation(userId: number, conversationId: number, tagId: number): Promise<ApiResponse<any>> {
    return apiCall(`/api/v1/users/${userId}/tags/conversations/${conversationId}/${tagId}`, {
      method: 'DELETE',
    });
  },

  async createTag(userId: number, name: string, color: string): Promise<ApiResponse<TagResponse>> {
    return apiCall(`/api/v1/users/${userId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  },

  async getConversationsByTag(userId: number, tagId: number): Promise<ApiResponse<TaggedConversationResponse[]>> {
    return apiCall(`/api/v1/users/${userId}/tags/${tagId}/conversations`);
  },

  async getWorkoutsByTag(userId: number, tagId: number): Promise<ApiResponse<TaggedWorkoutResponse[]>> {
    return apiCall(`/api/v1/users/${userId}/tags/${tagId}/workouts`);
  },
};

// Connection test utility
export const testConnection = async (): Promise<boolean> => {
  const result = await apiService.checkHealth();
  if (result.success) {
    console.log('Backend connection successful:', result.data);
    return true;
  } else {
    console.error('Backend connection failed:', result.error);
    return false;
  }
};

// Activity stats helper
export const getActivityStats = async (userId: number): Promise<ApiResponse<ActivityStats>> => {
  try {
    const statsResult = await apiService.getUserStats(userId);

    if (statsResult.success && statsResult.data.totalConversations !== undefined) {
      return {
        success: true,
        data: {
          totalChats: statsResult.data.totalConversations || 0,
          totalWorkouts: statsResult.data.totalWorkouts || 0,
          recentActivity: statsResult.data.daysSinceLastActivity || 0,
        },
      };
    }

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
      return {
        success: true,
        data: {
          totalChats: chatsResult.data.length,
          totalWorkouts: workoutsResult.data.length,
          recentActivity: daysSince,
        },
      };
    }

    return { success: false, error: 'Failed to load activity data from individual endpoints' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error while fetching activity stats',
    };
  }
};