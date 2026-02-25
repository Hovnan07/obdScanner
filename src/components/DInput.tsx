import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface DInputProps<T extends FieldValues> extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
}

function DInput<T extends FieldValues>({
  name,
  control,
  label,
  ...textInputProps
}: DInputProps<T>) {
  const { t } = useTranslation();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          {label && <Text style={styles.label}>{label}</Text>}
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholderTextColor="#bbb"
            {...textInputProps}
          />
          {error?.message && (
            <Text style={styles.errorText}>{t(error.message)}</Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
  },
});

export default DInput;
