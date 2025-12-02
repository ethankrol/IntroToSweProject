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

// mirrors backend OrganizerEventDetails / DelegateEventDetails / VolunteerEventDetails
export type BaseEventDetail = {
    name: string;
    description?: string | null;
    location: {
        type: 'Point';
        coordinates: number[];
    };
    location_name?: string | null;
    start_date: string;
    end_date: string;
};

export type OrganizerEventDetail = BaseEventDetail & {
    delegate_join_code: string;
    total_attendees?: number | null;
    volunteers?: any[] | null;
    delegates?: any[] | null; 
};

export type VolunteerEventDetail = BaseEventDetail & {
    delegate_join_code: string;
    delegate_org_code?: string | null;
    delegate_contact_info: string;
    organizer_contact_info: string;
    my_role: string;
    task_description: string;
    task_location: {
        type: 'Point';
        coordinates: number[];
    };
    task_location_name: string;
    task_id?: string;
};

export type DelegateEventDetail = BaseEventDetail & {
    volunteer_join_code: string;
    total_attendees?: number | null;
    volunteers?: any[] | null;
    organizer_contact_info: string;
    my_role: string;
    task_description: string;
    task_location: {
        type: 'Point';
        coordinates: number[];
    };
    task_location_name: string;
};

export type EventDetail =
    | OrganizerEventDetail
    | VolunteerEventDetail
    | DelegateEventDetail;

// Task models
export type TaskPayload = {
    name: string;
    description?: string;
    location: {
        type: 'Point';
        coordinates: number[];
    };
    location_name?: string;
    start_time: string; // ISO
    end_time: string;   // ISO
    max_volunteers?: number | null;
    assigned_delegate?: string; // email
    task_join_code?: string;   // backend generates on create
    organizer_contact_info?: string;
};

export type TaskResponse = TaskPayload & {
    id?: string;
    event_id: string;
    volunteer_count?: number | null;
};

export type DelegateProfile = {
    email: string;
    name?: string;
    organization?: string;
    delegate_org_code: string;
    event_id?: string | null;
    volunteer_count: number;
    volunteers: { email?: string; name?: string; organization?: string }[];
};

export type VolunteerProfile = {
    email: string;
    memberships: VolunteerMembership[];
};

export type VolunteerMembership = {
    organization?: string;
    delegate_org_code?: string;
    event_id?: string | null;
    delegate_email?: string | null;
    delegate_name?: string | null;
    volunteer_count: number;
    volunteers: { email?: string; name?: string; organization?: string }[];
};
