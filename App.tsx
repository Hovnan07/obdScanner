import React from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';
import { useObdStore } from './src/store/obdStore';
import './src/i18n';

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

function App() {
  const profileSetupComplete = useObdStore((state) => state.profileSetupComplete);
  const profileEditVisible = useObdStore((state) => state.profileEditVisible);

  if (!profileSetupComplete) {
    return <ProfileSetupScreen />;
  }

  if (profileEditVisible) {
    return <ProfileEditScreen />;
  }

  return <DashboardScreen />;
}

export default App;

