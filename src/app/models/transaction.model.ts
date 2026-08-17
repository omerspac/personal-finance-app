export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'Food'
  | 'Transport'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Other';

export interface Transaction {

  id?: number;

  title: string;

  amount: number;

  type: TransactionType;

  category: TransactionCategory;

  date: string;

  time?: string;

  notification_id?: number | null;
  
  notes?: string;

  created_at?: string;

  updated_at?: string;

}