import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppShellPage } from './app-shell.page';

describe('AppShellPage', () => {
  let component: AppShellPage;
  let fixture: ComponentFixture<AppShellPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AppShellPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
