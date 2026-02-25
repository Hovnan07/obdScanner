import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  visible: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'hy', name: 'Հայերեն', flag: '🇦🇲' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ visible, onClose }) => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Select Language</Text>
          
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                i18n.language === lang.code && styles.languageButtonActive,
              ]}
              onPress={() => handleLanguageChange(lang.code)}
              activeOpacity={0.7}>
              <Text style={styles.flag}>{lang.flag}</Text>
              <Text style={[
                styles.languageName,
                i18n.language === lang.code && styles.languageNameActive,
              ]}>
                {lang.name}
              </Text>
              {i18n.language === lang.code && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  languageButtonActive: {
    backgroundColor: '#1a1a1a',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  languageNameActive: {
    color: '#FFFFFF',
  },
  checkmark: {
    fontSize: 20,
    color: '#34C759',
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default LanguageSelector;
