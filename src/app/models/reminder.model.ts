export interface Reminder {

  id?: number;

  title: string;

  amount?: number | null;

  due_date: string;

  notification_id?: number | null;

  created_at?: string;

}