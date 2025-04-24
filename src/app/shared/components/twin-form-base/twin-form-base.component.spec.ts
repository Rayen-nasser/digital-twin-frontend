import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TwinFormBaseComponent } from './twin-form-base.component';

describe('TwinFormBaseComponent', () => {
  let component: TwinFormBaseComponent;
  let fixture: ComponentFixture<TwinFormBaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TwinFormBaseComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TwinFormBaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
