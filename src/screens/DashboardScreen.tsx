import React, { useEffect, useRef } from 'react';
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import dtcCodesRaw from '../../codes.json';
import { useObdStore } from '../store/obdStore';
import NotificationModal from '../components/NotificationModal';
import LanguageSelector from '../components/LanguageSelector';
import ProfileAvatar from '../components/ProfileAvatar';
import EngineTab from '../components/tabs/EngineTab';
import BatteryTab from '../components/tabs/BatteryTab';
import ErrorLogTab from '../components/tabs/ErrorLogTab';
import BrakePadTab from '../components/tabs/BrakePadTab';
import ABSTab from '../components/tabs/ABSTab';
import ACTab from '../components/tabs/ACTab';
import { useTranslation } from 'react-i18next';

const getTabs = (t: any) => [t('dashboard.engine'), t('dashboard.battery'), t('dashboard.errorLog'), t('dashboard.brakePad'), t('dashboard.abs'), t('dashboard.ac')];

const dtcLookup: Record<string, string> = {};
for (const entry of dtcCodesRaw as Array<{ Code: string; Description: string }>) {
  const code = entry.Code.replace(/\/.*$/, '').trim().toUpperCase();
  dtcLookup[code] = entry.Description;
}

// VIN WMI (first 3 chars) to manufacturer name
const WMI_MAP: Record<string, string> = {
  WBA: 'BMW', WBS: 'BMW M', WBY: 'BMW', '4US': 'BMW',
  WDB: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDD: 'Mercedes-Benz', 'W1K': 'Mercedes-Benz',
  WAU: 'Audi', WUA: 'Audi',
  WVW: 'Volkswagen', WV2: 'Volkswagen',
  WP0: 'Porsche', WP1: 'Porsche',
  JTD: 'Toyota', JTE: 'Toyota', '4T1': 'Toyota', '5TD': 'Toyota',
  JHM: 'Honda', '1HG': 'Honda', '2HG': 'Honda', '5FN': 'Honda',
  JN1: 'Nissan', JN8: 'Nissan', '1N4': 'Nissan', '5N1': 'Nissan',
  '1FA': 'Ford', '1FT': 'Ford', '3FA': 'Ford',
  '1G1': 'Chevrolet', '1GC': 'Chevrolet', '2G1': 'Chevrolet',
  '1GY': 'Cadillac',
  '1GM': 'Pontiac',
  '2HM': 'Hyundai', KMH: 'Hyundai', '5NP': 'Hyundai',
  KNA: 'Kia', KND: 'Kia',
  JF1: 'Subaru', JF2: 'Subaru', '4S3': 'Subaru', '4S4': 'Subaru',
  JMA: 'Mitsubishi', JMB: 'Mitsubishi', JA3: 'Mitsubishi',
  MAJ: 'Ford (India)', SAL: 'Land Rover', SAJ: 'Jaguar',
  ZFF: 'Ferrari', ZAM: 'Maserati', ZAR: 'Alfa Romeo',
  YV1: 'Volvo', YV4: 'Volvo',
  TRU: 'Audi (Hungary)', TMB: 'Skoda',
  VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroen',
  SCC: 'Lotus', SCF: 'Aston Martin',
};

const decodeVinMake = (vin: string): string => {
  const v = vin.toUpperCase();
  const wmi3 = v.substring(0, 3);
  if (WMI_MAP[wmi3]) return WMI_MAP[wmi3];
  const wmi2 = v.substring(0, 2);
  for (const key of Object.keys(WMI_MAP)) {
    if (key.startsWith(wmi2)) return WMI_MAP[key];
  }
  return vin.substring(0, 3);
};

const DashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  
  // Zustand store
  const {
    obdHost,
    obdPort,
    obdConnected,
    obdConnecting,
    obdRpm,
    obdSpeedKmh,
    dtcResults,
    dtcScanning,
    livePolling,
    showSettings,
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
    setObdHost,
    setObdPort,
    setObdConnected,
    setObdConnecting,
    setObdLastResponse,
    setObdRpm,
    setObdSpeedKmh,
    setDtcResults,
    setDtcScanning,
    setLivePolling,
    setShowSettings,
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

  // Refs for socket and intervals
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const obdSocketRef = useRef<any>(null);
  const obdBufferRef = useRef('');
  const obdPendingRef = useRef<null | { resolve: (s: string) => void; reject: (e: any) => void }>(null);

  useEffect(() => {
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
      }
      if (obdSocketRef.current) {
        try { obdSocketRef.current.destroy(); } catch { /* ignore */ }
        obdSocketRef.current = null;
      }
    };
  }, []);

  const parseHexBytes = (raw: string) => {
    const cleaned = raw
      .replace(/SEARCHING\.\.\./gi, '')
      .replace(/[^0-9A-Fa-f\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = cleaned.split(' ').filter(Boolean);
    const bytes: number[] = [];
    for (const t of tokens) {
      if (/^[0-9A-Fa-f]{2}$/.test(t)) {
        bytes.push(parseInt(t, 16));
      } else if (/^[0-9A-Fa-f]+$/.test(t) && t.length % 2 === 0) {
        for (let j = 0; j < t.length; j += 2) {
          bytes.push(parseInt(t.substring(j, j + 2), 16));
        }
      }
    }
    return bytes;
  };

  const parseRpmFrom010C = (raw: string) => {
    const bytes = parseHexBytes(raw);
    for (let i = 0; i + 3 < bytes.length; i++) {
      if (bytes[i] === 0x41 && bytes[i + 1] === 0x0c) {
        const a = bytes[i + 2];
        const b = bytes[i + 3];
        return (a * 256 + b) / 4;
      }
    }
    return null;
  };

  const parseSpeedFrom010D = (raw: string) => {
    const bytes = parseHexBytes(raw);
    for (let i = 0; i + 2 < bytes.length; i++) {
      if (bytes[i] === 0x41 && bytes[i + 1] === 0x0d) {
        return bytes[i + 2];
      }
    }
    return null;
  };

  const parseDTCs = (raw: string): string[] => {
    const bytes = parseHexBytes(raw);
    const codes: string[] = [];
    let dataStart = -1;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x43) {
        dataStart = i + 1;
        break;
      }
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
    // Look for 49 02 response header
    let dataStart = -1;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x49 && bytes[i + 1] === 0x02) {
        dataStart = i + 3; // skip 49 02 <count>
        break;
      }
    }
    if (dataStart < 0) {
      // Try extracting ASCII directly from cleaned response
      const ascii = raw.replace(/[^A-Za-z0-9]/g, '');
      if (ascii.length >= 17) {
        return ascii.substring(ascii.length - 17);
      }
      return null;
    }
    const vinChars: string[] = [];
    for (let i = dataStart; i < bytes.length && vinChars.length < 17; i++) {
      if (bytes[i] >= 0x20 && bytes[i] <= 0x7e) {
        vinChars.push(String.fromCharCode(bytes[i]));
      }
    }
    return vinChars.length >= 17 ? vinChars.join('') : null;
  };

  const readVehicleInfo = async () => {
    setVinReading(true);
    try {
      const resp = await obdSend('0902', 8000);
      const vin = parseVinFrom0902(resp);
      if (vin && vin.length >= 17) {
        setVehicleVin(vin);
        const make = decodeVinMake(vin);
        setVehicleMake(make);
      } else {
        setVehicleMake('Vehicle');
      }
    } catch {
      setVehicleMake('Vehicle');
    } finally {
      setVinReading(false);
    }
  };

  const obdHandleData = (data: any) => {
    const chunk = typeof data === 'string' ? data : data?.toString?.('utf8') ?? String(data);
    obdBufferRef.current += chunk;
    if (obdPendingRef.current && obdBufferRef.current.includes('>')) {
      const full = obdBufferRef.current;
      obdBufferRef.current = '';
      const cleaned = full.replace(/\r/g, '').replace(/\n/g, '\n').replace(/>/g, '').trim();
      setObdLastResponse(cleaned);
      const pending = obdPendingRef.current;
      obdPendingRef.current = null;
      pending.resolve(cleaned);
    }
  };

  const obdSend = (command: string, timeoutMs = 3000) => {
    return new Promise<string>((resolve, reject) => {
      if (!obdSocketRef.current) { reject(new Error('Not connected')); return; }
      if (obdPendingRef.current) { reject(new Error('Another command is in progress')); return; }
      obdBufferRef.current = '';
      obdPendingRef.current = { resolve, reject };
      const timer = setTimeout(() => {
        if (obdPendingRef.current) {
          obdPendingRef.current = null;
          reject(new Error('OBD timeout'));
        }
      }, timeoutMs);
      const originalResolve = resolve;
      const originalReject = reject;
      obdPendingRef.current = {
        resolve: (s) => { clearTimeout(timer); originalResolve(s); },
        reject: (e) => { clearTimeout(timer); originalReject(e); },
      };
      try {
        obdSocketRef.current.write(`${command.trim()}\r`);
      } catch (e) {
        clearTimeout(timer);
        obdPendingRef.current = null;
        reject(e);
      }
    });
  };

  const obdInit = async () => {
    await obdSend('ATZ', 3000);
    await obdSend('ATE0', 2000);
    await obdSend('ATL0', 2000);
    await obdSend('ATS0', 2000);
    await obdSend('ATH0', 2000);
    await obdSend('ATSP0', 2000);
  };

  const handleObdConnect = async () => {
    try {
      const portNum = Number(obdPort);
      if (!obdHost || !Number.isFinite(portNum)) {
        showModal('error', t('modal.invalidInput'), t('modal.invalidInputMsg'));
        return;
      }
      if (obdSocketRef.current) {
        try { obdSocketRef.current.destroy(); } catch { /* ignore */ }
        obdSocketRef.current = null;
      }
      setObdConnecting(true);
      setObdLastResponse('');
      setObdRpm(null);
      setObdSpeedKmh(null);
      obdBufferRef.current = '';
      
      let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
      let isConnected = false;
      
      const socket = TcpSocket.createConnection(
        { host: obdHost, port: portNum },
        async () => {
          isConnected = true;
          if (connectionTimeout) clearTimeout(connectionTimeout);
          setObdConnected(true);
          try {
            await obdInit();
            setObdLastResponse('OBD ready — reading vehicle info...');
            await readVehicleInfo();
            setShowSettings(false);
            setObdConnecting(false);
            showModal('success', t('modal.connectedTitle'), t('modal.connectedMsg', { vehicle: vehicleMake }));
          } catch (e) {
            setObdLastResponse(`Connected, init failed: ${String(e)}`);
            setObdConnecting(false);
            showModal('error', t('modal.initFailed'), t('modal.initFailedMsg'));
          }
        }
      );
      
      connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          try { socket.destroy(); } catch { /* ignore */ }
          setObdConnecting(false);
          showModal('error', t('modal.connectionError'), t('modal.connectionErrorMsg'));
        }
      }, 8000);
      
      socket.on('data', obdHandleData);
      socket.on('error', (e: any) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        setObdLastResponse(t('modal.socketError', { error: String(e) }));
        setObdConnected(false);
        setObdConnecting(false);
        showModal('error', t('modal.connectionError'), t('modal.connectionErrorMsg'));
      });
      socket.on('close', () => { 
        if (connectionTimeout) clearTimeout(connectionTimeout);
        setObdConnected(false);
      });
      obdSocketRef.current = socket;
    } catch (e) {
      console.error(e);
      setObdConnecting(false);
      showModal('error', t('modal.connectionFailed'), t('modal.connectionFailedMsg'));
    }
  };

  const stopLivePolling = () => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    setLivePolling(false);
  };

  const handleObdDisconnect = () => {
    stopLivePolling();
    try {
      if (obdSocketRef.current) { obdSocketRef.current.destroy(); }
    } catch { /* ignore */ } finally {
      obdSocketRef.current = null;
      setObdConnected(false);
    }
  };

  const handleReadRpm = async () => {
    try {
      const resp = await obdSend('010C');
      const rpm = parseRpmFrom010C(resp);
      setObdRpm(rpm);
      setObdLastResponse(resp);
    } catch (e) {
      Alert.alert('RPM failed', String(e));
    }
  };

  const handleReadSpeed = async () => {
    try {
      const resp = await obdSend('010D');
      const speed = parseSpeedFrom010D(resp);
      setObdSpeedKmh(speed);
      setObdLastResponse(resp);
    } catch (e) {
      Alert.alert('Speed failed', String(e));
    }
  };

  const pollOnce = async () => {
    try {
      const rpmResp = await obdSend('010C');
      const rpm = parseRpmFrom010C(rpmResp);
      setObdRpm(rpm);
    } catch { /* ignore */ }
    try {
      const speedResp = await obdSend('010D');
      const speed = parseSpeedFrom010D(speedResp);
      setObdSpeedKmh(speed);
    } catch { /* ignore */ }
  };

  const handleToggleLive = () => {
    if (livePolling) { stopLivePolling(); return; }
    setLivePolling(true);
    let polling = false;
    const tick = async () => {
      if (polling) return;
      polling = true;
      await pollOnce();
      polling = false;
    };
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
      if (codes.length === 0) {
        setDtcResults([{ code: '—', description: 'No trouble codes found' }]);
      } else {
        const results = codes.map((c) => ({
          code: c,
          description: dtcLookup[c] ?? 'Unknown code',
        }));
        setDtcResults(results);
      }
    } catch (e) {
      Alert.alert('DTC scan failed', String(e));
    } finally {
      setDtcScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />

      {/* Sticky Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerRow}
          activeOpacity={0.7}
          onPress={() => setProfileEditVisible(true)}>
          <ProfileAvatar
            firstName={userFirstName}
            lastName={userLastName}
            imageUri={userProfileImage}
            size={44}
          />
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>
              {userFirstName} {userLastName}
            </Text>
            {obdConnected ? (
              <Text style={styles.headerSubtitle}>
                {vehicleMake}{vehicleVin ? ` · ${vehicleVin}` : ''}
              </Text>
            ) : vinReading ? (
              <Text style={styles.headerSubtitle}>{t('common.readingVin')}</Text>
            ) : (
              <Text style={styles.headerSubtitle}>{t('dashboard.connectToStart')}</Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.languageBtn}
            onPress={showLanguageSelector}>
            <Text style={styles.languageBtnText}>🌐</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setShowSettings(!showSettings)}>
            <Text style={styles.settingsBtnText}>{showSettings ? '−' : '+'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}>
          {getTabs(t).map((tab, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Car Image */}
        <View style={styles.carImageSection}>
          <View style={styles.carImagePlaceholder}>
            <Text style={styles.carEmoji}>🚗</Text>
            <Text style={styles.carPlaceholderText}>
              {obdConnected ? vehicleMake : t('dashboard.connectToStart')}
            </Text>
          </View>
        </View>

        {/* Connection Settings (collapsible) */}
        {showSettings && (
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>{t('dashboard.connection')}</Text>
            <View style={styles.settingsRow}>
              <TextInput
                value={obdHost}
                onChangeText={setObdHost}
                placeholder="Host IP"
                placeholderTextColor="#bbb"
                autoCapitalize="none"
                style={styles.settingsInput}
              />
              <TextInput
                value={obdPort}
                onChangeText={setObdPort}
                placeholder="Port"
                placeholderTextColor="#bbb"
                keyboardType="number-pad"
                style={styles.settingsInputSmall}
              />
            </View>
            <View style={styles.settingsRow}>
              <TouchableOpacity
                style={[styles.connectBtn, obdConnected && styles.connectBtnConnected]}
                onPress={handleObdConnect}
                disabled={obdConnected || obdConnecting}>
                {obdConnecting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.connectBtnText}>
                    {obdConnected ? t('common.connected') : t('common.connect')}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.disconnectBtn, !obdConnected && styles.btnDisabled]}
                onPress={handleObdDisconnect}
                disabled={!obdConnected}>
                <Text style={styles.disconnectBtnText}>{t('common.disconnect')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab Content - Switch Case */}
        {(() => {
          switch (activeTab) {
            case t('dashboard.engine'):
              return (
                <EngineTab
                  obdConnected={obdConnected}
                  obdRpm={obdRpm}
                  obdSpeedKmh={obdSpeedKmh}
                  livePolling={livePolling}
                  handleToggleLive={handleToggleLive}
                  handleReadRpm={handleReadRpm}
                  handleReadSpeed={handleReadSpeed}
                />
              );
            case t('dashboard.battery'):
              return <BatteryTab obdConnected={obdConnected} />;
            case t('dashboard.errorLog'):
              return (
                <ErrorLogTab
                  obdConnected={obdConnected}
                  dtcResults={dtcResults}
                  dtcScanning={dtcScanning}
                  handleScanDtc={handleScanDTCs}
                />
              );
            case t('dashboard.brakePad'):
              return <BrakePadTab obdConnected={obdConnected} />;
            case t('dashboard.abs'):
              return <ABSTab obdConnected={obdConnected} />;
            case t('dashboard.ac'):
              return <ACTab obdConnected={obdConnected} />;
            default:
              return (
                <EngineTab
                  obdConnected={obdConnected}
                  obdRpm={obdRpm}
                  obdSpeedKmh={obdSpeedKmh}
                  livePolling={livePolling}
                  handleToggleLive={handleToggleLive}
                  handleReadRpm={handleReadRpm}
                  handleReadSpeed={handleReadSpeed}
                />
              );
          }
        })()}

      </ScrollView>

      {/* Bottom Diagnostic button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.diagnosticBtn,
            (!obdConnected || dtcScanning || livePolling) && styles.btnDisabled,
          ]}
          onPress={handleScanDTCs}
          disabled={!obdConnected || dtcScanning || livePolling}>
          {dtcScanning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.diagnosticBtnText}>{t('dashboard.diagnostic')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Notification Modal */}
      <NotificationModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={hideModal}
      />

      {/* Language Selector */}
      <LanguageSelector
        visible={languageSelectorVisible}
        onClose={hideLanguageSelector}
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
  settingsBtn: {
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
  settingsBtnText: {
    color: '#1a1a1a',
    fontSize: 22,
    fontWeight: '300',
  },

  // Tabs
  tabsScroll: {
    marginTop: 12,
    marginBottom: 4,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 18,
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

  // Car Image
  carImageSection: {
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 220,
  },
  carImagePlaceholder: {
    width: '85%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  carEmoji: {
    fontSize: 80,
    marginBottom: 8,
  },
  carPlaceholderText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
  },

  // Shared card
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Bar gauge
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
  },
  barUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    minWidth: 36,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E8E8ED',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: '#C8E64A',
    borderRadius: 3,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginBottom: 6,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    fontVariant: ['tabular-nums'],
  },
  statusOn: {
    color: '#34C759',
  },
  statusOff: {
    color: '#999',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBtnText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '700',
  },

  // Settings
  settingsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  settingsInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  settingsInputSmall: {
    flex: 0.5,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  connectBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectBtnConnected: {
    backgroundColor: '#34C759',
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  disconnectBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },

  // DTC
  dtcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 12,
  },
  dtcCodeBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dtcCodeText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dtcDescText: {
    flex: 1,
    color: '#666',
    fontSize: 13,
    fontWeight: '400',
  },

  // Raw
  rawText: {
    color: '#888',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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

  // Shared
  btnDisabled: {
    opacity: 0.4,
  },
});

export default DashboardScreen;
