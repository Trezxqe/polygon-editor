import {
  pointInPolygon,
  polygonsOverlap,
  generateRandomVertices,
  generateRandomColor,
  cloneVertices,
  translateVertices,
  getBounds,
} from './geometry.js';
import { UndoManager } from './undo-manager.js';

const style = `
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #16213e;
    color: #e0e0e0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    user-select: none;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 16px;
    background: #0f3460;
    border-bottom: 2px solid #1a1a2e;
    align-items: center;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    background: #533483;
    color: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }

  button:hover {
    background: #6a44a8;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  button:active {
    transform: scale(0.96);
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  button.danger {
    background: #c0392b;
  }

  button.danger:hover {
    background: #e74c3c;
  }

  .info {
    display: flex;
    gap: 24px;
    padding: 8px 16px;
    background: #1a1a3e;
    font-size: 14px;
    border-bottom: 1px solid #2a2a4e;
  }

  .info span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info .value {
    color: #f1c40f;
    font-weight: 700;
  }

  .canvas-wrapper {
    flex: 1;
    position: relative;
    min-height: 0;
    margin: 12px;
    border-radius: 12px;
    overflow: hidden;
    background: #0f3460;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.5);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: default;
  }

  .toast {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(0,0,0,0.82);
    color: #fff;
    padding: 12px 28px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.35s ease, transform 0.35s ease;
    z-index: 1000;
  }

  .toast.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

const template = document.createElement('template');
template.innerHTML = `
  <style>${style}</style>
  <div class="toolbar">
    <button id="btnGenerate" title="Создать новый случайный многоугольник">&#43; Generate Polygon</button>
    <button id="btnDelete" class="danger" title="Удалить выбранный многоугольник">&#128465; Delete Selected</button>
    <button id="btnDeleteAll" class="danger" title="Удалить все многоугольники">&#128465;&#128465; Delete All</button>
    <button id="btnColor" title="Изменить цвет выбранного многоугольника">&#127912; Change Color</button>
    <span style="flex:1"></span>
    <button id="btnExport" title="Экспортировать сцену в JSON">&#128229; Export JSON</button>
    <button id="btnImport" title="Импортировать сцену из JSON">&#128230; Import JSON</button>
    <span style="flex:1"></span>
    <button id="btnUndo" title="Отменить (Ctrl+Z)">&#8617; Undo</button>
    <button id="btnRedo" title="Повторить (Ctrl+Y)">&#8618; Redo</button>
  </div>
  <div class="info">
    <span>Polygons count: <span id="polyCount" class="value">0</span></span>
    <span>Selected: <span id="selectedInfo" class="value">none</span></span>
  </div>
  <div class="canvas-wrapper">
    <canvas id="canvas"></canvas>
  </div>
  <div id="toast" class="toast">No polygon selected</div>
