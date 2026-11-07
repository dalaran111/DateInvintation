export type Activity = 'cinema' | 'dinner' | 'custom';
export type MeetingPoint = { lat: number; lng: number; label: string };
export type DatePlan = { activity: Activity; customActivity: string; time: string; point: MeetingPoint | null };
