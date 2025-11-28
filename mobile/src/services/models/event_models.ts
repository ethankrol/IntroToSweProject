export type eventPayload = {
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;

    createdAt: string;
    createdBy: string;
    
    location: {
        type: "Point";
        coordinates: [number, number];
        address?: string;
    };

    // Additional event types we can change later
    maxVolunteers?: number;
    imageUrl?: string;
    visibility?: 'public' | 'private';
}