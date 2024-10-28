import { TestBed } from '@angular/core/testing';

import { StudentFormService } from './student-form.service';

describe('StudentFormService', () => {
  let service: StudentFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StudentFormService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
