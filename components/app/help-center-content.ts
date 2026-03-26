import type { Language } from '../../i18n';

export type HelpSectionId =
    | 'overview'
    | 'navigation'
    | 'brands-and-apps'
    | 'ideas'
    | 'accounts'
    | 'selected-app-setup'
    | 'step-1-icon'
    | 'step-2-client-spec'
    | 'step-3-setup-data'
    | 'step-4-dev-files'
    | 'step-5-development'
    | 'step-6-integration'
    | 'step-7-auto-release'
    | 'step-8-simulator-screenshots'
    | 'step-9-screenshot-prompts'
    | 'step-10-generated-screenshots'
    | 'no-brand-flow'
    | 'collaboration-and-guards'
    | 'deliverables-export';

export type HelpSectionGroupId = 'product-map' | 'main-workflow' | 'special-cases';

export type HelpSection = {
    id: HelpSectionId;
    groupId: HelpSectionGroupId;
    eyebrow: string;
    tocLabel: string;
    title: string;
    summary: string;
    points: string[];
    callout?: string;
    visual?: HelpSectionVisual;
};

export type HelpSectionVisual = {
    placement: 'right' | 'wide';
    size: 'small' | 'medium' | 'large';
    medium: 'image' | 'gif';
    asset?: {
        src: string;
        alt: string;
    };
};

export type HelpSectionGroup = {
    id: HelpSectionGroupId;
    title: string;
    summary: string;
};

export type HelpCenterCopy = {
    heroTitle: string;
    heroSummary: string;
    groups: Record<HelpSectionGroupId, HelpSectionGroup>;
    tocLabel: string;
    sections: HelpSection[];
};

// Help stays bilingual in source, but the shell intentionally forces Russian at runtime for now.
export const HELP_CENTER_RUNTIME_LANG: Language = 'ru';

