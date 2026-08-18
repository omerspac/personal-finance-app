import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  async exportTransactionsToCsv(
    transactions: Transaction[]
  ): Promise<void> {

    const csv = this.buildCsv(transactions);
    const fileName = `omfin-transactions-${this.getTimestamp()}.csv`;

    if (Capacitor.getPlatform() === 'web') {

      this.downloadOnWeb(csv, fileName);
      return;

    }

    await this.saveAndShareOnNative(csv, fileName);

  }

  // =========================================================
  // CSV BUILDING
  // =========================================================

  private buildCsv(transactions: Transaction[]): string {

    const header = ['Title', 'Amount', 'Type', 'Category', 'Date', 'Notes'];

    const rows = transactions.map(t => [
      this.escapeCsvValue(t.title),
      String(t.amount),
      t.type,
      this.escapeCsvValue(t.category),
      t.date,
      this.escapeCsvValue(t.notes ?? '')
    ]);

    return [header, ...rows]
      .map(row => row.join(','))
      .join('\n');

  }

  private escapeCsvValue(value: string): string {

    const needsQuotes = /[",\n]/.test(value);
    const escaped = value.replace(/"/g, '""');

    return needsQuotes ? `"${escaped}"` : escaped;

  }

  // =========================================================
  // WEB DOWNLOAD
  // =========================================================

  private downloadOnWeb(csv: string, fileName: string): void {

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

  }

  // =========================================================
  // NATIVE SAVE + SHARE
  // =========================================================

  private async saveAndShareOnNative(
    csv: string,
    fileName: string
  ): Promise<void> {

    // The CSV is written to the app-private cache directory. Unlike the
    // public Documents directory, this is always writable on every
    // Android version (no storage permission, no scoped-storage
    // restrictions) and the path is covered by the app's FileProvider
    // `cache-path` entry, so the Share sheet can open the file reliably.
    const writeResult = await Filesystem.writeFile({
      path: fileName,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });

    await Share.share({
      title: 'OmFin Transactions',
      text: 'Your exported transactions',
      url: writeResult.uri,
      dialogTitle: 'Save or open your CSV'
    });

  }

  private getTimestamp(): string {

    const now = new Date();

    const pad = (n: number) => String(n).padStart(2, '0');

    return (
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}`
    );

  }

}