import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  private darkModeSubject = new BehaviorSubject<boolean>(
    localStorage.getItem('theme') === 'dark'
  );

  darkMode$ = this.darkModeSubject.asObservable();


  constructor() {

    this.applyTheme(
      this.darkModeSubject.value
    );

  }


  getIsDarkMode(): boolean {

    return this.darkModeSubject.value;

  }


  toggleTheme(): void {

    this.setDarkMode(
      !this.darkModeSubject.value
    );

  }


  setDarkMode(isDark: boolean): void {

    this.darkModeSubject.next(isDark);

    this.applyTheme(isDark);

    localStorage.setItem(
      'theme',
      isDark ? 'dark' : 'light'
    );

  }


  private applyTheme(isDark: boolean): void {

    document.documentElement.classList.toggle(
      'dark',
      isDark
    );

  }

}