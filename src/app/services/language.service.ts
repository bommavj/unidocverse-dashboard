// src/app/services/language.service.ts
import { Injectable, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    'Dashboard': 'Dashboard',
    'Documents': 'Documents',
    'Search': 'Search',
    'Analytics': 'Analytics',
    'Timeline': 'Timeline',
    'Upload': 'Upload',
    'Insights': 'Insights',
    'Alerts': 'Alerts',
    'Settings': 'Settings',
    'Main': 'Main',
    'Assistant': 'Assistant',
    'Daily Planner': 'Daily Planner',
    'Quick Notes': 'Quick Notes',
    'Tools': 'Tools',
    'Ask AI': 'Ask AI',
    'Voice Assistant': 'Voice Assistant',
    'Integrations': 'Integrations',
    'Storage': 'Storage',
    'Light mode': 'Light mode',
    'Dark mode': 'Dark mode',
    'Trial': 'Trial',
    'Logout': 'Logout',
    // Settings Page
    'System Settings': 'System Settings',
    'Theme Settings': 'Theme Settings',
    'General Settings': 'General Settings',
    'Language Preferences': 'Language Preferences',
    'Change Password': 'Change Password',
    'Select Language': 'Select Language',
    'Save Changes': 'Save Changes',
    'Preferred Language': 'Preferred Language',
    // Dashboard page elements
    'Upload Document': 'Upload Document',
    'Recent Documents': 'Recent Documents',
    'Processed': 'Processed',
    'Status': 'Status',
    'Type': 'Type',
    'Actions': 'Actions',
    'Ask a Question': 'Ask a Question',
    'Key Points': 'Key Points',
    'Summary': 'Summary',
    // Features
    'Agency': 'Agency',
    'Clients': 'Clients',
    'Policies': 'Policies',
    'Renewals': 'Renewals',
    'Calendar': 'Calendar',
    'Commission': 'Commission',
    'Loss Runs': 'Loss Runs',
    'Gap Analysis': 'Gap Analysis',
    'COI': 'COI',
    'Legal': 'Legal',
    'Contracts': 'Contracts',
    'NDAs': 'NDAs',
    'Lease Agmt': 'Lease Agmt',
    'Reg Filings': 'Reg Filings',
    'Healthcare': 'Healthcare',
    'Medical Charts': 'Medical Charts',
    'Intake Forms': 'Intake Forms',
    'Lab Reports': 'Lab Reports',
    'Finance': 'Finance',
    'Bank Stmts': 'Bank Stmts',
    'Tax Returns': 'Tax Returns',
    'Invoices': 'Invoices',
    'Real Estate': 'Real Estate',
    'Appraisals': 'Appraisals',
    'Title Deeds': 'Title Deeds',
    'Disclosures': 'Disclosures',
    'HR & People': 'HR & People',
    'Resumes': 'Resumes',
    'Handbooks': 'Handbooks',
    'Reviews': 'Reviews',
    'Supply Chain': 'Supply Chain',
    'PO Register': 'PO Register',
    'Bills of Lading': 'Bills of Lading',
    'Manifests': 'Manifests'
  },
  es: {
    'Dashboard': 'Tablero',
    'Documents': 'Documentos',
    'Search': 'Buscar',
    'Analytics': 'Analítica',
    'Timeline': 'Cronología',
    'Upload': 'Subir',
    'Insights': 'Perspectivas',
    'Alerts': 'Alertas',
    'Settings': 'Configuración',
    'Main': 'Principal',
    'Assistant': 'Asistente',
    'Daily Planner': 'Planificador Diario',
    'Quick Notes': 'Notas Rápidas',
    'Tools': 'Herramientas',
    'Ask AI': 'Preguntar a IA',
    'Voice Assistant': 'Asistente de Voz',
    'Integrations': 'Integraciones',
    'Storage': 'Almacenamiento',
    'Light mode': 'Modo claro',
    'Dark mode': 'Modo oscuro',
    'Trial': 'Prueba',
    'Logout': 'Cerrar sesión',
    'System Settings': 'Configuración del Sistema',
    'Theme Settings': 'Configuración del Tema',
    'General Settings': 'Configuración General',
    'Language Preferences': 'Preferencias de Idioma',
    'Change Password': 'Cambiar Contraseña',
    'Select Language': 'Seleccionar Idioma',
    'Save Changes': 'Guardar Cambios',
    'Preferred Language': 'Idioma Preferido',
    'Upload Document': 'Subir Documento',
    'Recent Documents': 'Documentos Recientes',
    'Processed': 'Procesado',
    'Status': 'Estado',
    'Type': 'Tipo',
    'Actions': 'Acciones',
    'Ask a Question': 'Hacer una Pregunta',
    'Key Points': 'Puntos Clave',
    'Summary': 'Resumen',
    // Features
    'Agency': 'Agencia',
    'Clients': 'Clientes',
    'Policies': 'Pólizas',
    'Renewals': 'Renovaciones',
    'Calendar': 'Calendario',
    'Commission': 'Comisiones',
    'Loss Runs': 'Siniestralidad',
    'Gap Analysis': 'Análisis de Brechas',
    'COI': 'COI',
    'Legal': 'Legal',
    'Contracts': 'Contratos',
    'NDAs': 'Acuerdos de Confidencialidad',
    'Lease Agmt': 'Contrato de Arrendamiento',
    'Reg Filings': 'Presentaciones Regulatorias',
    'Healthcare': 'Salud',
    'Medical Charts': 'Fichas Médicas',
    'Intake Forms': 'Formularios de Admisión',
    'Lab Reports': 'Informes de Laboratorio',
    'Finance': 'Finanzas',
    'Bank Stmts': 'Extractos Bancarios',
    'Tax Returns': 'Declaraciones de Impuestos',
    'Invoices': 'Facturas',
    'Real Estate': 'Bienes Raíces',
    'Appraisals': 'Tasaciones',
    'Title Deeds': 'Escrituras de Propiedad',
    'Disclosures': 'Divulgaciones',
    'HR & People': 'Recursos Humanos',
    'Resumes': 'Currículums',
    'Handbooks': 'Manuales',
    'Reviews': 'Evaluaciones',
    'Supply Chain': 'Cadena de Suministro',
    'PO Register': 'Registro de Pedidos',
    'Bills of Lading': 'Conocimientos de Embarque',
    'Manifests': 'Manifiestos'
  },
  fr: {
    'Dashboard': 'Tableau de bord',
    'Documents': 'Documents',
    'Search': 'Rechercher',
    'Analytics': 'Analytique',
    'Timeline': 'Chronologie',
    'Upload': 'Télécharger',
    'Insights': 'Analyses',
    'Alerts': 'Alertes',
    'Settings': 'Paramètres',
    'Main': 'Principal',
    'Assistant': 'Assistant',
    'Daily Planner': 'Planificateur',
    'Quick Notes': 'Notes Rapides',
    'Tools': 'Outils',
    'Ask AI': 'Demander à l\'IA',
    'Voice Assistant': 'Assistant Vocal',
    'Integrations': 'Intégrations',
    'Storage': 'Stockage',
    'Light mode': 'Mode clair',
    'Dark mode': 'Mode sombre',
    'Trial': 'Essai',
    'Logout': 'Se déconnecter',
    'System Settings': 'Paramètres du Système',
    'Theme Settings': 'Paramètres du Thème',
    'General Settings': 'Paramètres Généraux',
    'Language Preferences': 'Préférences de Langue',
    'Change Password': 'Changer le Mot de Passe',
    'Select Language': 'Choisir la Langue',
    'Save Changes': 'Sauvegarder',
    'Preferred Language': 'Langue Préférée',
    'Upload Document': 'Télécharger un Document',
    'Recent Documents': 'Documents Récents',
    'Processed': 'Traité',
    'Status': 'Statut',
    'Type': 'Type',
    'Actions': 'Actions',
    'Ask a Question': 'Poser une Question',
    'Key Points': 'Points Clés',
    'Summary': 'Résumé',
    // Features
    'Agency': 'Agence',
    'Clients': 'Clients',
    'Policies': 'Polices',
    'Renewals': 'Renouvellements',
    'Calendar': 'Calendrier',
    'Commission': 'Commissions',
    'Loss Runs': 'Historique des Pertes',
    'Gap Analysis': 'Analyse des Écarts',
    'COI': 'COI',
    'Legal': 'Juridique',
    'Contracts': 'Contrats',
    'NDAs': 'Accords de Confidentialité',
    'Lease Agmt': 'Bail Commercial',
    'Reg Filings': 'Dépôts Réglementaires',
    'Healthcare': 'Santé',
    'Medical Charts': 'Dossiers Médicaux',
    'Intake Forms': 'Formulaires d\'Admission',
    'Lab Reports': 'Rapports de Laboratoire',
    'Finance': 'Finance',
    'Bank Stmts': 'Relevés Bancaires',
    'Tax Returns': 'Déclarations d\'Impôts',
    'Invoices': 'Factures',
    'Real Estate': 'Immobilier',
    'Appraisals': 'Évaluations',
    'Title Deeds': 'Titres de Propriété',
    'Disclosures': 'Divulgations',
    'HR & People': 'Ressources Humaines',
    'Resumes': 'CVs',
    'Handbooks': 'Manuels de l\'Employé',
    'Reviews': 'Évaluations',
    'Supply Chain': 'Chaîne Logistique',
    'PO Register': 'Registre des Bons de Commande',
    'Bills of Lading': 'Connaissements',
    'Manifests': 'Manifestes'
  },
  de: {
    'Dashboard': 'Dashboard',
    'Documents': 'Dokumente',
    'Search': 'Suche',
    'Analytics': 'Analysen',
    'Timeline': 'Timeline',
    'Upload': 'Hochladen',
    'Insights': 'Erkenntnisse',
    'Alerts': 'Benachrichtigungen',
    'Settings': 'Einstellungen',
    'Main': 'Hauptmenü',
    'Assistant': 'Assistent',
    'Daily Planner': 'Tagesplaner',
    'Quick Notes': 'Notizen',
    'Tools': 'Werkzeuge',
    'Ask AI': 'KI fragen',
    'Voice Assistant': 'Sprachassistent',
    'Integrations': 'Integrationen',
    'Storage': 'Speicher',
    'Light mode': 'Heller Modus',
    'Dark mode': 'Dunkler Modus',
    'Trial': 'Testversion',
    'Logout': 'Abmelden',
    'System Settings': 'Systemeinstellungen',
    'Theme Settings': 'Design-Einstellungen',
    'General Settings': 'Allgemeine Einstellungen',
    'Language Preferences': 'Spracheinstellungen',
    'Change Password': 'Passwort ändern',
    'Select Language': 'Sprache auswählen',
    'Save Changes': 'Änderungen speichern',
    'Preferred Language': 'Bevorzugte Sprache',
    'Upload Document': 'Dokument hochladen',
    'Recent Documents': 'Aktuelle Dokumente',
    'Processed': 'Verarbeitet',
    'Status': 'Status',
    'Type': 'Typ',
    'Actions': 'Aktionen',
    'Ask a Question': 'Frage stellen',
    'Key Points': 'Wichtige Punkte',
    'Summary': 'Zusammenfassung',
    // Features
    'Agency': 'Agentur',
    'Clients': 'Kunden',
    'Policies': 'Policen',
    'Renewals': 'Verlängerungen',
    'Calendar': 'Kalender',
    'Commission': 'Provisionen',
    'Loss Runs': 'Schadenverlauf',
    'Gap Analysis': 'Deckungslücken-Analyse',
    'COI': 'COI',
    'Legal': 'Recht',
    'Contracts': 'Verträge',
    'NDAs': 'Geheimhaltungsvereinbarungen',
    'Lease Agmt': 'Mietverträge',
    'Reg Filings': 'Behördliche Einreichungen',
    'Healthcare': 'Gesundheitswesen',
    'Medical Charts': 'Medizinische Akten',
    'Intake Forms': 'Aufnahmeformulare',
    'Lab Reports': 'Laborberichte',
    'Finance': 'Finanzen',
    'Bank Stmts': 'Kontoauszüge',
    'Tax Returns': 'Steuererklärungen',
    'Invoices': 'Rechnungen',
    'Real Estate': 'Immobilien',
    'Appraisals': 'Bewertungen',
    'Title Deeds': 'Grundbuchauszüge',
    'Disclosures': 'Offenlegungen',
    'HR & People': 'Personalwesen',
    'Resumes': 'Lebensläufe',
    'Handbooks': 'Handbücher',
    'Reviews': 'Leistungsbeurteilungen',
    'Supply Chain': 'Lieferkette',
    'PO Register': 'Bestellregister',
    'Bills of Lading': 'Frachtbriefe',
    'Manifests': 'Manifeste'
  }
};

