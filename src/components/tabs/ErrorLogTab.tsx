import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

interface ErrorLogTabProps {
  obdConnected: boolean;
  dtcResults: Array<{ code: string; description: string }>;
  dtcScanning: boolean;
  handleScanDtc: () => void;
}

const ErrorLogTab: React.FC<ErrorLogTabProps> = ({
  obdConnected,
  dtcResults,
  dtcScanning,
  handleScanDtc,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{t('dashboard.troubleCodes')}</Text>
          <TouchableOpacity
            style={[styles.scanBtn, !obdConnected && styles.btnDisabled]}
            onPress={handleScanDtc}
            disabled={!obdConnected || dtcScanning}>
            <Text style={styles.scanBtnText}>
              {dtcScanning ? 'Scanning...' : t('dashboard.diagnostic')}
            </Text>
          </TouchableOpacity>
        </View>

        {dtcResults.length > 0 ? (
          <ScrollView style={styles.dtcList}>
            {dtcResults.map((dtc, idx) => (
              <View key={idx} style={styles.dtcItem}>
                <Text style={styles.dtcCode}>{dtc.code}</Text>
                <Text style={styles.dtcDesc}>{dtc.description}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyText}>
              {obdConnected
                ? 'No error codes found. Tap Diagnostic to scan.'
                : 'Connect to OBD to scan for errors'}
            </Text>
          </View>
        )}
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scanBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  btnDisabled: {
    backgroundColor: '#ccc',
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dtcList: {
    maxHeight: 300,
  },
  dtcItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dtcCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 4,
  },
  dtcDesc: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default ErrorLogTab;
