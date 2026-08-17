import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LockScreenPage } from './lock-screen.page';

describe('LockScreenPage', () => {
  let component: LockScreenPage;
  let fixture: ComponentFixture<LockScreenPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LockScreenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
