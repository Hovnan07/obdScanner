import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useObdStore } from '../store/obdStore';
import ProfileAvatar from '../components/ProfileAvatar';
import DInput from '../components/DInput';
import LanguageSelector from '../components/LanguageSelector';
import { profileSchema, ProfileFormData } from '../validation/profileSchema';

const ProfileSetupScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    setUserFirstName,
    setUserLastName,
    setUserProfileImage,
    setProfileSetupComplete,
    languageSelectorVisible,
    showLanguageSelector,
    hideLanguageSelector,
  } = useObdStore();

  const [imageUri, setImageUri] = useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { isValid } } = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '' },
    mode: 'onChange',
  });

  const watchFirstName = watch('firstName');
  const watchLastName = watch('lastName');

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 512,
      maxHeight: 512,
    });

    if (result.assets && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onSubmit = (data: ProfileFormData) => {
    setUserFirstName(data.firstName.trim());
    setUserLastName(data.lastName.trim());
    setUserProfileImage(imageUri);
    setProfileSetupComplete(true);
  };

  const handleSkip = () => {
    setUserFirstName('User');
    setUserLastName('Guest');
    setUserProfileImage(null);
    setProfileSetupComplete(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />
      
      {/* Language button in top-right */}
      <View style={styles.topBar}>
        <View style={styles.placeholder} />
        <TouchableOpacity
          style={styles.languageBtn}
          onPress={showLanguageSelector}>
          <Text style={styles.languageBtnText}>🌐</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <View style={styles.topSection}>
            <Text style={styles.welcomeEmoji}>🚗</Text>
            <Text style={styles.title}>{t('profile.welcome')}</Text>
            <Text style={styles.subtitle}>{t('profile.subtitle')}</Text>
          </View>

          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
              <ProfileAvatar
                firstName={watchFirstName}
                lastName={watchLastName}
                imageUri={imageUri}
                size={120}
              />
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>{t('profile.tapToUpload')}</Text>
          </View>

          <View style={styles.formSection}>
            <DInput<ProfileFormData>
              name="firstName"
              control={control}
              label={t('profile.firstName')}
              placeholder={t('profile.firstNamePlaceholder')}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <DInput<ProfileFormData>
              name="lastName"
              control={control}
              label={t('profile.lastName')}
              placeholder={t('profile.lastNamePlaceholder')}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid}
            activeOpacity={0.8}>
            <Text style={styles.continueBtnText}>{t('profile.continue')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>{t('profile.skipRegistration')}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 8,
  },
  placeholder: {
    width: 40,
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraIconText: {
    fontSize: 18,
  },
  photoHint: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 12,
  },
  formSection: {
    marginBottom: 32,
  },
  continueBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skipBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipBtnText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default ProfileSetupScreen;
