import { TestBed } from '@angular/core/testing';

import { GitlabAuth } from './gitlab-auth';

describe('GitlabAuth', () => {
  let service: GitlabAuth;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GitlabAuth);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
