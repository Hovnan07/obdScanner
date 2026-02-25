import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface EngineTabProps {
  obdConnected: boolean;
  obdRpm: number | null;
  obdSpeedKmh: number | null;
  livePolling: boolean;
  handleToggleLive: () => void;
  handleReadRpm: () => void;
  handleReadSpeed: () => void;
}

const EngineTab: React.FC<EngineTabProps> = ({
  obdConnected,
  obdRpm,
  obdSpeedKmh,
  livePolling,
  handleToggleLive,
  handleReadRpm,
  handleReadSpeed,
}) => {
  const { t } = useTranslation();

  const rpmDisplay = obdRpm !== null ? obdRpm.toString() : '—';
  const speedDisplay = obdSpeedKmh !== null ? obdSpeedKmh.toString() : '—';

  return (
    <View style={styles.container}>
      {/* RPM gauge card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{t('dashboard.fuelRange')}</Text>
          <TouchableOpacity
            style={styles.arrowCircle}
            onPress={handleToggleLive}
            disabled={!obdConnected}>
            <Text style={styles.arrowIcon}>{livePolling ? '||' : '>'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barValue}>{rpmDisplay}</Text>
          <Text style={styles.barUnit}>{t('dashboard.rpm')}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: obdRpm
                    ? `${Math.min((obdRpm / 8000) * 100, 100)}%`
                    : '0%',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Speed gauge card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{t('dashboard.speed')}</Text>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barValue}>{speedDisplay}</Text>
          <Text style={styles.barUnit}>{t('dashboard.kmh')}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: obdSpeedKmh
                    ? `${Math.min((obdSpeedKmh / 240) * 100, 100)}%`
                    : '0%',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Quick stats row */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statCardLabel}>{t('dashboard.rpm')}</Text>
          <Text style={styles.statCardValue}>{rpmDisplay}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardLabel}>{t('dashboard.speed')}</Text>
          <Text style={styles.statCardValue}>{speedDisplay}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardLabel}>{t('dashboard.status')}</Text>
          <Text style={[styles.statCardValue, obdConnected ? styles.statusOn : styles.statusOff]}>
            {obdConnected ? t('dashboard.on') : t('dashboard.off')}
          </Text>
        </View>
      </View>

      {/* Action buttons row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, (!obdConnected || livePolling) && styles.btnDisabled]}
          onPress={handleReadRpm}
          disabled={!obdConnected || livePolling}>
          <Text style={styles.actionBtnText}>{t('dashboard.readRpm')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, (!obdConnected || livePolling) && styles.btnDisabled]}
          onPress={handleReadSpeed}
          disabled={!obdConnected || livePolling}>
          <Text style={styles.actionBtnText}>{t('dashboard.readSpeed')}</Text>
        </TouchableOpacity>
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    minWidth: 70,
  },
  barUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginRight: 12,
    minWidth: 50,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  statusOn: {
    color: '#34C759',
  },
  statusOff: {
    color: '#FF3B30',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#ccc',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default EngineTab;
