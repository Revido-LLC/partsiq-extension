// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useT } from '@lib/i18n';

describe('useT', () => {
  // ── Language selection ─────────────────────────────────────────────────────

  describe('useT("en")', () => {
    const t = useT('en');

    it('returns English strings for core column labels', () => {
      expect(t.partNumber).toBe('Part number');
      expect(t.supplier).toBe('Supplier');
      expect(t.deliveryTime).toBe('Delivery time');
      expect(t.stock).toBe('Stock');
      expect(t.price).toBe('Price');
    });

    it('returns English strings for UI actions', () => {
      expect(t.changeVehicle).toBe('Change vehicle');
      expect(t.changeOrder).toBe('Change order');
      expect(t.addManually).toBe('+ Add part manually');
      expect(t.addPart).toBe('Add part');
      expect(t.cancel).toBe('Cancel');
      expect(t.clearUnsent).toBe('Clear unsent');
      expect(t.finishSearch).toBe('Finish search');
      expect(t.newQuote).toBe('New quote');
      expect(t.retry).toBe('Retry');
    });

    it('returns English strings for status/feedback messages', () => {
      expect(t.scanning).toBe('Scanning page...');
      expect(t.analyzing).toBe('Analysing with Parts iQ...');
      expect(t.noPartsFound).toBe('No parts found on this page.');
      expect(t.searchFinished).toBe('Search finished.');
      expect(t.checkStatus).toBe('Check part status in Parts iQ.');
      expect(t.sending).toBe('Sending…');
      expect(t.sent).toBe('✓ Sent');
      expect(t.errorLabel).toBe('Error');
      expect(t.loginError).toBe('Login failed. Please try again.');
      expect(t.scanError).toBe('Scan failed.');
    });

    it('removeUnsentConfirm is a function', () => {
      expect(typeof t.removeUnsentConfirm).toBe('function');
    });

    it('removeUnsentConfirm uses singular "part" for count=1', () => {
      expect(t.removeUnsentConfirm(1)).toBe('Remove 1 unsent part?');
    });

    it('removeUnsentConfirm uses plural "parts" for count=3', () => {
      expect(t.removeUnsentConfirm(3)).toBe('Remove 3 unsent parts?');
    });

    it('removeUnsentConfirm uses plural "parts" for count=0', () => {
      expect(t.removeUnsentConfirm(0)).toBe('Remove 0 unsent parts?');
    });
  });

  // ── Dutch translations ─────────────────────────────────────────────────────

  describe('useT("nl")', () => {
    const t = useT('nl');

    it('returns Dutch strings for core column labels', () => {
      expect(t.partNumber).toBe('Artikelnummer');
      expect(t.supplier).toBe('Leverancier');
      expect(t.deliveryTime).toBe('Levertijd');
      expect(t.stock).toBe('Voorraad');
      expect(t.price).toBe('Prijs');
    });

    it('returns Dutch strings for UI actions', () => {
      expect(t.changeVehicle).toBe('Voertuig wijzigen');
      expect(t.changeOrder).toBe('Order wijzigen');
      expect(t.addManually).toBe('+ Onderdeel handmatig toevoegen');
      expect(t.addPart).toBe('Onderdeel toevoegen');
      expect(t.cancel).toBe('Annuleren');
      expect(t.clearUnsent).toBe('Niet-verzonden verwijderen');
      expect(t.finishSearch).toBe('Zoekopdracht afronden');
      expect(t.newQuote).toBe('Nieuwe offerte');
      expect(t.retry).toBe('Opnieuw');
    });

    it('returns Dutch strings for status/feedback messages', () => {
      expect(t.scanning).toBe('Pagina scannen…');
      expect(t.analyzing).toBe('Analyseren met Parts iQ...');
      expect(t.noPartsFound).toBe('Geen onderdelen gevonden op deze pagina.');
      expect(t.searchFinished).toBe('Zoekopdracht afgerond.');
      expect(t.checkStatus).toBe('Controleer de status van de onderdelen in Parts iQ.');
      expect(t.sending).toBe('Verzenden…');
      expect(t.sent).toBe('✓ Verzonden');
      expect(t.errorLabel).toBe('Fout');
      expect(t.loginError).toBe('Aanmelden mislukt. Probeer opnieuw.');
      expect(t.scanError).toBe('Scannen mislukt.');
    });

    it('removeUnsentConfirm is a function', () => {
      expect(typeof t.removeUnsentConfirm).toBe('function');
    });

    it('removeUnsentConfirm uses singular form for count=1', () => {
      expect(t.removeUnsentConfirm(1)).toBe('1 niet-verzonden onderdeel verwijderen?');
    });

    it('removeUnsentConfirm uses plural form for count=3', () => {
      expect(t.removeUnsentConfirm(3)).toBe('3 niet-verzonden onderdeelen verwijderen?');
    });

    it('removeUnsentConfirm uses plural form for count=0', () => {
      expect(t.removeUnsentConfirm(0)).toBe('0 niet-verzonden onderdeelen verwijderen?');
    });
  });

  // ── Contract: both languages expose the same keys ─────────────────────────

  describe('translation shape', () => {
    it('en and nl expose the same set of keys', () => {
      const enKeys = Object.keys(useT('en')).sort();
      const nlKeys = Object.keys(useT('nl')).sort();
      expect(enKeys).toEqual(nlKeys);
    });

    it('en and nl translations are distinct objects (not the same reference)', () => {
      expect(useT('en')).not.toBe(useT('nl'));
    });
  });
});
