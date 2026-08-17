import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Network } from '@capacitor/network';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  private onlineSubject = new BehaviorSubject<boolean>(true);
  readonly isOnline$ = this.onlineSubject.asObservable();

  // True once the user taps "Close" on the disconnected modal, so it
  // doesn't keep reappearing until connection state actually changes.
  private dismissedSubject = new BehaviorSubject<boolean>(false);
  readonly dismissed$ = this.dismissedSubject.asObservable();

  private initialized = false;

  async initialize(): Promise<void> {

    if (this.initialized) {
      return;
    }

    this.initialized = true;

    const status = await Network.getStatus();
    this.onlineSubject.next(status.connected);

    Network.addListener('networkStatusChange', (status) => {

      this.onlineSubject.next(status.connected);

      if (status.connected) {

        // Reset dismissal so the modal shows fresh next time we drop.
        this.dismissedSubject.next(false);

      }

    });

  }

  async isOnline(): Promise<boolean> {

    const status = await Network.getStatus();
    return status.connected;

  }

  dismiss(): void {

    this.dismissedSubject.next(true);

  }

}