import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { theme, commonStyles } from '../theme';

export default function PerformanceScreen() {
  return (
    <ScrollView style={commonStyles.containerPadded}>
      <View style={styles.header}>
        <Text style={commonStyles.heading2}>Performance Analytics</Text>
        <Text style={commonStyles.bodySecondary}>Track your athletic progress</Text>
      </View>

      <Card style={commonStyles.card}>
        <Card.Content>
          <View style={commonStyles.cardHeader}>
            <Icon name="analytics" size={24} color={theme.colors.primary} />
            <Text style={commonStyles.heading3}>Training Metrics</Text>
          </View>
          <Text style={commonStyles.body}>Detailed performance tracking and analytics will be displayed here.</Text>
        </Card.Content>
      </Card>

      <Card style={commonStyles.card}>
        <Card.Content>
          <View style={commonStyles.cardHeader}>
            <Icon name="timeline" size={24} color={theme.colors.secondary} />
            <Text style={commonStyles.heading3}>Progress Timeline</Text>
          </View>
          <Text style={commonStyles.body}>Visual timeline of your improvement over time.</Text>
        </Card.Content>
      </Card>

      <Card style={commonStyles.card}>
        <Card.Content>
          <Text style={commonStyles.heading3}>Quick Actions</Text>
          <View style={styles.buttonRow}>
            <Button 
              mode="contained" 
              icon="add"
              style={styles.actionButton}
              buttonColor={theme.colors.primary}
            >
              Log Workout
            </Button>
            <Button 
              mode="outlined" 
              icon="assessment"
              style={styles.actionButton}
              textColor={theme.colors.primary}
            >
              View Report
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