import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  // IonContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  moonOutline,
  sunnyOutline,
  logOutOutline,
  arrowUpOutline,
  arrowDownOutline,
  trendingUpOutline,
  trendingDownOutline,
  receiptOutline,
  barChartOutline,
  settingsOutline,
  homeOutline,
  chevronForwardOutline,
  restaurantOutline,
  cashOutline,
  carOutline
} from 'ionicons/icons';

import { ThemeService } from '../services/theme.service';
import { DatabaseService } from '../services/database.service';
import { Transaction } from '../models/transaction.model';


@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    // IonContent,
    IonButton,
    IonIcon,
    CommonModule
  ]
})

export class HomePage implements OnDestroy {

  isDarkMode = false;

  private themeSubscription?: Subscription;

  totalIncome = 0;

  totalExpenses = 0;

  totalBalance = 0;

  monthlyIncome = 0;

  monthlyExpenses = 0;

  currentMonthLabel = '';

  todayTransactions: Transaction[] = [];

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private databaseService: DatabaseService
  ) {

    addIcons({
      moonOutline,
      sunnyOutline,
      logOutOutline,
      arrowUpOutline,
      arrowDownOutline,
      trendingUpOutline,
      trendingDownOutline,
      receiptOutline,
      barChartOutline,
      settingsOutline,
      homeOutline,
      chevronForwardOutline,
      restaurantOutline,
      cashOutline,
      carOutline
    });

    this.isDarkMode =
      this.themeService.getIsDarkMode();


    this.themeSubscription =
      this.themeService.darkMode$.subscribe(
        (isDark) => {

          this.isDarkMode = isDark;

        }
      );

  }

  async ngOnInit(): Promise<void> {

    await this.loadDashboardData();

  }

  async ionViewWillEnter(): Promise<void> {

    await this.loadDashboardData();

  }

  private async loadDashboardData(): Promise<void> {

    try {

      const transactions =
        await this.databaseService.getTransactions();

      this.computeTotals(transactions);
      this.computeTodayTransactions(transactions);
      this.computeMonthlyTotals(transactions);

    } catch (error) {

      console.error(
        'Failed to load dashboard data:',
        error
      );

    }

  }

  private computeTotals(
    transactions: Transaction[]
  ): void {

    this.totalIncome = transactions
      .filter(transaction => transaction.type === 'income')
      .reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      );

    this.totalExpenses = transactions
      .filter(transaction => transaction.type === 'expense')
      .reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      );

    this.totalBalance =
      this.totalIncome - this.totalExpenses;

  }

  private computeTodayTransactions(
    transactions: Transaction[]
  ): void {

    const today = this.getLocalIsoDate(new Date());

    this.todayTransactions = transactions
      .filter(transaction => transaction.date === today)
      .sort((first, second) => {
        const firstId = first.id ?? 0;
        const secondId = second.id ?? 0;
        return secondId - firstId;
      });

  }

  private computeMonthlyTotals(
    transactions: Transaction[]
  ): void {

    const now = new Date();

    this.currentMonthLabel = now.toLocaleDateString(
      'en-US',
      {
        month: 'long',
        year: 'numeric'
      }
    );

    const currentMonthPrefix = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;

    const monthlyTransactions =
      transactions.filter(transaction =>
        transaction.date.startsWith(currentMonthPrefix)
      );

    this.monthlyIncome = monthlyTransactions
      .filter(transaction => transaction.type === 'income')
      .reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      );

    this.monthlyExpenses = monthlyTransactions
      .filter(transaction => transaction.type === 'expense')
      .reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      );

  }

  private getLocalIsoDate(date: Date): string {

    const offsetMs = date.getTimezoneOffset() * 60 * 1000;

    return new Date(date.getTime() - offsetMs)
      .toISOString()
      .split('T')[0];

  }

  getTransactionIconName(
    transaction: Transaction
  ): string {

    if (transaction.type === 'income') {
      return 'cash-outline';
    }

    if (transaction.category === 'Food') {
      return 'restaurant-outline';
    }

    if (transaction.category === 'Transport') {
      return 'car-outline';
    }

    return 'receipt-outline';

  }

  getTransactionIconClass(
    transaction: Transaction
  ): string {

    if (transaction.type === 'income') {
      return 'salary';
    }

    if (transaction.category === 'Food') {
      return 'food';
    }

    if (transaction.category === 'Transport') {
      return 'transport';
    }

    return 'food';

  }


  toggleTheme(): void {

    this.themeService.toggleTheme();

  }


  logout(): void {

    this.router.navigate(['/login']);

  }


  openTransactions(): void {

    this.router.navigate(['/transactions']);

  }


  goTo(page: string): void {

    switch (page) {

      case 'home':
        this.router.navigate(['/home']);
        break;

      case 'transactions':
        this.router.navigate(['/transactions']);
        break;

      case 'reports':
        this.router.navigate(['/reports']);
        break;

      case 'settings':
        this.router.navigate(['/settings']);
        break;

    }

  }


  ngOnDestroy(): void {

    this.themeSubscription?.unsubscribe();

  }

}