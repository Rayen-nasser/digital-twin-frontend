import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListTwinComponent } from './list-twin.component';

describe('ListTwinComponent', () => {
  let component: ListTwinComponent;
  let fixture: ComponentFixture<ListTwinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListTwinComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListTwinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
