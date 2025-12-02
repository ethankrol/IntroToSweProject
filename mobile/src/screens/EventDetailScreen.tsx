import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchEventDetails, fetchTasks, createTask, assignDelegate, updateTask, leaveVolunteerGroup, unassignDelegate, removeDelegateFromEvent, leaveTask } from '../services/events';
import { DelegateEventDetail, EventDetail, OrganizerEventDetail, TaskResponse, VolunteerEventDetail, VolunteerMembership } from '../services/models/event_models';

type RouteParams = {
  eventId?: string;
  event?: any; // fallback if navigation sends full event
  role?: 'organizer' | 'delegate' | 'volunteer';
  delegateOrgCode?: string;
  membership?: VolunteerMembership;
};

type DelegateOption = { value: string; label: string };

export default function EventDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { eventId, event, role = 'volunteer', delegateOrgCode, membership } = (route.params as RouteParams) || {};
  const resolvedEventId = eventId || event?._id || event?.id;

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

  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [waitingAssignment, setWaitingAssignment] = useState(false);

  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    locationName: '',
    lng: '',
    lat: '',
    maxVolunteers: '',
    assignedDelegate: '',
    organizerContact: '',
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showDelegateDropdown, setShowDelegateDropdown] = useState(false);
  const [taskDate, setTaskDate] = useState<Date>(new Date());
  const [taskStartTime, setTaskStartTime] = useState<Date>(new Date());
  const [taskEndTime, setTaskEndTime] = useState<Date>(new Date());
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [showTaskStartPicker, setShowTaskStartPicker] = useState(false);
  const [showTaskEndPicker, setShowTaskEndPicker] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedEventId) return;
    const load = async () => {
      try {
        setLoading(true);
        setWaitingAssignment(false);
        const d = await fetchEventDetails(resolvedEventId, role, delegateOrgCode);
        setDetail(d);
        if (role === 'volunteer' && (d as any).task_id) {
          setCurrentTaskId((d as any).task_id);
        }
        // Prefill delegate selection list and default coords
        if ('location' in d && d.location?.coordinates?.length === 2) {
          setTaskForm((prev) => ({
            ...prev,
            lng: String(d.location.coordinates[0]),
            lat: String(d.location.coordinates[1]),
          }));
        }
        if ('start_date' in d && d.start_date) {
          const start = new Date((d as any).start_date);
          setTaskDate(start);
          setTaskStartTime(start);
        }
        if ('end_date' in d && d.end_date) {
          const end = new Date((d as any).end_date);
          setTaskEndTime(end);
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
  }, [resolvedEventId, role, delegateOrgCode]);

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

  const openTaskLocationPicker = () => {
    const lng = parseFloat(taskForm.lng);
    const lat = parseFloat(taskForm.lat);
    navigation.navigate?.('LocationPicker', {
      address: taskForm.locationName || '',
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      onPick: (loc: { lat: number; lng: number; address: string }) => {
        setTaskForm((prev: any) => ({
          ...prev,
          locationName: loc.address,
          lng: String(loc.lng),
          lat: String(loc.lat),
        }));
      },
    });
  };

  const onEditTask = (task: TaskResponse) => {
    setEditingTaskId(task.id || task.task_join_code || null);
    setTaskForm({
      name: task.name || '',
      description: task.description || '',
      locationName: task.location_name || '',
      lng: task.location?.coordinates?.[0] != null ? String(task.location.coordinates[0]) : '',
      lat: task.location?.coordinates?.[1] != null ? String(task.location.coordinates[1]) : '',
      maxVolunteers: task.max_volunteers != null ? String(task.max_volunteers) : '',
      assignedDelegate: task.assigned_delegate || '',
      organizerContact: (task as any).organizer_contact_info || '',
    });
    if (task.start_time) {
      const start = new Date(task.start_time);
      setTaskDate(start);
      setTaskStartTime(start);
    }
    if (task.end_time) {
      const end = new Date(task.end_time);
      setTaskEndTime(end);
    }
  };

  const onCancelEdit = () => {
    setEditingTaskId(null);
    const now = new Date();
    setTaskForm({
      name: '',
      description: '',
      locationName: '',
      lng: '',
      lat: '',
      maxVolunteers: '',
      assignedDelegate: '',
      organizerContact: '',
    });
    setTaskDate(now);
    setTaskStartTime(now);
    setTaskEndTime(now);
  };

  const onSubmitTask = async () => {
    if (!resolvedEventId) return;
    if (!taskForm.name.trim()) return Alert.alert('Missing name', 'Task name is required.');
    const lng = parseFloat(taskForm.lng);
    const lat = parseFloat(taskForm.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) return Alert.alert('Invalid location', 'Enter valid longitude/latitude numbers.');
    const start = new Date(`${formatDateLocal(taskDate)}T${formatTime(taskStartTime)}:00`);
    const end = new Date(`${formatDateLocal(taskDate)}T${formatTime(taskEndTime)}:00`);
    try {
      setTaskLoading(true);
      const payload = {
        name: taskForm.name.trim(),
        description: taskForm.description.trim() || undefined,
        location: { type: 'Point' as const, coordinates: [lng, lat] },
        location_name: taskForm.locationName.trim() || undefined,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        max_volunteers: taskForm.maxVolunteers ? Number(taskForm.maxVolunteers) : undefined,
        assigned_delegate: taskForm.assignedDelegate.trim() || undefined,
        organizer_contact_info: taskForm.organizerContact.trim() || undefined,
      };
      if (editingTaskId) {
        await updateTask(resolvedEventId, editingTaskId, payload);
        Alert.alert('Success', 'Task updated');
      } else {
        await createTask(resolvedEventId, payload);
        Alert.alert('Success', 'Task created');
      }
      setTaskForm((prev) => ({ ...prev, name: '', description: '', locationName: '', maxVolunteers: '', lng: '', lat: '', organizerContact: '' }));
      setEditingTaskId(null);
      const now = new Date();
      setTaskDate(now);
      setTaskStartTime(now);
      setTaskEndTime(now);
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

  const onUnassignDelegate = async (taskId: string) => {
    if (!resolvedEventId) return;
    try {
      setTaskLoading(true);
      await unassignDelegate(resolvedEventId, taskId);
      const refreshed = await fetchTasks(resolvedEventId);
      setTasks(refreshed);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message ?? 'Failed to unassign delegate');
    } finally {
      setTaskLoading(false);
    }
  };

  const onRemoveDelegate = async (delegateEmail: string) => {
    if (!resolvedEventId) return;
    Alert.alert('Remove delegate', `Remove ${delegateEmail} and their volunteers from this event?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setTaskLoading(true);
            await removeDelegateFromEvent(resolvedEventId, delegateEmail);
            const refreshed = await fetchEventDetails(resolvedEventId, role, delegateOrgCode);
            setDetail(refreshed);
            const refreshedTasks = await fetchTasks(resolvedEventId);
            setTasks(refreshedTasks);
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to remove delegate');
          } finally {
            setTaskLoading(false);
          }
        },
      },
    ]);
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
      {role === 'volunteer' && membership ? (
        <View style={styles.box}>
          <Text style={[styles.boxLabel, { textAlign: 'center', fontWeight: '700', marginBottom: 8 }]}>My Group</Text>
          <Text style={styles.boxValue}>
            {membership.delegate_name || membership.delegate_email || 'Unknown delegate'}
            {membership.delegate_name && membership.delegate_email ? ` (${membership.delegate_email})` : ''}
          </Text>
          <Text style={styles.boxLabel}>Organization</Text>
          <Text style={styles.boxValue}>{membership.organization || 'N/A'}</Text>
          <Text style={styles.boxLabel}>Org Code</Text>
          <Text style={styles.code}>{membership.delegate_org_code}</Text>
          <Text style={[styles.boxLabel, { marginTop: 8 }]}>Volunteers ({membership.volunteer_count})</Text>
          {membership.volunteers?.length ? (
            membership.volunteers.map((v, idx) => (
              <Text key={v.email || idx} style={styles.boxValue}>
                {v.name || v.email || 'Unknown'} {v.email && v.name ? `(${v.email})` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.boxValue}>None yet</Text>
          )}
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 10, backgroundColor: '#b91c1c' }]}
            onPress={async () => {
              try {
                setTaskLoading(true);
                await leaveVolunteerGroup(membership.delegate_org_code || undefined, membership.event_id || undefined);
                Alert.alert('Left group', 'You have left this group.');
                navigation.navigate('HomeScreen' as never, { tab: 'volunteer', refresh: Date.now() } as never);
              } catch (e: any) {
                Alert.alert('Leave failed', e?.message ?? 'Unable to leave group');
              } finally {
                setTaskLoading(false);
              }
            }}
          >
            <Text style={styles.primaryText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {role === 'volunteer' && !membership && (
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#b91c1c', marginBottom: 12 }]}
          onPress={async () => {
            // allow leaving task-only membership
            try {
              setTaskLoading(true);
              let taskId = currentTaskId || (detail as any).task_id;
              if (!taskId && resolvedEventId) {
                // try refetching detail to obtain task id
                try {
                  const refreshed = await fetchEventDetails(resolvedEventId, role, delegateOrgCode);
                  setDetail(refreshed);
                  if ((refreshed as any).task_id) {
                    taskId = (refreshed as any).task_id;
                    setCurrentTaskId(taskId);
                  }
                } catch (e) {
                  // ignore; will fall through to error below
                }
              }
              if (!taskId) {
                Alert.alert('Leave failed', 'No task id found.');
                return;
              }
              await leaveTask(taskId);
              Alert.alert('Left task', 'You have left this task.');
              navigation.navigate('HomeScreen' as never, { tab: 'volunteer', refresh: Date.now() } as never);
            } catch (e: any) {
              Alert.alert('Leave failed', e?.message ?? 'Unable to leave task');
            } finally {
              setTaskLoading(false);
            }
          }}
        >
          <Text style={styles.primaryText}>Leave Task</Text>
        </TouchableOpacity>
      )}
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
          onUnassignDelegate={onUnassignDelegate}
          taskForm={taskForm}
          setTaskForm={setTaskForm}
          onCreateTask={onSubmitTask}
          showDelegateDropdown={showDelegateDropdown}
          setShowDelegateDropdown={setShowDelegateDropdown}
          taskDate={taskDate}
          taskStartTime={taskStartTime}
          taskEndTime={taskEndTime}
          showTaskDatePicker={showTaskDatePicker}
          showTaskStartPicker={showTaskStartPicker}
          showTaskEndPicker={showTaskEndPicker}
          setShowTaskDatePicker={setShowTaskDatePicker}
          setShowTaskStartPicker={setShowTaskStartPicker}
          setShowTaskEndPicker={setShowTaskEndPicker}
          setTaskDate={setTaskDate}
          setTaskStartTime={setTaskStartTime}
          setTaskEndTime={setTaskEndTime}
          formatDateLocal={formatDateLocal}
          formatTime={formatTime}
          onPickLocation={openTaskLocationPicker}
          onRemoveDelegate={onRemoveDelegate}
          editingTaskId={editingTaskId}
          onEditTask={onEditTask}
          onCancelEdit={onCancelEdit}
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
      {detail.delegate_org_code ? (
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Delegate contact</Text>
          <Text style={styles.boxValue}>{detail.delegate_contact_info}</Text>
        </View>
      ) : null}
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
  onUnassignDelegate: (taskId: string) => void;
  onRemoveDelegate: (delegateEmail: string) => void;
  taskForm: any;
  setTaskForm: React.Dispatch<React.SetStateAction<any>>;
  onCreateTask: () => void;
  showDelegateDropdown: boolean;
  setShowDelegateDropdown: (v: boolean) => void;
  taskDate: Date;
  taskStartTime: Date;
  taskEndTime: Date;
  showTaskDatePicker: boolean;
  showTaskStartPicker: boolean;
  showTaskEndPicker: boolean;
  setShowTaskDatePicker: (v: boolean) => void;
  setShowTaskStartPicker: (v: boolean) => void;
  setShowTaskEndPicker: (v: boolean) => void;
  setTaskDate: (d: Date) => void;
  setTaskStartTime: (d: Date) => void;
  setTaskEndTime: (d: Date) => void;
  formatDateLocal: (d: Date) => string;
  formatTime: (d: Date) => string;
  onPickLocation: () => void;
  editingTaskId: string | null;
  onEditTask: (task: TaskResponse) => void;
  onCancelEdit: () => void;
};

function OrganizerSection({
  detail,
  tasks,
  taskLoading,
  delegateOptions,
  onAssignDelegate,
  onUnassignDelegate,
  onRemoveDelegate,
  taskForm,
  setTaskForm,
  onCreateTask,
  showDelegateDropdown,
  setShowDelegateDropdown,
  taskDate,
  taskStartTime,
  taskEndTime,
  showTaskDatePicker,
  showTaskStartPicker,
  showTaskEndPicker,
  setShowTaskDatePicker,
  setShowTaskStartPicker,
  setShowTaskEndPicker,
  setTaskDate,
  setTaskStartTime,
  setTaskEndTime,
  formatDateLocal,
  formatTime,
  onPickLocation,
  editingTaskId,
  onEditTask,
  onCancelEdit,
}: OrganizerSectionProps) {
  return (
    <>
      {Array.isArray(detail.delegates) && detail.delegates.length ? (
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Delegates</Text>
          {detail.delegates.map((d: any, idx: number) => (
            <View key={d._id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={styles.boxValue}>{d.user_id || d.email || 'Unknown'}</Text>
              <TouchableOpacity
                style={[styles.assignButton, { backgroundColor: '#fee2e2', borderColor: '#f87171' }]}
                onPress={() => onRemoveDelegate(d.user_id || d.email || '')}
              >
                <Text style={[styles.assignText, { color: '#b91c1c' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.box}>
        <Text style={styles.boxLabel}>Delegate join code</Text>
        <Text style={styles.code}>{detail.delegate_join_code}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Create task</Text>
        {editingTaskId ? (
          <Text style={[styles.boxValue, { color: '#b45309', marginBottom: 8 }]}>
            Editing existing task
          </Text>
        ) : null}
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
        <Text style={styles.boxLabel}>Date</Text>
        <TouchableOpacity
          style={styles.dateBox}
          onPress={() => {
            setShowTaskDatePicker(!showTaskDatePicker);
            setShowTaskStartPicker(false);
            setShowTaskEndPicker(false);
          }}
        >
          <Text style={styles.boxValue}>{formatDateLocal(taskDate)}</Text>
        </TouchableOpacity>
        {showTaskDatePicker && (
          <DateTimePicker
            value={taskDate}
            mode="date"
            display="spinner"
            onChange={(_e, selected) => {
              if (Platform.OS === 'android') setShowTaskDatePicker(false);
              if (selected) setTaskDate(selected);
            }}
          />
        )}
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.boxLabel}>Start time</Text>
            <TouchableOpacity
              style={styles.dateBox}
              onPress={() => {
                setShowTaskStartPicker(!showTaskStartPicker);
                setShowTaskDatePicker(false);
                setShowTaskEndPicker(false);
              }}
            >
              <Text style={styles.boxValue}>{formatTime(taskStartTime)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.boxLabel}>End time</Text>
            <TouchableOpacity
              style={styles.dateBox}
              onPress={() => {
                setShowTaskEndPicker(!showTaskEndPicker);
                setShowTaskDatePicker(false);
                setShowTaskStartPicker(false);
              }}
            >
              <Text style={styles.boxValue}>{formatTime(taskEndTime)}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View>
          {showTaskStartPicker && (
            <DateTimePicker
              value={taskStartTime}
              mode="time"
              display="spinner"
              onChange={(_e, selected) => {
                if (Platform.OS === 'android') setShowTaskStartPicker(false);
                if (selected) setTaskStartTime(selected);
              }}
            />
          )}
          {showTaskEndPicker && (
            <DateTimePicker
              value={taskEndTime}
              mode="time"
              display="spinner"
              onChange={(_e, selected) => {
                if (Platform.OS === 'android') setShowTaskEndPicker(false);
                if (selected) setTaskEndTime(selected);
              }}
            />
          )}
        </View>
        <Text style={styles.boxLabel}>Location name</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Location name"
            value={taskForm.locationName}
            onChangeText={(t) => setTaskForm((p: any) => ({ ...p, locationName: t }))}
          />
          <TouchableOpacity style={[styles.dateBox, { minWidth: 120, alignItems: 'center' }]} onPress={onPickLocation}>
            <Text style={styles.boxValue}>Pick location</Text>
          </TouchableOpacity>
        </View>
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
          placeholder="Max volunteers (optional)"
          keyboardType="numeric"
          value={taskForm.maxVolunteers}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, maxVolunteers: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Organizer contact info (email or phone)"
          value={taskForm.organizerContact}
          onChangeText={(t) => setTaskForm((p: any) => ({ ...p, organizerContact: t }))}
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
          <Text style={styles.primaryText}>{editingTaskId ? 'Update Task' : 'Create Task'}</Text>
        </TouchableOpacity>
        {editingTaskId ? (
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#d1d5db', marginTop: 8 }]} onPress={onCancelEdit}>
            <Text style={[styles.primaryText, { color: '#111' }]}>Cancel Edit</Text>
          </TouchableOpacity>
        ) : null}
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
              <Text style={[styles.boxLabel, { marginTop: 6 }]}>Volunteers</Text>
              <View style={styles.barOuter}>
                {(() => {
                  const count = t.volunteer_count ?? 0;
                  const max = t.max_volunteers;
                  const pct = max && max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 100;
                  return (
                    <>
                      <View style={[styles.barInner, { width: `${pct}%` }]} />
                      <Text style={styles.barText}>
                        {max && max > 0 ? `${count}/${max}` : `${count} volunteers`}
                      </Text>
                    </>
                  );
                })()}
              </View>
              <Text style={styles.boxLabel}>Assigned delegate</Text>
              <Text style={styles.boxValue}>{t.assigned_delegate || 'Unassigned'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <TouchableOpacity
                  style={[styles.assignButton, { backgroundColor: '#bfdbfe', marginRight: 8 }]}
                  onPress={() => onEditTask(t)}
                >
                  <Text style={[styles.assignText, { color: '#1d4ed8' }]}>Edit</Text>
                </TouchableOpacity>
                {delegateOptions.length ? (
                  delegateOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.assignButton}
                      onPress={() => onAssignDelegate(t.id || '', opt.value)}
                    >
                      <Text style={styles.assignText}>Assign {opt.label}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.boxValue}>No delegates available</Text>
                )}
                {t.assigned_delegate ? (
                  <TouchableOpacity
                    style={[styles.assignButton, { backgroundColor: '#fee2e2', borderColor: '#f87171' }]}
                    onPress={() => onUnassignDelegate(t.id || '')}
                  >
                    <Text style={[styles.assignText, { color: '#b91c1c' }]}>Unassign</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
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
  dateBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9fafb'
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6
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
  },
  barOuter: {
    position: 'relative',
    height: 18,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 6,
    justifyContent: 'center'
  },
  barInner: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#10b981'
  },
  barText: {
    fontSize: 12,
    color: '#111',
    textAlign: 'center'
  }
});
