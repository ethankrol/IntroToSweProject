import React, { useMemo, useState } from 'react';
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
import { saveEvent } from '../services/events';
import { EventUpsertPayload, EventResponse } from '../services/models/event_models';

type EventFields = {
  _id?: string;
  name: string;
  description?: string;
  location_name?: string;
  // UI-only helpers
  date: string;
  startTime: string;
  endTime: string;
  lng: string; // longitude
  lat: string; // latitude
  delegate_join_code: string;
  volunteer_join_code: string;
};

export default function EditEventScreen({ route, navigation }: any) {
  const incoming = route?.params?.event;
  // Try to normalize incoming event (support either old shape or new backend shape)
  const initial: EventFields = useMemo(() => {
    if (!incoming) {
      return {
        _id: undefined,
        name: '',
        description: '',
        location_name: '',
        date: '',
        startTime: '',
        endTime: '',
        lng: '',
        lat: '',
        delegate_join_code: '',
        volunteer_join_code: '',
      };
    }
    // New shape from backend
    if (incoming.name) {
      const startISO: string | undefined = incoming.start_date;
      const endISO: string | undefined = incoming.end_date;
      const startD = startISO ? new Date(startISO) : undefined;
      const endD = endISO ? new Date(endISO) : undefined;
      const coords: [number, number] | undefined = incoming.location?.coordinates;
      return {
        _id: incoming._id || incoming.id,
        name: incoming.name || '',
        description: incoming.description || '',
        location_name: incoming.location_name || '',
        date: startD ? formatDateLocal(startD) : '',
        startTime: startD ? formatTime(startD) : '',
        endTime: endD ? formatTime(endD) : '',
        lng: coords && coords.length === 2 ? String(coords[0]) : '',
        lat: coords && coords.length === 2 ? String(coords[1]) : '',
        delegate_join_code: incoming.delegate_join_code || '',
        volunteer_join_code: incoming.volunteer_join_code || '',
      };
    }
    // Old shape fallback (title/date/startTime/endTime/location)
    return {
      _id: incoming._id || incoming.id,
      name: incoming.title || '',
      description: incoming.description || '',
      location_name: incoming.location || '',
      date: incoming.date || '',
      startTime: incoming.startTime || '',
      endTime: incoming.endTime || '',
      lng: '',
      lat: '',
      delegate_join_code: '',
      volunteer_join_code: '',
    };
  }, [incoming]);

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

  const onSave = async () => {
    try {
      const start = new Date(
        `${formatDateLocal(date)}T${formatTime(startTime)}:00`
      );
      const end = new Date(
        `${formatDateLocal(date)}T${formatTime(endTime)}:00`
      );

      if (!fields.name) {
        Alert.alert('Validation', 'Please enter a name.');
        return;
      }
      const lngNum = Number(fields.lng);
      const latNum = Number(fields.lat);
      if (!Number.isFinite(lngNum) || !Number.isFinite(latNum)) {
        Alert.alert('Validation', 'Please enter valid coordinates.');
        return;
      }

      const payload: EventUpsertPayload = {
        ...(fields._id ? { _id: fields._id } : {}),
        name: fields.name,
        description: fields.description || undefined,
        location: {
          type: 'Point',
          coordinates: [lngNum, latNum],
        },
        location_name: fields.location_name || undefined,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        // If left empty, backend will auto-generate
        ...(fields.delegate_join_code ? { delegate_join_code: fields.delegate_join_code } : {}),
        ...(fields.volunteer_join_code ? { volunteer_join_code: fields.volunteer_join_code } : {}),
      };

      const saved: EventResponse = await saveEvent(payload);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Alert.alert('Success', `Event ${fields._id ? 'updated' : 'created'} successfully.`);
      navigation.goBack?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save event');
    }
  };
  const onCancel = () => navigation.goBack?.();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>{fields._id ? 'Edit Event' : 'Create Event'}</Text>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={fields.name}
        onChangeText={t => setFields(f => ({ ...f, name: t }))}
        placeholder="Event name"
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

      {/* Location Name */}
      <Text style={styles.label}>Location Name</Text>
      <TextInput
        style={styles.input}
        value={fields.location_name || ''}
        onChangeText={t => setFields(f => ({ ...f, location_name: t }))}
        placeholder="Location name (optional)"
      />

      {/* Coordinates */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={fields.lng}
            onChangeText={t => setFields(f => ({ ...f, lng: t }))}
            placeholder="e.g. -73.9857"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={fields.lat}
            onChangeText={t => setFields(f => ({ ...f, lat: t }))}
            placeholder="e.g. 40.7484"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

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

      {/* Join Codes */}
      <Text style={styles.label}>Delegate Join Code</Text>
      <TextInput
        style={styles.input}
        value={fields.delegate_join_code}
        onChangeText={t => setFields(f => ({ ...f, delegate_join_code: t }))}
        placeholder="Delegate join code"
      />
      <Text style={styles.label}>Volunteer Join Code</Text>
      <TextInput
        style={styles.input}
        value={fields.volunteer_join_code}
        onChangeText={t => setFields(f => ({ ...f, volunteer_join_code: t }))}
        placeholder="Volunteer join code"
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
