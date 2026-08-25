import {api, token} from '../../servicios-auth.js?v=1.5.9';

const DATASETS = [
  {
    key:'market',
    label:'Valores de mercado',
    path:'../../data/vehicle_market.json',
    list:'rows'
  },
  {
    key:'dnrpa',
    label:'Valuaciones oficiales',
    path:'../../data/dnrpa.json',
    list:'rows'
  },
  {
    key:'catalog',
    label:'Catálogo unificado',
    path:'../../data/unified_catalog.json',
    list:'entries'
  },
  {
    key:'rates',
    label:'Financiación',
    path:'../../data/rates.json',
    list:'products'
  },
  {
    key:'config',
    label:'Configuración',
    path:'../../data/config.json',
    document:true
  }
];

const $ = selector => document.querySelector(selector);
const state = {
  running:false,
  current:'',
  status:{}
};

function deny() {
  location.replace('../../index.html');
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[c]);
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value) || 0);
}

async function fetchJson(path) {
  const response = await fetch(new URL(path, import.meta.url), {
    cache:'no-store',
    headers:{Accept:'application/json'}
  });

  if (!response.ok) {
    throw new Error(`${path} respondió HTTP ${response.status}`);
  }

  return response.json();
}

function metadataFor(data, listKey) {
  if (!data || typeof data !== 'object') return {};

  const result = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === listKey) continue;
    result[key] = value;
  }

  return result;
}

function normalizedRecord(dataset, record, index) {
  const fallback = `${dataset}-${String(index).padStart(8,'0')}`;

  if (dataset === 'rates') {
    const bank = String(record?.bank || '');
    const product = String(record?.product || '');
    return {
      record_id: `${bank}|${product}` || fallback,
      brand:'',
      model:'',
      variant:'',
      secondary_key:bank,
      payload_json:JSON.stringify(record)
    };
  }

  if (dataset === 'config') {
    return {
      record_id:'config',
      brand:'',
      model:'',
      variant:'',
      secondary_key:'config',
      payload_json:JSON.stringify(record)
    };
  }

  return {
    record_id:String(record?.id || fallback),
    brand:String(record?.brand || ''),
    model:String(record?.model || ''),
    variant:String(
      record?.variant ||
      record?.version ||
      record?.description ||
      ''
    ),
    secondary_key:String(record?.source || ''),
    payload_json:JSON.stringify(record)
  };
}

function rowElement(dataset) {
  return document.querySelector(`[data-dataset="${dataset}"]`);
}

function updateRow(dataset, {
  stateText,
  progress,
  detail
} = {}) {
  const row = rowElement(dataset);
  if (!row) return;

  if (stateText !== undefined) {
    row.querySelector('[data-state]').textContent = stateText;
  }

  if (detail !== undefined) {
    row.querySelector('[data-detail]').textContent = detail;
  }

  if (progress !== undefined) {
    const value = Math.max(0, Math.min(100, Number(progress) || 0));
    row.querySelector('[data-progress]').style.width = `${value}%`;
  }
}

