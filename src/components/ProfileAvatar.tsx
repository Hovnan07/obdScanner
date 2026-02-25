import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface ProfileAvatarProps {
  firstName: string;
  lastName: string;
  imageUri: string | null;
  size?: number;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  firstName,
  lastName,
  imageUri,
  size = 44,
}) => {
  const initials =
    (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '?';

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const textSize = size * 0.4;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.image, containerStyle]}
      />
    );
  }

  return (
    <View style={[styles.initialsContainer, containerStyle]}>
      <Text style={[styles.initialsText, { fontSize: textSize }]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  initialsContainer: {
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default ProfileAvatar;
