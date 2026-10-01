// Registry region. Tambah region = tambah satu entri di sini, tidak ada kode lain yang berubah.
//   label      teks di dropdown
//   modelUid   UID model Sketchfab
const REGIONS = {
  "ekstremitas-superior": {
    label: "Ekstremitas Superior Dextra",
    modelUid: "7b818f0f813f4524987725ebb0a67148"
  }
};

const DEFAULT_REGION = Object.keys(REGIONS)[0];

// Konvensi prefix nama node -> label layer.
const LAYERS = {
  os_: "Tulang",
  m_: "Otot",
  n_: "Nervus",
  a_: "Arteri",
  v_: "Vena"
};

const VIEWER_API_VERSION = "1.12.1";

// Opsi embed Sketchfab Viewer API (https://sketchfab.com/developers/viewer/initialization).
const VIEWER_OPTIONS = {
  autostart: 1,
  preload: 1,
  ui_infos: 0,
  ui_watermark: 0,
  ui_inspector: 0,
  ui_settings: 0,
  ui_vr: 0,
  ui_ar: 0,
  ui_help: 0,
  ui_annotations: 0,
  ui_hint: 0
};

// Warna highlight, RGB 0..1 (linear).
const HIGHLIGHT = {
  correct: [0.1, 0.75, 0.2],
  wrong: [0.85, 0.1, 0.1],
  wrongMs: 900
};
