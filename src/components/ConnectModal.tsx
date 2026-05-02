import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import { useTranslation } from 'react-i18next';

interface ConnectModalProps {
  visible: boolean;
  onClose: () => void;
  bleScanning: boolean;
  bleDevices: BluetoothDevice[];
  bleDeviceId: string;
  obdConnected: boolean;
  obdConnecting: boolean;
  onScan: () => void;
  onSelectDevice: (id: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ConnectModal: React.FC<ConnectModalProps> = ({
  visible,
  onClose,
  bleScanning,
  bleDevices,
  bleDeviceId,
  obdConnected,
  obdConnecting,
  onScan,
  onSelectDevice,
  onConnect,
  onDisconnect,
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>OBD Adapter</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, obdConnected ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.statusText}>
              {obdConnected
                ? t('common.connected')
                : obdConnecting
                ? 'Connecting...'
                : 'Not connected'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.scanBtn, bleScanning && styles.btnDisabled]}
            onPress={onScan}
            disabled={bleScanning}>
            {bleScanning ? (
              <ActivityIndicator color="#1a1a1a" size="small" />
            ) : (
              <Text style={styles.scanBtnText}>
                {bleDevices.length > 0 ? 'Refresh Paired Devices' : 'Scan Paired Devices'}
              </Text>
            )}
          </TouchableOpacity>

          {bleDevices.length > 0 ? (
            <ScrollView style={styles.deviceList} showsVerticalScrollIndicator={false}>
              {bleDevices.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.deviceItem, d.id === bleDeviceId && styles.deviceItemSelected]}
                  onPress={() => onSelectDevice(d.id)}>
                  <View style={styles.deviceLeft}>
                    <Text style={styles.deviceIcon}>◉</Text>
                    <View>
                      <Text style={styles.deviceName}>{d.name || 'Unnamed Device'}</Text>
                      <Text style={styles.deviceAddress}>{d.address || d.id}</Text>
                    </View>
                  </View>
                  {d.id === bleDeviceId && (
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : !bleScanning ? (
            <View style={styles.emptyDevices}>
              <Text style={styles.emptyText}>
                Tap "Scan" to find paired devices.{'\n'}
                Make sure your OBD adapter is paired in Bluetooth Settings first.
              </Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {obdConnected ? (
              <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect}>
                <Text style={styles.disconnectBtnText}>{t('common.disconnect')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectBtn, (!bleDeviceId || obdConnecting) && styles.btnDisabled]}
                onPress={onConnect}
                disabled={!bleDeviceId || obdConnecting}>
                {obdConnecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.connectBtnText}>{t('common.connect')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOn: {
    backgroundColor: '#34C759',
  },
  dotOff: {
    backgroundColor: '#ccc',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  scanBtn: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  deviceList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  deviceItemSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#34C759',
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    fontSize: 22,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyDevices: {
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  actionRow: {
    marginTop: 4,
  },
  connectBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disconnectBtn: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

export default ConnectModal;
