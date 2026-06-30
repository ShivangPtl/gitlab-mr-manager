import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Promoter } from './promoter';

describe('Promoter', () => {
  let component: Promoter;
  let fixture: ComponentFixture<Promoter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Promoter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Promoter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
