# Skip and Seek

**English** | [Русский](#русский)

Keyboard-first video seeking and ad skipping for any site.

> **If an ad doesn't skip automatically — press `D` to skip it manually.**

Works in Chrome, Edge, Brave and other Chromium-based browsers. Finds the video player on the page, even inside embeds, and lets you move through the video without touching the mouse:

- **A** — back 5 seconds
- **D** — forward 5 seconds

## Features

- Finds the player automatically: `<video>`, YouTube, Vimeo, Twitch, Netflix, etc.
- Works inside iframes, including embedded players.
- Uses physical keys, not characters: A/D work on Russian and other non-Latin layouts.
- Never steals typing: input fields, search boxes and chats are ignored.
- Picks the main video: prefers the playing, visible and largest player.
- Shows a small toast with the new position: `+5 sec 01:23 / 03:45`.
- Ad auto-skip: clicks "Skip" buttons, finishes short ad clips and blocks ad requests.
- Popup: turn the extension on or off, change the seek step.

## Installation

1. Download the repository (**Code → Download ZIP**) and unpack it, or `git clone` it.
2. Open `chrome://extensions` (`edge://extensions` in Edge).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the extension folder.
5. Open any video and press `A` / `D`.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Manifest V3: permissions and entry points |
| `content.js` | Page script: finds `<video>` (including shadow DOM), handles keys, seeks |
| `background.js` | Service worker: relays seeking between frames when the focus is elsewhere |
| `ads.js` | Ad auto-skip: clicks "Skip", finishes short ad clips |
| `adblock-rules.json` | DeclarativeNetRequest rules: blocks ad requests (adriver, yandex/ads, adfox, doubleclick, etc.) |
| `popup.html` / `popup.js` | Settings: on/off toggle and seek step |
| `icons/` | Extension icons |

## How ad skipping works

The extension doesn't "crack" ads; it works at the page level. It detects an ad by several signals and, while the ad is playing, clicks skip buttons and fast-forwards short ad clips:

1. **"Skip" / "Пропустить" / "Close ad" buttons** — clicked as soon as they appear (matched by class, `aria-label` and text in several languages).
2. **Player classes** — `vjs-ad-playing`, `ima-ad*`, `ad-showing`, `vast-*`, `ad-container`, etc. (YouTube, video.js, Google IMA, JW Player, Plyr).
3. **Ad URLs** — when `video.src` points to an ad host (`doubleclick`, `googlesyndication`, `aniview`, `springserve`, `adserver`, …).
4. **"Ad" label or countdown** — visible "Реклама", "Skip ad", "Ad ends in N sec" text near the video.
5. **Network blocking** — `adblock-rules.json` cuts ad requests (XHR, media, iframes, scripts), so many players never receive the VAST response.

This covers players used by amd.online (**CDN**, **Amedia**, **Kodik**): they all show VAST prerolls through one of these schemes.

## Notes

- Doesn't run on `chrome://…`, `about:` and extension store pages (Chrome restriction).
- For local files (`file://`) enable "Allow access to file URLs" in the extension settings.
- Sites change their markup, so efficiency may depend on the player version. Site terms of service may prohibit skipping ads — use at your own risk.

---

## Русский

> **Если реклама не автоскипается — скипайте вручную на `D`.**

Расширение для Chromium (Chrome / Edge / Brave и другие), которое находит видеоплеер на любом сайте и перематывает видео с клавиатуры:

- **A** — назад на 5 секунд
- **D** — вперёд на 5 секунд

### Возможности

- Определяет плеер автоматически: `<video>`, YouTube, Vimeo, Twitch, Netflix и т.д.
- Работает внутри `iframe`, в том числе во встроенных плеерах.
- Учитывает раскладку клавиатуры — работает и на русской раскладке (физические клавиши A и D).
- Не мешает набору текста: в полях ввода, поиска и чатах клавиши не перехватываются.
- Выбирает «главное» видео: приоритет у видимого, играющего и самого крупного плеера.
- Показывает всплывающую подсказку с новым временем (`+5 сек 01:23 / 03:45`).
- Автопропуск рекламы: авто-клик по кнопкам «Skip»/«Пропустить», дожим коротких роликов и блокировка рекламных запросов.
- В попапе можно выключить расширение или изменить шаг перемотки.

### Установка

1. Скачай репозиторий (**Code → Download ZIP**) и распакуй, либо `git clone`.
2. Открой в браузере `chrome://extensions` (в Edge — `edge://extensions`).
3. Включи **«Режим разработчика»**.
4. Нажми **«Загрузить распакованное расширение»** и выбери папку расширения.
5. Готово. Открой любое видео и жми `A` / `D`.

### Файлы

| Файл | Назначение |
|------|-----------|
| `manifest.json` | Манифест V3, права и точки входа |
| `content.js` | Скрипт на страницах: ищет `<video>` (включая shadow DOM), слушает клавиши, перематывает |
| `background.js` | Service worker: ретранслирует перемотку между фреймами, если фокус в другом фрейме |
| `ads.js` | Автопропуск рекламы: клик по «Skip», дожим коротких роликов |
| `adblock-rules.json` | DNR-правила: режут рекламные запросы (adriver, yandex/ads, adfox, doubleclick и т.п.) |
| `popup.html` / `popup.js` | Настройки: вкл/выкл и шаг перемотки |
| `icons/` | Иконки расширения |

### Как это работает

Расширение не «взламывает» рекламу, а работает на уровне страницы. Оно определяет момент показа рекламы по нескольким сигналам и, пока реклама идёт, жмёт кнопки пропуска и дожимает короткие ролики:

1. **Кнопки «Skip» / «Пропустить» / «Закрыть рекламу»** — кликаются автоматически, как только появляются (по классу, `aria-label` и тексту на разных языках).
2. **Классы плеера** — `vjs-ad-playing`, `ima-ad*`, `ad-showing`, `vast-*`, `ad-container` и т.п. (YouTube, video.js, Google IMA, JW Player, Plyr).
3. **URL рекламы** — если `video.src` ведёт на рекламный домен (`doubleclick`, `googlesyndication`, `aniview`, `springserve`, `adserver` и т.п.).
4. **Надпись/таймер «Реклама»** — видимый текст «Реклама», «Пропустить рекламу», «Реклама закончится через N сек» рядом с видео.
5. **Блокировка по сети** — `adblock-rules.json` режет рекламные запросы (XHR, media, iframe, скрипты), и многие плееры просто не получают VAST-ответ.

Это покрывает плееры amd.online (**CDN**, **Amedia**, **Kodik**): все они показывают VAST-прероллы по одной из этих схем.

### Примечания

- На `chrome://…`, `about:` и страницах магазина расширения не работает (ограничение Chrome).
- Для видео с открытых файлов (`file://`) включи «Разрешить доступ к файловым URL» в настройках расширения.
- Сайты периодически меняют разметку, поэтому эффективность может зависеть от версии плеера. Использование автопропуска может нарушать условия сервисов (ToS) отдельных сайтов — включай на свой страх и риск.
