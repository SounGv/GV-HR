export type AnnouncementStatus = "DRAFT" | "PUBLISHED";
export type AnnouncementScope = "feed" | "manage";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  status: AnnouncementStatus;
  publishedAt: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface AnnouncementFormValues {
  title: string;
  body: string;
  pinned: boolean;
  status: AnnouncementStatus;
}
