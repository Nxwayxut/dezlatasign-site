# Dezlatasign

Статический сайт-портфолио Златы Сухарьковой.

## Публикация в GitHub

1. Откройте репозиторий `dezlatasign-site`.
2. Нажмите **Add file → Upload files**.
3. Загрузите содержимое этой папки. В корне репозитория должен лежать `index.html`.
4. Нажмите **Commit changes**.

## Cloudflare Pages

Настройки проекта:

- Framework preset: `None`
- Build command: оставить пустым
- Build output directory: `/`
- Root directory: `/`

После загрузки файлов откройте **Deployments** и нажмите **Retry deployment**, если автоматическая сборка не стартовала.

## Домен

В Cloudflare Pages откройте **Custom domains → Set up a custom domain** и добавьте:

- `dezlatasign.ru`
- `www.dezlatasign.ru` (по желанию)

## Редактирование

- Тексты и ссылки: `index.html`
- Цвета и размеры: `css/style.css`, блок `:root`
- Анимации и меню: `js/script.js`
- Изображения: папка `images`


## Финальный домен

Основной адрес сайта: https://dezlatasign.ru/

После подключения домена в Cloudflare Pages рекомендуется настроить постоянный редирект с адреса `*.pages.dev` и с `www.dezlatasign.ru` на `https://dezlatasign.ru/`.
