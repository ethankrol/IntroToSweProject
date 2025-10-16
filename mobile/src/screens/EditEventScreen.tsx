import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';

type EventFields = {
  title: string;
  date: string;
  location: string;
  description: string;
};

export default function EditEventScreen({ route, navigation }: any) {
  // prefill if necessary
  const initial: EventFields = route?.params?.event ?? {
    title: '',
    date: '',
    location: '',
    description: ''
  };

  const [fields, setFields] = useState<EventFields>(initial);

  const onSave = () => {
    // have to connect to API
    Alert.alert('Save', `Saving event: ${fields.title}`);
  };

  const onCancel = () => {
    navigation.goBack?.();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Edit Event</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={fields.title}
        onChangeText={(t) => setFields({ ...fields, title: t })}
        placeholder="Event title"
      />

      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        value={fields.date}
        onChangeText={(t) => setFields({ ...fields, date: t })}
        placeholder="YYYY-MM-DD or free text"
      />

      <Text style={styles.label}>Location</Text>
      <TextInput
        style={styles.input}
        value={fields.location}
        onChangeText={(t) => setFields({ ...fields, location: t })}
        placeholder="Location"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={fields.description}
        onChangeText={(t) => setFields({ ...fields, description: t })}
        placeholder="Description"
        multiline
        numberOfLines={4}
      />

      <View style={styles.buttonRow}>
        <Button title="Save" onPress={onSave} />
        <View style={styles.buttonSpacer} />
        <Button title="Cancel" onPress={onCancel} color="#888" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff'
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  label: {
    marginTop: 10,
    fontSize: 14,
    color: '#222'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    color: '#000'
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
    justifyContent: 'center'
  },
  buttonSpacer: {
    width: 12
  }
});
