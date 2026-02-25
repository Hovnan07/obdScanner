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
import { profileSchema, ProfileFormData } from '../validation/profileSchema';

const ProfileEditScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    userFirstName,
    userLastName,
    userProfileImage,
    setUserFirstName,
    setUserLastName,
    setUserProfileImage,
    setProfileEditVisible,
  } = useObdStore();

  const [imageUri, setImageUri] = useState<string | null>(userProfileImage);

  const { control, handleSubmit, watch, formState: { isValid } } = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: { firstName: userFirstName, lastName: userLastName },
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

  const handleRemovePhoto = () => {
    setImageUri(null);
  };

  const onSubmit = (data: ProfileFormData) => {
    setUserFirstName(data.firstName.trim());
    setUserLastName(data.lastName.trim());
    setUserProfileImage(imageUri);
    setProfileEditVisible(false);
  };

  const handleBack = () => {
    setProfileEditVisible(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{t('profile.editProfile')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Avatar section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
              <ProfileAvatar
                firstName={watchFirstName}
                lastName={watchLastName}
                imageUri={imageUri}
                size={100}
              />
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.photoActions}>
              <TouchableOpacity onPress={handlePickImage} style={styles.photoActionBtn}>
                <Text style={styles.photoActionText}>{t('profile.changePhoto')}</Text>
              </TouchableOpacity>
              {imageUri && (
                <TouchableOpacity onPress={handleRemovePhoto} style={styles.photoActionBtn}>
                  <Text style={[styles.photoActionText, styles.removeText]}>
                    {t('profile.removePhoto')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Form */}
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
            style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid}
            activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>{t('profile.save')}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
    backgroundColor: '#F2F2F7',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 24,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 16,
  },
  photoActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  photoActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  photoActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#42C83C',
  },
  removeText: {
    color: '#FF3B30',
  },
  formSection: {
    marginBottom: 32,
  },
  saveBtn: {
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
  saveBtnDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default ProfileEditScreen;
