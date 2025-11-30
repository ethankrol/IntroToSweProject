import { API_BASE_URL } from "../config";
import {
    EventUpsertPayload,
    EventResponse,
    EventDetail,
    TaskPayload,
    TaskResponse,
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

export async function fetchEventDetails(eventId: string, role: 'organizer' | 'delegate' | 'volunteer'): Promise<EventDetail> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/events/${eventId}?role=${role}`, { headers });
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
