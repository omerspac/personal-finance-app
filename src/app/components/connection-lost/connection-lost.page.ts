import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline,
  refreshOutline
} from 'ionicons/icons';
import { Subscription, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { NetworkService } from '../../services/network.service';

@Component({
  selector: 'app-connection-lost',
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    IonButton
  ],
  templateUrl: './connection-lost.page.html',
  styleUrls: ['./connection-lost.page.scss']
})
export class ConnectionLostPage implements OnDestroy {

  isWaiting = false;
  reconnectFailed = false;

  private subscription?: Subscription;
  private timeoutSubscription?: Subscription;

  constructor(
    public networkService: NetworkService
  ) {

    addIcons({
      cloudOfflineOutline,
      refreshOutline
    });

  }

  closeModal(): void {

    this.cleanupSubscriptions();

    this.networkService.dismiss();

  }

  reload(): void {

    // Prevent multiple reload attempts at the same time
    if (this.isWaiting) {
      return;
    }

    this.isWaiting = true;
    this.reconnectFailed = false;

    // Clean up any previous subscriptions
    this.cleanupSubscriptions();

    /*
     * Listen for the internet connection.
     * If connection comes back within 15 seconds,
     * reload the application.
     */
    this.subscription = this.networkService.isOnline$
      .subscribe(online => {

        if (online) {

          this.cleanupSubscriptions();

          window.location.reload();

        }

      });

    /*
     * Give the connection 15 seconds to come back.
     */
    this.timeoutSubscription = timer(15000)
      .subscribe(() => {

        // If we're still waiting after 15 seconds,
        // stop waiting and show the modal again.
        if (this.isWaiting) {

          this.isWaiting = false;
          this.reconnectFailed = true;

          this.subscription?.unsubscribe();
          this.subscription = undefined;

          this.timeoutSubscription?.unsubscribe();
          this.timeoutSubscription = undefined;

        }

      });

  }

  private cleanupSubscriptions(): void {

    this.subscription?.unsubscribe();
    this.subscription = undefined;

    this.timeoutSubscription?.unsubscribe();
    this.timeoutSubscription = undefined;

  }

  ngOnDestroy(): void {

    this.cleanupSubscriptions();

  }

}