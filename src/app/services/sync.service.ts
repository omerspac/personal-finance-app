import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

import { DatabaseService } from './database.service';
import { Transaction } from '../models/transaction.model';

export interface SyncResult {
  pushed: number;
  pulled: number;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private databaseService: DatabaseService
  ) { }

  async syncTransactions(): Promise<SyncResult> {

    const user = this.auth.currentUser;

    if (!user) {

      throw new Error(
        'You must be logged in to sync.'
      );

    }

    const transactionsRef = collection(
      this.firestore,
      `users/${user.uid}/transactions`
    );

    const localTransactions =
      await this.databaseService.getTransactions();

    // ---------------------------------------------
    // PUSH: upsert every local transaction to Firestore
    // ---------------------------------------------

    for (const transaction of localTransactions) {

      if (!transaction.id) {
        continue;
      }

      await setDoc(
        doc(transactionsRef, String(transaction.id)),
        transaction
      );

    }

    // ---------------------------------------------
    // PULL: bring down remote transactions we don't have locally
    // ---------------------------------------------

    const snapshot = await getDocs(transactionsRef);

    const localIds = new Set(
      localTransactions.map(t => t.id)
    );

    let pulledCount = 0;

    for (const docSnap of snapshot.docs) {

      const remoteId = Number(docSnap.id);

      if (!localIds.has(remoteId)) {

        const data = docSnap.data() as Transaction;

        await this.databaseService.insertTransactionWithId({
          ...data,
          id: remoteId
        });

        pulledCount += 1;

      }

    }

    return {
      pushed: localTransactions.length,
      pulled: pulledCount
    };

  }

}