`;

export class PolygonEditor extends HTMLElement {
  /** @type {{ id: number, vertices: {x:number,y:number}[], color: string }[]} */
  polygons = [];
  selectedIndex = -1;
  nextId = 0;

  /** @type {UndoManager} */
  undoManager = new UndoManager();

  /** @type {{ startMouse: {x:number,y:number}, origVertices: {x:number,y:number}[], dragged: boolean } | null} */
  dragState = null;

  animatingPolygons = new Map();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.canvas = this.shadowRoot.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.toastEl = this.shadowRoot.getElementById('toast');
    this.toastTimeout = null;

    this.polyCountEl = this.shadowRoot.getElementById('polyCount');
    this.selectedInfoEl = this.shadowRoot.getElementById('selectedInfo');

    this.btnGenerate = this.shadowRoot.getElementById('btnGenerate');
    this.btnDelete = this.shadowRoot.getElementById('btnDelete');
    this.btnDeleteAll = this.shadowRoot.getElementById('btnDeleteAll');
    this.btnColor = this.shadowRoot.getElementById('btnColor');
    this.btnExport = this.shadowRoot.getElementById('btnExport');
    this.btnImport = this.shadowRoot.getElementById('btnImport');
    this.btnUndo = this.shadowRoot.getElementById('btnUndo');
    this.btnRedo = this.shadowRoot.getElementById('btnRedo');

    this.setupListeners();
  }

  connectedCallback() {
    this.resizeCanvas();
    this.render();
    window.addEventListener('resize', this.handleResize);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
  }

  /* ---------- подписка на события ---------- */

  setupListeners() {
    this.btnGenerate.addEventListener('click', () => this.generatePolygon());
    this.btnDelete.addEventListener('click', () => this.deleteSelected());
    this.btnDeleteAll.addEventListener('click', () => this.deleteAll());
    this.btnColor.addEventListener('click', () => this.changeColor());
    this.btnExport.addEventListener('click', () => this.exportJSON());
    this.btnImport.addEventListener('click', () => this.importJSON());
    this.btnUndo.addEventListener('click', () => this.performUndo());
    this.btnRedo.addEventListener('click', () => this.performRedo());

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));

    this.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.setAttribute('tabindex', '0');
  }

  handleResize = () => {
    this.resizeCanvas();
    this.render();
  };

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
  }

  /* ---------- утилиты канваса ---------- */

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  hitTest(mx, my) {
    for (let i = this.polygons.length - 1; i >= 0; i--) {
      if (pointInPolygon({ x: mx, y: my }, this.polygons[i].vertices)) {
        return i;
      }
    }
    return -1;
  }

  /* ---------- основные действия ---------- */

  generatePolygon() {
    let vertices;
    let attempts = 0;
    const numVerts = 3 + Math.floor(Math.random() * 5);

    do {
      vertices = generateRandomVertices(numVerts, this.canvasWidth, this.canvasHeight, 50);
      attempts++;
    } while (
      attempts < 10 &&
      this.polygons.some(p => polygonsOverlap(p.vertices, vertices))
    );

    const polygon = {
      id: this.nextId++,
      vertices,
      color: generateRandomColor(),
    };

    this.undoManager.pushState(this.polygons);
    this.polygons.push(polygon);
    this.startAnimation(polygon);
    this.selectedIndex = this.polygons.length - 1;
    this.render();
  }

  deleteSelected() {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.polygons.length) {
      this.showToast('No polygon selected');
      return;
    }

    this.undoManager.pushState(this.polygons);
    this.polygons.splice(this.selectedIndex, 1);
    this.selectedIndex = Math.min(this.selectedIndex, this.polygons.length - 1);
    this.render();
  }

  deleteAll() {
    if (this.polygons.length === 0) return;
    this.undoManager.pushState(this.polygons);
    this.polygons = [];
    this.selectedIndex = -1;
    this.render();
  }

  changeColor() {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.polygons.length) {
      this.showToast('No polygon selected');
      return;
    }

    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.polygons[this.selectedIndex].color;
    input.addEventListener('input', () => {
      this.undoManager.pushState(this.polygons);
      this.polygons[this.selectedIndex].color = input.value;
      this.render();
    });
    input.click();
  }

  exportJSON() {
    if (this.polygons.length === 0) {
      this.showToast('Nothing to export');
      return;
    }

    const data = this.polygons.map(p => ({
      id: p.id,
      vertices: p.vertices,
      color: p.color,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'polygons.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Scene exported');
  }

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data)) throw new Error('Invalid format');

          const validated = data.map((item, i) => {
            if (!item.vertices || !Array.isArray(item.vertices) || item.vertices.length < 3) {
              throw new Error(`Invalid polygon at index ${i}`);
            }
            return {
              id: item.id ?? this.nextId++,
              vertices: item.vertices.map(v => ({ x: Number(v.x), y: Number(v.y) })),
              color: typeof item.color === 'string' ? item.color : generateRandomColor(),
            };
          });

          this.undoManager.pushState(this.polygons);
          this.polygons = validated;
          this.selectedIndex = -1;
          this.render();
          this.showToast(`Imported ${validated.length} polygon(s)`);
        } catch (err) {
          this.showToast(`Import error: ${err.message}`);
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }

  performUndo() {
    const restored = this.undoManager.undo(this.polygons);
    if (!restored) {
      this.showToast('Nothing to undo');
      return;
    }
    this.polygons = restored;
    this.selectedIndex = -1;
    this.render();
  }

  performRedo() {
    const restored = this.undoManager.redo(this.polygons);
    if (!restored) {
      this.showToast('Nothing to redo');
      return;
    }
    this.polygons = restored;
    this.selectedIndex = -1;
    this.render();
  }

  /* ---------- анимация появления ---------- */

  startAnimation(polygon) {
    polygon.animating = true;
    polygon.animProgress = 0;
    polygon.animStart = performance.now();
    this.animatingPolygons.set(polygon.id, polygon);
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(() => this.animationLoop());
    }
  }

  animationLoop() {
    const now = performance.now();
    let active = false;

    for (const poly of this.animatingPolygons.values()) {
      const elapsed = now - poly.animStart;
      poly.animProgress = Math.min(1, elapsed / 300);
      if (poly.animProgress < 1) active = true;
      else poly.animating = false;
    }

    for (const [id, poly] of this.animatingPolygons) {
      if (!poly.animating) this.animatingPolygons.delete(id);
    }

    this.render();

    if (active) {
      this.animFrameId = requestAnimationFrame(() => this.animationLoop());
    } else {
      this.animFrameId = null;
    }
  }

  /* ---------- обработка мыши ---------- */

  onMouseDown(e) {
    const pos = this.getMousePos(e);
    const hitIdx = this.hitTest(pos.x, pos.y);

    if (hitIdx >= 0) {
      this.selectedIndex = hitIdx;
      const poly = this.polygons[hitIdx];
      this.dragState = {
        startMouse: { x: pos.x, y: pos.y },
        origVertices: cloneVertices(poly.vertices),
        dragged: false,
      };
      this.canvas.style.cursor = 'grabbing';
      this.render();
    } else {
      this.selectedIndex = -1;
      this.render();
    }
  }

  onMouseMove(e) {
    if (!this.dragState) return;
    const pos = this.getMousePos(e);
    const dx = pos.x - this.dragState.startMouse.x;
    const dy = pos.y - this.dragState.startMouse.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.dragState.dragged = true;
    }

    const poly = this.polygons[this.selectedIndex];
    if (!poly) return;

    const newVerts = translateVertices(this.dragState.origVertices, dx, dy);
    const bounds = getBounds(newVerts);
    const cw = this.canvasWidth;
    const ch = this.canvasHeight;

    let clampedDx = dx;
    let clampedDy = dy;
    if (bounds.minX < 0) clampedDx -= bounds.minX;
    if (bounds.minY < 0) clampedDy -= bounds.minY;
    if (bounds.maxX > cw) clampedDx -= bounds.maxX - cw;
    if (bounds.maxY > ch) clampedDy -= bounds.maxY - ch;

    poly.vertices = translateVertices(
      this.dragState.origVertices,
      clampedDx,
      clampedDy
    );
    this.render();
  }

  onMouseUp(e) {
    if (!this.dragState) return;

    if (this.dragState.dragged && this.selectedIndex >= 0) {
      this.undoManager.pushState(
        this.polygons.map((p, i) =>
          i === this.selectedIndex
            ? { ...p, vertices: this.dragState.origVertices }
            : p
        )
      );
    }

    this.dragState = null;
    this.canvas.style.cursor = 'default';
  }

  /* ---------- клавиатура ---------- */

  onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Del') {
      this.deleteSelected();
      e.preventDefault();
    } else if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      this.performUndo();
      e.preventDefault();
    } else if (
      (e.ctrlKey && e.key === 'y') ||
      (e.ctrlKey && e.shiftKey && e.key === 'z') ||
      (e.ctrlKey && e.shiftKey && e.key === 'Z')
    ) {
      this.performRedo();
      e.preventDefault();
    }
  }

  /* ---------- toast-уведомления ---------- */

  showToast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 2000);
  }

  /* ---------- рендеринг ---------- */

  updateInfo() {
    this.polyCountEl.textContent = this.polygons.length;
    this.selectedInfoEl.textContent =
      this.selectedIndex >= 0 && this.selectedIndex < this.polygons.length
        ? `polygon #${this.polygons[this.selectedIndex].id}`
        : 'none';

    this.btnUndo.disabled = !this.undoManager.canUndo;
    this.btnRedo.disabled = !this.undoManager.canRedo;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this.polygons.length; i++) {
      const poly = this.polygons[i];
      let verts = poly.vertices;

      if (poly.animating) {
        const t = poly.animProgress;
        const eased = 1 - Math.pow(1 - t, 3);
        const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
        const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
        const scaled = verts.map(v => ({
          x: cx + (v.x - cx) * eased,
          y: cy + (v.y - cy) * eased,
        }));
        verts = scaled;
      }

      this.drawPolygon(ctx, verts, poly.color, i === this.selectedIndex);
    }

    this.updateInfo();
  }

  drawPolygon(ctx, vertices, color, selected) {
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = selected ? '#00e5ff' : '#2c3e50';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();

    if (selected) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

customElements.define('polygon-editor', PolygonEditor);
