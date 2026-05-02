import { CreateUserRequest, UserResponse } from '../interfaces/interfaces';
import ENV_CONFIG from '../config/environment';

export class UserService {
  private baseUrl: string;

  constructor(baseUrl: string = `${ENV_CONFIG.BACKEND_URL}/api/v1`) {
    this.baseUrl = baseUrl;
  }

  async checkUserExists(firebaseUid: string): Promise<UserResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/users/firebase/${firebaseUid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        return null; // User confirmed to not exist
      }

      if (!response.ok) {
        // Non-404 HTTP error — don't treat as "user not found"
        console.error(`checkUserExists: unexpected status ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      // Network error (backend unreachable, timeout, etc.)
      // Return null without throwing so callers never mistake this for a new user
      console.error('Error checking user existence:', error);
      return null;
    }
  }

  async createUser(userData: CreateUserRequest): Promise<UserResponse> {
    try {
      console.log('Creating user with data:', userData);

      const response = await fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create user error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();
      console.log('User created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserStats(userId: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }
}