import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  Button,
  ScrollView,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import dtcCodesRaw from './codes.json';

const manager = new BleManager();

const dtcLookup: Record<string, string> = {};
for (const entry of dtcCodesRaw as Array<{ Code: string; Description: string }>) {
  const code = entry.Code.replace(/\/.*$/, '').trim().toUpperCase();
  dtcLookup[code] = entry.Description;
}
const RSSI_THRESHOLD = -70;

export const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      const locationGranted =
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

      return scanGranted && connectGranted && locationGranted;
    } else {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  return true;
};

export const startScan = (onDeviceFound: any) => {
  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.log('Scan error:', error);
      return;
    }

    if (device?.name) {
      console.log('Found device:', device.name);
      onDeviceFound(device);
    }
  });
};

export const stopScan = () => {
  manager.stopDeviceScan();
};

export const connectToDevice = async (device: any) => {
  const connectedDevice = await manager.connectToDevice(device.id);
  await connectedDevice.discoverAllServicesAndCharacteristics();
  console.log('Connected device:', connectedDevice);
  return connectedDevice;
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [obdHost, setObdHost] = useState('192.168.0.10');
  const [obdPort, setObdPort] = useState('35000');
  const [obdConnected, setObdConnected] = useState(false);
  const [obdLastResponse, setObdLastResponse] = useState('');
  const [obdRpm, setObdRpm] = useState<number | null>(null);
  const [obdSpeedKmh, setObdSpeedKmh] = useState<number | null>(null);
  const [dtcResults, setDtcResults] = useState<Array<{ code: string; description: string }>>([]);
  const [dtcScanning, setDtcScanning] = useState(false);
  const [livePolling, setLivePolling] = useState(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const obdSocketRef = useRef<any>(null);
  const obdBufferRef = useRef('');
  const obdPendingRef = useRef<null | { resolve: (s: string) => void; reject: (e: any) => void }>(null);

  useEffect(() => {
    requestPermissions();

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      manager.stopDeviceScan();
      manager.destroy();

      if (obdSocketRef.current) {
        try {
          obdSocketRef.current.destroy();
        } catch (_) {
          // ignore
        }
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
    // Expect: 41 0C A B
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
    // Expect: 41 0D A
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
      if (!obdSocketRef.current) {
        reject(new Error('Not connected'));
        return;
      }

      if (obdPendingRef.current) {
        reject(new Error('Another command is in progress'));
        return;
      }

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
        resolve: (s) => {
          clearTimeout(timer);
          originalResolve(s);
        },
        reject: (e) => {
          clearTimeout(timer);
          originalReject(e);
        },
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
    await obdSend('ATZ', 5000);
    await obdSend('ATE0');
    await obdSend('ATL0');
    await obdSend('ATS0');
    await obdSend('ATH0');
    await obdSend('ATSP0');
  };

  const handleObdConnect = async () => {
    try {
      const portNum = Number(obdPort);
      if (!obdHost || !Number.isFinite(portNum)) {
        Alert.alert('Invalid host/port', 'Please enter a valid OBD Wi‑Fi host and port.');
        return;
      }

      if (obdSocketRef.current) {
        try {
          obdSocketRef.current.destroy();
        } catch (_) {
          // ignore
        }
        obdSocketRef.current = null;
      }

      setObdLastResponse('');
      setObdRpm(null);
      setObdSpeedKmh(null);
      obdBufferRef.current = '';

      const socket = TcpSocket.createConnection(
        { host: obdHost, port: portNum },
        async () => {
          setObdConnected(true);
          try {
            const data = await obdInit();
            console.log('OBD init:', data);
            setObdLastResponse('OBD ready');
          } catch (e) {
            setObdLastResponse(`Connected, init failed: ${String(e)}`);
          }
        }
      );

      socket.on('data', obdHandleData);
      socket.on('error', (e: any) => {
        setObdLastResponse(`Socket error: ${String(e)}`);
        setObdConnected(false);
      });
      socket.on('close', () => {
        setObdConnected(false);
      });

      obdSocketRef.current = socket;
    } catch (e) {
      Alert.alert('OBD connect failed', String(e));
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
      if (obdSocketRef.current) {
        obdSocketRef.current.destroy();
      }
    } catch (_) {
      // ignore
    } finally {
      obdSocketRef.current = null;
      setObdConnected(false);
    }
  };

  const handleReadRpm = async () => {
    try {
      const resp = await obdSend('010C');
      console.log('RPM:', resp);
      const rpm = parseRpmFrom010C(resp);
      console.log('RPM:', rpm);
      setObdRpm(rpm);
      setObdLastResponse(resp);
    } catch (e) {
      Alert.alert('RPM failed', String(e));
    }
  };

  const handleReadSpeed = async () => {
    try {
      const resp = await obdSend('010D');
      console.log('Speed:', resp);
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
    } catch (_) {
      // ignore single poll failure
    }
    try {
      const speedResp = await obdSend('010D');
      const speed = parseSpeedFrom010D(speedResp);
      setObdSpeedKmh(speed);
    } catch (_) {
      // ignore single poll failure
    }
  };

  const handleToggleLive = () => {
    if (livePolling) {
      stopLivePolling();
      return;
    }

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
      console.log('DTC raw:', resp);
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

  const ensureBluetoothPoweredOn = async () => {
    const currentState = await manager.state();
    if (currentState === 'PoweredOn') return true;

    return await new Promise<boolean>((resolve) => {
      const subscription = manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          subscription.remove();
          resolve(true);
        }
      }, true);

      Alert.alert('Bluetooth is off', 'Please enable Bluetooth to scan for devices.', [
        {
          text: 'OK',
          onPress: () => {
            subscription.remove();
            resolve(false);
          },
        },
      ]);
    });
  };

  const startScanInUi = () => {
    setDevices([]);
    setIsScanning(true);

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        setIsScanning(false);
        console.log('Scan error:', error);
        return;
      }

      if (!device?.name) return;
      console.log('Found device:', device);
      if (!device.isConnectable) return;
      if (typeof device.rssi === 'number' && device.rssi < RSSI_THRESHOLD) return;

      setDevices((prev) => {
        if (prev.some((d) => d.id === device.id)) return prev;
        return [...prev, device];
      });
    });

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    scanTimeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      scanTimeoutRef.current = null;
    }, 10000);
  };

  const handleScan = () => {
    (async () => {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permissions required', 'Bluetooth permissions are required to scan.');
        return;
      }

      const btOn = await ensureBluetoothPoweredOn();
      if (!btOn) return;

      startScanInUi();
    })();
  };

  const handleStopScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    manager.stopDeviceScan();
    setIsScanning(false);
  };

  const handleConnect = async (device: any) => {
    try {
      await connectToDevice(device);
      Alert.alert('Connected', device.name ?? device.localName ?? device.id);
    } catch (e) {
      Alert.alert('Connection failed', String(e));
    }
  };

  console.log('Devices:', devices,{obdConnected});

  return (
    <ScrollView style={styles.loadingContainer} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>Wi‑Fi OBD</Text>
      <View style={styles.row}>
        <TextInput
          value={obdHost}
          onChangeText={setObdHost}
          placeholder="Host"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={obdPort}
          onChangeText={setObdPort}
          placeholder="Port"
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>
      <View style={styles.row}>
        <Button title={obdConnected ? 'Connected' : 'Connect'} onPress={handleObdConnect} disabled={obdConnected} />
        <View style={styles.rowSpacer} />
        <Button title="Disconnect" onPress={handleObdDisconnect} disabled={!obdConnected} />
      </View>
      <View style={styles.dashboard}>
        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>RPM</Text>
          <Text style={styles.gaugeValue}>{obdRpm === null ? '—' : Math.round(obdRpm)}</Text>
        </View>
        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>km/h</Text>
          <Text style={styles.gaugeValue}>{obdSpeedKmh === null ? '—' : obdSpeedKmh}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Button
          title={livePolling ? 'Stop Live' : 'Start Live'}
          onPress={handleToggleLive}
          disabled={!obdConnected}
          color={livePolling ? '#c00' : '#007AFF'}
        />
        <View style={styles.rowSpacer} />
        <Button title="Read RPM" onPress={handleReadRpm} disabled={!obdConnected || livePolling} />
        <View style={styles.rowSpacer} />
        <Button title="Read Speed" onPress={handleReadSpeed} disabled={!obdConnected || livePolling} />
      </View>
      <View style={styles.row}>
        <Button
          title={dtcScanning ? 'Scanning...' : 'Scan Trouble Codes'}
          onPress={handleScanDTCs}
          disabled={!obdConnected || dtcScanning || livePolling}
        />
      </View>
      <Text style={styles.obdResponse}>Raw: {obdLastResponse}</Text>

      {dtcResults.length > 0 && (
        <View style={styles.dtcContainer}>
          <Text style={styles.sectionTitle}>Trouble Codes</Text>
          {dtcResults.map((item, idx) => (
            <View key={idx} style={styles.dtcRow}>
              <Text style={styles.dtcCode}>{item.code}</Text>
              <Text style={styles.dtcDesc}>{item.description}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.spacer} />
      {/* <Text style={styles.sectionTitle}>BLE Scan</Text> */}
      {/* <Button title={isScanning ? 'Scanning…' : 'Scan BLE Devices'} onPress={handleScan} disabled={isScanning} /> */}
      <View style={styles.spacer} />
      {/* <Button title="Stop Scan" onPress={handleStopScan} disabled={!isScanning} />

      <View style={styles.spacer} />
      {isScanning ? <ActivityIndicator /> : null}

      <View style={styles.spacer} />
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceRow} onPress={() => handleConnect(item)}>
            <Text style={styles.deviceName}>{item.name ?? item.localName ?? 'Unknown'}</Text>
            <Text style={styles.deviceId}>{item.id}</Text>
            <Text style={styles.deviceId}>RSSI: {typeof item.rssi === 'number' ? item.rssi : 'n/a'}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No devices yet</Text>}
      /> */}
    </ScrollView>

  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  dashboard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  gaugeBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 6,
    borderRadius: 12,
    paddingVertical: 20,
  },
  gaugeLabel: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  gaugeValue: {
    color: '#0f0',
    fontSize: 42,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowSpacer: {
    width: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  obdResponse: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    minHeight: 48,
    marginBottom: 12,
  },
  spacer: {
    height: 12,
  },
  deviceRow: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceId: {
    marginTop: 4,
    color: '#666',
    fontSize: 12,
  },
  emptyText: {
    marginTop: 16,
    color: '#666',
  },
  dtcContainer: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dtcRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dtcCode: {
    fontWeight: '700',
    fontSize: 14,
    width: 70,
    color: '#c00',
  },
  dtcDesc: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
});

export default App;





