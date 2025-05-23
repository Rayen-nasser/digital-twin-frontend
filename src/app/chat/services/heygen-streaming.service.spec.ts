import { TestBed } from '@angular/core/testing';

import { HeygenStreamingService } from './heygen-streaming.service';

describe('HeygenStreamingService', () => {
  let service: HeygenStreamingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HeygenStreamingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
