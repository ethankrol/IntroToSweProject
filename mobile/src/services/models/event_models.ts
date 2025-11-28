// Align types with backend EventBase (snake_case) and EventUpsert
export type EventUpsertPayload = {
    _id?: string;
    name: string;
    description?: string;
    location: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
    };
    location_name?: string;
    start_date: string; // ISO datetime
    end_date: string;   // ISO datetime
    delegate_join_code?: string; // optional; backend can generate
    volunteer_join_code?: string; // optional; backend can generate
};

export type EventResponse = EventUpsertPayload & {
    _id: string;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
};