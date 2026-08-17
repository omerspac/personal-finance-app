import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  // IonContent,
  // IonButton,
  IonIcon,
  IonInput,
  IonFab,
  IonFabButton,
  IonAlert,
  IonActionSheet
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  arrowBackOutline,
  searchOutline,
  chevronDownOutline,
  arrowDownOutline,
  arrowUpOutline,
  createOutline,
  trashOutline,
  receiptOutline,
  addOutline,
  homeOutline,
  barChartOutline,
  settingsOutline
} from 'ionicons/icons';

import { DatabaseService } from '../services/database.service';
import { Transaction } from '../models/transaction.model';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: true,
  imports: [
    // IonContent,
    // IonButton,
    IonIcon,
    IonInput,
    IonFab,
    IonFabButton,
    IonAlert,
    CommonModule,
    FormsModule,
    IonActionSheet
  ]
})
export class TransactionsPage implements OnInit {

  searchText = '';

  typeFilter: 'all' | 'income' | 'expense' = 'all';

  transactions: Transaction[] = [];

  // Transaction currently waiting for delete confirmation
  transactionToDelete: Transaction | null = null;

  // Controls the confirmation popup
  showDeleteAlert = false;

  categoryFilter: string | null = null;
  availableCategories: string[] = [];
  showCategorySheet = false;

  constructor(
    private router: Router,
    private databaseService: DatabaseService
  ) {

    addIcons({

      arrowBackOutline,
      searchOutline,
      chevronDownOutline,
      arrowDownOutline,
      arrowUpOutline,
      createOutline,
      trashOutline,
      receiptOutline,
      addOutline,
      homeOutline,
      barChartOutline,
      settingsOutline

    });

  }

  async ngOnInit(): Promise<void> {

    await this.loadTransactions();

  }

  async ionViewWillEnter(): Promise<void> {

    await this.loadTransactions();

  }

  // =========================================================
  // LOAD TRANSACTIONS
  // =========================================================

  async loadTransactions(): Promise<void> {

    try {

      this.transactions = await this.databaseService.getTransactions();
      this.availableCategories = [...new Set(this.transactions.map(t => t.category))];

    } catch (error) {

      console.error(
        'Failed to load transactions:',
        error
      );

    }

  }

  // =========================================================
  // FILTERED TRANSACTIONS
  // =========================================================

  get filteredTransactions(): Transaction[] {

    return this.transactions.filter(t => {

      const matchesType =
        this.typeFilter === 'all' || t.type === this.typeFilter;

      const matchesCategory =
        !this.categoryFilter || t.category === this.categoryFilter;

      const matchesSearch =
        !this.searchText ||
        t.title.toLowerCase().includes(this.searchText.toLowerCase());

      return matchesType && matchesCategory && matchesSearch;

    });

  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  goBack(): void {

    this.router.navigate(['/home']);

  }

  // =========================================================
  // ADD TRANSACTION
  // =========================================================

  addTransaction(): void {

    this.router.navigate(['/add-transaction']);

  }

  // =========================================================
  // EDIT TRANSACTION
  // =========================================================

  editTransaction(
    transaction: Transaction
  ): void {

    if (!transaction.id) {

      return;

    }

    this.router.navigate([
      '/edit-transaction',
      transaction.id
    ]);

  }

  // =========================================================
  // DELETE TRANSACTION
  // =========================================================

  deleteTransaction(
    transaction: Transaction
  ): void {

    if (!transaction.id) {

      return;

    }

    // Store the transaction that the user wants to delete
    this.transactionToDelete = transaction;

    // Open confirmation popup
    this.showDeleteAlert = true;

  }

  // =========================================================
  // CONFIRM DELETE
  // =========================================================

  async confirmDelete(): Promise<void> {

    if (!this.transactionToDelete?.id) {

      return;

    }

    const transactionId =
      this.transactionToDelete.id;

    try {

      await this.databaseService.deleteTransaction(
        transactionId
      );

      await this.loadTransactions();

    } catch (error) {

      console.error(
        'Failed to delete transaction:',
        error
      );

    } finally {

      // Close popup
      this.showDeleteAlert = false;

      // Clear selected transaction
      this.transactionToDelete = null;

    }

  }

  // =========================================================
  // CANCEL DELETE
  // =========================================================

  cancelDelete(): void {

    this.showDeleteAlert = false;

    this.transactionToDelete = null;

  }

  // =========================================================
  // TYPE FILTER
  // =========================================================

  setTypeFilter(
    type: 'all' | 'income' | 'expense'
  ): void {

    this.typeFilter = type;

  }

  // =========================================================
  // CATEGORY FILTER
  // =========================================================

  openCategoryFilter(): void {

    this.showCategorySheet = true;

  }

  get categoryActionButtons() {

    return [

      {
        text: 'All Categories',
        handler: () => {
          this.categoryFilter = null;
        }
      },

      ...this.availableCategories.map(cat => ({
        text: cat,
        handler: () => {
          this.categoryFilter = cat;
        }
      })),

      {
        text: 'Cancel',
        role: 'cancel'
      }

    ];

  }

}