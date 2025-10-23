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
      // Placeholder: call your backend endpoint /auth/request-reset
      // Example using fetch:
      // await fetch('http://<YOUR_BACKEND>/auth/request-reset', { method: 'POST', body: JSON.stringify({ email }), headers: { 'Content-Type': 'application/json' } });

      // For now, show a success message
      Alert.alert('If that email exists, an email has been sent with reset instructions.');
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Error sending reset email');
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
