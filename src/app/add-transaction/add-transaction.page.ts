import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';

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
  selector: 'app-add-transaction',
  templateUrl: './add-transaction.page.html',
  styleUrls: ['./add-transaction.page.scss'],
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
export class AddTransactionPage implements OnInit {

  title = '';

  amount: number | null = null;

  type: 'income' | 'expense' = 'expense';

  category: TransactionCategory = 'Other';

  date = '';

  notes = '';

  isSaving = false;

  categories: TransactionCategory[] = [
    'Food',
    'Transport',
    'Shopping',
    'Bills',
    'Entertainment',
    'Other'
  ];

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

  constructor(
    private router: Router,
    private databaseService: DatabaseService,
    private notificationService: NotificationService
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

  ngOnInit(): void {

    this.date = this.getTodayDate();

  }

  get selectedTime(): string {
    return `${this.timeHour}:${this.timeMinute} ${this.timePeriod}`;
  }

  private getTodayDate(): string {

    const today = new Date();

    const year = today.getFullYear();

    const month = String(today.getMonth() + 1)
      .padStart(2, '0');

    const day = String(today.getDate())
      .padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  async saveTransaction(): Promise<void> {

    if (this.isSaving) {
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
      alert('Please select a bill due time.');
      return;
    }

    this.isSaving = true;

    try {

      const transaction: Transaction = {
        title: this.title.trim(),
        amount: Number(this.amount),
        type: this.type,
        category: this.category,
        date: this.date,
        time:
          this.category === 'Bills'
          ? this.selectedTime
          : undefined,
        notes: this.notes.trim()
      };

      // HERE 
      const transactionId = await this.databaseService.addTransaction(
        transaction
      );

      // ========================================================= 
      // BILL NOTIFICATION 
      // =========================================================

      if (
        this.category === 'Bills' &&
        transaction.time
      ) {

        try {

          await this.notificationService.scheduleBillReminder(
            transactionId,
            transaction.title,
            transaction.amount,
            transaction.date,
            transaction.time
          );

        } catch (notificationError) {

          console.error(
            'Failed to schedule bill notification:',
            notificationError
          );

        }

      }

      await this.router.navigate(['/transactions']);

    } catch (error) {

      console.error(
        'Failed to save transaction:',
        error
      );

      alert(
        'Failed to save transaction. Please try again.'
      );

    } finally {

      this.isSaving = false;

    }

  }

  goBack(): void {

    this.router.navigate(['/transactions']);

  }

}
