import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/services/revenueCatService', () => ({
  revenueCatService: {
    getAvailablePackages: jest.fn(),
    purchaseSubscription: jest.fn(),
  },
  SUBSCRIPTION_PRODUCTS: {
    BASIC_MONTHLY: 'gameiq_basic_monthly',
    PREMIUM_MONTHLY: 'gameiq_premium_monthly',
  },
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = { uid: 'test-uid', email: 'test@test.com' };

function renderFlow(props: Partial<Parameters<typeof OnboardingFlow>[0]> = {}) {
  const onComplete = jest.fn();
  const utils = render(
    <OnboardingFlow
      user={mockUser}
      onComplete={onComplete}
      {...props}
    />
  );
  return { ...utils, onComplete };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// =========================================================================
// Step rendering
// =========================================================================

describe('step rendering', () => {

  test('renders sport selection on step 1 by default', () => {
    const { getByText } = renderFlow();
    expect(getByText('Welcome to WellnessIQ!')).toBeTruthy();
    expect(getByText('Step 1 of 3')).toBeTruthy();
  });

  test('renders subscription selection when startAtStep=3', () => {
    const { getByText } = renderFlow({ startAtStep: 3 });
    expect(getByText('Choose Your Plan')).toBeTruthy();
    expect(getByText('Step 3 of 3')).toBeTruthy();
  });

  test('all sports are shown on step 1', () => {
    const { getByText } = renderFlow();
    expect(getByText('Football')).toBeTruthy();
    expect(getByText('Basketball')).toBeTruthy();
    expect(getByText('Baseball')).toBeTruthy();
    expect(getByText('Soccer')).toBeTruthy();
    expect(getByText('Hockey')).toBeTruthy();
  });

  test('selecting a sport advances to step 2', () => {
    const { getByText } = renderFlow();
    fireEvent.press(getByText('Football'));
    expect(getByText('Choose Your Position')).toBeTruthy();
    expect(getByText('Step 2 of 3')).toBeTruthy();
  });

  test('step 2 shows positions for selected sport', () => {
    const { getByText } = renderFlow();
    fireEvent.press(getByText('Football'));
    expect(getByText('QB')).toBeTruthy();
    expect(getByText('WR')).toBeTruthy();
    expect(getByText('LB')).toBeTruthy();
  });

  test('selecting a position advances to step 3', () => {
    const { getByText } = renderFlow();
    fireEvent.press(getByText('Football'));
    fireEvent.press(getByText('QB'));
    expect(getByText('Choose Your Plan')).toBeTruthy();
  });
});

// =========================================================================
// hideTrial prop
// =========================================================================

describe('hideTrial prop', () => {

  test('trial card is visible when hideTrial is false', () => {
    const { getByText } = renderFlow({ startAtStep: 3, hideTrial: false });
    expect(getByText('Start Free Trial')).toBeTruthy();
  });

  test('trial card is visible when hideTrial is not set', () => {
    const { getByText } = renderFlow({ startAtStep: 3 });
    expect(getByText('Start Free Trial')).toBeTruthy();
  });

  test('trial card is hidden when hideTrial is true', () => {
    const { queryByText } = renderFlow({ startAtStep: 3, hideTrial: true });
    expect(queryByText('Start Free Trial')).toBeNull();
  });

  test('divider is hidden when hideTrial is true', () => {
    const { queryByText } = renderFlow({ startAtStep: 3, hideTrial: true });
    expect(queryByText(/or subscribe for full access/i)).toBeNull();
  });

  test('divider is visible when hideTrial is false', () => {
    const { getByText } = renderFlow({ startAtStep: 3, hideTrial: false });
    expect(getByText(/or subscribe for full access/i)).toBeTruthy();
  });

  test('paid tiers always visible regardless of hideTrial', () => {
    const { getByText: withTrial } = renderFlow({ startAtStep: 3, hideTrial: false });
    expect(withTrial('Basic')).toBeTruthy();
    expect(withTrial('Premium')).toBeTruthy();

    const { getByText: withoutTrial } = renderFlow({ startAtStep: 3, hideTrial: true });
    expect(withoutTrial('Basic')).toBeTruthy();
    expect(withoutTrial('Premium')).toBeTruthy();
  });
});

// =========================================================================
// Trial selection
// =========================================================================

describe('trial selection', () => {

  test('pressing trial card calls onComplete with TRIAL tier', () => {
    const { getByText, onComplete } = renderFlow({ startAtStep: 3 });
    fireEvent.press(getByText('Start Free Trial'));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionTier: 'TRIAL' })
    );
  });

  test('trial onComplete includes billingCycle monthly', () => {
    const { getByText, onComplete } = renderFlow({ startAtStep: 3 });
    fireEvent.press(getByText('Start Free Trial'));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: 'monthly' })
    );
  });
});

// =========================================================================
// Back button — dismissal when at initialStep
// =========================================================================

