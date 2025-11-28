import React, { useMemo, useState, useEffect } from 'react';
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
  location: { type: 'Point'; coordinates: [number | undefined, number | undefined] };
  location_name?: string;
  start_date?: string;
  end_date?: string; 
  delegate_join_code?: string;
  volunteer_join_code?: string;
};

export default function EditEventScreen({ route, navigation }: any) {


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

    const incoming = route?.params?.event;

    const initial: EventFields = useMemo(() => {
      if (!incoming) {
        return {
          name: '',
          description: '',
          location: { type: 'Point', coordinates: [undefined, undefined] },
          location_name: '',
          start_date: undefined,
          end_date: undefined,
          delegate_join_code: '',
          volunteer_join_code: '',
        };
      }
      const coords: [number | undefined, number | undefined] = incoming.location?.coordinates ?? [undefined, undefined];
      return {
        _id: incoming._id || incoming.id,
        name: incoming.name ?? '',
        description: incoming.description ?? '',
        location: { type: 'Point', coordinates: [coords[0], coords[1]] },
        location_name: incoming.location_name ?? '',
        start_date: incoming.start_date,
        end_date: incoming.end_date,
        delegate_join_code: incoming.delegate_join_code ?? '',
        volunteer_join_code: incoming.volunteer_join_code ?? '',
      };
    }, [incoming]);

  const [fields, setFields] = useState<EventFields>(initial);
  const [date, setDate] = useState(initial.start_date ? new Date(initial.start_date) : new Date());
  const [startTime, setStartTime] = useState(
    initial.start_date ? new Date(initial.start_date) : new Date()
  );
  const [endTime, setEndTime] = useState(
    initial.end_date ? new Date(initial.end_date) : new Date()
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // When returning from LocationPickerScreen, update location fields
  useEffect(() => {
    const picked = route?.params?.pickedLocation;
    if (picked && picked.coordinates && Array.isArray(picked.coordinates)) {
      const [lng, lat] = picked.coordinates;
      setFields(f => ({
        ...f,
        location_name: picked.location_name ?? f.location_name ?? '',
        location: { type: 'Point', coordinates: [lng, lat] }
      }));
      // Clear the param so it doesn't reapply on re-render
      if (navigation?.setParams) navigation.setParams({ pickedLocation: undefined });
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
    }
  };

  const onChangeStart = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (selectedDate) {
      setStartTime(selectedDate);
    }
  };

  const onChangeEnd = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (selectedDate) {
      setEndTime(selectedDate);
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

      const name = (fields.name ?? '').trim();
      if (!name) {
        Alert.alert('Validation', 'Please enter a name.');
        return;
      }
      const lngNum = fields.location.coordinates[0] ?? NaN;
      const latNum = fields.location.coordinates[1] ?? NaN;
      if (!Number.isFinite(lngNum) || !Number.isFinite(latNum)) {
        Alert.alert('Validation', 'Please enter valid coordinates.');
        return;
      }

      const payload: EventUpsertPayload = {
        ...(fields._id ? { _id: fields._id } : {}),
        name,
        description: fields.description || undefined,
        location: { type: 'Point', coordinates: [lngNum, latNum] },
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

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={fields.name}
        onChangeText={t => setFields(f => ({ ...f, name: t }))}
        placeholder="Event name"
      />

      <Text style={styles.label}>Date</Text>
      <TouchableOpacity style={styles.dateBox} onPress={toggleDatePicker}>
        <Text style={styles.dateText}>{fields.start_date ? formatDateLocal(new Date(fields.start_date)) : 'Tap to choose a date'}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker value={date} mode="date" display="spinner" onChange={onChangeDate} />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>Start Time</Text>
          <TouchableOpacity style={styles.dateBox} onPress={toggleStartPicker}>
            <Text style={styles.dateText}>{formatTime(startTime)}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity style={styles.dateBox} onPress={toggleEndPicker}>
            <Text style={styles.dateText}>{formatTime(endTime)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        {showStartPicker && (
          <DateTimePicker value={startTime} mode="time" display="spinner" onChange={onChangeStart} />
        )}
        {showEndPicker && (
          <DateTimePicker value={endTime} mode="time" display="spinner" onChange={onChangeEnd} />
        )}
      </View>

      <Text style={styles.label}>Location Name</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TextInput
        style={styles.input}
        value={fields.location_name || ''}
        onChangeText={t => setFields(f => ({ ...f, location_name: t }))}
        placeholder="Location name (optional)"
      />
        <TouchableOpacity
          style={[styles.dateBox, { paddingVertical: 10, marginTop: 6 }]}
          onPress={() => {
            navigation.navigate?.('LocationPicker', {
              initialQuery: fields.location_name || '',
              initialCoords: fields.location?.coordinates,
            });
          }}
        >
          <Text style={styles.dateText}>Pick Location</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={fields.location.coordinates[0] != null ? String(fields.location.coordinates[0]) : ''}
            onChangeText={t => setFields(f => ({ ...f, location: { ...f.location, coordinates: [t ? Number(t) : undefined, f.location.coordinates[1]] } }))}
            placeholder="e.g. -73.9857"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ width: '48%' }}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={fields.location.coordinates[1] != null ? String(fields.location.coordinates[1]) : ''}
            onChangeText={t => setFields(f => ({ ...f, location: { ...f.location, coordinates: [f.location.coordinates[0], t ? Number(t) : undefined] } }))}
            placeholder="e.g. 40.7484"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={fields.description}
        onChangeText={t => setFields(f => ({ ...f, description: t }))}
        placeholder="Description"
        multiline
        numberOfLines={4}
      />

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
