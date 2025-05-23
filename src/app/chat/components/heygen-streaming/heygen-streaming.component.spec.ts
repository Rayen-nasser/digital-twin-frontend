import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeygenStreamingComponent } from './heygen-streaming.component';

describe('HeygenStreamingComponent', () => {
  let component: HeygenStreamingComponent;
  let fixture: ComponentFixture<HeygenStreamingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HeygenStreamingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HeygenStreamingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
