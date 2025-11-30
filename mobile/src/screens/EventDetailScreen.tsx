import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, TextInput } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { fetchEventDetails, fetchTasks, createTask, assignDelegate } from '../services/events';
import { DelegateEventDetail, EventDetail, OrganizerEventDetail, TaskResponse, VolunteerEventDetail } from '../services/models/event_models';

type RouteParams = {
  eventId?: string;
  event?: any; // fallback if navigation sends full event
  role?: 'organizer' | 'delegate' | 'volunteer';
};

type DelegateOption = { value: string; label: string };

export default function EventDetailScreen() {
  const route = useRoute();
  const { eventId, event, role = 'volunteer' } = (route.params as RouteParams) || {};
  const resolvedEventId = eventId || event?._id || event?.id;

  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [waitingAssignment, setWaitingAssignment] = useState(false);

  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    locationName: '',
    startTime: '',
    endTime: '',
    lng: '',
    lat: '',
    maxVolunteers: '',
    assignedDelegate: '',
  });
  const [showDelegateDropdown, setShowDelegateDropdown] = useState(false);

  useEffect(() => {
    if (!resolvedEventId) return;
    const load = async () => {
      try {
        setLoading(true);
        setWaitingAssignment(false);
        const d = await fetchEventDetails(resolvedEventId, role);
        setDetail(d);
        // Prefill delegate selection list and default coords
        if ('location' in d && d.location?.coordinates?.length === 2) {
          setTaskForm((prev) => ({
            ...prev,
            lng: String(d.location.coordinates[0]),
            lat: String(d.location.coordinates[1]),
          }));
        }
        if (role === 'organizer') {
          await loadTasks();
        }
      } catch (err: any) {
        console.error(err);
        const msg = err?.message ?? '';
        // If the backend says not assigned, show waiting state instead of hard error
        if (msg.includes('assigned') || msg.includes('400')) {
          setWaitingAssignment(true);
        } else {
          Alert.alert('Error', msg || 'Failed to load event');
        }
      } finally {
        setLoading(false);
      }
    };
    const loadTasks = async () => {
      try {
        setTaskLoading(true);
        const t = await fetchTasks(resolvedEventId);
        setTasks(t);
      } catch (err: any) {
        console.error(err);
        Alert.alert('Error', err?.message ?? 'Failed to load tasks');
      } finally {
        setTaskLoading(false);
      }
    };
    load();
  }, [resolvedEventId, role]);

  const delegateOptions: DelegateOption[] = useMemo(() => {
    if (role !== 'organizer') return [];
    const d = detail as OrganizerEventDetail | null;
    const raw = d?.delegates ?? [];
    return raw
      .map((r: any) => {
        const email = r?.user_id || r?.email || '';
        if (!email) return null;
        const name = r?.first_name && r?.last_name ? `${r.first_name} ${r.last_name}` : r?.name;
        const org = r?.organization;
        const labelParts = [name || email, org ? `(${org})` : null].filter(Boolean);
        return { value: email, label: labelParts.join(' ') || email };
      })
      .filter(Boolean) as DelegateOption[];
  }, [detail, role]);

  const onCreateTask = async () => {
    if (!resolvedEventId) return;
    if (!taskForm.name.trim()) return Alert.alert('Missing name', 'Task name is required.');
    if (!taskForm.assignedDelegate.trim()) return Alert.alert('Missing delegate', 'Please select a delegate.');
    const lng = parseFloat(taskForm.lng);
    const lat = parseFloat(taskForm.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) return Alert.alert('Invalid location', 'Enter valid longitude/latitude numbers.');
    try {
      setTaskLoading(true);
      const payload = {
        name: taskForm.name.trim(),
        description: taskForm.description.trim() || undefined,
        location: { type: 'Point' as const, coordinates: [lng, lat] },
        location_name: taskForm.locationName.trim() || undefined,
        start_time: taskForm.startTime || new Date().toISOString(),
        end_time: taskForm.endTime || new Date().toISOString(),
        max_volunteers: taskForm.maxVolunteers ? Number(taskForm.maxVolunteers) : undefined,
        assigned_delegate: taskForm.assignedDelegate.trim(),
      };
      await createTask(resolvedEventId, payload);
      Alert.alert('Success', 'Task created');
      setTaskForm((prev) => ({ ...prev, name: '', description: '', locationName: '', startTime: '', endTime: '', maxVolunteers: '' }));
      const refreshed = await fetchTasks(resolvedEventId);
      setTasks(refreshed);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message ?? 'Failed to create task');
    } finally {
      setTaskLoading(false);
    }
  };

  const onAssignDelegate = async (taskId: string, delegateEmail: string) => {
    if (!resolvedEventId) return;
    try {
      setTaskLoading(true);
      await assignDelegate(resolvedEventId, taskId, delegateEmail);
      const refreshed = await fetchTasks(resolvedEventId);
      setTasks(refreshed);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message ?? 'Failed to assign delegate');
    } finally {
      setTaskLoading(false);
    }
  };

  if (!resolvedEventId) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>No event id provided</Text>
      </View>
    );
  }

  if (loading && !detail && !waitingAssignment) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (waitingAssignment) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.title}>Waiting to be assigned</Text>
        <Text style={{ textAlign: 'center', color: '#555', marginTop: 8 }}>
          You joined this event but have not been assigned to a task yet. Please check back once the organizer assigns you.
        </Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>No event data</Text>
      </View>
    );
  }

  const base = detail as any;
  const start = base.start_date ? new Date(base.start_date).toLocaleString() : '';
  const end = base.end_date ? new Date(base.end_date).toLocaleString() : '';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{base.name}</Text>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Timing</Text>
        <Text style={styles.boxValue}>{start}</Text>
        <Text style={styles.boxValue}>to {end}</Text>
      </View>

      {base.location_name ? (
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Location</Text>
          <Text style={styles.boxValue}>{base.location_name}</Text>
        </View>
      ) : null}

      {base.description ? (
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Description</Text>
          <Text style={styles.boxValue}>{base.description}</Text>
        </View>
      ) : null}

      {/* Role-specific */}
      {role === 'volunteer' && (
        <VolunteerSection detail={detail as VolunteerEventDetail} />
      )}
      {role === 'delegate' && (
        <DelegateSection detail={detail as DelegateEventDetail} />
      )}
      {role === 'organizer' && (
        <OrganizerSection
          detail={detail as OrganizerEventDetail}
          tasks={tasks}
          taskLoading={taskLoading}
          delegateOptions={delegateOptions}
          onAssignDelegate={onAssignDelegate}
          taskForm={taskForm}
          setTaskForm={setTaskForm}
          onCreateTask={onCreateTask}
          showDelegateDropdown={showDelegateDropdown}
          setShowDelegateDropdown={setShowDelegateDropdown}
        />
      )}
    </ScrollView>
  );
}

