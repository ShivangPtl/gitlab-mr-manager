import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareBranches } from './compare-branches';

describe('CompareBranches', () => {
  let component: CompareBranches;
  let fixture: ComponentFixture<CompareBranches>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareBranches]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompareBranches);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
