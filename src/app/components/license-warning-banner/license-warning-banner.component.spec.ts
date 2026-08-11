import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseWarningBannerComponent } from './license-warning-banner.component';

describe('LicenseWarningBannerComponent', () => {
  let component: LicenseWarningBannerComponent;
  let fixture: ComponentFixture<LicenseWarningBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LicenseWarningBannerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LicenseWarningBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