function VolunteerSection({ detail }: { detail: VolunteerEventDetail }) {
  return (
    <>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Your role</Text>
        <Text style={styles.boxValue}>{detail.my_role}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Organizer contact</Text>
        <Text style={styles.boxValue}>{detail.organizer_contact_info}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Delegate contact</Text>
        <Text style={styles.boxValue}>{detail.delegate_contact_info}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Task</Text>
        <Text style={styles.boxValue}>{detail.task_description}</Text>
        <Text style={[styles.boxLabel, { marginTop: 8 }]}>Task location</Text>
        <Text style={styles.boxValue}>{detail.task_location_name}</Text>
        <Text style={styles.boxLabel}>Volunteer join code</Text>
        <Text style={styles.code}>{detail.delegate_join_code}</Text>
      </View>
    </>
  );
}

function DelegateSection({ detail }: { detail: DelegateEventDetail }) {
  return (
    <>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Your role</Text>
        <Text style={styles.boxValue}>{detail.my_role}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Organizer contact</Text>
        <Text style={styles.boxValue}>{detail.organizer_contact_info}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Task</Text>
        <Text style={styles.boxValue}>{detail.task_description}</Text>
        <Text style={[styles.boxLabel, { marginTop: 8 }]}>Task location</Text>
        <Text style={styles.boxValue}>{detail.task_location_name}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Volunteer join code</Text>
        <Text style={styles.code}>{detail.volunteer_join_code}</Text>
        <Text style={[styles.boxLabel, { marginTop: 8 }]}>Attendees</Text>
        <Text style={styles.boxValue}>{detail.total_attendees ?? 0}</Text>
      </View>
      {detail.volunteers?.length ? (
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Volunteers</Text>
          {detail.volunteers.map((v: any, idx: number) => (
            <Text key={v?._id || idx} style={styles.listItem}>{v?.user_id || v?.email || JSON.stringify(v)}</Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

type OrganizerSectionProps = {
  detail: OrganizerEventDetail;
  tasks: TaskResponse[];
  taskLoading: boolean;
  delegateOptions: DelegateOption[];
  onAssignDelegate: (taskId: string, delegateEmail: string) => void;
  taskForm: any;
  setTaskForm: React.Dispatch<React.SetStateAction<any>>;
  onCreateTask: () => void;
  showDelegateDropdown: boolean;
  setShowDelegateDropdown: (v: boolean) => void;
};

function OrganizerSection({
  detail,
  tasks,
  taskLoading,
  delegateOptions,
  onAssignDelegate,
  taskForm,
  setTaskForm,
  onCreateTask,
  showDelegateDropdown,
  setShowDelegateDropdown,
}: OrganizerSectionProps) {
  return (
    <>
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Delegate join code</Text>
        <Text style={styles.code}>{detail.delegate_join_code}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Create task</Text>
        <TextInput
          style={styles.input}
          placeholder="Task name"
          value={taskForm.name}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, name: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Description"
          value={taskForm.description}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, description: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Location name"
          value={taskForm.locationName}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, locationName: t }))}
        />
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Longitude"
            keyboardType="numeric"
            value={taskForm.lng}
            onChangeText={(t) => setTaskForm((p: any) => ({ ...p, lng: t }))}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Latitude"
            keyboardType="numeric"
            value={taskForm.lat}
            onChangeText={(t) => setTaskForm((p: any) => ({ ...p, lat: t }))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Start time (ISO, optional)"
          value={taskForm.startTime}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, startTime: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="End time (ISO, optional)"
          value={taskForm.endTime}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, endTime: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Max volunteers (optional)"
          keyboardType="numeric"
          value={taskForm.maxVolunteers}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, maxVolunteers: t }))}
        />

        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowDelegateDropdown(!showDelegateDropdown)}
        >
          <Text style={styles.boxValue}>
            {taskForm.assignedDelegate
              ? delegateOptions.find((d) => d.value === taskForm.assignedDelegate)?.label || taskForm.assignedDelegate
              : 'Select delegate'}
          </Text>
        </TouchableOpacity>
        {showDelegateDropdown && (
          <View style={styles.dropdownList}>
            {delegateOptions.length === 0 ? (
              <Text style={styles.boxValue}>No delegates yet</Text>
            ) : (
              delegateOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    setTaskForm((p: any) => ({ ...p, assignedDelegate: opt.value }));
                    setShowDelegateDropdown(false);
                  }}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={styles.boxValue}>{opt.label}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={onCreateTask}>
          <Text style={styles.primaryText}>Create Task</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Tasks</Text>
        {taskLoading ? (
          <ActivityIndicator size="small" color="#059669" />
        ) : tasks.length === 0 ? (
          <Text style={styles.boxValue}>No tasks yet</Text>
        ) : (
          tasks.map((t, idx) => (
            <View key={t.id || t.task_join_code || idx} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
              <Text style={styles.boxValue}>{t.name}</Text>
              <Text style={styles.boxLabel}>Volunteer join code</Text>
              <Text style={styles.code}>{t.task_join_code}</Text>
              <Text style={styles.boxLabel}>Assigned delegate</Text>
              <Text style={styles.boxValue}>{t.assigned_delegate || 'Unassigned'}</Text>
              {delegateOptions.length ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.boxLabel}>Assign / change delegate</Text>
                  {delegateOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.assignButton}
                      onPress={() => onAssignDelegate(t.id || '', opt.value)}
                    >
                      <Text style={styles.assignText}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff'
  },
  header: {
    fontSize: 18,
    textAlign: 'center'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  box: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa'
  },
  boxLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6
  },
  boxValue: {
    fontSize: 16,
    color: '#222'
  },
  listItem: {
    fontSize: 14,
    color: '#333'
  },
  code: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#0f766e',
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff'
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9fafb'
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  assignButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#e0f2f1',
    borderRadius: 4,
    marginTop: 6
  },
  assignText: {
    color: '#065f46'
  }
});
