import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { API_BASE_URL } from '../config';

export default function ResetPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const onRequestReset = async () => {
  if (!email) {
    Alert.alert('Please enter an email');
    return;
  }

  // Navigate immediately to SetPasswordScreen (without token)
  navigation.navigate('SetPasswordScreen');

  // Optionally, still send the request in the background
  try {
    setSending(true);
    await fetch(`${API_BASE_URL}/request-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    // You can show a message or handle errors if needed
  } catch (err) {
    // Handle error if needed
  } finally {
    setSending(false);
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Reset password</Text>
      <Text style={styles.label}>Enter the email address for your account</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        autoCapitalize="none"
      />
      <Button title={sending ? 'Sending...' : 'Send reset email'} onPress={onRequestReset} disabled={sending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff'
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12
  },
  label: {
    marginBottom: 6,
    color: '#333'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 12,
    borderRadius: 8
  }
});