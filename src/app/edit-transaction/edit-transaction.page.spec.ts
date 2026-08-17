import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditTransactionPage } from './edit-transaction.page';

describe('EditTransactionPage', () => {
  let component: EditTransactionPage;
  let fixture: ComponentFixture<EditTransactionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EditTransactionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
