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

export type HelpSection = {
    id: HelpSectionId;
    eyebrow: string;
    tocLabel: string;
    title: string;
    summary: string;
    points: string[];
    callout?: string;
    mediaLabel: string;
    mediaHint: string;
};

export type HelpCenterCopy = {
    heroTitle: string;
    heroSummary: string;
    tocLabel: string;
    mediaPlaceholderLabel: string;
    sections: HelpSection[];
};

const CONTENT_BY_LANG: Record<Language, HelpCenterCopy> = {
    en: {
        heroTitle: 'Help Center',
        heroSummary: 'Operator reference for the core ZefGen flow: page roles, setup order, and the path from idea to deliverables.',
        tocLabel: 'Page guide',
        mediaPlaceholderLabel: 'Suggested image or GIF',
        sections: [
            {
                id: 'overview',
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
                mediaLabel: 'Platform overview',
                mediaHint: 'Use a compact diagram that shows the relationship between brand context, app workflow, and side pages.',
            },
            {
                id: 'navigation',
                eyebrow: 'Navigation',
                tocLabel: 'Navigation',
                title: 'How navigation works',
                summary: 'The sidebar controls context. The left side picks the active brand and app, and the footer switches between non-workspace pages.',
                points: [
                    'Changing the selected brand or app changes the active workspace context immediately.',
                    'The footer keeps Accounts, sessions, Help, and Ideas available without leaving the authenticated shell.',
                    'Browser history is preserved across workspace, accounts, help, and ideas, so `/help` and `/help#...` behave like real pages.',
                ],
                mediaLabel: 'Sidebar reference',
                mediaHint: 'Highlight the brand list, selected app, footer nav, and language switch.',
            },
            {
                id: 'brands-and-apps',
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
                mediaLabel: 'Brand and app structure',
                mediaHint: 'Show one brand with multiple apps plus the brand-level release and reference panels.',
            },
            {
                id: 'ideas',
                eyebrow: 'Side page',
                tocLabel: 'Ideas',
                title: 'Ideas page',
                summary: 'Ideas is the backlog for concepts, summaries, and reusable client specs before they become active app work.',
                points: [
                    'Use it to compare directions, store generated concepts, or keep manual ideas in one place.',
                    'Step 2 can pull an existing idea into the active app instead of rewriting the spec.',
                    'Ideas can stay under a brand or remain in No Brand while the concept is still exploratory.',
                ],
                mediaLabel: 'Ideas workflow',
                mediaHint: 'Capture the ideas table with one generated idea and one manual idea visible.',
            },
            {
                id: 'accounts',
                eyebrow: 'Side page',
                tocLabel: 'Accounts',
                title: 'Accounts page',
                summary: 'Accounts stores publishing identities and lets you bind them to apps before setup data starts depending on them.',
                points: [
                    'Keep accounts unassigned until an app needs a concrete publishing identity, or attach them early when the target app is already known.',
                    'Assigned account data is meant to flow into company-name and publishing fields in setup.',
                    'Unsaved edits block navigation away from Accounts, so save or cancel before switching pages.',
                ],
                mediaLabel: 'Account assignment',
                mediaHint: 'A table view with one assigned account and one unassigned account is enough.',
            },
            {
                id: 'selected-app-setup',
                eyebrow: 'Pre-step panels',
                tocLabel: 'Selected app setup',
                title: 'Selected app setup before Step 1',
                summary: 'When an app is selected, two app-level panels appear above the numbered steps: the canonical App Store link and the App Review webhook.',
                points: [
                    'Use the App Store link row to store the live or canonical store URL tied to the selected app.',
                    'Use the webhook row to save App Store Connect credentials, bind the ASC app, and receive App Review state changes here.',
                    'Webhook order is fixed: create receiver, add Apple key, load Apple apps, sync webhook, send test.',
                ],
                callout: 'Using Save Apple config, Load Apple apps, and Sync Apple webhook here replaces manual webhook setup in App Store Connect.',
                mediaLabel: 'App Store link and webhook',
                mediaHint: 'Capture both pre-step panels together so the order is obvious before Step 1 starts.',
            },
            {
                id: 'step-1-icon',
                eyebrow: 'Step 1',
                tocLabel: 'Step 1: Icon',
                title: 'Step 1: Icon direction',
                summary: 'Step 1 sets the visual anchor for the rest of the asset flow.',
                points: [
                    'For regular brands, icon direction should use brand references and prompts.',
                    'For No Brand, icon prompting can be derived from the client spec after the concept is defined.',
                    'Do not over-polish here. Pick a direction strong enough to guide later screenshot work.',
                ],
                mediaLabel: 'Icon generation',
                mediaHint: 'Show the icon module with one selected result.',
            },
            {
                id: 'step-2-client-spec',
                eyebrow: 'Step 2',
                tocLabel: 'Step 2: Client spec',
                title: 'Step 2: Client spec',
                summary: 'This is the product brief. It feeds setup data, development tasks, screenshot prompts, and export quality.',
                points: [
                    'Write the spec directly or pull it from Ideas.',
                    'Be specific about flows, target user, screens, monetization, and constraints.',
                    'If downstream output is vague, the client spec is usually the first thing to tighten.',
                ],
                mediaLabel: 'Client spec editor',
                mediaHint: 'Use a capture that shows the editor and the idea-picker entry point.',
            },
            {
                id: 'step-3-setup-data',
                eyebrow: 'Step 3',
                tocLabel: 'Step 3: Setup data',
                title: 'Step 3: Setup data',
                summary: 'Setup data turns an app from a concept into an executable project with the required operational values.',
                points: [
                    'This step covers variables, secrets, bundle details, legal links, and store-facing metadata.',
                    'Account-linked values and generated helpers only work well when the underlying fields are complete.',
                    'Missing required setup values intentionally block later runner and integration actions.',
                ],
                mediaLabel: 'Setup data',
                mediaHint: 'A variables-and-secrets capture with legal links visible works well here.',
            },
            {
                id: 'step-4-dev-files',
                eyebrow: 'Step 4',
                tocLabel: 'Step 4: Dev files',
                title: 'Step 4: Dev files and repository',
                summary: 'This step connects the app to the repository that later tasks will read from and write to.',
                points: [
                    'Create or connect the target repo before expecting code-producing tasks to run cleanly.',
                    'This is the bridge between product planning in ZefGen and implementation assets outside it.',
                    'If the repo is unclear, development and integration should stay blocked.',
                ],
                mediaLabel: 'Repository setup',
                mediaHint: 'Use the repo panel with a connected or newly created repository visible.',
            },
            {
                id: 'step-5-development',
                eyebrow: 'Step 5',
                tocLabel: 'Step 5: Development',
                title: 'Step 5: Development',
                summary: 'Development queues implementation work once the brief, setup, and repo context are stable enough.',
                points: [
                    'Run it after the spec, setup data, and repository are ready for actionable work.',
                    'Track job status inside the module instead of guessing whether the runner is blocked or still working.',
                    'If the runner requests clarification, answer there before changing unrelated steps.',
                ],
                mediaLabel: 'Development runner',
                mediaHint: 'A job timeline or status card is enough.',
            },
            {
                id: 'step-6-integration',
                eyebrow: 'Step 6',
                tocLabel: 'Step 6: Integration',
                title: 'Step 6: Integration',
                summary: 'Integration applies the prepared package into the target repo flow and exposes where the process currently sits.',
                points: [
                    'This step depends on a connected repo and enough setup completeness to know what should be applied.',
                    'Use the timeline to read the current phase: prepare repo, load package, plan, apply, check, send.',
                    'If the process pauses for input, treat it as a checkpoint, not as a silent failure.',
                ],
                mediaLabel: 'Integration timeline',
                mediaHint: 'Capture the phase timeline so users can read the state quickly.',
            },
            {
                id: 'step-8-simulator-screenshots',
                eyebrow: 'Step 8',
                tocLabel: 'Step 8: Simulator shots',
                title: 'Step 8: Simulator screenshots',
                summary: 'This step provides the raw app frames that the marketing screenshot flow builds on.',
                points: [
                    'Upload source screenshots in a clean order so slot mapping stays predictable.',
                    'Focus on source quality and coverage, not marketing polish yet.',
                    'If the source count is incomplete, later screenshot steps should remain blocked.',
                ],
                mediaLabel: 'Simulator uploads',
                mediaHint: 'Show several uploaded simulator screenshots in sequence.',
            },
            {
                id: 'step-9-screenshot-prompts',
                eyebrow: 'Step 9',
                tocLabel: 'Step 9: Prompts',
                title: 'Step 9: Screenshot prompts',
                summary: 'This is where raw frames become marketable screenshot slots with positioning, copy, and style direction.',
                points: [
                    'Each slot should have a clear source frame, style reference, and text direction.',
                    'Prompt quality matters because this step shapes marketing assets, not raw documentation.',
                    'Use the client spec and brand references to avoid generic headline filler.',
                ],
                mediaLabel: 'Prompt mapping',
                mediaHint: 'One slot with its frame, reference, and copy is enough.',
            },
            {
                id: 'step-10-generated-screenshots',
                eyebrow: 'Step 10',
                tocLabel: 'Step 10: Generated shots',
                title: 'Step 10: Generated screenshots',
                summary: 'This is the review and selection stage for final screenshot outputs.',
                points: [
                    'Compare versions, refine overlays, and keep only the outputs that should survive into the final set.',
                    'Mark the step complete only after the required icon and screenshot picks are clear.',
                    'The goal is a clean export package, not a gallery of every experiment.',
                ],
                mediaLabel: 'Screenshot review',
                mediaHint: 'Show a gallery with one picked version highlighted.',
            },
            {
                id: 'no-brand-flow',
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
                mediaLabel: 'Move to brand',
                mediaHint: 'Capture the Step 11 panel with the target-brand selector open.',
            },
            {
                id: 'collaboration-and-guards',
                eyebrow: 'Guards',
                tocLabel: 'Collaboration',
                title: 'Collaboration and guards',
                summary: 'ZefGen blocks edits or page switches when that prevents conflicts or data loss.',
                points: [
                    'A brand can become read-only when another user is already holding the editing lock.',
                    'Use Take over editing to explicitly take write access and move the other session into view-only mode.',
                    'Accounts also has its own unsaved-change guard and will stop page exits until edits are resolved.',
                ],
                mediaLabel: 'Read-only and guard states',
                mediaHint: 'A read-only banner or unsaved-changes warning is enough.',
            },
            {
                id: 'deliverables-export',
                eyebrow: 'Finish',
                tocLabel: 'Deliverables',
                title: 'Deliverables and export',
                summary: 'Deliverables is the handoff end of the workflow after the final picks are clean.',
                points: [
                    'Export only after Step 10 is curated enough for another person to understand the final set immediately.',
                    'ZIP downloads and final asset bundles exist to remove manual collection work at the end.',
                    'Treat deliverables as a release-ready package, not as storage for every intermediate variant.',
                ],
                mediaLabel: 'Deliverables package',
                mediaHint: 'Use the export controls or deliverables rail once you have final assets to show.',
            },
        ],
    },
    ru: {
        heroTitle: 'Центр помощи',
        heroSummary: 'Короткая справка по основному сценарию работы в ZefGen: что делает каждая страница, в каком порядке идти по шагам и как довести приложение до итоговых материалов.',
        tocLabel: 'Разделы страницы',
        mediaPlaceholderLabel: 'Рекомендуемое изображение или GIF',
        sections: [
            {
                id: 'overview',
                eyebrow: 'Обзор',
                tocLabel: 'Обзор',
                title: 'Карта платформы',
                summary: 'ZefGen объединяет контекст бренда, настройку приложения, работу с разработкой и подготовку материалов в одном авторизованном пространстве.',
                points: [
                    'Бренд задает общее позиционирование, контекст релиза и набор референсов.',
                    'У каждого приложения свой путь: настройка, разработка, интеграция, скриншоты и экспорт.',
                    'Accounts, Help и Ideas открываются в той же оболочке, а не как отдельные продукты.',
                ],
                callout: 'Обычно маршрут такой: выбрать или создать бренд, выбрать или создать приложение, заполнить блоки над шагами и дальше идти по шагам 1-10.',
                mediaLabel: 'Схема платформы',
                mediaHint: 'Сюда подойдет компактная схема, показывающая связь между брендом, приложением и вспомогательными страницами.',
            },
            {
                id: 'navigation',
                eyebrow: 'Навигация',
                tocLabel: 'Навигация',
                title: 'Как устроена навигация',
                summary: 'Сайдбар управляет контекстом. Слева выбираются бренд и приложение, а нижняя панель переключает вспомогательные страницы.',
                points: [
                    'При смене бренда или приложения сразу меняется активный рабочий контекст.',
                    'Внизу всегда доступны Accounts, sessions, Help и Ideas, поэтому переключаться можно без выхода из приложения.',
                    'История браузера сохраняется между workspace, accounts, help и ideas, поэтому `/help` и `/help#...` работают как обычные страницы.',
                ],
                mediaLabel: 'Навигация в сайдбаре',
                mediaHint: 'Покажи список брендов, выбранное приложение, нижнюю панель и переключатель языка.',
            },
            {
                id: 'brands-and-apps',
                eyebrow: 'Рабочее пространство',
                tocLabel: 'Бренды и приложения',
                title: 'Бренды и приложения',
                summary: 'Бренд задает общий контекст. Приложение внутри бренда становится отдельной рабочей единицей со своим процессом.',
                points: [
                    'Release info хранит общую информацию о выпуске, которую потом используют шаги приложения.',
                    'Reference library и брендовые референсы влияют на иконку, стиль скриншотов и качество промптов.',
                    'No Brand нужен только для сырых концептов, когда общий контекст бренда еще не сформировался.',
                ],
                callout: 'Если release info или брендовые референсы слабые, это обычно сразу видно на шаге иконки и в блоках со скриншотами.',
                mediaLabel: 'Структура бренда и приложений',
                mediaHint: 'Покажи один бренд с несколькими приложениями и рядом панели Release info и Reference library.',
            },
            {
                id: 'ideas',
                eyebrow: 'Отдельная страница',
                tocLabel: 'Ideas',
                title: 'Страница Ideas',
                summary: 'Ideas — это список концептов, кратких описаний и черновиков client spec до того, как они превращаются в рабочее приложение.',
                points: [
                    'Здесь удобно сравнивать направления, хранить сгенерированные варианты и ручные идеи в одном месте.',
                    'На шаге 2 можно подтянуть готовую идею в текущее приложение вместо того, чтобы писать spec с нуля.',
                    'Идеи могут жить внутри бренда или оставаться в No Brand, пока концепт еще не закрепился.',
                ],
                mediaLabel: 'Работа с Ideas',
                mediaHint: 'Подойдет таблица идей, где видны хотя бы один сгенерированный и один ручной вариант.',
            },
            {
                id: 'accounts',
                eyebrow: 'Отдельная страница',
                tocLabel: 'Accounts',
                title: 'Страница Accounts',
                summary: 'Accounts хранит данные издательских аккаунтов и позволяет заранее привязать их к приложению, если это нужно для настройки.',
                points: [
                    'Аккаунты можно держать свободными до тех пор, пока приложению не понадобится конкретный издательский контекст.',
                    'Данные выбранного аккаунта должны подставляться в company name и другие издательские поля в setup data.',
                    'Несохранённые правки блокируют выход со страницы, поэтому перед переключением нужно сохранить или отменить изменения.',
                ],
                mediaLabel: 'Назначение аккаунта',
                mediaHint: 'Здесь достаточно таблицы с одним назначенным и одним свободным аккаунтом.',
            },
            {
                id: 'selected-app-setup',
                eyebrow: 'Панели перед шагами',
                tocLabel: 'Настройка приложения',
                title: 'Настройка выбранного приложения перед шагом 1',
                summary: 'Когда выбрано приложение, над нумерованными шагами появляются два отдельных блока: ссылка на App Store и webhook для App Review.',
                points: [
                    'В строке App Store link сохраняется канонический адрес страницы приложения в магазине.',
                    'В webhook-блоке сохраняются данные App Store Connect, выбирается нужное приложение и включается получение статусов App Review.',
                    'Последовательность такая: создать receiver, добавить Apple key, загрузить список Apple apps, синхронизировать webhook и отправить тест.',
                ],
                callout: 'Если пройти Save Apple config, Load Apple apps и Sync Apple webhook прямо здесь, вручную настраивать webhook в App Store Connect не придется.',
                mediaLabel: 'App Store link и webhook',
                mediaHint: 'Лучше показать обе панели вместе, чтобы сразу был понятен порядок до перехода к шагам.',
            },
            {
                id: 'step-1-icon',
                eyebrow: 'Шаг 1',
                tocLabel: 'Шаг 1: Иконка',
                title: 'Шаг 1: Направление иконки',
                summary: 'На этом шаге задается визуальная основа для всей дальнейшей работы с графикой.',
                points: [
                    'Для обычных брендов иконка должна опираться на брендовые референсы и промпты.',
                    'В No Brand направление иконки можно строить от client spec, когда сам концепт уже сформулирован.',
                    'Не нужно доводить все до идеала сразу. Достаточно выбрать сильное направление для следующих шагов.',
                ],
                mediaLabel: 'Генерация иконки',
                mediaHint: 'Покажи модуль иконки с одним выбранным результатом.',
            },
            {
                id: 'step-2-client-spec',
                eyebrow: 'Шаг 2',
                tocLabel: 'Шаг 2: Client spec',
                title: 'Шаг 2: Client spec',
                summary: 'Это главный продуктовый документ. От него зависят setup data, задачи для разработки, промпты для скриншотов и качество итогового пакета.',
                points: [
                    'Спецификацию можно написать вручную или подтянуть из Ideas.',
                    'Здесь нужна конкретика: основной сценарий, целевой пользователь, экраны, монетизация и ограничения.',
                    'Если результат на следующих шагах получается размытым, почти всегда стоит сначала улучшить client spec.',
                ],
                mediaLabel: 'Редактор client spec',
                mediaHint: 'Хорошо подойдет экран, где видны редактор и вход в выбор идеи.',
            },
            {
                id: 'step-3-setup-data',
                eyebrow: 'Шаг 3',
                tocLabel: 'Шаг 3: Setup data',
                title: 'Шаг 3: Setup data',
                summary: 'Здесь приложение перестает быть просто идеей и превращается в проект с рабочими параметрами.',
                points: [
                    'Здесь находятся variables, secrets, bundle details, legal links и данные для App Store.',
                    'Подстановка данных из аккаунта и генерация вспомогательных блоков нормально работают только при заполненной базе.',
                    'Если обязательных значений не хватает, следующие runner и integration actions должны оставаться заблокированными.',
                ],
                mediaLabel: 'Setup data',
                mediaHint: 'Подойдет экран с variables and secrets и видимым блоком legal links.',
            },
            {
                id: 'step-4-dev-files',
                eyebrow: 'Шаг 4',
                tocLabel: 'Шаг 4: Dev files',
                title: 'Шаг 4: Dev files и репозиторий',
                summary: 'На этом шаге приложение привязывается к репозиторию, с которым дальше будет работать система.',
                points: [
                    'Сначала нужно создать или подключить целевой репозиторий, и только потом ждать нормальной работы с кодом.',
                    'Это мост между планированием внутри ZefGen и реальной кодовой базой.',
                    'Если репозиторий не выбран или выбран неясно, development и integration должны оставаться заблокированными.',
                ],
                mediaLabel: 'Настройка репозитория',
                mediaHint: 'Покажи блок репозитория с уже подключенным или только что созданным проектом.',
            },
            {
                id: 'step-5-development',
                eyebrow: 'Шаг 5',
                tocLabel: 'Шаг 5: Development',
                title: 'Шаг 5: Development',
                summary: 'На этом шаге в очередь ставится реальная работа по разработке, когда brief, setup и репозиторий уже готовы.',
                points: [
                    'Имеет смысл запускать его только после того, как spec, setup data и репозиторий собраны достаточно хорошо.',
                    'Статус задач лучше читать прямо в модуле, а не гадать, система еще работает или уже ждёт действие.',
                    'Если runner просит уточнение, лучше отвечать там, а не менять несвязанные шаги.',
                ],
                mediaLabel: 'Development runner',
                mediaHint: 'Здесь достаточно статуса задачи или короткого таймлайна.',
            },
            {
                id: 'step-6-integration',
                eyebrow: 'Шаг 6',
                tocLabel: 'Шаг 6: Integration',
                title: 'Шаг 6: Integration',
                summary: 'Integration применяет подготовленный пакет в целевой репозиторий и показывает, на каком этапе сейчас находится процесс.',
                points: [
                    'Шаг зависит от подключенного репозитория и достаточно полного setup data.',
                    'Таймлайн нужен, чтобы понимать текущую фазу: prepare repo, load package, plan, apply, check, send.',
                    'Если процесс остановился и просит ввод, это нормальная контрольная точка, а не скрытая ошибка.',
                ],
                mediaLabel: 'Таймлайн integration',
                mediaHint: 'Покажи таймлайн этапов, чтобы статус можно было считать с первого взгляда.',
            },
            {
                id: 'step-8-simulator-screenshots',
                eyebrow: 'Шаг 8',
                tocLabel: 'Шаг 8: Simulator shots',
                title: 'Шаг 8: Скриншоты из симулятора',
                summary: 'На этом шаге загружается исходный материал, на котором строится вся дальнейшая работа со скриншотами.',
                points: [
                    'Исходные скриншоты лучше загружать в правильном порядке, чтобы слоты потом не путались.',
                    'Здесь важны качество и полнота исходников, а не финальный маркетинговый вид.',
                    'Если исходных кадров не хватает, следующие шаги со скриншотами должны оставаться заблокированными.',
                ],
                mediaLabel: 'Загрузка симулятора',
                mediaHint: 'Покажи несколько уже загруженных кадров по порядку.',
            },
            {
                id: 'step-9-screenshot-prompts',
                eyebrow: 'Шаг 9',
                tocLabel: 'Шаг 9: Prompts',
                title: 'Шаг 9: Промпты для скриншотов',
                summary: 'Здесь исходные кадры превращаются в маркетинговые слоты со своим сообщением, стилем и текстом.',
                points: [
                    'У каждого слота должен быть понятный исходный кадр, визуальный референс и направление по тексту.',
                    'Качество промптов здесь критично, потому что это уже маркетинговые материалы, а не просто фиксация экранов.',
                    'Лучше опираться на client spec и брендовые референсы, чтобы не получить дежурные и пустые заголовки.',
                ],
                mediaLabel: 'Настройка промптов',
                mediaHint: 'Достаточно одного слота, где видны исходный кадр, референс и текст.',
            },
            {
                id: 'step-10-generated-screenshots',
                eyebrow: 'Шаг 10',
                tocLabel: 'Шаг 10: Generated shots',
                title: 'Шаг 10: Сгенерированные скриншоты',
                summary: 'Здесь просматриваются варианты, вносятся правки и выбираются финальные скриншоты.',
                points: [
                    'Сравнивай версии, правь оверлеи и оставляй только то, что должно войти в финальный набор.',
                    'Завершать шаг стоит только тогда, когда иконка и нужные скриншоты уже выбраны окончательно.',
                    'Цель этого шага — собрать чистый пакет на экспорт, а не хранить все эксперименты подряд.',
                ],
                mediaLabel: 'Отбор скриншотов',
                mediaHint: 'Покажи галерею, где один выбранный вариант явно отмечен.',
            },
            {
                id: 'no-brand-flow',
                eyebrow: 'No Brand',
                tocLabel: 'No Brand / Шаг 11',
                title: 'No Brand и перенос в бренд на шаге 11',
                summary: 'No Brand нужен для ранних концептов. Логика остается той же, но стартовый порядок и финальный перенос здесь отличаются.',
                points: [
                    'В начале порядок меняется: сначала идет client spec, а уже потом иконка, потому что сначала нужно собрать саму идею.',
                    'Шаг 11 — это отдельное действие переноса: выбери целевой бренд и переведи туда приложение, когда позиционирование и референсы уже стабилизировались.',
                    'Если подходящего бренда еще нет, его нужно сначала создать. До этого перенос будет недоступен.',
                ],
                callout: 'Переносить приложение из No Brand стоит тогда, когда ему уже нужен общий контекст бренда: release info, референсы и стабильное позиционирование.',
                mediaLabel: 'Перенос в бренд',
                mediaHint: 'Покажи блок шага 11 с открытым выбором целевого бренда.',
            },
            {
                id: 'collaboration-and-guards',
                eyebrow: 'Ограничения',
                tocLabel: 'Совместная работа',
                title: 'Совместная работа и ограничения',
                summary: 'ZefGen блокирует запись или переход между страницами там, где это защищает от конфликтов и потери данных.',
                points: [
                    'Бренд может перейти в read-only, если другой пользователь уже удерживает editing lock.',
                    'Кнопка «Забрать редактирование» нужна, чтобы явно забрать право на запись и перевести другую сессию в режим только просмотра.',
                    'У Accounts есть защита от несохраненных изменений, поэтому выйти со страницы без сохранения не получится.',
                ],
                mediaLabel: 'Read-only и предупреждения',
                mediaHint: 'Подойдет read-only banner или предупреждение о несохраненных изменениях.',
            },
            {
                id: 'deliverables-export',
                eyebrow: 'Финиш',
                tocLabel: 'Deliverables',
                title: 'Deliverables и экспорт',
                summary: 'Deliverables — это финальная точка процесса, когда выбранные материалы уже готовы к передаче дальше.',
                points: [
                    'Экспорт имеет смысл только после того, как шаг 10 уже собран и итоговый набор не вызывает вопросов.',
                    'ZIP downloads и готовые asset bundles нужны, чтобы не собирать материалы вручную в конце.',
                    'Смотри на deliverables как на финальный пакет, а не как на склад промежуточных версий.',
                ],
                mediaLabel: 'Пакет deliverables',
                mediaHint: 'Сюда можно поставить export controls или блок deliverables, когда будет готов финальный набор.',
            },
        ],
    },
};

export const getHelpCenterCopy = (lang: Language) => CONTENT_BY_LANG[lang] || CONTENT_BY_LANG.en;