async function loadStatus() {
  try {
    const data = await api('/api/admin/data/status');
    state.status = data.active || {};

    for (const item of DATASETS) {
      const active = state.status[item.key];

      if (active) {
        updateRow(item.key, {
          stateText:'ACTIVO EN D1',
          progress:100,
          detail:`${formatNumber(active.imported_records)} registros`
        });
      } else {
        updateRow(item.key, {
          stateText:'PENDIENTE',
          progress:0,
          detail:'Todavía usa solamente la copia pública'
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function migrateDataset(item) {
  state.current = item.key;
  updateRow(item.key, {
    stateText:'LEYENDO JSON',
    progress:2,
    detail:'Preparando datos…'
  });

  const data = await fetchJson(item.path);

  let records;
  let metadata;

  if (item.document) {
    records = [data];
    metadata = {
      kind:'document',
      migrated_from:'public-json'
    };
  } else {
    records = Array.isArray(data?.[item.list]) ? data[item.list] : [];
    metadata = metadataFor(data, item.list);
  }

  const expected = records.length;

  if (!expected) {
    throw new Error(`${item.label}: no se encontraron registros.`);
  }

  updateRow(item.key, {
    stateText:'INICIANDO',
    progress:4,
    detail:`${formatNumber(expected)} registros detectados`
  });

  const start = await api('/api/admin/data/start', {
    method:'POST',
    body:JSON.stringify({
      dataset:item.key,
      expected_records:expected,
      metadata_json:JSON.stringify(metadata)
    })
  });

  const releaseKey = start.release_key;
  let imported = Math.max(0, Number(start.imported_records) || 0);

  if (imported > expected) imported = 0;

  updateRow(item.key, {
    stateText:start.resumed ? 'REANUDANDO' : 'MIGRANDO',
    progress:expected ? (imported / expected) * 100 : 0,
    detail:`${formatNumber(imported)} / ${formatNumber(expected)}`
  });

  const CHUNK = 30;

  for (let offset = imported; offset < expected; offset += CHUNK) {
    const slice = records.slice(offset, offset + CHUNK);

    const payload = slice.map((record, localIndex) =>
      normalizedRecord(item.key, record, offset + localIndex)
    );

    const response = await api('/api/admin/data/chunk', {
      method:'POST',
      body:JSON.stringify({
        dataset:item.key,
        release_key:releaseKey,
        records:payload
      })
    });

    imported = Number(response.imported_records) || 0;

    updateRow(item.key, {
      stateText:'MIGRANDO',
      progress:(imported / expected) * 100,
      detail:`${formatNumber(imported)} / ${formatNumber(expected)}`
    });

    // Da aire al navegador y evita ráfagas innecesarias.
    await new Promise(resolve => setTimeout(resolve, 35));
  }

  updateRow(item.key, {
    stateText:'VALIDANDO',
    progress:99,
    detail:'Comparando conteos…'
  });

  const finish = await api('/api/admin/data/finish', {
    method:'POST',
    body:JSON.stringify({
      dataset:item.key,
      release_key:releaseKey
    })
  });

  updateRow(item.key, {
    stateText:'ACTIVO EN D1',
    progress:100,
    detail:`${formatNumber(finish.imported_records)} registros`
  });
}

async function migrateAll() {
  if (state.running) return;

  state.running = true;
  const button = $('#start-migration');
  button.disabled = true;
  button.textContent = 'MIGRANDO…';

  $('#migration-message').textContent =
    'No cierres esta pestaña hasta que los cinco bloques indiquen ACTIVO EN D1.';

  try {
    for (const item of DATASETS) {
      await migrateDataset(item);
    }

    $('#migration-message').textContent =
      'Migración completada. Los cinco datasets tienen una release activa en D1.';
    button.textContent = 'MIGRACIÓN COMPLETA';
    await loadStatus();
  } catch (err) {
    console.error(err);

    const current = state.current;
    if (current) {
      updateRow(current, {
        stateText:'PAUSADO / ERROR',
        detail:String(err?.message || err)
      });
    }

    $('#migration-message').textContent =
      'La migración se detuvo. Podés volver a pulsar el botón: el sistema reanuda la carga staging desde el último registro guardado.';

    button.disabled = false;
    button.textContent = 'REANUDAR MIGRACIÓN';
  } finally {
    state.running = false;
  }
}

async function init() {
  if (!token()) return deny();

  try {
    const me = await api('/api/me');

    if (!me?.authenticated || !me?.is_admin) {
      return deny();
    }

    document.documentElement.classList.remove('fa-migration-pending');
    await loadStatus();

    $('#start-migration').addEventListener('click', migrateAll);
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) return deny();

    console.error(err);
    document.documentElement.classList.remove('fa-migration-pending');
    $('#migration-message').textContent =
      'No se pudo comprobar el estado de D1.';
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init, {once:true})
  : init();
