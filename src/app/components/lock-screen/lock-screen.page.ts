import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { fingerPrintOutline, lockClosedOutline } from 'ionicons/icons';

import { BiometricLockService } from '../../services/biometric-lock.service';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    IonButton
  ],
  templateUrl: './lock-screen.page.html',
  styleUrls: ['./lock-screen.page.scss']
})
export class LockScreenPage implements OnInit {

  isUnlocking = false;

  errorMessage: string | null = null;

  constructor(
    public lockService: BiometricLockService
  ) {

    addIcons({
      fingerPrintOutline,
      lockClosedOutline
    });

  }

  async ngOnInit(): Promise<void> {

    // Prompt immediately as soon as the lock screen appears
    await this.tryUnlock();

  }

  async tryUnlock(): Promise<void> {

    if (this.isUnlocking) {
      return;
    }

    this.isUnlocking = true;
    this.errorMessage = null;

    const result = await this.lockService.attemptUnlock();

    if (!result.success && !result.loggedOut) {

      const remaining = this.lockService.remainingAttempts;

      this.errorMessage =
        `Authentication failed. ${remaining} attempt(s) remaining before you'll be logged out.`;

    }

    this.isUnlocking = false;

  }

}