import { ZohoFormPage } from './ZohoFormPage.js';
import { getStore } from '../store.js';

/**
 * Architects & Spec Writers Zoho form (ADC: /architects/, form "ADCcaArchitects").
 * A standard Zoho form, so first/last name, company (SingleLine), email, phone, and the
 * submit button all come from ZohoFormPage. It adds city, region, and the message textarea.
 * Required fields (zf_MandArray): Name_First, Name_Last, Email, PhoneNumber_countrycode.
 *
 * City/region field names vary per store's Zoho form, so they come from config:
 * `forms.architectInquiries.cityField` / `regionField` (defaults: the Zoho address
 * fields ADC and CAD use). ADAP's "ADAPArchitects2" has City as plain text in
 * `SingleLine1` and no region at all, so it sets `regionField: null`. Only an
 * explicit null skips a field — a configured name that is missing from the page
 * still fails, so a renamed field surfaces instead of being silently left blank.
 */
export class ArchitectFormPage extends ZohoFormPage {
  get path() { return getStore().forms.architectInquiries.path; }

  fieldName(key, fallback) {
    const form = getStore().forms.architectInquiries;
    return form[key] === undefined ? fallback : form[key];
  }

  fillCity(v) {
    const field = this.fieldName('cityField', 'Address_City');
    if (field) cy.get(`input[name="${field}"]`).clear().type(v);
    return this;
  }

  fillRegion(v) {
    const field = this.fieldName('regionField', 'Address_Region');
    if (field) cy.get(`input[name="${field}"]`).clear().type(v);
    return this;
  }

  fillMessage(v) {
    cy.get('textarea[name="MultiLine"]').clear().type(v);
    return this;
  }
}
