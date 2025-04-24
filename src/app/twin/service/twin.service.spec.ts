import { TestBed } from '@angular/core/testing';

import { TwinService } from './twin.service';

describe('TwinService', () => {
  let service: TwinService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TwinService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
