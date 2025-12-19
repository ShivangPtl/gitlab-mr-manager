import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MergeRequests } from './merge-requests';

describe('MergeRequests', () => {
  let component: MergeRequests;
  let fixture: ComponentFixture<MergeRequests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MergeRequests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MergeRequests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
