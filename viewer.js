// Wrapper Sketchfab Viewer API. Tidak tahu apa-apa soal quiz.
// Struktur = node yang namanya berprefix (lihat LAYERS di config.js).
// Highlight bekerja lewat material: model wajib satu material per struktur.
const Viewer = (() => {
  const PREFIXES = Object.keys(LAYERS);

  let container = null;
  let api = null;
  let generation = 0;          // naik tiap init; callback dari viewer lama diabaikan
  let clickCb = null;

  let nodeById = new Map();    // instanceID -> node mentah
  let parentOf = new Map();    // instanceID -> parent instanceID
  let structures = new Map();  // nama struktur -> { roots: [instanceID], materialIDs: Set }
  let materials = new Map();   // materialID -> material mentah
  let original = new Map();    // materialID -> salinan material sebelum di-highlight

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const prefixOf = (name) => PREFIXES.find((p) => name && name.startsWith(p)) || null;
  const nameOf = (id) => nodeById.get(id)?.name;

  // Sketchfab memecah tiap object jadi beberapa node; node Geometry diberi suffix
  // (mis. os_humerus_os_humerus_0). Node cocok dengan object kalau namanya sama persis
  // atau diawali nama object + "_". Batas "_" mencegah a_radialis cocok dengan a_radialis-indicis.
  const matches = (nodeName, objectName) =>
    !!nodeName && (nodeName === objectName || nodeName.startsWith(objectName + "_"));

  function call(method, ...args) {
    return new Promise((resolve, reject) => {
      api[method](...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
  }

  // Naik dari node yang diklik ke struktur terluar yang konsisten.
  // Menangani node turunan yang diberi suffix oleh Sketchfab (mis. os_humerus_os_humerus_0 di bawah os_humerus).
  function resolve(id) {
    let best = null;
    for (let cur = id; cur !== undefined; cur = parentOf.get(cur)) {
      const name = nameOf(cur);
      if (!prefixOf(name)) continue;
      if (best === null || matches(best, name)) best = name;
      else break;
    }
    return best;
  }

  function indexNodes(nodeMap) {
    nodeById = new Map();
    parentOf = new Map();
    structures = new Map();

    for (const node of Object.values(nodeMap)) nodeById.set(node.instanceID, node);
    for (const node of nodeById.values()) {
      for (const child of node.children || []) {
        parentOf.set(typeof child === "object" ? child.instanceID : child, node.instanceID);
      }
    }

    for (const id of nodeById.keys()) {
      const s = resolve(id);
      if (!s) continue;
      if (!structures.has(s)) structures.set(s, { roots: [], materialIDs: new Set() });
      const entry = structures.get(s);
      const parent = parentOf.get(id);
      if (parent === undefined || resolve(parent) !== s) entry.roots.push(id);
      const mat = nodeById.get(id).materialID;
      if (mat) entry.materialIDs.add(mat);
    }
  }

  function makeIframe() {
    const iframe = document.createElement("iframe");
    iframe.title = "Model anatomi 3D";
    iframe.allow = "autoplay; fullscreen; xr-spatial-tracking";
    iframe.setAttribute("allowfullscreen", "");
    return iframe;
  }

  function teardown() {
    generation++;
    api = null;
    nodeById = new Map();
    parentOf = new Map();
    structures = new Map();
    materials = new Map();
    original = new Map();
    if (container) container.replaceChildren();
  }

  function init(containerEl, modelUid) {
    teardown();
    container = containerEl;
    const gen = generation;
    const iframe = makeIframe();
    container.appendChild(iframe);

    return new Promise((resolvePromise, reject) => {
      const client = new Sketchfab(VIEWER_API_VERSION, iframe);
      client.init(modelUid, {
        ...VIEWER_OPTIONS,
        success(viewerApi) {
          if (gen !== generation) return;
          viewerApi.start();
          viewerApi.addEventListener("viewerready", async () => {
            if (gen !== generation) return;
            api = viewerApi;
            try {
              const [nodeMap, matList] = await Promise.all([call("getNodeMap"), call("getMaterialList")]);
              if (gen !== generation) return;
              indexNodes(nodeMap);
              materials = new Map(matList.map((m) => [m.id, m]));
              api.addEventListener(
                "click",
                (info) => {
                  if (gen !== generation || !clickCb || info.instanceID == null) return;
                  const name = resolve(info.instanceID);
                  if (name) clickCb(name);
                },
                { pick: "slow" }
              );
              resolvePromise();
            } catch (err) {
              reject(err);
            }
          });
        },
        error() {
          if (gen === generation) reject(new Error(`Sketchfab gagal init model ${modelUid}`));
        }
      });
    });
  }

  function loadRegion(regionKey) {
    const region = REGIONS[regionKey];
    if (!region) return Promise.reject(new Error(`Region tidak dikenal: ${regionKey}`));
    if (!container) return Promise.reject(new Error("Viewer.init belum pernah dipanggil"));
    return init(container, region.modelUid);
  }

  function onNodeClick(callback) {
    clickCb = callback;
  }

  function paint(material, color) {
    const ch = material.channels;
    for (const key of ["AlbedoPBR", "DiffusePBR", "DiffuseColor"]) {
      if (!ch[key]) continue;
      ch[key].enable = true;
      ch[key].color = color;
      ch[key].factor = 1;
      delete ch[key].texture;
    }
    if (ch.EmitColor) {
      ch.EmitColor.enable = true;
      ch.EmitColor.color = color;
      ch.EmitColor.factor = 0.35;
      delete ch.EmitColor.texture;
    }
  }

  // Struktur terindeks yang cocok dengan nama object.
  const entriesFor = (objectName) =>
    [...structures].filter(([name]) => matches(name, objectName)).map(([, entry]) => entry);

  async function highlight(nodeName, color) {
    if (!api) return;
    const ids = new Set(entriesFor(nodeName).flatMap((entry) => [...entry.materialIDs]));
    const jobs = [];
    for (const id of ids) {
      const mat = materials.get(id);
      if (!mat) continue;
      if (!original.has(id)) original.set(id, clone(mat));
      const painted = clone(original.get(id));
      paint(painted, color);
      jobs.push(call("setMaterial", painted));
    }
    await Promise.all(jobs);
  }

  async function clearHighlight() {
    if (!api) return;
    const jobs = [];
    for (const mat of original.values()) jobs.push(call("setMaterial", clone(mat)));
    original = new Map();
    await Promise.all(jobs);
  }

  function setVisible(predicate) {
    if (!api) return Promise.resolve();
    const jobs = [];
    for (const [name, entry] of structures) {
      const method = predicate(name) ? "show" : "hide";
      for (const id of entry.roots) jobs.push(call(method, id));
    }
    return Promise.all(jobs);
  }

  // Entri diakhiri "_" = prefix layer (mis. "m_"), selain itu nama object penuh.
  // Struktur yang tidak cocok entri mana pun disembunyikan.
  function showOnly(list) {
    const prefixes = list.filter((e) => e.endsWith("_"));
    const objects = list.filter((e) => !e.endsWith("_"));
    return setVisible(
      (name) => prefixes.some((p) => name.startsWith(p)) || objects.some((o) => matches(name, o))
    );
  }

  function resetVisibility() {
    return setVisible(() => true);
  }

  function hasNode(nodeName) {
    return entriesFor(nodeName).length > 0;
  }

  // Bantuan onboarding model: semua nama node mentah + struktur yang terdeteksi.
  function debugNodes() {
    return {
      raw: [...nodeById.values()].map((n) => `${n.instanceID}\t${n.type}\t${n.name}`),
      structures: [...structures.keys()]
    };
  }

  return {
    init,
    loadRegion,
    onNodeClick,
    highlight,
    clearHighlight,
    showOnly,
    resetVisibility,
    hasNode,
    matches,
    debugNodes
  };
})();
