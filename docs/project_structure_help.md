# Help Center Structure Plan

## Goal

Сделать `/help` не лэндингом и не длинной лентой одинаковых карточек, а сильной рабочей справкой:

- быстро сканируется
- выглядит собранно и дорого
- показывает реальные шаги работы в продукте
- использует визуалы там, где они реально помогают

## Core Decisions

### 1. Не чередовать визуалы у шагов

Для пошагового workflow картинки не должны прыгать то влево, то вправо.

Оставляем единый ритм:

- текст слева
- визуал справа

Причина:

- шаги читаются быстрее
- страница ощущается как рабочая документация, а не маркетинговый лендинг
- не ломается привычка сканирования при длинной последовательности Step 1 → Step 10

### 2. Разделить help на 3 крупные секции

Это даст странице структуру, не перегружая её.

#### Section A. Product map

- Overview
- Navigation
- Brands and apps
- Ideas
- Accounts
- Selected app setup

#### Section B. Main workflow

- Step 1: Icon
- Step 2: Client spec
- Step 3: Setup data
- Step 4: Dev files
- Step 5: Development
- Step 6: Integration
- Step 8: Simulator screenshots
- Step 9: Screenshot prompts
- Step 10: Generated screenshots

#### Section C. Special cases

- No Brand / Step 11
- Collaboration
- Deliverables

### 3. Step 7 не показывать в help, пока он не готов

Step 7 сейчас не должен фигурировать как часть готового help flow.

Правило:

- не показывать Step 7 в help
- не объяснять его как рабочий этап
- вернуть его только тогда, когда у него появится реальная готовая поверхность

## Page Rhythm

### Section A. Product map

Это вводный блок. Тут можно позволить себе более свободную композицию, но без визуального хаоса.

Рекомендуемый ритм:

- `Overview` — широкий вводный визуал
- остальные блоки — обычные UI-скрины
- визуалы не обязаны быть у каждого пункта одинакового размера

### Section B. Main workflow

Это самая важная часть help. Здесь нужен жесткий единый шаблон.

Для каждого шага:

- заголовок
- короткое объяснение
- 2–3 точечных bullets
- визуал справа, если он нужен

Никакого чередования сторон.

### Section C. Special cases

Этот блок должен ощущаться отдельно от основного workflow.

Можно выделить его:

- отдельным section divider
- чуть более спокойным фоном
- меньшей “шаговостью”

## Visual Strategy

### Общие правила

- не добавлять визуал в каждый блок механически
- лучше меньше визуалов, но сильных
- использовать GIF только там, где движение реально объясняет процесс
- не писать в UI подсказки вида `Suggested image`, `Suggested GIF`, `Use this slot`, и т.д.
- если визуала пока нет, лучше просто оставить чистую текстовую секцию, чем держать декоративный placeholder

### Где нужен большой визуал

- Overview
- Brands and apps
- Selected app setup
- Step 3
- Step 5
- Step 9
- Step 10
- No Brand / Step 11

### Где достаточно обычного небольшого визуала

- Navigation
- Ideas
- Accounts
- Step 1
- Step 2
- Step 4
- Step 6
- Collaboration
- Deliverables

### Где лучше GIF

- Selected app setup
- Step 5
- Step 6
- Step 9
- Step 10
- No Brand / Step 11

### Где лучше статичный скрин

- Overview
- Navigation
- Brands and apps
- Ideas
- Accounts
- Step 1
- Step 2
- Step 3
- Step 4
- Deliverables

## Section-by-Section Plan

### A. Product map

#### Overview

- роль: коротко объяснить, как устроен продукт целиком
- визуал: один широкий скрин или схема
- формат: статичный

#### Navigation

- роль: показать, как перемещаться между workspace / help / accounts / ideas
- визуал: компактный скрин sidebar
- формат: статичный

#### Brands and apps

- роль: объяснить разницу между брендом и приложением
- визуал: скрин бренда с app pills + блоками Release info / Reference library
- формат: статичный

#### Ideas

- роль: показать, где живут идеи до привязки к app
- визуал: таблица ideas
- формат: статичный

#### Accounts

- роль: показать, как App Store accounts живут отдельно от app workflow
- визуал: таблица аккаунтов
- формат: статичный

#### Selected app setup

- роль: объяснить pre-step блоки до Step 1
- визуал: App Store link + webhook
- формат: лучше GIF или очень понятный последовательный скрин

### B. Main workflow

#### Step 1: Icon

- визуал: модуль генерации иконки
- формат: статичный
- размер: небольшой

#### Step 2: Client spec

- визуал: редактор client spec + picker идеи
- формат: статичный
- размер: небольшой

#### Step 3: Setup data

- визуал: variables / secrets / legal links
- формат: статичный
- размер: крупнее обычного

#### Step 4: Dev files

- визуал: repo setup
- формат: статичный
- размер: небольшой

#### Step 5: Development

- визуал: runner timeline / status
- формат: желательно GIF, если там есть важная динамика
- размер: крупный

#### Step 6: Integration

- визуал: integration timeline
- формат: желательно GIF или очень ясный статусный скрин
- размер: средний или крупный

#### Step 8: Simulator screenshots

- визуал: загрузка simulator screenshots
- формат: статичный
- размер: средний

#### Step 9: Screenshot prompts

- визуал: slot mapping + prompts + references
- формат: лучше GIF или сильный детальный скрин
- размер: крупный

#### Step 10: Generated screenshots

- визуал: gallery / picked version / edit controls
- формат: лучше GIF, если есть полезная динамика выбора и редактирования
- размер: крупный

### C. Special cases

#### No Brand / Step 11

- роль: показать отдельный сценарий вне обычного brand flow
- визуал: move-to-brand panel
- формат: GIF или статичный скрин с открытым target brand selector
- размер: крупный

#### Collaboration

- роль: объяснить read-only, takeover, unsaved guards
- визуал: один хороший read-only / warning state
- формат: статичный
- размер: небольшой

#### Deliverables

- роль: зафиксировать, чем заканчивается flow
- визуал: export rail / final package
- формат: статичный
- размер: небольшой

## Implementation Notes

### Section headers

На странице должны появиться 3 явных divider-а:

- Product map
- Main workflow
- Special cases

Они должны:

- визуально разделять page flow
- не ломать внутреннюю TOC-навигацию
- быть короткими и спокойными, без лишнего декора

### TOC behavior

В TOC можно оставить плоский список секций, но внутри страницы крупные разделители должны быть видны явно.

Если понадобится второй проход:

- можно добавить в TOC визуальную группировку по секциям
- но только если это не перегрузит левую колонку

### Content density

Для всех workflow steps придерживаться одного правила:

- короткий summary
- 2–3 bullets
- без длинных “обучающих” абзацев

### Media policy

До тех пор, пока реальных визуалов нет:

- не возвращать декоративные media placeholders
- не показывать текст с советами, какой скрин сюда стоит поставить
- оставлять секцию чисто текстовой

## Acceptance Criteria

- help визуально делится на 3 крупные секции
- основной workflow читается как единая последовательность без чередования сторон
- Step 7 отсутствует до готовности
- визуалы не обязательны для каждого пункта, но места под них планируются осознанно
- страница выглядит как product documentation, а не как landing page
- отсутствуют подсказки для автора вида `Suggested image`, `Suggested GIF`, `Use this slot`

