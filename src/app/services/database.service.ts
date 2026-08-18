import { Injectable } from '@angular/core';

import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection
} from '@capacitor-community/sqlite';

import { Capacitor } from '@capacitor/core';

import { Preferences } from '@capacitor/preferences';

import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';

import {
  Transaction
} from '../models/transaction.model';

import {
  Reminder
} from '../models/reminder.model';

// Marks whether the pre-isolation `omfin` database has already been
// migrated into a per-user database. The migration is one-time only: the
// legacy data goes to whichever user signs in first after the upgrade,
// and is never copied again (so it can never leak to a second account).
const LEGACY_MIGRATED_KEY = 'omfin_legacy_migrated';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  private sqlite: SQLiteConnection;

  private db?: SQLiteDBConnection;

  private initializationPromise?: Promise<void>;

  private pendingUid?: string;

  private currentUid?: string;

  private currentDatabaseName?: string;

  private readonly legacyDatabaseName = 'omfin';

  constructor(
    private authService: AuthService
  ) {
    this.sqlite = new SQLiteConnection(
      CapacitorSQLite
    );
  }

  // =========================================================
  // USER-SCOPED DATABASE NAME
  // =========================================================
  //
  // Every authenticated user gets their own SQLite database so that
  // local data is completely isolated. Logging out and logging into a
  // different account must never expose the previous user's rows.

  private getDatabaseNameForUser(uid: string): string {

    return `omfin_${uid.replace(/[^A-Za-z0-9_-]/g, '_')}`;

  }

  private async getCurrentUserUid(): Promise<string | null> {

    const user = await firstValueFrom(
      this.authService.user$
    );

    return user?.uid ?? null;

  }

  // =========================================================
  // GET DATABASE
  // =========================================================

  private getDatabase(): SQLiteDBConnection {

    if (!this.db) {
      throw new Error(
        'Database has not been initialized yet.'
      );
    }

    return this.db;
  }

  private async ensureDatabaseReady(): Promise<SQLiteDBConnection> {

    await this.initializeDatabase();

    return this.getDatabase();
  }

  // =========================================================
  // DATABASE INITIALIZATION
  // =========================================================
  //
  // Initializes the SQLite connection for the CURRENTLY authenticated
  // user. If the signed-in user changed since the last initialization
  // the previous connection is closed first so no cross-user data can
  // ever be read.

  async initializeDatabase(): Promise<void> {

    const uid = await this.getCurrentUserUid();

    if (!uid) {

      // Not logged in: there is no per-user database to open. Close any
      // stale connection so the next login always starts clean.
      await this.closeDatabase();

      return;

    }

    const databaseName = this.getDatabaseNameForUser(uid);

    if (this.db && this.currentUid === uid) {

      // Already initialized for this user.
      return;

    }

    if (this.initializationPromise && this.pendingUid === uid) {

      // A concurrent call is already initializing for the same user.
      return this.initializationPromise;

    }

    await this.closeDatabase();

    this.currentUid = uid;

    this.pendingUid = uid;

    this.initializationPromise =
      this.initializeDatabaseInternal(databaseName);

    try {

      await this.initializationPromise;

    } finally {

      this.initializationPromise = undefined;

      this.pendingUid = undefined;

    }

  }

  private async initializeDatabaseInternal(
    databaseName: string
  ): Promise<void> {

    try {

      if (Capacitor.getPlatform() === 'web') {
        await this.ensureJeepSqliteElementForWeb();
        await this.sqlite.initWebStore();
        await this.waitForWebStoreOpen();
      }

      const consistency =
        await this.sqlite.checkConnectionsConsistency();

      const isConnection =
        await this.sqlite.isConnection(
          databaseName,
          false
        );

      if (
        consistency.result &&
        isConnection.result
      ) {

        this.db =
          await this.sqlite.retrieveConnection(
            databaseName,
            false
          );

      } else {

        this.db =
          await this.sqlite.createConnection(
            databaseName,
            false,
            'no-encryption',
            1,
            false
          );

      }

      this.currentDatabaseName = databaseName;

      const db = this.getDatabase();

      await db.open();

      await this.createTables();

      await this.migrateLegacyDatabaseIfNeeded();

      console.log(
        `OmFin SQLite initialized successfully (${databaseName})`
      );

    } catch (error) {

      console.error(
        'SQLite initialization failed:',
        error
      );

      throw error;

    }
  }

  // =========================================================
  // LEGACY DATA MIGRATION (one-time)
  // =========================================================
  //
  // Before per-user isolation the app stored everything in a single
  // `omfin` database. On the first login after the upgrade that data is
  // copied into the signed-in user's database so existing transactions
  // are preserved (never deleted) and remain visible to the account that
  // owns this device. The migration runs exactly once and never again,
  // so legacy rows can never be exposed to a second account.

  private async migrateLegacyDatabaseIfNeeded(): Promise<void> {

    const migrated =
      await Preferences.get({ key: LEGACY_MIGRATED_KEY });

    if (migrated.value === 'true') {
      return;
    }

    const target = this.getDatabase();

    try {

      const countResult = await target.query(`
        SELECT COUNT(*) AS count FROM transactions
      `);

      const currentCount = Number(
        (countResult.values ?? [])[0]?.count ?? 0
      );

      if (currentCount > 0) {

        // The user already has their own data - never merge legacy rows
        // into it.
        await Preferences.set({
          key: LEGACY_MIGRATED_KEY,
          value: 'true'
        });

        return;

      }

      let legacyDb: SQLiteDBConnection | null = null;

      try {

        const isLegacyConnection =
          await this.sqlite.isConnection(
            this.legacyDatabaseName,
            false
          );

        legacyDb = isLegacyConnection.result
          ? await this.sqlite.retrieveConnection(
              this.legacyDatabaseName,
              false
            )
          : await this.sqlite.createConnection(
              this.legacyDatabaseName,
              false,
              'no-encryption',
              1,
              false
            );

        await legacyDb.open();

        const transactionResult =
          await legacyDb.query(`
            SELECT * FROM transactions
          `);

        const reminderResult =
          await legacyDb.query(`
            SELECT * FROM reminders
          `);

        const legacyTransactions =
          (transactionResult.values ?? []) as Transaction[];

        const legacyReminders =
          (reminderResult.values ?? []) as Reminder[];

        const now = new Date().toISOString();

        for (const transaction of legacyTransactions) {

          if (!transaction.id) {
            continue;
          }

          await target.run(
            `
            INSERT OR REPLACE INTO transactions
            (
              id,
              title,
              amount,
              type,
              category,
              date,
              time,
              notification_id,
              notes,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              transaction.id,
              transaction.title,
              transaction.amount,
              transaction.type,
              transaction.category,
              transaction.date,
              transaction.time ?? null,
              transaction.notification_id ?? null,
              transaction.notes ?? '',
              transaction.created_at ?? now,
              transaction.updated_at ?? now
            ]
          );

        }

        for (const reminder of legacyReminders) {

          if (!reminder.id) {
            continue;
          }

          await target.run(
            `
            INSERT OR REPLACE INTO reminders
            (
              id,
              title,
              amount,
              due_date,
              notification_id,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              reminder.id,
              reminder.title,
              reminder.amount ?? null,
              reminder.due_date,
              reminder.notification_id ?? null,
              reminder.created_at ?? now
            ]
          );

        }

        await Preferences.set({
          key: LEGACY_MIGRATED_KEY,
          value: 'true'
        });

      } finally {

        if (legacyDb) {

          try {

            await this.sqlite.closeConnection(
              this.legacyDatabaseName,
              false
            );

          } catch (error) {

            console.warn(
              'Failed to close legacy database:',
              error
            );

          }

        }

      }

    } catch (error) {

      // Migration must never block login or data access.
      console.warn(
        'Legacy database migration failed:',
        error
      );

    }

  }

  private async ensureJeepSqliteElementForWeb(): Promise<void> {

    if (typeof document === 'undefined') {
      throw new Error(
        'Document is not available for web SQLite initialization.'
      );
    }

    await this.waitForJeepSqliteDefinition();

    const existingElement =
      document.querySelector('jeep-sqlite');

    if (existingElement) {
      existingElement.setAttribute('autoSave', 'true');
      existingElement.setAttribute('wasmPath', '/assets');
      await this.waitForJeepSqliteReady(existingElement);
      return;
    }

    const element =
      document.createElement('jeep-sqlite');

    element.setAttribute('autoSave', 'true');
    element.setAttribute('wasmPath', '/assets');

    document.body.appendChild(element);

    await this.waitForJeepSqliteReady(element);
  }

  private async waitForJeepSqliteReady(
    element: Element
  ): Promise<void> {

    await this.waitForJeepSqliteDefinition();

    const maybeComponent =
      element as HTMLElement & {
        componentOnReady?: () => Promise<unknown>;
      };

    if (typeof maybeComponent.componentOnReady === 'function') {
      await maybeComponent.componentOnReady();
    }
  }

  private async waitForJeepSqliteDefinition(): Promise<void> {

    const timeoutMs = 5000;

    await Promise.race([
      customElements.whenDefined('jeep-sqlite'),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(
            `jeep-sqlite did not load within ${timeoutMs / 1000} seconds. ` +
            'Make sure /assets/jeep-sqlite/jeep-sqlite.esm.js is available.'
          ));
        }, timeoutMs);
      })
    ]);

  }

  private async waitForWebStoreOpen(): Promise<void> {

    const element =
      document.querySelector('jeep-sqlite') as
        | (HTMLElement & {
            isStoreOpen?: () => Promise<boolean>;
          })
        | null;

    if (!element || typeof element.isStoreOpen !== 'function') {
      throw new Error(
        'jeep-sqlite element is not ready to open web store.'
      );
    }

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {

      const isOpen = await element.isStoreOpen();

      if (isOpen) {
        return;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 100);
      });
    }

    throw new Error(
      'Timed out while waiting for jeep-sqlite web store to open.'
    );
  }

  // =========================================================
  // CREATE TABLES
  // =========================================================
  private async createTables(): Promise<void> {

    const db = this.getDatabase();

    const transactionTable = `

      CREATE TABLE IF NOT EXISTS transactions (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        title TEXT NOT NULL,

        amount REAL NOT NULL,

        type TEXT NOT NULL,

        category TEXT NOT NULL,

        date TEXT NOT NULL,

        time TEXT,

        notes TEXT,

        created_at TEXT NOT NULL,

        updated_at TEXT NOT NULL

      );

    `;

    const reminderTable = `

      CREATE TABLE IF NOT EXISTS reminders (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        title TEXT NOT NULL,

        amount REAL,

        due_date TEXT NOT NULL,

        notification_id INTEGER,

        created_at TEXT NOT NULL

      );

    `;

    await db.execute(transactionTable);

    await db.execute(reminderTable);

    // =========================================================
    // MIGRATION
    // Add time and notification_id columns to existing
    // transactions table if they do not exist
    // =========================================================

    const columns = await db.query(`
      PRAGMA table_info(transactions)
    `);

    const hasTimeColumn: boolean =
      (columns.values ?? [])
        .some(
          (column: any) => column.name === 'time'
        );

    if (!hasTimeColumn) {

      await db.execute(`
        ALTER TABLE transactions
        ADD COLUMN time TEXT
      `);

    }


    const hasNotificationIdColumn: boolean =
      (columns.values ?? [])
        .some(
          (column: any) => column.name === 'notification_id'
        );

    if (!hasNotificationIdColumn) {

      await db.execute(`
        ALTER TABLE transactions
        ADD COLUMN notification_id INTEGER
      `);

    }

  }

  // =========================================================
  // TRANSACTIONS
  // =========================================================

  async addTransaction(
    transaction: Transaction
  ): Promise<number> {

    const db = await this.ensureDatabaseReady();

    const now =
      new Date().toISOString();

    const result =
      await db.run(
        `
        INSERT INTO transactions
        (
          title,
          amount,
          type,
          category,
          date,
          time,
          notification_id,
          notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          transaction.title,
          transaction.amount,
          transaction.type,
          transaction.category,
          transaction.date,
          transaction.time ?? null,
          transaction.notification_id ?? null,
          transaction.notes ?? '',
          now,
          now
        ]
      );

    return result.changes?.lastId ?? 0;
  }

  // =========================================================
  // INSERT TRANSACTION WITH EXPLICIT ID (used by cloud sync)
  // =========================================================

  async insertTransactionWithId(
    transaction: Transaction
  ): Promise<void> {

    if (!transaction.id) {

      throw new Error(
        'Transaction ID is required for insertTransactionWithId.'
      );
    }

    const db = await this.ensureDatabaseReady();

    const now = new Date().toISOString();

    await db.run(
      `
        INSERT OR REPLACE INTO transactions
        (
          id,
          title,
          amount,
          type,
          category,
          date,
          time,
          notification_id,
          notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        transaction.id,
        transaction.title,
        transaction.amount,
        transaction.type,
        transaction.category,
        transaction.date,
        transaction.time ?? null,
        transaction.notification_id ?? null,
        transaction.notes ?? '',
        transaction.created_at ?? now,
        transaction.updated_at ?? now
      ]
    );
    
  }
  // =========================================================
  // GET ALL TRANSACTIONS
  // =========================================================

  async getTransactions(): Promise<Transaction[]> {

    const db = await this.ensureDatabaseReady();

    const result =
      await db.query(
        `
        SELECT *
        FROM transactions
        ORDER BY date DESC, id DESC
        `
      );

    return (result.values ?? []) as Transaction[];
  }

  // =========================================================
  // GET TRANSACTION BY ID
  // =========================================================

  async getTransactionById(
    id: number
  ): Promise<Transaction | null> {

    const db = await this.ensureDatabaseReady();

    const result =
      await db.query(
        `
        SELECT *
        FROM transactions
        WHERE id = ?
        `,
        [id]
      );

    if (
      !result.values ||
      result.values.length === 0
    ) {

      return null;
    }

    return result.values[0] as Transaction;
  }

  // =========================================================
  // UPDATE TRANSACTION
  // =========================================================

  async updateTransaction(
    transaction: Transaction
  ): Promise<void> {

    if (!transaction.id) {

      throw new Error(
        'Transaction ID is required for update.'
      );
    }

    const db = await this.ensureDatabaseReady();

    const now =
      new Date().toISOString();

    await db.run(
      `
      UPDATE transactions

      SET
        title = ?,
        amount = ?,
        type = ?,
        category = ?,
        date = ?,
        time = ?,
        notification_id = ?,
        notes = ?,
        updated_at = ?

      WHERE id = ?
      `,
      [
        transaction.title,
        transaction.amount,
        transaction.type,
        transaction.category,
        transaction.date,
        transaction.time ?? null,
        transaction.notification_id ?? null,
        transaction.notes ?? '',
        now,
        transaction.id
      ]
    );
  }

  // =========================================================
  // DELETE TRANSACTION
  // =========================================================

  async deleteTransaction(
    id: number
  ): Promise<void> {

    const db = await this.ensureDatabaseReady();

    await db.run(
      `
      DELETE FROM transactions
      WHERE id = ?
      `,
      [id]
    );
  }

  // =========================================================
  // ADD REMINDER
  // =========================================================

  async addReminder(
    reminder: Reminder
  ): Promise<number> {

    const db = await this.ensureDatabaseReady();

    const now =
      new Date().toISOString();

    const result =
      await db.run(
        `
        INSERT INTO reminders
        (
          title,
          amount,
          due_date,
          notification_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          reminder.title,
          reminder.amount ?? null,
          reminder.due_date,
          reminder.notification_id ?? null,
          now
        ]
      );

    return result.changes?.lastId ?? 0;
  }

  // =========================================================
  // GET ALL REMINDERS
  // =========================================================

  async getReminders(): Promise<Reminder[]> {

    const db = await this.ensureDatabaseReady();

    const result =
      await db.query(
        `
        SELECT *
        FROM reminders
        ORDER BY due_date ASC, id ASC
        `
      );

    return (result.values ?? []) as Reminder[];
  }

  // =========================================================
  // GET REMINDER BY ID
  // =========================================================

  async getReminderById(
    id: number
  ): Promise<Reminder | null> {

    const db = await this.ensureDatabaseReady();

    const result =
      await db.query(
        `
        SELECT *
        FROM reminders
        WHERE id = ?
        `,
        [id]
      );

    if (
      !result.values ||
      result.values.length === 0
    ) {

      return null;
    }

    return result.values[0] as Reminder;
  }

  // =========================================================
  // UPDATE REMINDER
  // =========================================================

  async updateReminder(
    reminder: Reminder
  ): Promise<void> {

    if (!reminder.id) {

      throw new Error(
        'Reminder ID is required for update.'
      );
    }

    const db = await this.ensureDatabaseReady();

    await db.run(
      `
      UPDATE reminders

      SET
        title = ?,
        amount = ?,
        due_date = ?,
        notification_id = ?

      WHERE id = ?
      `,
      [
        reminder.title,
        reminder.amount ?? null,
        reminder.due_date,
        reminder.notification_id ?? null,
        reminder.id
      ]
    );
  }

  // =========================================================
  // DELETE REMINDER
  // =========================================================

  async deleteReminder(
    id: number
  ): Promise<void> {

    const db = await this.ensureDatabaseReady();

    await db.run(
      `
      DELETE FROM reminders
      WHERE id = ?
      `,
      [id]
    );
  }

  // =========================================================
  // CLOSE DATABASE
  // =========================================================

  async closeDatabase(): Promise<void> {

    if (this.db && this.currentDatabaseName) {

      try {

        await this.sqlite.closeConnection(
          this.currentDatabaseName,
          false
        );

      } catch (error) {

        console.warn(
          'Failed to close SQLite connection:',
          error
        );

      }

    }

    this.db = undefined;

    this.currentDatabaseName = undefined;

    this.currentUid = undefined;
  }
}