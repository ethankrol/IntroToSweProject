import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';

export default function ResetPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const onRequestReset = async () => {
    if (!email) {
      Alert.alert('Please enter an email');
      return;
    }

    try {
      setSending(true);
      // Call backend to request password reset
      const response = await fetch('http://localhost:8000/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Unable to send reset email');
        return;
      }

      Alert.alert('Success', 'A password reset email has been sent to your email address.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Unable to connect to server. Please try again later.');
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