describe('back button dismissal', () => {

  test('back button at startAtStep=3 calls onComplete with null subscriptionTier', () => {
    const { getByText, onComplete } = renderFlow({ startAtStep: 3 });
    fireEvent.press(getByText('← Back'));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionTier: null })
    );
  });

  test('back button dismissal passes null sport and position', () => {
    const { getByText, onComplete } = renderFlow({ startAtStep: 3 });
    fireEvent.press(getByText('← Back'));
    expect(onComplete).toHaveBeenCalledWith({
      sport: null,
      position: null,
      subscriptionTier: null,
      billingCycle: 'monthly',
    });
  });

  test('back button at step 2 navigates to step 1 (not dismiss)', () => {
    const { getByText, onComplete } = renderFlow();
    fireEvent.press(getByText('Football'));       // go to step 2
    fireEvent.press(getByText('← Back'));         // back to step 1
    expect(onComplete).not.toHaveBeenCalled();
    expect(getByText('Welcome to WellnessIQ!')).toBeTruthy();
  });

  test('back button at step 3 (from full flow) navigates to step 2', () => {
    const { getByText, onComplete } = renderFlow();
    fireEvent.press(getByText('Football'));
    fireEvent.press(getByText('QB'));             // go to step 3
    fireEvent.press(getByText('← Back'));         // back to step 2
    expect(onComplete).not.toHaveBeenCalled();
    expect(getByText('Choose Your Position')).toBeTruthy();
  });
});

// =========================================================================
// Subscription plan content
// =========================================================================

describe('subscription plan content', () => {

  test('Basic plan shows correct price', () => {
    const { getByText } = renderFlow({ startAtStep: 3 });
    expect(getByText('$12.99/month')).toBeTruthy();
  });

  test('Premium plan shows correct price', () => {
    const { getByText } = renderFlow({ startAtStep: 3 });
    expect(getByText('$19.99/month')).toBeTruthy();
  });

  test('Premium is marked as most popular', () => {
    const { getByText } = renderFlow({ startAtStep: 3 });
    expect(getByText('MOST POPULAR')).toBeTruthy();
  });

  test('Premium shows tagging feature', () => {
    const { getByText } = renderFlow({ startAtStep: 3 });
    expect(getByText(/tagging system/i)).toBeTruthy();
  });
});

// =========================================================================
// General Fitness onboarding flow
// =========================================================================

describe('General Fitness onboarding flow', () => {

  test('General Fitness appears as a sport option on step 1', () => {
    const { getByText } = renderFlow();
    expect(getByText('General Fitness')).toBeTruthy();
  });

  test('selecting General Fitness skips position step and goes directly to subscription', () => {
    const { getByText, queryByText } = renderFlow();
    fireEvent.press(getByText('General Fitness'));
    expect(getByText('Choose Your Plan')).toBeTruthy();
    expect(queryByText('Choose Your Position')).toBeNull();
  });

  test('step counter shows Step 2 of 2 after selecting General Fitness', () => {
    const { getByText } = renderFlow();
    fireEvent.press(getByText('General Fitness'));
    expect(getByText('Step 2 of 2')).toBeTruthy();
  });

  // Step 1 always renders a static 'Step 1 of 3' label regardless of path —
  // the step counter only branches on General Fitness at step 3. Skipping the
  // 'Step 1 of 2' assertion until (if ever) the sport-selection screen gets a
  // path-aware counter.
  test.skip('step counter shows Step 1 of 2 on first step when General Fitness path detected', () => {
    // Intentionally skipped; component does not currently support this.
  });

  test('back button from subscription step in General Fitness flow navigates to step 1 (skipping position step)', () => {
    const { getByText, onComplete, queryByText } = renderFlow();
    fireEvent.press(getByText('General Fitness'));    // go to step 3
    fireEvent.press(getByText('← Back'));             // GF flow: back goes to step 1, not step 2
    expect(onComplete).not.toHaveBeenCalled();
    expect(getByText('Welcome to WellnessIQ!')).toBeTruthy();
    expect(queryByText('Choose Your Position')).toBeNull();
  });

  test('selecting General Fitness then trial calls onComplete with GENERAL_FITNESS sport', () => {
    const { getByText, onComplete } = renderFlow();
    fireEvent.press(getByText('General Fitness'));
    fireEvent.press(getByText('Start Free Trial'));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ sport: 'GENERAL_FITNESS' })
    );
  });

  test('selecting General Fitness then trial calls onComplete with null position', () => {
    const { getByText, onComplete } = renderFlow();
    fireEvent.press(getByText('General Fitness'));
    fireEvent.press(getByText('Start Free Trial'));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ position: null })
    );
  });
});

// =========================================================================
// Sport-specific flow still shows 3 steps after General Fitness added
// =========================================================================
//
// Verified by existing test 'selecting a sport advances to step 2', which
// asserts 'Step 2 of 3' on the position step after Football is selected.
// No additional test required; the label has not changed for sport paths.
