/**
 * FACIL AUTO — Valor principal de financiación v1.5.26
 *
 * El listado bancario ya se ordena por menor CFT en app.js.
 * Esta capa toma la primera alternativa visible y la usa como resumen:
 * cuota mensual + referencia a menor CFT.
 */
(() => {
  function parseARS(text) {
    const digits = String(text || '').replace(/[^\d]/g, '');
    const value = Number(digits);
    return Number.isFinite(value) ? value : NaN;
  }

  function setSummary(value, label) {
    const primary = document.getElementById('finance-primary');
    const primaryLabel = document.getElementById('finance-primary-label');

    if (primary) primary.textContent = value;
    if (primaryLabel) primaryLabel.textContent = label;
  }

  function currentTerm() {
    const term = Number(document.getElementById('term')?.value || 0);
    return Number.isFinite(term) && term > 0 ? term : null;
  }

  function updateFinancePrimary() {
    const results = document.getElementById('resultados');
    if (!results || results.hidden) return;

    const loanText = document.getElementById('loan-amount')?.textContent || '';
    const loanAmount = parseARS(loanText);

    if (Number.isFinite(loanAmount) && loanAmount <= 0) {
      setSummary('SIN FINANCIACIÓN', 'operación cubierta por anticipo');
      return;
    }

    const firstRow = document.querySelector('#bank-list .bank-row');
    if (!firstRow) {
      setSummary('—', 'sin alternativas para este plazo');
      return;
    }

    // app.js usa .bank-payment para la cuota mensual de cada alternativa.
    const payment = firstRow.querySelector('.bank-payment b')?.textContent?.trim() || '';
    const bankName = firstRow.querySelector('.bank-name > b')?.childNodes?.[0]?.textContent?.trim() || '';
    const noOffers = /sin alternativas/i.test(firstRow.textContent || '');

    if (noOffers || !payment || payment === '—') {
      const term = currentTerm();
      setSummary(
        'SIN ALTERNATIVAS',
        term ? `para ${term} meses` : 'para el plazo elegido'
      );
      return;
    }

    const term = currentTerm();
    const labelParts = ['cuota/mes', 'menor CFT'];

    if (term) labelParts.push(`${term} meses`);

    setSummary(payment, labelParts.join(' · '));

    const strip = document.querySelector('.finance-strip');
    if (strip) {
      strip.dataset.primaryBank = bankName;
      strip.dataset.primaryPayment = payment;
      strip.dataset.primaryTerm = term ? String(term) : '';
    }
  }

  function init() {
    const bankList = document.getElementById('bank-list');

    if (bankList) {
      new MutationObserver(() => {
        queueMicrotask(updateFinancePrimary);
      }).observe(bankList, {
        childList:true,
        subtree:true,
        characterData:true
      });
    }

    const form = document.getElementById('vehicle-form');
    form?.addEventListener('submit', () => {
      // app.js está cargado antes y escribe el listado durante su submit.
      window.setTimeout(updateFinancePrimary, 0);
    });

    document.getElementById('term')?.addEventListener('change', () => {
      if (!document.getElementById('resultados')?.hidden) {
        updateFinancePrimary();
      }
    });

    document.getElementById('down-payment')?.addEventListener('change', () => {
      if (!document.getElementById('resultados')?.hidden) {
        updateFinancePrimary();
      }
    });

    window.FACIL_AUTO_FINANCE_PRIMARY = Object.freeze({
      update:updateFinancePrimary,
      version:'1.5.26'
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, {once:true})
    : init();
})();