const CONTENT_BY_LANG: Record<Language, HelpCenterCopy> = {
    en: {
        heroTitle: 'Help',
        heroSummary: 'Operator reference for the core ZefGen flow: page roles, setup order, and the path from idea to deliverables.',
        groups: {
            'product-map': {
                id: 'product-map',
                title: 'Product map',
                summary: 'Pages, context, and pre-step setup before the main production sequence starts.',
            },
            'main-workflow': {
                id: 'main-workflow',
                title: 'Main workflow',
                summary: 'The core execution path once an app is created or selected and the prep blocks are ready.',
            },
            'special-cases': {
                id: 'special-cases',
                title: 'Special cases',
                summary: 'Alternative flows, collaboration guards, and the final handoff surface.',
            },
        },
        tocLabel: 'Page guide',
        sections: [
            {
                id: 'overview',
                groupId: 'product-map',
                eyebrow: 'Overview',
                tocLabel: 'Overview',
                title: 'Platform map',
                summary: 'ZefGen keeps brand context, app setup, development operations, and asset production in one authenticated workspace.',
                points: [
                    'Brands hold shared market direction, release context, and reference material.',
                    'Each app runs its own setup, dev, integration, screenshot, and export track.',
                    'Accounts, Help, and Ideas are side pages inside the same shell, not separate products.',
                ],
                callout: 'Default path: pick or create a brand, pick or create an app, clear selected-app setup, then run Steps 1-10.',
            },
            {
                id: 'navigation',
                groupId: 'product-map',
                eyebrow: 'Navigation',
                tocLabel: 'Navigation',
                title: 'How navigation works',
                summary: 'The sidebar controls context. The left side picks the active brand and app, and the footer switches between non-workspace pages.',
                points: [
                    'Changing the selected brand or app changes the active workspace context immediately.',
                    'The footer keeps Accounts, sessions, Help, and Ideas available without leaving the authenticated shell.',
                    'Browser history is preserved across workspace, accounts, help, and ideas, so `/help` and `/help#...` behave like real pages.',
                ],
            },
            {
                id: 'brands-and-apps',
                groupId: 'product-map',
                eyebrow: 'Workspace',
                tocLabel: 'Brands and apps',
                title: 'Brands and apps',
                summary: 'Brands are the shared operating layer. Apps are the execution unit inside that layer.',
                points: [
                    'Release info stores brand-level launch context that later app work inherits.',
                    'Reference library and brand references feed icon direction, screenshot styling, and prompt quality.',
                    'Use No Brand only when the concept is still too fluid for stable shared context.',
                ],
                callout: 'If brand release info or references are weak, Step 1 and the screenshot steps usually degrade first.',
            },
            {
                id: 'accounts',
                groupId: 'product-map',
                eyebrow: 'Side page',
                tocLabel: 'Accounts',
                title: 'Accounts page',
                summary: 'Accounts stores publishing identities and lets you bind them to apps before setup data starts depending on them.',
                points: [
                    'Keep accounts unassigned until an app needs a concrete publishing identity, or attach them early when the target app is already known.',
                    'Assigned account data is meant to flow into company-name and publishing fields in setup.',
                    'Unsaved edits block navigation away from Accounts, so save or cancel before switching pages.',
                ],
            },
            {
                id: 'ideas',
                groupId: 'product-map',
                eyebrow: 'Side page',
                tocLabel: 'Ideas',
                title: 'Ideas page',
                summary: 'Ideas is the backlog for concepts, summaries, and reusable client specs before they become active app work.',
                points: [
                    'Use it to compare directions, store generated concepts, or keep manual ideas in one place.',
                    'Step 2 can pull an existing idea into the active app instead of rewriting the spec.',
                    'Ideas can stay under a brand or remain in No Brand while the concept is still exploratory.',
                ],
            },
            {
                id: 'selected-app-setup',
                groupId: 'main-workflow',
                eyebrow: 'Before Step 1',
                tocLabel: 'Before Step 1',
                title: 'Before Step 1: selected app setup',
                summary: 'After an app is created or selected, two app-level panels appear above the numbered steps: the canonical App Store link and the App Review webhook.',
                points: [
                    'If the app does not exist yet, create it under a brand or in No Brand first. These panels only appear for the currently selected app.',
                    'Use the App Store link row to store the live or canonical store URL tied to the selected app.',
                    'Use the webhook row to save App Store Connect credentials, bind the ASC app, and receive App Review state changes here.',
                    'Webhook order is fixed: create receiver, add Apple key, load Apple apps, sync webhook, send test.',
                ],
                callout: 'Using Save Apple config, Load Apple apps, and Sync Apple webhook here replaces manual webhook setup in App Store Connect.',
            },
            {
                id: 'step-1-icon',
                groupId: 'main-workflow',
                eyebrow: 'Step 1',
                tocLabel: 'Step 1: Icon',
                title: 'Step 1: Icon direction',
                summary: 'Step 1 sets the visual anchor for the rest of the asset flow.',
                points: [
                    'For regular brands, icon direction should use brand references and prompts.',
                    'For No Brand, icon prompting can be derived from the client spec after the concept is defined.',
                    'Do not over-polish here. Pick a direction strong enough to guide later screenshot work.',
                ],
            },
            {
                id: 'step-2-client-spec',
                groupId: 'main-workflow',
                eyebrow: 'Step 2',
                tocLabel: 'Step 2: Client spec',
                title: 'Step 2: Client spec',
                summary: 'This is the product brief. It feeds setup data, development tasks, screenshot prompts, and export quality.',
                points: [
                    'Write the spec directly or pull it from Ideas.',
                    'Be specific about flows, target user, screens, monetization, and constraints.',
                    'If downstream output is vague, the client spec is usually the first thing to tighten.',
                ],
            },
            {
                id: 'step-3-setup-data',
                groupId: 'main-workflow',
                eyebrow: 'Step 3',
                tocLabel: 'Step 3: Setup data',
                title: 'Step 3: Setup data',
                summary: 'Setup data turns an app from a concept into an executable project with the required operational values.',
                points: [
                    'This step covers variables, secrets, bundle details, legal links, and store-facing metadata.',
                    'Account-linked values and generated helpers only work well when the underlying fields are complete.',
                    'Missing required setup values intentionally block later runner and integration actions.',
                ],
            },
            {
                id: 'step-4-dev-files',
                groupId: 'main-workflow',
                eyebrow: 'Step 4',
                tocLabel: 'Step 4: Dev files',
                title: 'Step 4: Dev files and repository',
                summary: 'This step connects the app to the repository that later tasks will read from and write to.',
                points: [
                    'Create or connect the target repo before expecting code-producing tasks to run cleanly.',
                    'This is the bridge between product planning in ZefGen and implementation assets outside it.',
                    'If the repo is unclear, development and integration should stay blocked.',
                ],
            },
            {
                id: 'step-5-development',
                groupId: 'main-workflow',
                eyebrow: 'Step 5',
                tocLabel: 'Step 5: Development',
                title: 'Step 5: Development',
                summary: 'Development queues implementation work once the brief, setup, and repo context are stable enough.',
                points: [
                    'Run it after the spec, setup data, and repository are ready for actionable work.',
                    'Track job status inside the module instead of guessing whether the runner is blocked or still working.',
                    'If the runner requests clarification, answer there before changing unrelated steps.',
                ],
            },
            {
                id: 'step-6-integration',
                groupId: 'main-workflow',
                eyebrow: 'Step 6',
                tocLabel: 'Step 6: Integration',
                title: 'Step 6: Integration',
                summary: 'Integration applies the prepared package into the target repo flow and exposes where the process currently sits.',
                points: [
                    'This step depends on a connected repo and enough setup completeness to know what should be applied.',
                    'Use the timeline to read the current phase: prepare repo, load package, plan, apply, check, send.',
                    'If the process pauses for input, treat it as a checkpoint, not as a silent failure.',
                ],
            },
            {
                id: 'step-7-auto-release',
                groupId: 'main-workflow',
                eyebrow: 'Step 7',
                tocLabel: 'Step 7: Auto-release',
                title: 'Step 7: Auto-release',
                summary: 'Under development, пока вручную.',
                points: [],
            },
            {
                id: 'step-8-simulator-screenshots',
                groupId: 'main-workflow',
                eyebrow: 'Step 8',
                tocLabel: 'Step 8: Simulator shots',
                title: 'Step 8: Simulator screenshots',
                summary: 'This step provides the raw app frames that the marketing screenshot flow builds on.',
                points: [
                    'Upload source screenshots in a clean order so slot mapping stays predictable.',
                    'Focus on source quality and coverage, not marketing polish yet.',
                    'If the source count is incomplete, later screenshot steps should remain blocked.',
                ],
            },
            {
                id: 'step-9-screenshot-prompts',
                groupId: 'main-workflow',
                eyebrow: 'Step 9',
                tocLabel: 'Step 9: Prompts',
                title: 'Step 9: Screenshot prompts',
                summary: 'This is where raw frames become marketable screenshot slots with positioning, copy, and style direction.',
                points: [
                    'Each slot should have a clear source frame, style reference, and text direction.',
                    'Prompt quality matters because this step shapes marketing assets, not raw documentation.',
                    'Use the client spec and brand references to avoid generic headline filler.',
                ],
            },
            {
                id: 'step-10-generated-screenshots',
                groupId: 'main-workflow',
                eyebrow: 'Step 10',
                tocLabel: 'Step 10: Generated shots',
                title: 'Step 10: Generated screenshots',
                summary: 'This is the review and selection stage for final screenshot outputs.',
                points: [
                    'Compare versions, refine overlays, and keep only the outputs that should survive into the final set.',
                    'Mark the step complete only after the required icon and screenshot picks are clear.',
                    'The goal is a clean export package, not a gallery of every experiment.',
                ],
            },
            {
                id: 'no-brand-flow',
                groupId: 'special-cases',
                eyebrow: 'No Brand',
                tocLabel: 'No Brand / Step 11',
                title: 'No Brand flow and Step 11 move to brand',
                summary: 'No Brand is for early concepts. The workflow still works, but the opening order and the final handoff are different.',
                points: [
                    'The order flips at the start: client spec comes before icon because the concept usually needs definition first.',
                    'Step 11 is a dedicated move action: choose a target brand and transfer the app once positioning, references, and launch intent are stable.',
                    'If there is no target brand yet, create one first. The move panel stays blocked until a regular brand exists.',
                ],
                callout: 'Move out of No Brand when the app needs shared release info and brand references, not just when the copy looks better.',
            },
            {
                id: 'collaboration-and-guards',
                groupId: 'special-cases',
                eyebrow: 'Guards',
                tocLabel: 'Collaboration',
                title: 'Collaboration and guards',
                summary: 'ZefGen blocks edits or page switches when that prevents conflicts or data loss.',
                points: [
                    'A brand can become read-only when another user is already holding the editing lock.',
                    'Use Take over editing to explicitly take write access and move the other session into view-only mode.',
                    'Accounts also has its own unsaved-change guard and will stop page exits until edits are resolved.',
                ],
            },
            {
                id: 'deliverables-export',
                groupId: 'special-cases',
                eyebrow: 'Finish',
                tocLabel: 'Deliverables',
                title: 'Deliverables and export',
                summary: 'Deliverables is the handoff end of the workflow after the final picks are clean.',
                points: [
                    'Export only after Step 10 is curated enough for another person to understand the final set immediately.',
                    'ZIP downloads and final asset bundles exist to remove manual collection work at the end.',
                    'Treat deliverables as a release-ready package, not as storage for every intermediate variant.',
                ],
            },
        ],
    },
    ru: {
        heroTitle: 'Help',
        heroSummary: 'Короткая карта ZefGen: где что находится, в каком порядке идти по шагам и где заканчивается процесс.',
        groups: {
            'product-map': {
                id: 'product-map',
                title: 'Карта продукта',
                summary: 'Страницы, контекст и стартовые блоки до основного процесса.',
            },
            'main-workflow': {
                id: 'main-workflow',
                title: 'Основной процесс',
                summary: 'Главная последовательность после создания или выбора приложения и базовой подготовки.',
            },
            'special-cases': {
                id: 'special-cases',
                title: 'Особые сценарии',
                summary: 'No Brand, ограничения совместной работы и финальная выдача материалов.',
            },
        },
        tocLabel: 'Разделы',
        sections: [
            {
                id: 'overview',
                groupId: 'product-map',
                eyebrow: 'Обзор',
                tocLabel: 'Обзор',
                title: 'One-shot платформа полного цикла',
                summary: 'ZefGen — one-shot платформа полного цикла для разработки и выпуска приложения: от идеи и настройки до разработки, интеграции, скриншотов и финального пакета.',
                points: [
                    'Бренд хранит общий контекст: позиционирование, релиз и референсы.',
                    'У каждого приложения свой путь: setup, разработка, интеграция, скриншоты.',
                ],
                callout: 'Маршрут релизеров: подготовить аккаунты/идеи, выбрать бренд, пройти пройти по шагам и создать приложение, скриншоты.',
            },
            {
                id: 'navigation',
                groupId: 'product-map',
                eyebrow: 'Навигация',
                tocLabel: 'Навигация',
                title: 'Как устроена навигация',
                summary: 'Сайдбар задает контекст. Слева выбираются бренд и приложение, внизу переключаются служебные страницы.',
                points: [
                    'Смена бренда или приложения сразу меняет активный рабочий контекст.',
                    'Accounts, sessions, Help и Ideas доступны в той же оболочке, без отдельного выхода из workspace.',
                    'История браузера сохраняется между workspace, accounts, help и ideas, поэтому `/help` и `/help#...` ведут себя как обычные страницы.',
                ],
            },
            {
                id: 'brands-and-apps',
                groupId: 'product-map',
                eyebrow: 'Рабочее пространство',
                tocLabel: 'Бренды и приложения',
                title: 'Бренды и приложения',
                summary: 'Бренд задает общий слой. Приложение внутри бренда идет по собственному процессу.',
                points: [
                    'Release info хранит общий контекст выпуска, который потом наследуют шаги приложения.',
                    'Reference library и брендовые референсы влияют на иконку, скриншоты и качество промптов.',
                    'No Brand подходит только для ранних концептов, пока общий контекст бренда еще не собран.',
                ],
                callout: 'Слабые release info и референсы быстрее всего бьют по иконке и скриншотам.',
            },
            {
                id: 'accounts',
                groupId: 'product-map',
                eyebrow: 'Отдельная страница',
                tocLabel: 'Accounts',
                title: 'Страница Accounts',
                summary: 'Accounts хранит издательские аккаунты и их привязку к приложениям.',
                points: [
                    'Аккаунт можно держать свободным до момента, когда приложению нужен конкретный издатель.',
                    'Данные назначенного аккаунта должны попадать в company name и смежные поля setup data.',
                    'Несохраненные правки блокируют переход на другие страницы, пока изменения не сохранены или не отменены.',
                ],
            },
            {
                id: 'ideas',
                groupId: 'product-map',
                eyebrow: 'Отдельная страница',
                tocLabel: 'Ideas',
                title: 'Страница Ideas',
                summary: 'Ideas хранит концепты и черновики client spec до перехода в рабочее приложение.',
                points: [
                    'Здесь удобно сравнивать направления и держать в одном месте сгенерированные и ручные идеи.',
                    'На шаге 2 можно подтянуть готовую идею в текущее приложение вместо нового client spec с нуля.',
                    'Идеи могут жить внутри бренда или оставаться в No Brand, пока концепт еще не закрепился.',
                ],
            },
            {
                id: 'selected-app-setup',
                groupId: 'main-workflow',
                eyebrow: 'Перед шагом 1',
                tocLabel: 'Перед шагом 1',
                title: 'Перед шагом 1: настройка выбранного приложения',
                summary: 'После создания или выбора приложения над шагами появляются два app-level блока: ссылка на App Store и App Review webhook.',
                points: [
                    'Если приложения еще нет, сначала создай его в бренде или в No Brand. Без выбранного приложения этот блок не появляется.',
                    'В App Store link хранится основная ссылка на карточку приложения.',
                    'В webhook-блоке сохраняются данные App Store Connect, выбирается приложение и включается прием статусов App Review.',
                    'Порядок фиксированный: receiver, Apple key, Apple apps, sync webhook, test.',
                ],
                callout: 'Если пройти Save Apple config, Load Apple apps и Sync Apple webhook здесь, вручную настраивать webhook уже не нужно.',
            },
            {
                id: 'step-1-icon',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 1',
                tocLabel: 'Шаг 1: Иконка',
                title: 'Шаг 1: Направление иконки',
                summary: 'Здесь задается визуальное направление для всей дальнейшей графики.',
                points: [
                    'Для обычного бренда иконка должна опираться на брендовые референсы и промпты.',
                    'В No Brand направление можно строить от client spec, когда сама идея уже понятна.',
                    'Не нужно доводить все до финала сразу. Достаточно выбрать сильное направление для следующих шагов.',
                ],
            },
            {
                id: 'step-2-client-spec',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 2',
                tocLabel: 'Шаг 2: Client spec',
                title: 'Шаг 2: Client spec',
                summary: 'Это главный продуктовый документ. От него зависят setup data, разработка и тексты для скриншотов.',
                points: [
                    'Спецификацию можно написать вручную или подтянуть из Ideas.',
                    'Здесь нужна конкретика: сценарий, пользователь, экраны, монетизация и ограничения.',
                    'Если следующие шаги дают размытый результат, сначала усиливай client spec.',
                ],
            },
            {
                id: 'step-3-setup-data',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 3',
                tocLabel: 'Шаг 3: Setup data',
                title: 'Шаг 3: Setup data',
                summary: 'Здесь идея превращается в проект с рабочими параметрами и обязательными данными.',
                points: [
                    'Здесь живут variables, secrets, bundle details, legal links и store-метаданные.',
                    'Подстановка данных из аккаунта и вспомогательная генерация нормально работают только на заполненной базе.',
                    'Если обязательных значений не хватает, runner и integration дальше должны оставаться заблокированными.',
                ],
            },
            {
                id: 'step-4-dev-files',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 4',
                tocLabel: 'Шаг 4: Dev files',
                title: 'Шаг 4: Dev files и репозиторий',
                summary: 'На этом шаге приложение привязывается к репозиторию, с которым дальше работает система.',
                points: [
                    'Сначала нужно создать или подключить целевой репозиторий.',
                    'Это мост между планированием внутри ZefGen и реальной кодовой базой.',
                    'Если репозиторий не выбран или выбран неверно, development и integration должны оставаться заблокированными.',
                ],
            },
            {
                id: 'step-5-development',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 5',
                tocLabel: 'Шаг 5: Development',
                title: 'Шаг 5: Development',
                summary: 'Здесь запускается реальная работа по разработке, когда spec, setup data и репозиторий уже готовы.',
                points: [
                    'Запускай шаг только после того, как client spec, setup data и repo собраны достаточно хорошо.',
                    'Статус задач лучше читать прямо в модуле, а не гадать, система еще работает или уже ждет действие.',
                    'Если runner просит уточнение, отвечай там, а не меняй несвязанные шаги.',
                ],
            },
            {
                id: 'step-6-integration',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 6',
                tocLabel: 'Шаг 6: Integration',
                title: 'Шаг 6: Integration',
                summary: 'Integration применяет подготовленный пакет в репозиторий и показывает текущую фазу процесса.',
                points: [
                    'Шаг зависит от подключенного репозитория и достаточно полного setup data.',
                    'Таймлайн нужен, чтобы читать текущую фазу: prepare repo, load package, plan, apply, check, send.',
                    'Если процесс остановился и просит ввод, это контрольная точка, а не скрытая ошибка.',
                ],
            },
            {
                id: 'step-7-auto-release',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 7',
                tocLabel: 'Шаг 7: Авто-релиз',
                title: 'Шаг 7: Авто-релиз',
                summary: 'Under development, пока вручную.',
                points: [],
            },
            {
                id: 'step-8-simulator-screenshots',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 8',
                tocLabel: 'Шаг 8: Simulator shots',
                title: 'Шаг 8: Скриншоты из симулятора',
                summary: 'Здесь загружается исходный материал, на котором строится весь процесс скриншотов.',
                points: [
                    'Исходные скриншоты лучше загружать в правильном порядке, чтобы слоты потом не путались.',
                    'Здесь важны качество и полнота исходников, а не финальный маркетинговый вид.',
                    'Если исходных кадров не хватает, следующие шаги со скриншотами должны оставаться заблокированными.',
                ],
            },
            {
                id: 'step-9-screenshot-prompts',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 9',
                tocLabel: 'Шаг 9: Prompts',
                title: 'Шаг 9: Промпты для скриншотов',
                summary: 'Здесь исходные кадры превращаются в слоты со своим сообщением, стилем и текстом.',
                points: [
                    'У каждого слота должен быть понятный исходный кадр, визуальный референс и направление по тексту.',
                    'Качество промптов здесь критично, потому что это уже маркетинговые материалы.',
                    'Опирайся на client spec и брендовые референсы, чтобы не получить пустые дежурные заголовки.',
                ],
            },
            {
                id: 'step-10-generated-screenshots',
                groupId: 'main-workflow',
                eyebrow: 'Шаг 10',
                tocLabel: 'Шаг 10: Generated shots',
                title: 'Шаг 10: Сгенерированные скриншоты',
                summary: 'Здесь просматриваются версии, вносятся правки и выбирается финальный набор.',
                points: [
                    'Сравнивай версии, правь оверлеи и оставляй только то, что должно войти в итоговый пакет.',
                    'Завершать шаг стоит только тогда, когда иконка и нужные скриншоты выбраны окончательно.',
                    'Цель этого шага не галерея экспериментов, а чистый набор на экспорт.',
                ],
            },
            {
                id: 'no-brand-flow',
                groupId: 'special-cases',
                eyebrow: 'No Brand',
                tocLabel: 'No Brand / Шаг 11',
                title: 'No Brand и перенос в бренд на шаге 11',
                summary: 'No Brand нужен для ранних концептов. Логика та же, но стартовый порядок и финальный перенос другие.',
                points: [
                    'В начале порядок меняется: сначала идет client spec, а уже потом иконка.',
                    'Шаг 11 - отдельное действие переноса: выбери целевой бренд и переведи туда приложение, когда позиционирование и референсы уже стабилизировались.',
                    'Если подходящего бренда еще нет, его нужно сначала создать. До этого перенос будет недоступен.',
                ],
                callout: 'Переноси приложение из No Brand в тот момент, когда ему уже нужен общий брендовый контекст.',
            },
            {
                id: 'collaboration-and-guards',
                groupId: 'special-cases',
                eyebrow: 'Ограничения',
                tocLabel: 'Совместная работа',
                title: 'Совместная работа и ограничения',
                summary: 'ZefGen блокирует запись или переход между страницами там, где это защищает от конфликтов и потери данных.',
                points: [
                    'Бренд может перейти в режим только чтения, если другой пользователь уже удерживает право редактирования.',
                    'Кнопка «Забрать редактирование» нужна, чтобы явно вернуть себе запись и перевести другую сессию в просмотр.',
                    'У Accounts есть отдельная защита от несохраненных изменений, поэтому выйти со страницы без решения правок не получится.',
                ],
            },
            {
                id: 'deliverables-export',
                groupId: 'special-cases',
                eyebrow: 'Финиш',
                tocLabel: 'Deliverables',
                title: 'Deliverables и экспорт',
                summary: 'Deliverables - финальная точка процесса, когда материалы уже готовы к передаче дальше.',
                points: [
                    'Экспорт имеет смысл только после того, как шаг 10 уже собран и итоговый набор не вызывает вопросов.',
                    'ZIP downloads и готовые asset bundles нужны, чтобы не собирать материалы вручную в конце.',
                    'Смотри на deliverables как на финальный пакет, а не как на склад промежуточных версий.',
                ],
            },
        ],
    },
};

