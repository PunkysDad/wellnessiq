import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { theme, commonStyles } from '../theme';

export default function EditProfileScreen() {
  return (
    <ScrollView style={commonStyles.containerPadded}>
      <View style={styles.header}>
        <Text style={commonStyles.heading2}>Edit Profile</Text>
        <Text style={commonStyles.bodySecondary}>Update your athlete information</Text>
      </View>

      <Card style={commonStyles.card}>
        <Card.Content>
          <View style={commonStyles.cardHeader}>
            <Icon name="person" size={24} color={theme.colors.primary} />
            <Text style={commonStyles.heading3}>Basic Information</Text>
          </View>
          <Text style={commonStyles.body}>
            Profile editing form will be implemented here with fields for:
          </Text>
          <Text style={commonStyles.bodySecondary}>• Name and contact information</Text>
          <Text style={commonStyles.bodySecondary}>• Sport and position details</Text>
          <Text style={commonStyles.bodySecondary}>• School and graduation year</Text>
          <Text style={commonStyles.bodySecondary}>• Profile photo upload</Text>
        </Card.Content>
      </Card>

      <Card style={commonStyles.card}>
        <Card.Content>
          <View style={commonStyles.cardHeader}>
            <Icon name="fitness-center" size={24} color={theme.colors.secondary} />
            <Text style={commonStyles.heading3}>Athletic Stats</Text>
          </View>
          <Text style={commonStyles.body}>
            Update your performance metrics and achievements.
          </Text>
        </Card.Content>
      </Card>

      <Card style={commonStyles.card}>
        <Card.Content>
          <Text style={commonStyles.heading3}>Actions</Text>
          <View style={styles.buttonRow}>
            <Button 
              mode="contained" 
              icon="save"
              style={styles.actionButton}
              buttonColor={theme.colors.success}
            >
              Save Changes
            </Button>
            <Button 
              mode="outlined" 
              icon="cancel"
              style={styles.actionButton}
              textColor={theme.colors.textSecondary}
            >
              Cancel
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: theme.spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
});