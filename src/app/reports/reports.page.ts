import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  // IonContent,
  IonIcon,
  IonActionSheet
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  chevronDownOutline,
  trendingUpOutline,
  trendingDownOutline,
  walletOutline,
  receiptOutline
} from 'ionicons/icons';

import { DatabaseService } from '../services/database.service';
import { Transaction } from '../models/transaction.model';

interface MonthlySeriesItem {
  label: string;
  key: string;
  income: number;
  expenses: number;
  incomeHeight: number;
  expensesHeight: number;
  isCurrentMonth: boolean;
}

interface CategoryExpenseItem {
  name: string;
  amount: number;
  percent: number;
  dotClass: string;
}

interface MonthOption {
  label: string;
  key: string;
  date: Date;
}


@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: true,
  imports: [
    // IonContent,
    IonIcon,
    IonActionSheet,
    CommonModule
  ]
})
export class ReportsPage implements OnInit {

  selectedMonthLabel = '';

  monthlySeries: MonthlySeriesItem[] = [];

  categoryExpenses: CategoryExpenseItem[] = [];

  monthlyIncome = 0;

  monthlyExpenses = 0;

  monthlyNetSavings = 0;

  monthlyTransactionsCount = 0;

  // =========================================================
  // MONTH SELECTOR STATE
  // =========================================================

  showMonthSheet = false;

  private selectedDate: Date = new Date();

  private allTransactions: Transaction[] = [];

  private readonly categoryDotClassMap: Record<string, string> = {
    Food: 'food-dot',
    Transport: 'transport-dot',
    Shopping: 'shopping-dot',
    Bills: 'bills-dot',
    Entertainment: 'entertainment-dot',
    Other: 'other-dot'
  };

  private readonly categoryColorMap: Record<string, string> = {
    Food: '#d97828',
    Transport: '#5576c9',
    Shopping: '#8b6ac9',
    Bills: '#d45b5b',
    Entertainment: '#d4a13f',
    Other: '#7b828c'
  };

  constructor(
    private databaseService: DatabaseService
  ) {

    addIcons({
      chevronDownOutline,
      trendingUpOutline,
      trendingDownOutline,
      walletOutline,
      receiptOutline
    });

  }

  async ngOnInit(): Promise<void> {

    await this.loadReportData();

  }

  async ionViewWillEnter(): Promise<void> {

    await this.loadReportData();

  }

  get monthlyExpensesDonutStyle(): string {

    if (this.monthlyExpenses <= 0 || this.categoryExpenses.length === 0) {
      return 'conic-gradient(#e8eaed 0deg 360deg)';
    }

    let currentDegree = 0;

    const gradientSegments = this.categoryExpenses.map((category) => {
      const start = currentDegree;
      const delta = (category.percent / 100) * 360;
      const end = start + delta;
      currentDegree = end;
      const color = this.categoryColorMap[category.name] ?? '#7b828c';
      return `${color} ${start}deg ${end}deg`;
    });

    return `conic-gradient(${gradientSegments.join(', ')})`;

  }

  // =========================================================
  // MONTH SELECTOR
  // =========================================================

  openMonthSelector(): void {

    this.showMonthSheet = true;

  }

  get monthActionButtons() {

    return [

      ...this.availableMonths.map(option => ({
        text: option.label,
        handler: () => {
          this.selectMonth(option.date);
        }
      })),

      {
        text: 'Cancel',
        role: 'cancel'
      }

    ];

  }

  // Every month from January of the current year through the current month,
  // most recent first.
  private get availableMonths(): MonthOption[] {

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();

    const months: MonthOption[] = [];

    for (let monthIndex = currentMonthIndex; monthIndex >= 0; monthIndex -= 1) {

      const date = new Date(currentYear, monthIndex, 1);

      months.push({
        label: date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        }),
        key: this.getMonthKey(date),
        date
      });

    }

    return months;

  }

  private selectMonth(date: Date): void {

    this.selectedDate = date;

    this.recomputeAll();

  }

  // =========================================================
  // LOAD REPORT DATA
  // =========================================================

  private async loadReportData(): Promise<void> {

    try {

      this.allTransactions =
        await this.databaseService.getTransactions();

      this.recomputeAll();

    } catch (error) {

      console.error(
        'Failed to load reports data:',
        error
      );

    }

  }

  private recomputeAll(): void {

    this.computeSelectedMonth(this.allTransactions);
    this.computeMonthlySeries(this.allTransactions);

  }

  private computeSelectedMonth(
    transactions: Transaction[]
  ): void {

    const selectedMonthKey = this.getMonthKey(this.selectedDate);

    this.selectedMonthLabel = this.selectedDate.toLocaleDateString(
      'en-US',
      {
        month: 'long',
        year: 'numeric'
      }
    );

    const selectedMonthTransactions =
      transactions.filter(transaction =>
        transaction.date.startsWith(selectedMonthKey)
      );

    this.monthlyIncome = selectedMonthTransactions
      .filter(transaction => transaction.type === 'income')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    this.monthlyExpenses = selectedMonthTransactions
      .filter(transaction => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    this.monthlyNetSavings =
      this.monthlyIncome - this.monthlyExpenses;

    this.monthlyTransactionsCount =
      selectedMonthTransactions.length;

    this.computeCategoryExpenses(selectedMonthTransactions);

  }

  private computeCategoryExpenses(
    transactions: Transaction[]
  ): void {

    const expenseTransactions = transactions
      .filter(transaction => transaction.type === 'expense');

    const totalExpense = expenseTransactions
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const categoryAmountMap = new Map<string, number>();

    for (const transaction of expenseTransactions) {
      const existingAmount =
        categoryAmountMap.get(transaction.category) ?? 0;
      categoryAmountMap.set(
        transaction.category,
        existingAmount + Number(transaction.amount || 0)
      );
    }

    this.categoryExpenses = Array
      .from(categoryAmountMap.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: totalExpense > 0
          ? (amount / totalExpense) * 100
          : 0,
        dotClass:
          this.categoryDotClassMap[name] ?? 'other-dot'
      }))
      .sort((first, second) => second.amount - first.amount);

  }

  // Trailing 6 months ending at the selected month.
  private computeMonthlySeries(
    transactions: Transaction[]
  ): void {

    const anchor = this.selectedDate;
    const monthBuckets: MonthlySeriesItem[] = [];

    for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo -= 1) {

      const date = new Date(
        anchor.getFullYear(),
        anchor.getMonth() - monthsAgo,
        1
      );

      const monthKey = this.getMonthKey(date);

      const monthTransactions =
        transactions.filter(transaction =>
          transaction.date.startsWith(monthKey)
        );

      const income = monthTransactions
        .filter(transaction => transaction.type === 'income')
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      const expenses = monthTransactions
        .filter(transaction => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      monthBuckets.push({
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        key: monthKey,
        income,
        expenses,
        incomeHeight: 0,
        expensesHeight: 0,
        isCurrentMonth: monthsAgo === 0
      });

    }

    const maxAmount = Math.max(
      1,
      ...monthBuckets.map(month => Math.max(month.income, month.expenses))
    );

    this.monthlySeries = monthBuckets.map(month => ({
      ...month,
      incomeHeight: (month.income / maxAmount) * 100,
      expensesHeight: (month.expenses / maxAmount) * 100
    }));

  }

  private getMonthKey(date: Date): string {

    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;

  }

}