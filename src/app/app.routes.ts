import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [

  // =========================================
  // LOGIN - NO APP SHELL
  // =========================================

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/login.page')
        .then(m => m.LoginPage)
  },


  // =========================================
  // APP SHELL
  // =========================================

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/app-shell/app-shell.page')
        .then(m => m.AppShellPage),

    children: [

      // =========================================
      // DASHBOARD
      // =========================================

      {
        path: 'home',
        loadComponent: () =>
          import('./home/home.page')
            .then(m => m.HomePage)
      },


      // =========================================
      // TRANSACTIONS
      // =========================================

      {
        path: 'transactions',
        loadComponent: () =>
          import('./transactions/transactions.page')
            .then(m => m.TransactionsPage)
      },


      // =========================================
      // ADD TRANSACTION
      // =========================================

      {
        path: 'add-transaction',
        loadComponent: () =>
          import('./add-transaction/add-transaction.page')
            .then(m => m.AddTransactionPage)
      },


      // =========================================
      // EDIT TRANSACTION
      // =========================================

      {
        path: 'edit-transaction/:id',
        loadComponent: () =>
          import('./edit-transaction/edit-transaction.page')
            .then(m => m.EditTransactionPage)
      },


      // =========================================
      // REPORTS
      // =========================================

      {
        path: 'reports',
        loadComponent: () =>
          import('./reports/reports.page')
            .then(m => m.ReportsPage)
      },


      // =========================================
      // SETTINGS
      // =========================================

      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.page')
            .then(m => m.SettingsPage)
      },


      // =========================================
      // DEFAULT APP PAGE
      // =========================================

      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }

    ]
  },


  // =========================================
  // UNKNOWN ROUTES
  // =========================================

  {
    path: '**',
    redirectTo: 'login'
  },
  {
    path: 'connection-lost',
    loadComponent: () => import('./components/connection-lost/connection-lost.page').then( m => m.ConnectionLostPage)
  }

];