import { workoutApiService } from '../services/workoutApiService';
import { WorkoutRequest } from '../interfaces/interfaces';

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockOkResponse(body: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function mockErrorResponse(status: number, body: object | string) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => bodyStr,
  });
}

function mockNetworkFailure(message = 'Network request failed') {
  mockFetch.mockRejectedValueOnce(new TypeError(message));
}

const baseRequest: WorkoutRequest = {
  sport: 'FOOTBALL',
  position: 'QB',
  experienceLevel: 'intermediate',
  trainingPhase: 'off-season',
  equipment: ['Full gym'],
  timeAvailable: 45,
  trainingFocus: ['Arm strength', 'Pocket mobility'],
  additionalEquipment: undefined,
  specialFocusAreas: undefined,
};

// General Fitness users have no position and submit fitness goals as the
// training focus. WorkoutRequest now allows position: null and
// trainingPhase: 'GENERAL' directly, so no cast is required.
const generalFitnessRequest: WorkoutRequest = {
  sport: 'GENERAL_FITNESS',
  position: null,
  experienceLevel: 'intermediate',
  trainingPhase: 'GENERAL',
  equipment: ['Bodyweight'],
  timeAvailable: 45,
  trainingFocus: ['Lose Weight', 'Increase Cardio Health'],
};

const mockWorkoutPlan = {
  id: '1',
  title: 'QB Off-Season Power Builder',
  description: 'Arm strength and pocket mobility',
  estimatedDuration: 45,
  exercises: [],
  focusAreas: ['Arm strength'],
  createdAt: '2026-03-16T00:00:00',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockClear();
});

describe('workoutApiService.generateWorkout', () => {

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('successful generation', () => {
    test('returns success=true with workout data on 200', async () => {
      mockOkResponse(mockWorkoutPlan);

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockWorkoutPlan);
    });

    test('posts to /workouts/generate endpoint', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(baseRequest, 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/workouts/generate'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('includes userId in request body', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(baseRequest, 42);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.userId).toBe(42);
    });

    test('maps equipment array to availableEquipment field', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(baseRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.availableEquipment).toEqual(['Full gym']);
    });

    test('maps timeAvailable to sessionDuration field', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(baseRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.sessionDuration).toBe(45);
    });

    test('maps trainingFocus to focusAreas field', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(baseRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.focusAreas).toEqual(['Arm strength', 'Pocket mobility']);
    });

    test('sends null for specialRequirements when not provided', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(baseRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.specialRequirements).toBeNull();
    });

    test('sends specialRequirements when provided', async () => {
      mockOkResponse(mockWorkoutPlan);
      const req = { ...baseRequest, specialRequests: 'No jumping exercises' };

      await workoutApiService.generateWorkout(req, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.specialRequirements).toBe('No jumping exercises');
    });
  });

  // ── Trial / subscription limit errors ───────────────────────────────────────

  describe('trial and subscription limit error handling', () => {
    test('returns success=false when backend returns 400', async () => {
      mockErrorResponse(400, {
        id: '', title: '', description: 'Trial workout limit reached (1 workout). Subscribe to Basic ($12.99) or Premium ($19.99).',
        estimatedDuration: 0, exercises: [], focusAreas: [], createdAt: '', sport: '', position: ''
      });

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.success).toBe(false);
    });

    test('extracts trial limit message from description field', async () => {
      const errMsg = 'Trial workout limit reached (1 workout). Subscribe to Basic ($12.99) or Premium ($19.99).';
      mockErrorResponse(400, { description: errMsg });

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe(errMsg);
    });

    test('extracts monthly budget message from description field', async () => {
      const errMsg = 'Monthly AI budget reached ($4.00 of $4.00). Upgrade to Premium for double the monthly allowance.';
      mockErrorResponse(400, { description: errMsg });

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe(errMsg);
    });

    test('falls back to message field if description is absent', async () => {
      mockErrorResponse(400, { message: 'No active subscription.' });

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe('No active subscription.');
    });

    test('falls back to HTTP status string when body has no known fields', async () => {
      mockErrorResponse(400, {});

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toContain('400');
    });

    test('falls back to raw text when body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe('Internal Server Error');
    });

    test('description field takes priority over message field', async () => {
      mockErrorResponse(400, {
        description: 'Trial workout limit reached.',
        message: 'Bad Request',
      });

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe('Trial workout limit reached.');
    });
  });

  // ── Network errors ──────────────────────────────────────────────────────────

  describe('network error handling', () => {
    test('returns success=false on network failure', async () => {
      mockNetworkFailure();

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.success).toBe(false);
    });

    test('returns backend connection message on Network request failed', async () => {
      mockNetworkFailure('Network request failed');

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toContain('Cannot connect to backend server');
    });

    test('returns error message for non-network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe('Timeout');
    });

    test('returns unknown error string for non-Error throws', async () => {
      mockFetch.mockRejectedValueOnce('something weird');

      const result = await workoutApiService.generateWorkout(baseRequest, 1);

      expect(result.error).toBe('Unknown error');
    });
  });

  // ── General Fitness workout generation ─────────────────────────────────────

  describe('General Fitness workout generation', () => {
    test('GENERAL_FITNESS sport is sent as-is in request body', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(generalFitnessRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.sport).toBe('GENERAL_FITNESS');
    });

    test('null position is sent as null in request body', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(generalFitnessRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.position).toBeNull();
    });

    test('additionalEquipment is included in request body when provided', async () => {
      mockOkResponse(mockWorkoutPlan);
      const req: WorkoutRequest = { ...generalFitnessRequest, additionalEquipment: 'Pull-up bar' };

      await workoutApiService.generateWorkout(req, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.additionalEquipment).toBe('Pull-up bar');
    });

    test('additionalEquipment is null or absent when not provided', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(generalFitnessRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.additionalEquipment == null).toBe(true);
    });

    test('specialFocusAreas is included in request body when provided', async () => {
      mockOkResponse(mockWorkoutPlan);
      const req: WorkoutRequest = { ...generalFitnessRequest, specialFocusAreas: 'Strengthen posterior chain' };

      await workoutApiService.generateWorkout(req, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.specialFocusAreas).toBe('Strengthen posterior chain');
    });

    test('specialFocusAreas is null or absent when not provided', async () => {
      mockOkResponse(mockWorkoutPlan);

      await workoutApiService.generateWorkout(generalFitnessRequest, 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.specialFocusAreas == null).toBe(true);
    });

    test('GENERAL_FITNESS workout returns success=true on 200', async () => {
      mockOkResponse(mockWorkoutPlan);

      const result = await workoutApiService.generateWorkout(generalFitnessRequest, 1);

      expect(result.success).toBe(true);
    });

    test('GENERAL_FITNESS trial limit error is handled the same as sport-specific trial limit', async () => {
      const errMsg = 'Trial workout limit reached (1 workout). Subscribe to Basic ($12.99) or Premium ($19.99).';
      mockErrorResponse(400, { description: errMsg });

      const result = await workoutApiService.generateWorkout(generalFitnessRequest, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Trial workout limit reached');
    });
  });
});
