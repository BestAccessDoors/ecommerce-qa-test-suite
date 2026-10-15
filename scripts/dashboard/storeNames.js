/**
 * Friendly display names for each store code. The dashboard server uses this for
 * GET /api/stores; codes with no entry fall back to their uppercase code.
 * The same names are ALSO hardcoded in the "Run One Store.bat" menu (a batch file
 * cannot read this module) — keep the two in sync when a store is added or renamed.
 */
module.exports = {
  bestus: 'Best Access Doors USA',
  bestca: 'Best Access Doors Canada',
  adap: 'Access Doors and Panels',
  adc: 'Access Doors Canada',
  aap: 'Acudor Access Panels',
  fse: 'Fire Safety Equipment',
  brh: 'Best Roof Hatches',
  cad: 'California Access Doors',
  pda: 'Puertas de Acceso',
};
