import { TestBed } from '@angular/core/testing';

import { EventsPageService } from './events-page.service';

describe('EventsPageService', () => {
  let service: EventsPageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventsPageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
