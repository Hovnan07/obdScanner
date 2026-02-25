import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface BatteryTabProps {
  obdConnected: boolean;
}

const BatteryTab: React.FC<BatteryTabProps> = ({ obdConnected }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('dashboard.battery')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Voltage:</Text>
          <Text style={styles.value}>{obdConnected ? '12.6V' : '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status:</Text>
          <Text style={[styles.value, styles.statusGood]}>
            {obdConnected ? 'Good' : '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Temperature:</Text>
          <Text style={styles.value}>{obdConnected ? '25°C' : '—'}</Text>
        </View>
      </View>

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderEmoji}>🔋</Text>
        <Text style={styles.placeholderText}>
          Battery diagnostics will be available here
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statusGood: {
    color: '#34C759',
  },
  placeholderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default BatteryTab;
