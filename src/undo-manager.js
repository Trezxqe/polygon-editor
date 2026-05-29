import { cloneVertices } from './geometry.js';

/**
 * Управляет историей отмены/повтора для состояния многоугольников.
 * Каждое состояние — глубокий клон массива polygons.
 */
export class UndoManager {
  constructor() {
    /** @type {{ vertices: {x:number,y:number}[], color: string, id: number }[][]} */
    this.undoStack = [];
    /** @type {{ vertices: {x:number,y:number}[], color: string, id: number }[][]} */
    this.redoStack = [];
  }

  /**
   * Сохраняет снимок текущего состояния многоугольников.
   * Очищает стек повтора после нового действия.
   */
  pushState(polygons) {
    this.undoStack.push(this.clonePolygons(polygons));
    this.redoStack = [];
  }

  /**
   * Восстанавливает предыдущее состояние. Возвращает восстановленный массив или null.
   */
  undo(currentPolygons) {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(this.clonePolygons(currentPolygons));
    return this.undoStack.pop();
  }

  /**
   * Восстанавливает следующее состояние. Возвращает восстановленный массив или null.
   */
  redo(currentPolygons) {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(this.clonePolygons(currentPolygons));
    return this.redoStack.pop();
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Создаёт глубокий клон массива многоугольников.
   */
  clonePolygons(polygons) {
    return polygons.map(p => ({
      ...p,
      vertices: cloneVertices(p.vertices),
    }));
  }
}
