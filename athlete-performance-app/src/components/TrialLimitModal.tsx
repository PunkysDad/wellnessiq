import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { appTheme } from '../theme/appTheme';

interface Props {
  visible: boolean;
  limitType: 'chat' | 'workout';
  modalType?: 'trial' | 'budgetBasic' | 'budgetPremium';
  onDismiss: () => void;
  onUpgrade: () => void;
}

export default function TrialLimitModal({ visible, limitType, modalType = 'trial', onDismiss, onUpgrade }: Props) {
  const isChat = limitType === 'chat';

  const title = modalType === 'trial' ? 'Trial Limit Reached' : 'Monthly Limit Reached';

  let bodyText: string;
  if (modalType === 'budgetBasic') {
    bodyText = "You've used your monthly AI budget. Upgrade to Premium for double the allowance.";
  } else if (modalType === 'budgetPremium') {
    bodyText = "You've reached your monthly usage limit. Your limit resets at the start of next month. You can still review all of your previous chats and workouts.";
  } else {
    bodyText = isChat
      ? "You've used all 3 free coaching questions included in your trial."
      : "You've used the 1 free workout plan included in your trial.";
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Icon name={isChat ? 'chat' : 'fitness-center'} size={36} color={appTheme.navy} />
          </View>

          {/* Heading */}
          <Text style={styles.title}>{title}</Text>

          {/* Body */}
          <Text style={styles.body}>{bodyText}</Text>

          {/* What they get — hidden for Premium budget limit */}
          {modalType !== 'budgetPremium' && (
            <View style={styles.tierList}>
              <Text style={styles.tierHeading}>Unlock full access:</Text>

              {modalType !== 'budgetBasic' && (
                <View style={styles.tierRow}>
                  <Icon name="check-circle" size={18} color="#8B5CF6" />
                  <View style={styles.tierText}>
                    <Text style={styles.tierName}>Basic — $12.99/mo</Text>
                    <Text style={styles.tierDetail}>~400 chats + ~57 workouts per month</Text>
                  </View>
                </View>
              )}

              <View style={styles.tierRow}>
                <Icon name="check-circle" size={18} color="#8B5CF6" />
                <View style={styles.tierText}>
                  <Text style={styles.tierName}>Premium — $19.99/mo</Text>
                  <Text style={styles.tierDetail}>~800 chats + ~114 workouts per month</Text>
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          {modalType !== 'budgetPremium' && (
            <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade}>
              <Text style={styles.upgradeBtnText}>Subscribe Now</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>
              {modalType === 'budgetPremium' ? 'Got It' : 'Maybe Later'}
            </Text>
          </TouchableOpacity>

          <View style={styles.legalLinks}>
            <Text
              style={styles.legalLinkText}
              onPress={() => Linking.openURL('https://sportsiqapp.info/privacy.html')}
            >
              Privacy Policy
            </Text>
            <Text style={styles.legalDivider}>|</Text>
            <Text
              style={styles.legalLinkText}
              onPress={() => Linking.openURL('https://sportsiqapp.info/terms.html')}
            >
              Terms of Use
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: appTheme.white,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${appTheme.navy}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: appTheme.navy,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: appTheme.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  tierList: {
    width: '100%',
    backgroundColor: '#1a2744',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  tierHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tierText: {
    flex: 1,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  tierDetail: {
    fontSize: 12,
    color: '#b0bec5',
    marginTop: 1,
  },
  upgradeBtn: {
    backgroundColor: appTheme.navy,
    borderRadius: 10,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeBtnText: {
    color: appTheme.white,
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  dismissBtnText: {
    color: appTheme.textLight,
    fontSize: 14,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  legalLinkText: {
    fontSize: 12,
    color: '#b0bec5',
  },
  legalDivider: {
    fontSize: 12,
    color: '#b0bec5',
    marginHorizontal: 8,
  },
});