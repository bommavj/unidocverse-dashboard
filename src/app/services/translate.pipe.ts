// src/app/services/translate.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Pure: false makes the pipe run on every change detection cycle, allowing dynamic language switches to refresh the view instantly
})
export class TranslatePipe implements PipeTransform {

  constructor(private language: LanguageService) {}

  transform(value: string): string {
    if (!value) return '';
    return this.language.translate(value);
  }
}
