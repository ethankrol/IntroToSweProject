import { API_BASE_URL } from "../config";
import { EventUpsertPayload, EventResponse } from './models/event_models';
import { getCookie } from './cookie';

const EVENT_URL = `${API_BASE_URL}/event`;

export async function saveEvent(payload: EventUpsertPayload): Promise<EventResponse> {
    const token = await getCookie('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

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
    const token = await getCookie('auth_token');
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE_URL}/events?role=${role}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load events: ${res.status} ${text}`);
    }
    return await res.json();
}

export async function joinEvent(code: string): Promise<EventResponse> {
    const token = await getCookie('auth_token');
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/event/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Join failed: ${res.status} ${text}`);
    }
    return await res.json();
}