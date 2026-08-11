import { Injectable } from '@angular/core';
import { LanguageService } from './language.service';

export interface LocaleInfo {
  locale: string;       // BCP47 e.g. "en-US"
  country: string;      // ISO 3166 e.g. "US"
  dateOrder: 'MDY' | 'DMY' | 'YMD';
  currency: string;     // ISO 4217 e.g. "USD"
  confidence: number;
}

// Snake-case variant coming from the backend JSON
export interface LocaleInfoApi {
  locale: string;
  country: string;
  date_order: 'MDY' | 'DMY' | 'YMD';
  currency: string;
  confidence: number;
}

/** Convert the snake_case backend shape to the camelCase frontend shape. */
export function toLocaleInfo(api: LocaleInfoApi | null | undefined): LocaleInfo | null {
  if (!api) return null;
  return {
    locale:     api.locale,
    country:    api.country,
    dateOrder:  api.date_order,
    currency:   api.currency,
    confidence: api.confidence,
  };
}

@Injectable({ providedIn: 'root' })
export class LocaleService {

  constructor(private lang: LanguageService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Date helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Normalize an ambiguous short date string (e.g. "07-10-26") to
   * MM/DD/YYYY so that `new Date()` parses it correctly.
   *
   * Uses localeInfo.dateOrder when provided; falls back to LanguageService.
   */
  normalizeDate(raw: string, localeInfo?: LocaleInfo | null): string {
    const m = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
    if (!m) return raw;
    let [, a, b, c] = m;
    if (c.length === 2) c = '20' + c;
    const order = localeInfo?.dateOrder ?? this.lang.dateOrder;
    switch (order) {
      case 'DMY': return `${b}/${a}/${c}`;   // DD-MM-YY → MM/DD/YYYY for JS Date
      case 'YMD': return `${a}/${b}/${c}`;   // YY-MM-DD → treat a as month
      default:    return `${a}/${b}/${c}`;   // MDY pass-through
    }
  }

  /**
   * Format an ISO date string (or any JS-parseable date) in the document's
   * locale style.
   *
   * e.g. en-US → "July 10, 2026"   en-GB → "10 July 2026"   de → "10. Juli 2026"
   */
  formatDate(isoDate: string, localeInfo?: LocaleInfo | null): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;

    const locale = localeInfo?.locale ?? this._uiLocale();
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'long', day: 'numeric'
      }).format(d);
    } catch {
      return isoDate;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Currency helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Format a number as a currency string in the document's locale.
   * e.g. 1234.56, {currency:'EUR', locale:'de-DE'} → "1.234,56 €"
   */
  formatCurrency(amount: number, localeInfo?: LocaleInfo | null): string {
    const locale   = localeInfo?.locale   ?? this._uiLocale();
    const currency = localeInfo?.currency ?? 'USD';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency, minimumFractionDigits: 2
      }).format(amount);
    } catch {
      return String(amount);
    }
  }

  /**
   * Parse a raw currency string into a number, handling:
   * - Currency symbols ($, £, €, ¥, etc.)
   * - Comma-as-decimal (EU format: "1.234,56")
   * - Thousands separators
   */
  parseCurrency(raw: string): number {
    if (!raw) return NaN;
    // Strip currency symbols and whitespace
    let s = raw.replace(/[^\d.,\-]/g, '').trim();
    if (!s) return NaN;

    // Detect EU format: last separator is a comma AND it's after a dot
    // e.g. "1.234,56" → EU (dot=thousands, comma=decimal)
    const lastComma = s.lastIndexOf(',');
    const lastDot   = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // EU format — comma is decimal separator
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK format — dot is decimal separator
      s = s.replace(/,/g, '');
    }
    return parseFloat(s);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────────────────────

  /** Best-effort BCP47 locale from the current UI language. */
  private _uiLocale(): string {
    const lang = this.lang.currentLang();
    const map: Record<string, string> = {
      en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
      it: 'it-IT', pt: 'pt-PT', zh: 'zh-CN', ja: 'ja-JP',
      ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', ru: 'ru-RU',
      nl: 'nl-NL', sv: 'sv-SE', tr: 'tr-TR', pl: 'pl-PL',
      da: 'da-DK', no: 'nb-NO', fi: 'fi-FI',
    };
    return map[lang] ?? 'en-US';
  }
}