const VISUAL_PLAN_BY_SECTION: Partial<Record<HelpSectionId, HelpSectionVisual>> = {
    overview: {
        placement: 'wide',
        size: 'large',
        medium: 'image',
    },
    navigation: {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    'brands-and-apps': {
        placement: 'right',
        size: 'large',
        medium: 'image',
    },
    ideas: {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    accounts: {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    'selected-app-setup': {
        placement: 'right',
        size: 'large',
        medium: 'gif',
    },
    'step-1-icon': {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    'step-2-client-spec': {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    'step-3-setup-data': {
        placement: 'right',
        size: 'large',
        medium: 'image',
    },
    'step-4-dev-files': {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    'step-5-development': {
        placement: 'right',
        size: 'large',
        medium: 'gif',
    },
    'step-6-integration': {
        placement: 'right',
        size: 'medium',
        medium: 'gif',
    },
    'step-8-simulator-screenshots': {
        placement: 'right',
        size: 'medium',
        medium: 'image',
    },
    'step-9-screenshot-prompts': {
        placement: 'right',
        size: 'large',
        medium: 'gif',
    },
    'step-10-generated-screenshots': {
        placement: 'right',
        size: 'large',
        medium: 'gif',
    },
    'no-brand-flow': {
        placement: 'right',
        size: 'large',
        medium: 'gif',
    },
    'collaboration-and-guards': {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
    'deliverables-export': {
        placement: 'right',
        size: 'small',
        medium: 'image',
    },
};

export const getHelpCenterCopy = (lang: Language) => {
    const content = CONTENT_BY_LANG[lang] || CONTENT_BY_LANG.en;
    return {
        ...content,
        sections: content.sections.map((section) => ({
            ...section,
            visual: VISUAL_PLAN_BY_SECTION[section.id],
        })),
    };
};
