import { TestBed } from '@angular/core/testing';

import { Auth } from '@angular/fire/auth';

import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DatabaseService,
        {
          provide: Auth,
          useValue: {
            onAuthStateChanged: (callback: any) => {
              callback(null);
              return () => {};
            }
          }
        }
      ]
    });
    service = TestBed.inject(DatabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});