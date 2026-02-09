import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperadminDashboard } from './superadmin-dashboard';

describe('SuperadminDashboard', () => {
  let component: SuperadminDashboard;
  let fixture: ComponentFixture<SuperadminDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperadminDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperadminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
