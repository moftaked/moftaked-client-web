import { TestBed } from '@angular/core/testing';

import { EventReportService } from './event-report.service';

describe('EventReportService', () => {
  let service: EventReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
