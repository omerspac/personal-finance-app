import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppLoadingPage } from './app-loading.page';

describe('AppLoadingPage', () => {
  let component: AppLoadingPage;
  let fixture: ComponentFixture<AppLoadingPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AppLoadingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
