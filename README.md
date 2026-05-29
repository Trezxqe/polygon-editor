# Polygon Editor

Веб-редактор многоугольников на Web Components и Canvas API.

## Стек

- Vanilla JavaScript (ES2020+)
- Web Components (Shadow DOM)
- Canvas API
- Webpack 5

## Запуск

```bash
npm install
npm run dev     # dev-сервер с hot reload
npm run build   # production-сборка в dist/
```

## Функции

- Генерация случайных многоугольников (3-7 вершин) без наложений
- Перетаскивание мышью с удержанием в границах canvas
- Удаление выбранного / всех многоугольников
- Изменение цвета выбранного многоугольника
- Undo / Redo (Ctrl+Z / Ctrl+Y) для всех действий
- Анимация появления при генерации
- Экспорт и импорт сцены в JSON
