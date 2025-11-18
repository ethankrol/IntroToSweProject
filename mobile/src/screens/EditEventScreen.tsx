import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type EventFields = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
};

export default function EditEventScreen({ route, navigation }: any) {
  const initial: EventFields = route?.params?.event ?? {
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    lat?: number;
    lng?: number;
  };

  // Enable LayoutAnimation on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const [fields, setFields] = useState<EventFields>(initial);
  const [date, setDate] = useState(initial.date ? new Date(initial.date) : new Date());
  const [startTime, setStartTime] = useState(
    initial.startTime ? new Date(`1970-01-01T${initial.startTime}:00`) : new Date()
  );
  const [endTime, setEndTime] = useState(
    initial.endTime ? new Date(`1970-01-01T${initial.endTime}:00`) : new Date()
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  React.useEffect(() => {
  const loc = route?.params?.pickedLocation;
  if (loc) {
    setFields(f => ({
      ...f,
      location: loc.address,
      lat: loc.lat,
      lng: loc.lng,
    }));
  }
}, [route?.params?.pickedLocation]);


  const toggleDatePicker = () => {
    setShowDatePicker(prev => !prev);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const toggleStartPicker = () => {
    setShowStartPicker(prev => !prev);
    setShowDatePicker(false);
    setShowEndPicker(false);
  };

  const toggleEndPicker = () => {
    setShowEndPicker(prev => !prev);
    setShowDatePicker(false);
    setShowStartPicker(false);
  };

  const onChangeDate = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setFields(f => ({ ...f, date: formatDateLocal(selectedDate) }));
    }
  };

  const onChangeStart = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (selectedDate) {
      setStartTime(selectedDate);
      setFields(f => ({ ...f, startTime: formatTime(selectedDate) }));
    }
  };

  const onChangeEnd = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (selectedDate) {
      setEndTime(selectedDate);
      setFields(f => ({ ...f, endTime: formatTime(selectedDate) }));
    }
  };

  const onSave = () => {
    Alert.alert('Save', `Saving event: ${fields.title}`);
  };
  const onCancel = () => navigation.goBack?.();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Edit Event</Text>

      {/* Title */}
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={fields.title}
        onChangeText={t => setFields(f => ({ ...f, title: t }))}
        placeholder="Event title"
      />

      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <TouchableOpacity style={styles.dateBox} onPress={toggleDatePicker}>
        <Text style={styles.dateText}>{fields.date || 'Tap to choose a date'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker value={date} mode="date" display="spinner" onChange={onChangeDate} />
      )}

      {/* Start & End Time side by side */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>Start Time</Text>
          <TouchableOpacity style={styles.dateBox} onPress={toggleStartPicker}>
            <Text style={styles.dateText}>{fields.startTime || 'Tap to choose'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity style={styles.dateBox} onPress={toggleEndPicker}>
            <Text style={styles.dateText}>{fields.endTime || 'Tap to choose'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reserved space for spinners to avoid glitches */}
      <View>
        {showStartPicker && (
          <DateTimePicker value={startTime} mode="time" display="spinner" onChange={onChangeStart} />
        )}
        {showEndPicker && (
          <DateTimePicker value={endTime} mode="time" display="spinner" onChange={onChangeEnd} />
        )}
      </View>

      {/* Location */}
      <Text style={styles.label}>Location</Text>
      <TextInput
        style={styles.input}
        value={fields.location}
        onChangeText={t => setFields(f => ({ ...f, location: t }))}
        placeholder="Location"
      />

      <TouchableOpacity
        style={{
          marginTop: 8,
          padding: 12,
          backgroundColor: "#2563eb",
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() =>
          navigation.navigate("LocationPicker" as never, {
            lat: fields.lat,
            lng: fields.lng,
            address: fields.location,
            // where to come back to, optional
          } as never)
        }
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Choose on map</Text>
        </TouchableOpacity>

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={fields.description}
        onChangeText={t => setFields(f => ({ ...f, description: t }))}
        placeholder="Description"
        multiline
        numberOfLines={4}
      />

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Button title="Save" onPress={onSave} />
        <View style={styles.buttonSpacer} />
        <Button title="Cancel" onPress={onCancel} color="#888" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  label: { marginTop: 16, fontSize: 14, color: '#222' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginTop: 6, color: '#000' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  dateBox: { borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f2f2f2', padding: 12, borderRadius: 8, marginTop: 6 },
  dateText: { fontSize: 16, color: '#000' },
  buttonRow: { flexDirection: 'row', marginTop: 22, justifyContent: 'center' },
  buttonSpacer: { width: 12 },
});
