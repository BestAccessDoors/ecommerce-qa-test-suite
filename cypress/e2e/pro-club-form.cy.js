import { ProClubFormPage } from '../support/pages/ProClubFormPage.js';
import { getMultipartField } from '../support/utils/getMultipartField.js';
import { getStore, describeIfStore, itIfStore, storePersona } from '../support/store.js';

const site = getStore();
const proClubForm = site.forms && site.forms.proClub;
const submitPattern = proClubForm && proClubForm.submitUrlPattern;
// A Pro Club form may have no country dropdown (BESTCA's had none until July 2026) — gate the
// country-specific tests on it.
const hasCountry = proClubForm && proClubForm.hasCountry !== false;
// Optional restriction: when set, the dropdown must offer nothing outside this list. Neither
// current store sets it — both offer Canada + United States on purpose (see below).
const allowedCountries = proClubForm && proClubForm.allowedCountries;
// The country the store deliberately preselects, if any. Unset means the dropdown must start on
// its placeholder. BESTUS preselects "United States" (intended — confirmed by the store owner
// Oct 16 2026); BESTCA starts on "-Select-".
const defaultCountry = proClubForm && proClubForm.defaultCountry;

describeIfStore(proClubForm, 'Pro Club Application form', () => {
  let page;
  let persona;

  before(() => {
    cy.fixture('personas').then((p) => { persona = storePersona(p.primary); });
  });

  beforeEach(() => {
    page = new ProClubFormPage();
  });

  describe('Happy path', () => {
    it('submits successfully with all required fields filled', () => {
      cy.uniqueEmail().then((email) => {
        cy.interceptZoho('submit', submitPattern);
        page.visit().scrollToForm();
        cy.fillPersona(page, persona, email);
        page.submit();
        cy.expectZohoAccepted();
      });
    });

    it('sends user-entered values in the request payload', () => {
      cy.uniqueEmail().then((email) => {
        cy.interceptZoho('submit', submitPattern);
        page.visit().scrollToForm();
        cy.fillPersona(page, persona, email);
        page.submit();
        cy.wait('@submit').then((interception) => {
          const body = interception.request.body;
          expect(getMultipartField(body, 'Name_First')).to.equal(persona.firstName);
          expect(getMultipartField(body, 'Name_Last')).to.equal(persona.lastName);
          expect(getMultipartField(body, 'Email')).to.equal(email);
          if (hasCountry && allowedCountries) {
            expect(getMultipartField(body, 'Address_Country')).to.be.oneOf(allowedCountries);
          }
        });
      });
    });
  });

  describe('Validation (negative paths)', () => {
    beforeEach(() => {
      page.visit().scrollToForm();
      cy.interceptZoho('submit', submitPattern);
    });

    // Gated on forms.proClub.allowedCountries, which no store sets: BESTUS and BESTCA both offer
    // Canada + United States on purpose (each routes the other country's applicants to its
    // sibling store's Pro Club form — see CLAUDE.md, pro-club-form.cy.js). Set the key only for a
    // store whose dropdown must be restricted.
    itIfStore(hasCountry && allowedCountries, "offers only the store's allowed countries in the dropdown", () => {
      cy.get('select[name="Address_Country"] option').then(($opts) => {
        const countries = [...$opts]
          .map((o) => o.textContent.trim())
          .filter((t) => t && t !== '-Select-' && t !== '--');
        expect(countries).to.have.members(allowedCountries);
      });
    }, "store's Pro Club form has no country restriction (forms.proClub.allowedCountries not set)");

    const countryDefaultTitle = defaultCountry
      ? `defaults the country dropdown to ${defaultCountry}`
      : 'defaults the country dropdown to a placeholder selection';
    itIfStore(hasCountry, countryDefaultTitle, () => {
      cy.get('select[name="Address_Country"]').should(($sel) => {
        // Compared on the selected option's TEXT: Zoho renders most options with no value
        // attribute, so val() is the text anyway, but the placeholder carries value="-Select-".
        const selected = $sel.find('option:selected').text().trim();
        if (defaultCountry) {
          expect(selected, 'preselected country (forms.proClub.defaultCountry)').to.equal(defaultCountry);
        } else {
          expect(selected).to.satisfy(
            (v) => !v || v === '-Select-' || v === '--',
            `Expected placeholder, got "${selected}" (set forms.proClub.defaultCountry if the preselection is intended)`
          );
        }
      });
    }, "store's Pro Club form has no country field (forms.proClub.hasCountry is false)");

    it('shows an error when Email is empty', () => {
      cy.uniqueEmail().then((email) => {
        cy.fillPersona(page, { ...persona }, email);
        cy.get('input[name="Email"]').clear({ force: true });
        page.submit();
        cy.expectNoSubmission();
        // forms.proClub.emailErrorNotVisible skips only this visible-error assertion. Unused since
        // Oct 15 2026: BESTUS carried it from July 2026, while its Email_error never toggled
        // visible, and the error shows again now (verified by running this spec without the flag).
        if (!(proClubForm && proClubForm.emailErrorNotVisible)) {
          cy.expectFieldError('input[name="Email"]');
        }
      });
    });

    // Pro Club form does not enforce client-side validation on Name fields or
    // malformed email — those tests are omitted as they reflect Zoho's form config,
    // not a gap in test coverage.

    it('does not submit the form when required fields are missing', () => {
      page.submit();
      cy.expectNoSubmission();
    });

    // Same mechanism as contact-form.cy.js: checks.js stubs /recaptcha/ so an unsolvable v2
    // checkbox can't block the happy-path POSTs, and this test hands that stub back an EMPTY
    // response to check the store's own gate blocks submission the way it does for a visitor
    // who ignored the checkbox.
    //
    // This is the form that proves the test is worth having. The gate snippet installs its
    // listener on document.getElementById('zohoForm'), so it silently does NOTHING unless the
    // form's id happens to match — and on Sept 1 2026 this page's form was id='form' (contact's
    // was already id='zohoForm'), so `if (!form) return` short-circuited and the widget rendered
    // while blocking nothing at all. It was fixed overnight (confirmed by the store owner): as of
    // Sept 2 2026 the id is 'zohoForm', the gate enforces, and this test passes. Nothing LOOKS
    // different between the two states — the widget renders either way — so a one-word template
    // edit can disarm the captcha with no visible symptom. That is what this test watches for.
    itIfStore(proClubForm && proClubForm.hasRecaptcha, 'does not submit until the reCAPTCHA is completed', () => {
      cy.uniqueEmail().then((email) => {
        cy.window().then((w) => { w.grecaptcha = { ...w.grecaptcha, getResponse: () => '' }; });
        cy.fillPersona(page, persona, email);
        page.submit();
        cy.expectNoSubmission();
      });
    }, "store's Pro Club form has no reCAPTCHA gate (forms.proClub.hasRecaptcha)");
  });
});
