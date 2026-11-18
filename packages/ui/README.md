# Only Tools UI

Общий стиль для всех приложений Only Tools (вариант B «Конструктор», выбран 18.11.2026).

- `only-tools.css` — единственный файл, который подключают приложения: цвета (светлая и тёмная темы), шрифт, кнопки, поля, карточки, плитки, списки, прогресс, каркас приложения.
- `index.html` — страница-витрина со всеми компонентами (собирается из `showcase.src.html` + `only-tools.css`).

## Подключение

```html
<html lang="ru" data-app="food">   <!-- car | gig | food | hub -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap">
<link rel="stylesheet" href="/only-tools.css">
<body class="ot-root">
```

- `data-app` и `data-theme` ставить на один и тот же элемент (обычно `html`).
- Без `data-theme` тема берётся из системы.
- Каркас `.ot-shell > .ot-layout > .ot-nav + .ot-main` перестраивается по ширине самого каркаса: до 640 px вкладки снизу, 640–1023 px колонка с иконками, от 1024 px боковая панель с переключателем приложений.
- Внизу не больше пяти вкладок, «добавить» (`.ot-nav__add`) в центре. Лишние пункты помечаются `.ot-nav__item--wide` и видны только на планшете и компьютере.
- Для установки на телефон нужен `manifest.webmanifest` с `"display": "standalone"` и `theme_color` `#fff8f1` (тёмная тема `#17141f`).
