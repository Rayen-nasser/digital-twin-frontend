import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateTwinComponent } from './create-twin.component';

describe('CreateTwinComponent', () => {
  let component: CreateTwinComponent;
  let fixture: ComponentFixture<CreateTwinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreateTwinComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateTwinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
