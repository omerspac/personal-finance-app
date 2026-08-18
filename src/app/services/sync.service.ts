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

    // Cloud storage is already scoped to the authenticated user's own
    // Firestore sub-collection, so the PUSH below can only ever write
    // into the current user's folder.
    const transactionsRef = collection(
      this.firestore,
      `users/${user.uid}/transactions`
    );

    // Local data is scoped per user as well (see DatabaseService), so the
    // transactions read here belong to the currently signed-in user only.
    const localTransactions =
      await this.databaseService.getTransactions();

    // ---------------------------------------------
    // PUSH: upsert every local transaction to Firestore
    // ---------------------------------------------

    for (const transaction of localTransactions) {

      if (!transaction.id) {
        continue;
      }

      // Every cloud document is stamped with the owner's uid so a PULL
      // can verify ownership and never import another account's rows.
      await setDoc(
        doc(transactionsRef, String(transaction.id)),
        {
          ...transaction,
          uid: user.uid
        }
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

      const data = docSnap.data();

      // Isolation guard: only import documents that are explicitly owned
      // by the current user. Documents without a uid field (written by
      // the pre-fix version, when the PUSH step could copy another
      // user's local data into this folder) are never imported, so a
      // user can never read or display another user's transactions.
      const documentUid = data?.['uid'] as string | undefined;

      if (documentUid !== user.uid) {
        continue;
      }

      const remoteId = Number(docSnap.id);

      if (!localIds.has(remoteId)) {

        const transactionData = data as Transaction;

        await this.databaseService.insertTransactionWithId({
          ...transactionData,
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