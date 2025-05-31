import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StreamingPanelComponent } from './streaming-panel.component';

describe('StreamingPanelComponent', () => {
  let component: StreamingPanelComponent;
  let fixture: ComponentFixture<StreamingPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StreamingPanelComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StreamingPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
