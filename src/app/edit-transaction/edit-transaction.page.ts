import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  // IonContent,
  IonIcon,
  IonInput,
  IonTextarea
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  arrowBackOutline,
  createOutline,
  arrowDownOutline,
  arrowUpOutline,
  gridOutline,
  chevronDownOutline,
  calendarOutline,
  checkmarkOutline
} from 'ionicons/icons';

import { DatabaseService } from '../services/database.service';
import {
  Transaction,
  TransactionCategory
} from '../models/transaction.model';

@Component({
  selector: 'app-edit-transaction',
  templateUrl: './edit-transaction.page.html',
  styleUrls: ['./edit-transaction.page.scss'],
  standalone: true,
  imports: [
    // IonContent,
    IonIcon,
    IonInput,
    IonTextarea,
    CommonModule,
    FormsModule
  ]
})
export class EditTransactionPage implements OnInit {

  title = '';

  amount: number | null = null;

  type: 'income' | 'expense' = 'expense';

  category: TransactionCategory = 'Other';

  date = '';

  timeHour = '12';

  timeMinute = '00';

  timePeriod: 'AM' | 'PM' = 'AM';

  hours: string[] = [
    '12',
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11'
  ];

  minutes: string[] = Array.from(
    { length: 60 },
    (_, index) =>
      String(index).padStart(2, '0')
  );

  notes = '';

  isSaving = false;

  isLoading = true;

  private transactionId: number | null = null;

  categories: TransactionCategory[] = [
    'Food',
    'Transport',
    'Shopping',
    'Bills',
    'Entertainment',
    'Other'
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private databaseService: DatabaseService
  ) {

    addIcons({
      arrowBackOutline,
      createOutline,
      arrowDownOutline,
      arrowUpOutline,
      gridOutline,
      chevronDownOutline,
      calendarOutline,
      checkmarkOutline
    });

  }

  async ngOnInit(): Promise<void> {

    const idParam = this.route.snapshot.paramMap.get('id');

    const id = idParam ? Number(idParam) : NaN;

    if (!idParam || Number.isNaN(id)) {

      alert('No transaction specified to edit.');
      this.router.navigate(['/transactions']);
      return;

    }

    this.transactionId = id;

    await this.loadTransaction(id);

  }

  get selectedTime(): string {
    return `${this.timeHour}:${this.timeMinute} ${this.timePeriod}`;
  }

  // =========================================================
  // LOAD EXISTING TRANSACTION
  // =========================================================

  private async loadTransaction(id: number): Promise<void> {

    this.isLoading = true;

    try {

      const transaction =
        await this.databaseService.getTransactionById(id);

      if (!transaction) {

        alert('Transaction not found.');
        this.router.navigate(['/transactions']);
        return;

      }

      this.title = transaction.title;
      this.amount = transaction.amount;
      this.type = transaction.type;
      this.category = transaction.category as TransactionCategory;
      this.date = transaction.date;
      this.notes = transaction.notes ?? '';

      // Parse the stored time string (e.g. "3:45 PM") back into parts
      if (transaction.time) {
        const match = transaction.time.match(
          /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
        );
        if (match) {
          this.timeHour   = match[1].padStart(2, '0');
          this.timeMinute = match[2];
          this.timePeriod = match[3].toUpperCase() as 'AM' | 'PM';
        }
      }

    } catch (error) {

      console.error(
        'Failed to load transaction for editing:',
        error
      );

      alert('Failed to load transaction. Please try again.');

      this.router.navigate(['/transactions']);

    } finally {

      this.isLoading = false;

    }

  }

  // =========================================================
  // SAVE CHANGES
  // =========================================================

  async saveTransaction(): Promise<void> {

    if (this.isSaving || !this.transactionId) {
      return;
    }

    if (!this.title.trim()) {
      alert('Please enter a transaction title.');
      return;
    }

    if (
      this.amount === null ||
      this.amount <= 0
    ) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!this.category) {
      alert('Please select a category.');
      return;
    }

    if (!this.date) {
      alert('Please select a date.');
      return;
    }

    if (this.category === 'Bills' && !this.selectedTime) {
      alert('Please select a due time for the bill.');
      return;
    }

    this.isSaving = true;

    try {

      const transaction: Transaction = {
        id: this.transactionId,
        title: this.title.trim(),
        amount: Number(this.amount),
        type: this.type,
        category: this.category,
        date: this.date,
        time: this.category === 'Bills'
          ? this.selectedTime
          : undefined,
        notes: this.notes.trim()
      };

      await this.databaseService.updateTransaction(
        transaction
      );

      await this.router.navigate(['/transactions']);

    } catch (error) {

      console.error(
        'Failed to update transaction:',
        error
      );

      alert(
        'Failed to save changes. Please try again.'
      );

    } finally {

      this.isSaving = false;

    }

  }

  goBack(): void {

    this.router.navigate(['/transactions']);

  }

}