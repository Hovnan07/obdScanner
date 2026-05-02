import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import dtcCodesRaw from '../../codes.json';
import { useObdStore } from '../store/obdStore';
import NotificationModal from '../components/NotificationModal';
import LanguageSelector from '../components/LanguageSelector';
import ProfileAvatar from '../components/ProfileAvatar';
import EngineTab from '../components/tabs/EngineTab';
import ErrorLogTab from '../components/tabs/ErrorLogTab';
import ConnectModal from '../components/ConnectModal';
import { useTranslation } from 'react-i18next';
import { scanVin } from '../services/carImageService';

const getTabs = (t: any) => [t('dashboard.engine'), t('dashboard.errorLog')];

const dtcLookup: Record<string, string> = {};
for (const entry of dtcCodesRaw as Array<{ Code: string; Description: string }>) {
  const code = entry.Code.replace(/\/.*$/, '').trim().toUpperCase();
  dtcLookup[code] = entry.Description;
}

const DashboardScreen: React.FC = () => {
  const { t } = useTranslation();

  const {
    bleDeviceId,
    obdConnected,
    obdConnecting,
    obdRpm,
    obdSpeedKmh,
    dtcResults,
    dtcScanning,
    livePolling,
    activeTab,
    vehicleVin,
    vehicleMake,
    vinReading,
    modalVisible,
    modalType,
    modalTitle,
    modalMessage,
    languageSelectorVisible,
    userFirstName,
    userLastName,
    userProfileImage,
    setBleDeviceId,
    setObdConnected,
    setObdConnecting,
    setObdLastResponse,
    setObdRpm,
    setObdSpeedKmh,
    setDtcResults,
    setDtcScanning,
    setLivePolling,
    setActiveTab,
    setVehicleVin,
    setVehicleMake,
    setVinReading,
    showModal,
    hideModal,
    showLanguageSelector,
    hideLanguageSelector,
    setProfileEditVisible,
  } = useObdStore();

  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const [make, setMake] = useState<string | undefined>(undefined);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [modelYear, setModelYear] = useState<string | undefined>(undefined);
  const [bleDevices, setBleDevices] = useState<BluetoothDevice[]>([]);
  const [bleScanning, setBleScanning] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      try {
        if (bleDeviceRef.current?.isConnected()) bleDeviceRef.current.disconnect();
      } catch { /* ignore */ } finally {
        bleDeviceRef.current = null;
      }
    };
  }, []);

  // Auto-close the connect modal once the device connects
  useEffect(() => {
    if (obdConnected) setConnectModalVisible(false);
  }, [obdConnected]);

  const ensureBtPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const perms: any[] = [];
      if (Platform.Version >= 31) {
        perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
        perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      } else {
        perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      }
      const results: any = await PermissionsAndroid.requestMultiple(perms as any);
      return perms.every((p) => results?.[p] === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      return false;
    }
  };

  const startBleScan = async () => {
    const ok = await ensureBtPermissions();
    if (!ok) {
      showModal('error', t('modal.connectionError'), 'Bluetooth permission denied');
      return;
    }
    setBleDevices([]);
    setBleScanning(true);
    try {
      const bonded = await RNBluetoothClassic.getBondedDevices();
      setBleDevices(bonded);
      setBleScanning(false);
      if (bonded.length === 0) {
        showModal('info', 'No Paired Devices', 'Please pair your OBD adapter in Bluetooth settings first');
      }
    } catch (e) {
      setBleScanning(false);
      showModal('error', t('modal.connectionError'), String(e));
    }
  };

  const parseHexBytes = (raw: string) => {
    const cleaned = raw
      .replace(/SEARCHING\.\.\./gi, '')
      .replace(/[^0-9A-Fa-f\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = cleaned.split(' ').filter(Boolean);
    const bytes: number[] = [];
    for (const tok of tokens) {
      if (/^[0-9A-Fa-f]{2}$/.test(tok)) {
        bytes.push(parseInt(tok, 16));
      } else if (/^[0-9A-Fa-f]+$/.test(tok) && tok.length % 2 === 0) {
        for (let j = 0; j < tok.length; j += 2) {
          bytes.push(parseInt(tok.substring(j, j + 2), 16));
        }
      }
    }
    return bytes;
  };

  const parseRpmFrom010C = (raw: string) => {
    const bytes = parseHexBytes(raw);
    for (let i = 0; i + 3 < bytes.length; i++) {
      if (bytes[i] === 0x41 && bytes[i + 1] === 0x0c) {
        return (bytes[i + 2] * 256 + bytes[i + 3]) / 4;
      }
    }
    return null;
  };

  const parseSpeedFrom010D = (raw: string) => {
    const bytes = parseHexBytes(raw);
    for (let i = 0; i + 2 < bytes.length; i++) {
      if (bytes[i] === 0x41 && bytes[i + 1] === 0x0d) return bytes[i + 2];
    }
    return null;
  };

  const parseDTCs = (raw: string): string[] => {
    const bytes = parseHexBytes(raw);
    const codes: string[] = [];
    let dataStart = -1;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x43) { dataStart = i + 1; break; }
    }
    if (dataStart < 0) return codes;
    const prefixMap: Record<number, string> = {
      0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3',
      4: 'C0', 5: 'C1', 6: 'C2', 7: 'C3',
      8: 'B0', 9: 'B1', 10: 'B2', 11: 'B3',
      12: 'U0', 13: 'U1', 14: 'U2', 15: 'U3',
    };
    for (let i = dataStart; i + 1 < bytes.length; i += 2) {
      const hi = bytes[i];
      const lo = bytes[i + 1];
      if (hi === 0x00 && lo === 0x00) continue;
      const nibble1 = (hi >> 4) & 0x0f;
      const nibble2 = hi & 0x0f;
      const prefix = prefixMap[nibble1] ?? 'P0';
      const suffix = nibble2.toString(16).toUpperCase() + lo.toString(16).toUpperCase().padStart(2, '0');
      codes.push(prefix + suffix);
    }
    return codes;
  };

  const parseVinFrom0902 = (raw: string): string | null => {
    const bytes = parseHexBytes(raw);
    const vinBytes: number[] = [];
    let i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0x49 && i + 1 < bytes.length && bytes[i + 1] === 0x02) {
        i += 3;
        continue;
      }
      vinBytes.push(bytes[i]);
      i++;
    }
    const vinChars: string[] = [];
    for (const b of vinBytes) {
      if (b >= 0x20 && b <= 0x7e) vinChars.push(String.fromCharCode(b));
    }
    if (vinChars.length >= 17) return vinChars.slice(0, 17).join('');
    const ascii = raw.replace(/[^A-Za-z0-9]/g, '');
    if (ascii.length >= 17) return ascii.substring(ascii.length - 17);
    return null;
  };

  const readVehicleInfo = async () => {
    setVinReading(true);
    try {
      const resp = await obdSend('0902', 8000);
      const vin = parseVinFrom0902(resp);
      if (vin && vin.length > 0) {
        setVehicleVin(vin);
        const decoded = await scanVin(vin);
        if (decoded) {
          setModelYear(decoded.modelYear ?? undefined);
          setModel(decoded.model ?? undefined);
          setMake(decoded.make ?? undefined);
          if (decoded.make) setVehicleMake(decoded.make);
        }
      } else {
        setVehicleMake('Vehicle');
      }
    } catch {
      setVehicleMake('Vehicle');
    } finally {
      setVinReading(false);
    }
  };

  const obdReadUntilPrompt = async (timeoutMs: number): Promise<string> => {
    const device = bleDeviceRef.current;
    if (!device) throw new Error('Not connected');
    let buffer = '';
    const deadline = Date.now() + timeoutMs;
    let lastDataTime = 0;
    while (Date.now() < deadline) {
      try {
        const msg = await device.read();
        if (msg) {
          buffer += msg + '\n';
          lastDataTime = Date.now();
          if (buffer.includes('>')) {
            return buffer.replace(/\r/g, '').replace(/>/g, '').trim();
          }
        } else if (lastDataTime > 0 && Date.now() - lastDataTime > 500) {
          return buffer.replace(/\r/g, '').replace(/>/g, '').trim();
        }
      } catch (e) {
        console.log('[obdRead] Read error:', e);
      }
      await new Promise<void>(r => setTimeout(r, 50));
    }
    if (buffer.trim().length > 0) return buffer.replace(/\r/g, '').replace(/>/g, '').trim();
    throw new Error('OBD timeout');
  };

  const obdSend = async (command: string, timeoutMs = 10000): Promise<string> => {
    if (!bleDeviceRef.current) throw new Error('Not connected');
    try { await bleDeviceRef.current.clear(); } catch { /* ignore */ }
    await bleDeviceRef.current.write(`${command.trim()}\r`);
    const response = await obdReadUntilPrompt(timeoutMs);
    setObdLastResponse(response);
    return response;
  };

  const obdInit = async () => {
    await obdSend('ATZ', 5000);
    await obdSend('ATE0', 3000);
    await obdSend('ATL0', 3000);
    await obdSend('ATS0', 3000);
    await obdSend('ATH0', 3000);
    await obdSend('ATSP0', 3000);
  };

  const handleObdConnect = async () => {
    try {
      if (!bleDeviceId) {
        showModal('error', t('modal.invalidInput'), 'Select a Bluetooth device');
        return;
      }
      const ok = await ensureBtPermissions();
      if (!ok) {
        showModal('error', t('modal.connectionError'), 'Bluetooth permission denied');
        return;
      }
      setObdConnecting(true);
      setObdLastResponse('');
      setObdRpm(null);
      setObdSpeedKmh(null);
      const device = await RNBluetoothClassic.connectToDevice(bleDeviceId, { delimiter: '\r' });
      bleDeviceRef.current = device;
      setObdConnected(true);
      try {
        await obdInit();
        setObdLastResponse('OBD ready — reading vehicle info...');
        await readVehicleInfo();
        setObdConnecting(false);
        showModal('success', t('modal.connectedTitle'), t('modal.connectedMsg', { vehicle: vehicleMake }));
      } catch (e) {
        setObdLastResponse(`Connected, init failed: ${String(e)}`);
        setObdConnecting(false);
        showModal('error', t('modal.initFailed'), t('modal.initFailedMsg'));
      }
    } catch (e) {
      console.error(e);
      setObdConnecting(false);
      showModal('error', t('modal.connectionFailed'), t('modal.connectionFailedMsg'));
    }
  };

  const stopLivePolling = () => {
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
    setLivePolling(false);
  };

  const handleObdDisconnect = () => {
    stopLivePolling();
    try {
      if (bleDeviceRef.current?.isConnected()) bleDeviceRef.current.disconnect();
    } catch { /* ignore */ } finally {
      bleDeviceRef.current = null;
      setObdConnected(false);
    }
  };

  const handleReadRpm = async () => {
    try {
      setObdRpm(parseRpmFrom010C(await obdSend('010C')));
    } catch (e) {
      Alert.alert('RPM failed', String(e));
    }
  };

  const handleReadSpeed = async () => {
    try {
      setObdSpeedKmh(parseSpeedFrom010D(await obdSend('010D')));
    } catch (e) {
      Alert.alert('Speed failed', String(e));
    }
  };

  const pollOnce = async () => {
    try { setObdRpm(parseRpmFrom010C(await obdSend('010C'))); } catch { /* ignore */ }
    try { setObdSpeedKmh(parseSpeedFrom010D(await obdSend('010D'))); } catch { /* ignore */ }
  };

  const handleToggleLive = () => {
    if (livePolling) { stopLivePolling(); return; }
    setLivePolling(true);
    let polling = false;
    const tick = async () => { if (polling) return; polling = true; await pollOnce(); polling = false; };
    tick();
    liveIntervalRef.current = setInterval(tick, 1000);
  };

  const handleScanDTCs = async () => {
    setDtcScanning(true);
    setDtcResults([]);
    try {
      const resp = await obdSend('03', 10000);
      setObdLastResponse(resp);
      if (/NO DATA/i.test(resp) || /NO CODES/i.test(resp)) {
        setDtcResults([{ code: '—', description: 'No trouble codes found' }]);
        setDtcScanning(false);
        return;
      }
      const codes = parseDTCs(resp);
      setDtcResults(
        codes.length === 0
          ? [{ code: '—', description: 'No trouble codes found' }]
          : codes.map((c) => ({ code: c, description: dtcLookup[c] ?? 'Unknown code' })),
      );
    } catch (e) {
      Alert.alert('DTC scan failed', String(e));
    } finally {
      setDtcScanning(false);
    }
  };

  const tabs = getTabs(t);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerRow} activeOpacity={0.7} onPress={() => setProfileEditVisible(true)}>
          <ProfileAvatar firstName={userFirstName} lastName={userLastName} imageUri={userProfileImage} size={44} />
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>{userFirstName} {userLastName}</Text>
            <Text style={styles.headerSubtitle}>
              {obdConnected
                ? `${vehicleMake}${vehicleVin ? ` · ${vehicleVin}` : ''}`
                : vinReading
                ? t('common.readingVin')
                : t('dashboard.connectToStart')}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.languageBtn} onPress={showLanguageSelector}>
            <Text style={styles.languageBtnText}>⊕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.connectChip, obdConnected && styles.connectChipActive]}
            onPress={() => setConnectModalVisible(true)}>
            <View style={[styles.chipDot, obdConnected ? styles.chipDotOn : styles.chipDotOff]} />
            <Text style={[styles.chipText, obdConnected && styles.chipTextActive]}>
              {obdConnected ? 'Connected' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}>
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Vehicle status card */}
        <View style={styles.vehicleCard}>
          {obdConnecting || vinReading ? (
            <>
              <ActivityIndicator color="#007AFF" size="large" style={{ marginBottom: 10 }} />
              <Text style={styles.vehicleCardSubtitle}>
                {vinReading ? t('common.readingVin') : 'Connecting...'}
              </Text>
            </>
          ) : obdConnected ? (
            <>
              <View style={styles.vehicleConnectedBadge}>
                <View style={styles.vehicleConnectedDot} />
                <Text style={styles.vehicleConnectedBadgeText}>Connected</Text>
              </View>
              <Text style={styles.vehicleName}>
                {[make, model, modelYear].filter(Boolean).join(' ') || vehicleMake}
              </Text>
              {vehicleVin ? <Text style={styles.vehicleVin}>VIN · {vehicleVin}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.vehicleCardEmoji}>⊘</Text>
              <Text style={styles.vehicleCardTitle}>No vehicle connected</Text>
              <Text style={styles.vehicleCardSubtitle}>{t('dashboard.connectToStart')}</Text>
            </>
          )}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === t('dashboard.errorLog') ? (
            <ErrorLogTab
              obdConnected={obdConnected}
              dtcResults={dtcResults}
              dtcScanning={dtcScanning}
              handleScanDtc={handleScanDTCs}
            />
          ) : (
            <EngineTab
              obdConnected={obdConnected}
              obdRpm={obdRpm}
              obdSpeedKmh={obdSpeedKmh}
              livePolling={livePolling}
              handleToggleLive={handleToggleLive}
              handleReadRpm={handleReadRpm}
              handleReadSpeed={handleReadSpeed}
            />
          )}
        </View>

      </ScrollView>

      {/* Bottom diagnostic button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.diagnosticBtn, (!obdConnected || dtcScanning || livePolling) && styles.btnDisabled]}
          onPress={handleScanDTCs}
          disabled={!obdConnected || dtcScanning || livePolling}>
          {dtcScanning
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.diagnosticBtnText}>{t('dashboard.diagnostic')}</Text>}
        </TouchableOpacity>
      </View>

      <NotificationModal visible={modalVisible} type={modalType} title={modalTitle} message={modalMessage} onClose={hideModal} />
      <LanguageSelector visible={languageSelectorVisible} onClose={hideLanguageSelector} />
      <ConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        bleScanning={bleScanning}
        bleDevices={bleDevices}
        bleDeviceId={bleDeviceId}
        obdConnected={obdConnected}
        obdConnecting={obdConnecting}
        onScan={startBleScan}
        onSelectDevice={setBleDeviceId}
        onConnect={handleObdConnect}
        onDisconnect={handleObdDisconnect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    gap: 12,
    paddingTop: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  languageBtnText: {
    fontSize: 20,
  },

  // Connect chip
  connectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  connectChipActive: {
    backgroundColor: '#E8F5E9',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipDotOn: {
    backgroundColor: '#34C759',
  },
  chipDotOff: {
    backgroundColor: '#ccc',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  chipTextActive: {
    color: '#2E7D32',
  },

  // Tabs
  tabsScroll: {
    marginTop: 8,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabActive: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },

  // Vehicle status card
  vehicleCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  vehicleConnectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    gap: 6,
  },
  vehicleConnectedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
  },
  vehicleConnectedBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  vehicleName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 6,
  },
  vehicleVin: {
    fontSize: 12,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  vehicleCardEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  vehicleCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  vehicleCardSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  // Tab content wrapper
  tabContent: {
    paddingHorizontal: 20,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: '#F2F2F7',
  },
  diagnosticBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  diagnosticBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

export default DashboardScreen;
