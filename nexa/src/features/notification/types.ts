export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}
