export type MeetingStatus = "SCHEDULED" | "CANCELLED";
export type MeetingResponseStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export type MeetingScope = "organizer" | "invitee";

export interface MeetingAttendee {
  id: string;
  status: MeetingResponseStatus;
  respondedAt: string | null;
  note: string | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface MeetingListItem {
  id: string;
  title: string;
  location: string | null;
  startAt: string;
  endAt: string;
  status: MeetingStatus;
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  attendees: MeetingAttendee[];
  /** Present only when the viewer themselves is an attendee. */
  myResponse?: MeetingResponseStatus;
}

export interface Meeting extends MeetingListItem {
  description: string | null;
  createdAt: string;
}

export interface MeetingFormValues {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  attendeeEmployeeIds: string[];
}
