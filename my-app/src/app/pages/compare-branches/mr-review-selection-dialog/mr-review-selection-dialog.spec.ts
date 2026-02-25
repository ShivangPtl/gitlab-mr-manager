import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MrReviewSelectionDialog } from './mr-review-selection-dialog';

describe('MrReviewSelectionDialog', () => {
  let component: MrReviewSelectionDialog;
  let fixture: ComponentFixture<MrReviewSelectionDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MrReviewSelectionDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MrReviewSelectionDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
