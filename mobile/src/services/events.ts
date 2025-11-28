import { API_BASE_URL } from "../config";
import {eventPayload} from './models/event_models'
const EVENTS_URL = `${API_BASE_URL}/events`;

    
export async function createEvent(payload: Event): Promise<any> {
    const res = await fetch(`${EVENTS_URL}/create`, {
        method: "POST",
        headers: {
            "Content-Type"
        }
    }
}