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