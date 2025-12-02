import { API_BASE_URL } from "../config";
import {
    EventUpsertPayload,
    EventResponse,
    EventDetail,
    TaskPayload,
    TaskResponse,
    DelegateProfile,
    VolunteerProfile,
} from './models/event_models';
import { getCookie } from './cookie';

const EVENT_URL = `${API_BASE_URL}/event`;

async function authHeaders(extra?: Record<string, string>) {
    const token = await getCookie('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extra ?? {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export async function saveEvent(payload: EventUpsertPayload): Promise<EventResponse> {
    const headers = await authHeaders();
    const res = await fetch(EVENT_URL, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save event: ${res.status} ${text}`);
    }
    return (await res.json()) as EventResponse;
}

export async function fetchEvents(role: 'organizer' | 'delegate' | 'volunteer'): Promise<EventResponse[]> {
    const headers = await authHeaders();
    const url = `${API_BASE_URL}/events?role=${role}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load events: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function fetchEventDetails(eventId: string, role: 'organizer' | 'delegate' | 'volunteer', delegateOrgCode?: string): Promise<EventDetail> {
    const headers = await authHeaders();
    const query = new URLSearchParams({ role });
    if (delegateOrgCode) query.append('delegate_org_code', delegateOrgCode);
    const res = await fetch(`${API_BASE_URL}/events/${eventId}?${query.toString()}`, { headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load event details: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function joinEvent(delegateCode: string): Promise<EventResponse> {
    const headers = await authHeaders();
    const code = delegateCode.trim();
    const res = await fetch(`${API_BASE_URL}/event/join/${code}`, {
        method: 'POST',
        headers,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Join failed: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function joinTask(taskCode: string): Promise<TaskResponse> {
    const headers = await authHeaders();
    const code = taskCode.trim();
    const res = await fetch(`${API_BASE_URL}/tasks/join/${code}`, {
        method: 'POST',
        headers,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Join task failed: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function leaveTask(taskId: string): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/tasks/leave`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task_id: taskId }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to leave task: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function removeDelegateFromEvent(eventId: string, delegateEmail: string): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/delegate/remove/${eventId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ delegate_email: delegateEmail }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to remove delegate: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function fetchTasks(eventId: string): Promise<TaskResponse[]> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/events/${eventId}/tasks`, { headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load tasks: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function createTask(eventId: string, payload: TaskPayload): Promise<TaskResponse> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/events/${eventId}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create task: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function updateTask(eventId: string, taskId: string, payload: TaskPayload): Promise<TaskResponse> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update task: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function assignDelegate(eventId: string, taskId: string, delegateEmail: string): Promise<TaskResponse> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/events/${eventId}/tasks/${taskId}/assign`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ assigned_delegate: delegateEmail }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to assign delegate: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function unassignDelegate(eventId: string, taskId: string): Promise<TaskResponse> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/events/${eventId}/tasks/${taskId}/unassign`, {
        method: 'PATCH',
        headers,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to unassign delegate: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function registerDelegate(eventId: string | null, organization: string): Promise<{ event_id: string | null; delegate_org_code: string }> {
    const headers = await authHeaders();
    const url = eventId
        ? `${API_BASE_URL}/delegate/register?event_id=${encodeURIComponent(eventId)}`
        : `${API_BASE_URL}/delegate/register`;
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ organization }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to register delegate: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function joinViaDelegateCode(code: string): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/delegate/join/${code.trim()}`, {
        method: 'POST',
        headers,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to join with delegate code: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function fetchDelegateProfile(): Promise<DelegateProfile> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/delegate/profile`, { headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load delegate profile: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function leaveDelegateEvent(): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/delegate/leave`, {
        method: 'POST',
        headers,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to leave event: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function attachDelegateToEvent(eventId: string, delegateCode: string): Promise<{ event_id: string; delegate_org_code: string }> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/delegate/attach/${encodeURIComponent(eventId)}/${delegateCode.trim()}`, {
        method: 'POST',
        headers,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to attach delegate: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function fetchVolunteerProfile(): Promise<VolunteerProfile> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/volunteer/profile`, { headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load volunteer profile: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function leaveVolunteerGroup(delegateOrgCode?: string, eventId?: string | null): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/volunteer/leave`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            ...(delegateOrgCode ? { delegate_org_code: delegateOrgCode } : {}),
            ...(eventId ? { event_id: eventId } : {}),
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to leave group: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function removeVolunteer(volunteerEmail: string): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/delegate/volunteer/remove`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ volunteer_email: volunteerEmail }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to remove volunteer: ${res.status} ${text}`);
    }
    return await res.json();
}
