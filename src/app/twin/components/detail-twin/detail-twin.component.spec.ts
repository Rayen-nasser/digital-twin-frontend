import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailTwinComponent } from './detail-twin.component';

describe('DetailTwinComponent', () => {
  let component: DetailTwinComponent;
  let fixture: ComponentFixture<DetailTwinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetailTwinComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DetailTwinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
