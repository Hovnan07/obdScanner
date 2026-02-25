import { create } from 'zustand';

interface DtcResult {
  code: string;
  description: string;
}

interface ObdState {
  // Connection
  obdHost: string;
  obdPort: string;
  obdConnected: boolean;
  obdConnecting: boolean;
  obdLastResponse: string;
  
  // Vehicle info
  vehicleVin: string | null;
  vehicleMake: string;
  vinReading: boolean;
  
  // Live data
  obdRpm: number | null;
  obdSpeedKmh: number | null;
  
  // DTC
  dtcResults: DtcResult[];
  dtcScanning: boolean;
  
  // UI state
  livePolling: boolean;
  showSettings: boolean;
  activeTab: string;
  
  // Modal notification
  modalVisible: boolean;
  modalType: 'success' | 'error' | 'info';
  modalTitle: string;
  modalMessage: string;
  
  // Language selector
  languageSelectorVisible: boolean;
  
  // User profile
  userFirstName: string;
  userLastName: string;
  userProfileImage: string | null;
  profileSetupComplete: boolean;
  profileEditVisible: boolean;
  
  // Actions
  setObdHost: (host: string) => void;
  setObdPort: (port: string) => void;
  setObdConnected: (connected: boolean) => void;
  setObdConnecting: (connecting: boolean) => void;
  setObdLastResponse: (response: string) => void;
  
  setVehicleVin: (vin: string | null) => void;
  setVehicleMake: (make: string) => void;
  setVinReading: (reading: boolean) => void;
  
  setObdRpm: (rpm: number | null) => void;
  setObdSpeedKmh: (speed: number | null) => void;
  
  setDtcResults: (results: DtcResult[]) => void;
  setDtcScanning: (scanning: boolean) => void;
  
  setLivePolling: (polling: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  
  showModal: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
  hideModal: () => void;
  
  showLanguageSelector: () => void;
  hideLanguageSelector: () => void;
  
  setUserFirstName: (name: string) => void;
  setUserLastName: (name: string) => void;
  setUserProfileImage: (uri: string | null) => void;
  setProfileSetupComplete: (complete: boolean) => void;
  setProfileEditVisible: (visible: boolean) => void;
  
  resetConnection: () => void;
}

export const useObdStore = create<ObdState>((set) => ({
  // Initial state
  obdHost: '192.168.0.10',
  obdPort: '35000',
  obdConnected: false,
  obdConnecting: false,
  obdLastResponse: '',
  
  vehicleVin: null,
  vehicleMake: 'My Car',
  vinReading: false,
  
  obdRpm: null,
  obdSpeedKmh: null,
  
  dtcResults: [],
  dtcScanning: false,
  
  livePolling: false,
  showSettings: true,
  activeTab: 'Engine',
  
  modalVisible: false,
  modalType: 'info',
  modalTitle: '',
  modalMessage: '',
  
  languageSelectorVisible: false,
  
  userFirstName: '',
  userLastName: '',
  userProfileImage: null,
  profileSetupComplete: false,
  profileEditVisible: false,
  
  // Actions
  setObdHost: (host) => set({ obdHost: host }),
  setObdPort: (port) => set({ obdPort: port }),
  setObdConnected: (connected) => set({ obdConnected: connected }),
  setObdConnecting: (connecting) => set({ obdConnecting: connecting }),
  setObdLastResponse: (response) => set({ obdLastResponse: response }),
  
  setVehicleVin: (vin) => set({ vehicleVin: vin }),
  setVehicleMake: (make) => set({ vehicleMake: make }),
  setVinReading: (reading) => set({ vinReading: reading }),
  
  setObdRpm: (rpm) => set({ obdRpm: rpm }),
  setObdSpeedKmh: (speed) => set({ obdSpeedKmh: speed }),
  
  setDtcResults: (results) => set({ dtcResults: results }),
  setDtcScanning: (scanning) => set({ dtcScanning: scanning }),
  
  setLivePolling: (polling) => set({ livePolling: polling }),
  setShowSettings: (show) => set({ showSettings: show }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  showModal: (type, title, message) => set({
    modalVisible: true,
    modalType: type,
    modalTitle: title,
    modalMessage: message,
  }),
  hideModal: () => set({ modalVisible: false }),
  
  showLanguageSelector: () => set({ languageSelectorVisible: true }),
  hideLanguageSelector: () => set({ languageSelectorVisible: false }),
  
  setUserFirstName: (name) => set({ userFirstName: name }),
  setUserLastName: (name) => set({ userLastName: name }),
  setUserProfileImage: (uri) => set({ userProfileImage: uri }),
  setProfileSetupComplete: (complete) => set({ profileSetupComplete: complete }),
  setProfileEditVisible: (visible) => set({ profileEditVisible: visible }),
  
  resetConnection: () => set({
    obdConnected: false,
    obdLastResponse: '',
    obdRpm: null,
    obdSpeedKmh: null,
    dtcResults: [],
    livePolling: false,
  }),
}));
