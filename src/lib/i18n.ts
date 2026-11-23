import type { Lang } from '@app-types/parts';

const T = {
  en: {
    partNumber: 'Part number',
    supplier: 'Supplier',
    deliveryTime: 'Delivery time',
    stock: 'Stock',
    price: 'Price',
    changeVehicle: 'Change vehicle',
    changeOrder: 'Change order',
    scanning: 'Scanning page...',
    analyzing: 'Analysing with Parts iQ...',
    noPartsFound: 'No parts found on this page.',
    tryWithCrop: 'Try with crop selection',
    addManually: '+ Add part manually',
    addPart: 'Add part',
    partName: 'Part name',
    partNumberLabel: 'Part number',
    cancel: 'Cancel',
    clearUnsent: 'Clear unsent',
    finishSearch: 'Finish search',
    searchFinished: 'Search finished.',
    newQuote: 'New quote',
    checkStatus: 'Check part status in Parts iQ.',
    partsSent: (n: number) => `${n} part${n === 1 ? '' : 's'} sent.`,
    scan: 'Scan page',
    crop: 'Crop selection',
    retry: 'Retry',
    clear: 'Clear',
    sending: 'Sending…',
    sent: '✓ Sent',
    errorLabel: 'Error',
    loginError: 'Login failed. Please try again.',
    scanError: 'Scan failed.',
    scanSupplierPage: 'Scan a supplier page instead',
    backToWorkOrder: 'Back to work order',
    addFromSupplierTitle: 'Add parts from a supplier',
    addFromSupplierHint: 'Open the supplier page and select the part.',
    cropWaiting: 'Crop is ready. Switch to the supplier tab and drag over the part (Esc cancels).',
    scanNeedsSupplier: 'This is not a supplier page. Open the supplier page in this window and click Scan page there.',
    removeUnsentConfirm: (count: number) =>
      `Remove ${count} unsent part${count === 1 ? '' : 's'}?`,
  },
  nl: {
    partNumber: 'Artikelnummer',
    supplier: 'Leverancier',
    deliveryTime: 'Levertijd',
    stock: 'Voorraad',
    price: 'Prijs',
    changeVehicle: 'Voertuig wijzigen',
    changeOrder: 'Order wijzigen',
    scanning: 'Pagina scannen…',
    analyzing: 'Analyseren met Parts iQ...',
    noPartsFound: 'Geen onderdelen gevonden op deze pagina.',
    tryWithCrop: 'Probeer met uitsnede',
    addManually: '+ Onderdeel handmatig toevoegen',
    addPart: 'Onderdeel toevoegen',
    partName: 'Naam onderdeel',
    partNumberLabel: 'Artikelnummer',
    cancel: 'Annuleren',
    clearUnsent: 'Niet-verzonden verwijderen',
    finishSearch: 'Zoekopdracht afronden',
    searchFinished: 'Zoekopdracht afgerond.',
    newQuote: 'Nieuwe offerte',
    checkStatus: 'Controleer de status van de onderdelen in Parts iQ.',
    partsSent: (n: number) => (n === 1 ? '1 onderdeel verzonden.' : `${n} onderdelen verzonden.`),
    scan: 'Pagina scannen',
    crop: 'Uitsnede selecteren',
    retry: 'Opnieuw',
    clear: 'Wissen',
    sending: 'Verzenden…',
    sent: '✓ Verzonden',
    errorLabel: 'Fout',
    loginError: 'Aanmelden mislukt. Probeer opnieuw.',
    scanError: 'Scannen mislukt.',
    scanSupplierPage: 'Liever een leverancierspagina scannen',
    backToWorkOrder: 'Terug naar werkorder',
    addFromSupplierTitle: 'Onderdelen van een leverancier toevoegen',
    addFromSupplierHint: 'Open de pagina van de leverancier en selecteer het onderdeel.',
    cropWaiting: 'Uitsnede staat klaar. Ga naar het tabblad van de leverancier en sleep over het onderdeel (Esc annuleert).',
    scanNeedsSupplier: 'Dit is geen leverancierspagina. Open de pagina van de leverancier in dit venster en klik daar op Pagina scannen.',
    removeUnsentConfirm: (count: number) =>
      `${count} niet-verzonden onderdeel${count === 1 ? '' : 'en'} verwijderen?`,
  },
} as const;

export type Translations = typeof T.en;

/** Language value sent by the Bubble app: only the exact "nl" is Dutch, anything else is English. */
export function parseLang(raw: unknown): Lang {
  return raw === 'nl' ? 'nl' : 'en';
}

export function useT(lang: Lang): Translations {
  return (T[lang] ?? T.en) as unknown as Translations;
}
