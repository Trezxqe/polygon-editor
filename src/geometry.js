/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {Point[]} Vertices
 */

/**
 * Возвращает ограничивающий прямоугольник для набора вершин.
 */
export function getBounds(vertices) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Алгоритм ray casting: проверяет, находится ли точка внутри многоугольника.
 */
export function pointInPolygon(point, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    if ((yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Проверяет пересечение двух отрезков (p1-p2) и (q1-q2).
 */
function segmentsIntersect(p1, p2, q1, q2) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = q2.x - q1.x, d2y = q2.y - q1.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;

  const t = ((q1.x - p1.x) * d2y - (q1.y - p1.y) * d2x) / cross;
  const u = ((q1.x - p1.x) * d1y - (q1.y - p1.y) * d1x) / cross;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Проверяет, перекрываются ли два многоугольника.
 * Тестирует пересечение рёбер и вхождение вершин одного в другой.
 */
export function polygonsOverlap(verts1, verts2) {
  for (let i = 0; i < verts1.length; i++) {
    const p1 = verts1[i];
    const p2 = verts1[(i + 1) % verts1.length];
    for (let j = 0; j < verts2.length; j++) {
      const q1 = verts2[j];
      const q2 = verts2[(j + 1) % verts2.length];
      if (segmentsIntersect(p1, p2, q1, q2)) return true;
    }
  }

  for (const v of verts1) {
    if (pointInPolygon(v, verts2)) return true;
  }
  for (const v of verts2) {
    if (pointInPolygon(v, verts1)) return true;
  }

  return false;
}

/**
 * Генерирует случайный набор вершин для выпуклого многоугольника.
 * Все вершины гарантированно лежат внутри [margin, размер-margin].
 */
export function generateRandomVertices(numVertices, canvasWidth, canvasHeight, margin = 50) {
  const angles = Array.from({ length: numVertices }, () => Math.random() * 2 * Math.PI);
  angles.sort((a, b) => a - b);

  const localVerts = angles.map(a => {
    const radius = 30 + Math.random() * 80;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });

  const bounds = getBounds(localVerts);
  const polyW = bounds.width;
  const polyH = bounds.height;

  const maxX = Math.max(0, canvasWidth - margin - polyW);
  const maxY = Math.max(0, canvasHeight - margin - polyH);
  const offsetX = margin + Math.random() * maxX - bounds.minX;
  const offsetY = margin + Math.random() * maxY - bounds.minY;

  return localVerts.map(v => ({
    x: Math.round(v.x + offsetX),
    y: Math.round(v.y + offsetY),
  }));
}

/**
 * Возвращает случайный HSL-цвет, визуально различимый и не слишком светлый.
 */
export function generateRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const sat = 55 + Math.floor(Math.random() * 35);
  const lig = 30 + Math.floor(Math.random() * 30);
  return `hsl(${hue}, ${sat}%, ${lig}%)`;
}

/**
 * Глубокое копирование массива вершин.
 */
export function cloneVertices(vertices) {
  return vertices.map(v => ({ x: v.x, y: v.y }));
}

/**
 * Смещает все вершины на (dx, dy).
 */
export function translateVertices(vertices, dx, dy) {
  return vertices.map(v => ({ x: v.x + dx, y: v.y + dy }));
}
