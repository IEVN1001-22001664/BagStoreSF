/* Selector de datos (solo desarrollo). Cambio instantáneo vía ?data= */
(() => {
  const states = [['demo', 'Demo'], ['worst', 'Peor caso'], ['empty', 'Vacío'], ['one', 'Uno'], ['huge', '1,000'], ['nophoto', 'Sin foto']];
  const cur = window.__BREAKUI_KEY || 'demo';
  const bar = document.createElement('div');
  bar.setAttribute('style', 'position:fixed;z-index:9999;left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:2px;padding:3px;border-radius:999px;background:#e5e5e5;font:12px/1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.15);max-width:calc(100vw - 16px);overflow-x:auto');
  for (const [k, label] of states) {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = `dev/break-ui.html?data=${k}`;
    a.setAttribute('style', `padding:7px 10px;border-radius:999px;text-decoration:none;white-space:nowrap;color:#111;${k === cur ? 'background:#fff;font-weight:600' : ''}`);
    bar.append(a);
  }
  document.body.append(bar);
})();
