import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface NotificationModalProps {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
}) => {
  const { t } = useTranslation();
  
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ⓘ';
      default:
        return '';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#34C759';
      case 'error':
        return '#FF3B30';
      case 'info':
        return '#007AFF';
      default:
        return '#999';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={[styles.iconCircle, { backgroundColor: getIconColor() + '20' }]}>
            <Text style={[styles.iconText, { color: getIconColor() }]}>
              {getIcon()}
            </Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: getIconColor() }]}
            onPress={onClose}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>{t('common.ok')}</Text>
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
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 32,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default NotificationModal;
