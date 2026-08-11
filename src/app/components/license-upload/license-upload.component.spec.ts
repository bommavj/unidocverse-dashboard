import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseUploadComponent } from './license-upload.component';

describe('LicenseUploadComponent', () => {
  let component: LicenseUploadComponent;
  let fixture: ComponentFixture<LicenseUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LicenseUploadComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LicenseUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
