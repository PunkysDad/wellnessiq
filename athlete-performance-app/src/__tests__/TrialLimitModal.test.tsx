import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TrialLimitModal from '../components/TrialLimitModal';

// ─── Mock expo/vector-icons ───────────────────────────────────────────────────
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID ?? `icon-${name}`}>{name}</Text>;
  },
}));

// ─── Mock appTheme ────────────────────────────────────────────────────────────
jest.mock('../theme/appTheme', () => ({
  appTheme: {
    navy: '#1a2744',
    navyDark: '#0f1829',
    red: '#c0392b',
    white: '#ffffff',
    gray: '#f5f5f5',
    textLight: '#666666',
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultProps: {
  visible: boolean;
  limitType: 'chat' | 'workout';
  onDismiss: jest.Mock;
  onUpgrade: jest.Mock;
} = {
  visible: true,
  limitType: 'workout',
  onDismiss: jest.fn(),
  onUpgrade: jest.fn(),
};

function renderModal(overrides: Partial<typeof defaultProps> = {}) {
  return render(<TrialLimitModal {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TrialLimitModal', () => {

  // ── Visibility ──────────────────────────────────────────────────────────────

  describe('visibility', () => {
    test('renders when visible=true', () => {
      const { getByText } = renderModal({ visible: true });
      expect(getByText('Trial Limit Reached')).toBeTruthy();
    });

    test('does not render content when visible=false', () => {
      const { queryByText } = renderModal({ visible: false });
      expect(queryByText('Trial Limit Reached')).toBeNull();
    });
  });

  // ── Workout limit copy ───────────────────────────────────────────────────────

  describe('workout limit type', () => {
    test('shows workout-specific body text', () => {
      const { getByText } = renderModal({ limitType: 'workout' });
      expect(getByText(/1 free workout plan/i)).toBeTruthy();
    });

    test('does not show chat-specific body text', () => {
      const { queryByText } = renderModal({ limitType: 'workout' });
      expect(queryByText(/3 free coaching questions/i)).toBeNull();
    });
  });

  // ── Chat limit copy ──────────────────────────────────────────────────────────

  describe('chat limit type', () => {
    test('shows chat-specific body text', () => {
      const { getByText } = renderModal({ limitType: 'chat' });
      expect(getByText(/3 free coaching questions/i)).toBeTruthy();
    });

    test('does not show workout-specific body text', () => {
      const { queryByText } = renderModal({ limitType: 'chat' });
      expect(queryByText(/1 free workout plan/i)).toBeNull();
    });
  });

  // ── Pricing copy ─────────────────────────────────────────────────────────────

  describe('pricing information', () => {
    test('shows Basic tier price', () => {
      const { getByText } = renderModal();
      expect(getByText(/Basic — \$12\.99\/mo/i)).toBeTruthy();
    });

    test('shows Premium tier price', () => {
      const { getByText } = renderModal();
      expect(getByText(/Premium — \$19\.99\/mo/i)).toBeTruthy();
    });

    test('shows Basic usage detail', () => {
      const { getByText } = renderModal();
      expect(getByText(/~400 chats/i)).toBeTruthy();
    });

    test('shows Premium usage detail', () => {
      const { getByText } = renderModal();
      expect(getByText(/~800 chats/i)).toBeTruthy();
    });
  });

  // ── Actions ──────────────────────────────────────────────────────────────────

  describe('button actions', () => {
    test('calls onUpgrade when Subscribe Now is pressed', () => {
      const onUpgrade = jest.fn();
      const { getByText } = renderModal({ onUpgrade });

      fireEvent.press(getByText('Subscribe Now'));

      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });

    test('calls onDismiss when Maybe Later is pressed', () => {
      const onDismiss = jest.fn();
      const { getByText } = renderModal({ onDismiss });

      fireEvent.press(getByText('Maybe Later'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    test('onUpgrade is not called when Maybe Later is pressed', () => {
      const onUpgrade = jest.fn();
      const { getByText } = renderModal({ onUpgrade });

      fireEvent.press(getByText('Maybe Later'));

      expect(onUpgrade).not.toHaveBeenCalled();
    });

    test('onDismiss is not called when Subscribe Now is pressed', () => {
      const onDismiss = jest.fn();
      const { getByText } = renderModal({ onDismiss });

      fireEvent.press(getByText('Subscribe Now'));

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  // ── Title ────────────────────────────────────────────────────────────────────

  describe('title', () => {
    test('always shows Trial Limit Reached title', () => {
      const { getAllByText } = renderModal();
      expect(getAllByText('Trial Limit Reached').length).toBeGreaterThan(0);
    });

    test('title is the same for both limit types', () => {
      const { getByText: getChat } = renderModal({ limitType: 'chat' });
      const { getByText: getWorkout } = renderModal({ limitType: 'workout' });
      expect(getChat('Trial Limit Reached')).toBeTruthy();
      expect(getWorkout('Trial Limit Reached')).toBeTruthy();
    });
  });
});