import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { DatabaseService } from './database.service';
import { Reminder } from '../models/reminder.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private databaseService: DatabaseService
  ) { }


  // =========================================================
  // PERMISSION
  // =========================================================

  async requestPermission(): Promise<boolean> {

    const result =
      await LocalNotifications.requestPermissions();

    return result.display === 'granted';

  }


  // =========================================================
  // ENABLE - schedule every upcoming reminder
  // =========================================================

  async enableReminderNotifications(): Promise<void> {

    const granted =
      await this.requestPermission();

    if (!granted) {

      throw new Error(
        'Notification permission was not granted.'
      );

    }

    const reminders =
      await this.databaseService.getReminders();

    for (const reminder of reminders) {

      await this.scheduleReminder(reminder);

    }

  }


  // =========================================================
  // DISABLE - cancel every scheduled reminder
  // =========================================================

  async disableReminderNotifications(): Promise<void> {

    const reminders =
      await this.databaseService.getReminders();

    const idsToCancel =
      reminders
        .filter(
          reminder =>
            reminder.notification_id != null
        )
        .map(
          reminder => ({
            id: reminder.notification_id as number
          })
        );

    if (idsToCancel.length > 0) {

      await LocalNotifications.cancel({
        notifications: idsToCancel
      });

    }

    for (const reminder of reminders) {

      if (
        reminder.notification_id != null &&
        reminder.id
      ) {

        await this.databaseService.updateReminder({

          ...reminder,

          notification_id: null

        });

      }

    }

  }


  // =========================================================
  // SCHEDULE EXISTING REMINDER
  // =========================================================

  private async scheduleReminder(
    reminder: Reminder
  ): Promise<void> {

    if (!reminder.id) {
      return;
    }

    const fireDate =
      new Date(reminder.due_date);

    if (
      Number.isNaN(fireDate.getTime()) ||
      fireDate.getTime() <= Date.now()
    ) {

      return;

    }

    const notificationId =
      reminder.id;

    await LocalNotifications.schedule({

      notifications: [

        {

          id: notificationId,

          title: 'Payment Reminder',

          body: reminder.amount
            ? `${reminder.title} - Rs. ${reminder.amount}`
            : reminder.title,

          schedule: {
            at: fireDate
          }

        }

      ]

    });

    await this.databaseService.updateReminder({

      ...reminder,

      notification_id: notificationId

    });

  }


  // =========================================================
  // PARSE 12-HOUR DATE + TIME
  // =========================================================

  private parse12HourDateTime(
    date: string,
    time: string
  ): Date {

    /*
     * Expected:
     *
     * 12:00 AM
     * 08:30 PM
     * 11:45 PM
     */

    const match =
      time.match(
        /^(\d{1,2}):(\d{2})\s(AM|PM)$/i
      );

    if (!match) {

      return new Date(NaN);

    }

    let hour =
      Number(match[1]);

    const minute =
      Number(match[2]);

    const period =
      match[3].toUpperCase();

    if (
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
    ) {

      return new Date(NaN);

    }

    // AM
    if (period === 'AM') {

      if (hour === 12) {

        hour = 0;

      }

    }

    // PM
    else {

      if (hour !== 12) {

        hour += 12;

      }

    }

    const [
      year,
      month,
      day
    ] = date
      .split('-')
      .map(Number);

    return new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0
    );

  }


  // =========================================================
  // SCHEDULE BILL REMINDER
  // =========================================================

  async scheduleBillReminder(
    transactionId: number,
    title: string,
    amount: number,
    dueDate: string,
    dueTime: string
  ): Promise<boolean> {

    const granted =
      await this.requestPermission();

    if (!granted) {

      console.warn(
        'Notification permission was not granted.'
      );

      return false;

    }

    const dueDateTime =
      this.parse12HourDateTime(
        dueDate,
        dueTime
      );

    if (
      Number.isNaN(
        dueDateTime.getTime()
      )
    ) {

      console.warn(
        'Invalid bill due date/time:',
        dueDate,
        dueTime
      );

      return false;

    }

    /*
     * Notification fires exactly
     * one hour before the bill.
     */

    const notificationDate =
      new Date(
        dueDateTime.getTime() -
        (60 * 60 * 1000)
      );


    /*
     * Do not schedule notifications
     * that are already in the past.
     */

    if (
      notificationDate.getTime() <=
      Date.now()
    ) {

      console.warn(
        'Bill reminder time has already passed.'
      );

      return false;

    }


    /*
     * Use transaction ID as notification ID.
     *
     * Example:
     *
     * Transaction ID = 25
     * Notification ID = 25
     */

    const notificationId =
      transactionId;


    /*
     * Cancel an existing notification
     * with the same ID first.
     *
     * This makes rescheduling safe.
     */

    try {

      await LocalNotifications.cancel({

        notifications: [

          {
            id: notificationId
          }

        ]

      });

    } catch {

      // Notification may not exist yet.
      // That's completely fine.

    }


    await LocalNotifications.schedule({

      notifications: [

        {

          id: notificationId,

          title: 'Bill Due Soon',

          body:
            `${title} is due in 1 hour. ` +
            `Please pay Rs. ${amount} ` +
            `before the due time.`,

          schedule: {

            at: notificationDate

          }

        }

      ]

    });


    return true;

  }


  // =========================================================
  // CANCEL BILL REMINDER
  // =========================================================

  async cancelBillReminder(
    notificationId: number | null | undefined
  ): Promise<void> {

    if (
      notificationId == null
    ) {

      return;

    }

    try {

      await LocalNotifications.cancel({

        notifications: [

          {
            id: notificationId
          }

        ]

      });

    } catch (error) {

      console.warn(
        'Failed to cancel bill notification:',
        error
      );

    }

  }

}