@Injectable({ providedIn: 'root' })
export class LanguageService {

  currentLang = signal<string>('en');
  dateOrder: 'MDY' | 'DMY' | 'YMD' = 'MDY';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
    this.restoreLanguage();

    // Auto-save preference to DB when currentLang changes and user is logged in
    effect(() => {
      const lang = this.currentLang();
      localStorage.setItem('udv_language', lang);

      const user = this.auth.currentUser();
      if (user && user.language !== lang) {
        // Update local memory user
        user.language = lang;
        localStorage.setItem('udv_user', JSON.stringify(user));
        
        // Sync to backend DB
        this.http.put('http://localhost:7979/api/auth/me/preferences', { language: lang }).subscribe({
          next: () => console.log('✅ Language preference synced to DB'),
          error: (err) => console.error('❌ Failed to sync language to DB', err)
        });
      }
    });
  }

  private restoreLanguage() {
    // 1. Try local storage setting
    const cached = localStorage.getItem('udv_language');
    if (cached && ['en', 'es', 'fr', 'de'].includes(cached)) {
      this.currentLang.set(cached);
      return;
    }

    // 2. Try logged in user preference
    const user = this.auth.currentUser();
    if (user && user.language && ['en', 'es', 'fr', 'de'].includes(user.language)) {
      this.currentLang.set(user.language);
      return;
    }

    // 3. Try browser language
    const browserLang = navigator.language.split('-')[0];
    if (['en', 'es', 'fr', 'de'].includes(browserLang)) {
      this.currentLang.set(browserLang);
    }
  }

  translate(key: string): string {
    const lang = this.currentLang();
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    return dict[key] !== undefined ? dict[key] : key;
  }
}
