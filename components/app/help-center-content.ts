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
                id: 'step-7-auto-release',
                eyebrow: 'Step 7',
                tocLabel: 'Step 7: Auto release',
                title: 'Step 7: Auto release',
                summary: 'Auto release is the release-facing stage after integration, not an early planning step.',
                points: [
                    'Use it only after setup, development, and integration are coherent.',
                    'Treat it as the launch-operations side of the flow, not as a substitute for earlier setup.',
                    'If release automation is still evolving, the slot still communicates the intended sequence.',
                ],
                mediaLabel: 'Auto release',
                mediaHint: 'A stateful release panel or future GIF is enough.',
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
                    'Use Start editing to claim write access explicitly instead of overwriting someone else.',
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
        heroSummary: 'Краткий операторский справочник по основному флоу ZefGen: роли страниц, порядок setup и путь от идеи до deliverables.',
        tocLabel: 'Навигация по странице',
        mediaPlaceholderLabel: 'Рекомендуемое изображение или GIF',
        sections: [
            {
                id: 'overview',
                eyebrow: 'Обзор',
                tocLabel: 'Обзор',
                title: 'Карта платформы',
                summary: 'ZefGen держит brand-контекст, app setup, dev-операции и производство ассетов внутри одного авторизованного workspace.',
                points: [
                    'Бренды хранят общее рыночное направление, release-контекст и референсы.',
                    'Каждое приложение идёт по своему setup, dev, integration, screenshot и export-флоу.',
                    'Accounts, Help и Ideas остаются боковыми страницами в том же shell-е, а не отдельными продуктами.',
                ],
                callout: 'Базовый маршрут такой: выбрать или создать бренд, выбрать или создать приложение, закрыть selected-app setup и потом идти по Steps 1-10.',
                mediaLabel: 'Схема платформы',
                mediaHint: 'Подойдёт компактная схема связи между brand-контекстом, app workflow и боковыми страницами.',
            },
            {
                id: 'navigation',
                eyebrow: 'Навигация',
                tocLabel: 'Навигация',
                title: 'Как устроена навигация',
                summary: 'Sidebar управляет контекстом. Слева выбираются бренд и приложение, а footer переключает не-workspace страницы.',
                points: [
                    'Смена выбранного бренда или приложения сразу меняет активный workspace-контекст.',
                    'В footer всегда доступны Accounts, sessions, Help и Ideas без выхода из авторизованного shell-а.',
                    'История браузера сохраняется между workspace, accounts, help и ideas, поэтому `/help` и `/help#...` ведут себя как обычные страницы.',
                ],
                mediaLabel: 'Sidebar reference',
                mediaHint: 'Подсвети список брендов, выбранное приложение, footer-nav и переключатель языка.',
            },
            {
                id: 'brands-and-apps',
                eyebrow: 'Workspace',
                tocLabel: 'Бренды и приложения',
                title: 'Бренды и приложения',
                summary: 'Бренд — это общий операционный слой. Приложение — рабочая единица внутри этого слоя.',
                points: [
                    'Release info хранит brand-level launch-контекст, который дальше наследует app workflow.',
                    'Reference library и brand references питают направление иконки, стиль скриншотов и качество prompts.',
                    'No Brand нужен только тогда, когда концепт ещё слишком сырой для стабильного общего контекста.',
                ],
                callout: 'Если release info или brand references слабые, первыми обычно проседают Step 1 и screenshot steps.',
                mediaLabel: 'Структура бренда и приложений',
                mediaHint: 'Покажи бренд с несколькими apps и рядом brand-level release/reference панели.',
            },
            {
                id: 'ideas',
                eyebrow: 'Боковая страница',
                tocLabel: 'Ideas',
                title: 'Страница Ideas',
                summary: 'Ideas — это backlog для концептов, summaries и reusable client spec-ов до того, как они становятся активной app-работой.',
                points: [
                    'Используй страницу для сравнения направлений, хранения generated concepts и ручных идей в одном месте.',
                    'На Step 2 можно подтянуть существующую идею в активное приложение вместо переписывания spec.',
                    'Идеи могут жить внутри бренда или оставаться в No Brand, пока концепт ещё исследовательский.',
                ],
                mediaLabel: 'Флоу Ideas',
                mediaHint: 'Подойдёт таблица ideas, где видны хотя бы одна generated и одна manual идея.',
            },
            {
                id: 'accounts',
                eyebrow: 'Боковая страница',
                tocLabel: 'Accounts',
                title: 'Страница Accounts',
                summary: 'Accounts хранит publishing identity и позволяет привязать её к приложению до того, как setup data начнёт на неё опираться.',
                points: [
                    'Держи аккаунты не назначенными, пока приложению не нужна конкретная publishing identity, или привязывай их заранее, если target app уже известен.',
                    'Данные назначенного аккаунта должны протекать в company-name и publishing-поля setup-а.',
                    'Несохранённые правки блокируют выход со страницы, поэтому перед переключением нужно сохранить или отменить изменения.',
                ],
                mediaLabel: 'Назначение аккаунта',
                mediaHint: 'Достаточно табличного вида с одним назначенным и одним свободным аккаунтом.',
            },
            {
                id: 'selected-app-setup',
                eyebrow: 'Панели перед шагами',
                tocLabel: 'Selected app setup',
                title: 'Selected app setup до Step 1',
                summary: 'Когда приложение выбрано, над нумерованными шагами появляются две app-level панели: canonical App Store link и App Review webhook.',
                points: [
                    'Строка App Store link хранит live или canonical store URL, привязанный к выбранному приложению.',
                    'Webhook-панель хранит per-app App Store Connect credentials, привязывает ASC app и принимает сюда App Review state changes.',
                    'Порядок webhook setup фиксированный: create receiver, add Apple key, load Apple apps, sync webhook, send test.',
                ],
                callout: 'Если пройти Save Apple config, Load Apple apps и Sync Apple webhook здесь, вручную создавать webhook в App Store Connect не нужно.',
                mediaLabel: 'App Store link и webhook',
                mediaHint: 'Лучше показать обе панели вместе, чтобы порядок был виден ещё до Step 1.',
            },
            {
                id: 'step-1-icon',
                eyebrow: 'Step 1',
                tocLabel: 'Step 1: Иконка',
                title: 'Step 1: Направление иконки',
                summary: 'Step 1 задаёт визуальную опору для остального asset-флоу.',
                points: [
                    'Для обычных брендов направление иконки должно опираться на brand references и prompts.',
                    'В No Brand prompt иконки можно строить от client spec после того, как сам концепт уже описан.',
                    'Не пытайся отполировать всё сразу. Достаточно выбрать направление, которое поддержит следующие screenshot-шаги.',
                ],
                mediaLabel: 'Генерация иконки',
                mediaHint: 'Покажи icon module с одним выбранным результатом.',
            },
            {
                id: 'step-2-client-spec',
                eyebrow: 'Step 2',
                tocLabel: 'Step 2: Client spec',
                title: 'Step 2: Client spec',
                summary: 'Это основной продуктовый brief. Он кормит setup data, dev tasks, screenshot prompts и качество экспорта.',
                points: [
                    'Спецификацию можно написать вручную или подтянуть из Ideas.',
                    'Нужна конкретика по flows, target user, screens, monetization и ограничениям.',
                    'Если downstream-результат расплывчатый, почти всегда стоит сначала ужесточить client spec.',
                ],
                mediaLabel: 'Редактор client spec',
                mediaHint: 'Хорошо сработает кадр, где видны editor и вход в idea picker.',
            },
            {
                id: 'step-3-setup-data',
                eyebrow: 'Step 3',
                tocLabel: 'Step 3: Setup data',
                title: 'Step 3: Setup data',
                summary: 'Setup data переводит приложение из стадии концепта в исполнимый проект с нужными операционными значениями.',
                points: [
                    'Здесь живут variables, secrets, bundle details, legal links и store-facing metadata.',
                    'Account-linked значения и generated helpers работают нормально только при заполненной базе.',
                    'Если обязательных setup-значений не хватает, следующие runner и integration actions должны оставаться заблокированными.',
                ],
                mediaLabel: 'Setup data',
                mediaHint: 'Подойдёт скрин variables-and-secrets с видимым блоком legal links.',
            },
            {
                id: 'step-4-dev-files',
                eyebrow: 'Step 4',
                tocLabel: 'Step 4: Dev files',
                title: 'Step 4: Dev files и репозиторий',
                summary: 'Этот шаг подключает приложение к репозиторию, из которого следующие задачи будут читать и в который будут писать.',
                points: [
                    'Создай или подключи target repo до того, как ждать чистых code-producing задач.',
                    'Это мост между product planning внутри ZefGen и implementation assets вне него.',
                    'Если repo не определён однозначно, development и integration должны оставаться заблокированными.',
                ],
                mediaLabel: 'Настройка репозитория',
                mediaHint: 'Покажи repo panel с подключённым или только что созданным репозиторием.',
            },
            {
                id: 'step-5-development',
                eyebrow: 'Step 5',
                tocLabel: 'Step 5: Development',
                title: 'Step 5: Development',
                summary: 'Development ставит implementation-работу в очередь, когда brief, setup и repo-контекст уже достаточно стабильны.',
                points: [
                    'Запускай шаг после того, как spec, setup data и repository готовы к осмысленной работе.',
                    'Смотри статус jobs внутри модуля, а не гадай, runner ещё работает или уже упёрся в блокер.',
                    'Если runner просит уточнение, отвечай там до изменений в несвязанных шагах.',
                ],
                mediaLabel: 'Development runner',
                mediaHint: 'Достаточно job timeline или статусной карточки.',
            },
            {
                id: 'step-6-integration',
                eyebrow: 'Step 6',
                tocLabel: 'Step 6: Integration',
                title: 'Step 6: Integration',
                summary: 'Integration применяет подготовленный пакет в target repo flow и показывает, на какой стадии находится процесс.',
                points: [
                    'Шаг зависит от подключённого repo и достаточной полноты setup data.',
                    'Таймлайн нужен, чтобы читать текущую фазу: prepare repo, load package, plan, apply, check, send.',
                    'Если процесс встал и просит ввод, это checkpoint, а не скрытая ошибка.',
                ],
                mediaLabel: 'Таймлайн integration',
                mediaHint: 'Покажи phases timeline, чтобы статус читался быстро.',
            },
            {
                id: 'step-7-auto-release',
                eyebrow: 'Step 7',
                tocLabel: 'Step 7: Auto release',
                title: 'Step 7: Auto release',
                summary: 'Auto release — это release-facing стадия после integration, а не ранний planning step.',
                points: [
                    'Используй шаг только после того, как setup, development и integration уже собраны.',
                    'Смотри на него как на часть launch-operations, а не как на замену предыдущему setup.',
                    'Даже если release automation ещё развивается, сам слот задаёт правильную последовательность.',
                ],
                mediaLabel: 'Auto release',
                mediaHint: 'Достаточно stateful release panel или будущего GIF.',
            },
            {
                id: 'step-8-simulator-screenshots',
                eyebrow: 'Step 8',
                tocLabel: 'Step 8: Simulator shots',
                title: 'Step 8: Скриншоты симулятора',
                summary: 'Этот шаг даёт сырые app frames, на которых строится весь маркетинговый screenshot-flow.',
                points: [
                    'Загружай source screenshots в чистом порядке, чтобы slot mapping оставался предсказуемым.',
                    'Фокус здесь на качестве и полноте источника, а не на маркетинговом polish.',
                    'Если исходников не хватает, следующие screenshot steps должны оставаться заблокированными.',
                ],
                mediaLabel: 'Загрузка симулятора',
                mediaHint: 'Покажи несколько уже загруженных simulator screenshots по порядку.',
            },
            {
                id: 'step-9-screenshot-prompts',
                eyebrow: 'Step 9',
                tocLabel: 'Step 9: Prompts',
                title: 'Step 9: Screenshot prompts',
                summary: 'Здесь сырые фреймы превращаются в маркетинговые screenshot slots с позицией, copy и style direction.',
                points: [
                    'У каждого слота должны быть понятные source frame, style reference и text direction.',
                    'Качество prompts критично, потому что это уже маркетинговые ассеты, а не просто документация экранов.',
                    'Опирайся на client spec и brand references, чтобы не получить generic headline filler.',
                ],
                mediaLabel: 'Prompt mapping',
                mediaHint: 'Достаточно одного слота, где видны frame, reference и copy.',
            },
            {
                id: 'step-10-generated-screenshots',
                eyebrow: 'Step 10',
                tocLabel: 'Step 10: Generated shots',
                title: 'Step 10: Сгенерированные скриншоты',
                summary: 'Это этап просмотра и отбора финальных screenshot outputs.',
                points: [
                    'Сравнивай версии, правь overlays и оставляй только то, что должно попасть в финальный набор.',
                    'Завершай шаг только тогда, когда выбор иконки и нужных скриншотов уже однозначен.',
                    'Цель шага — чистый export package, а не галерея всех экспериментов.',
                ],
                mediaLabel: 'Отбор скриншотов',
                mediaHint: 'Покажи галерею, где один picked вариант явно выделен.',
            },
            {
                id: 'no-brand-flow',
                eyebrow: 'No Brand',
                tocLabel: 'No Brand / Step 11',
                title: 'No Brand flow и Step 11 move to brand',
                summary: 'No Brand нужен для ранних концептов. Флоу работает, но стартовый порядок и финальный handoff здесь другие.',
                points: [
                    'В начале порядок меняется: client spec идёт раньше иконки, потому что сначала обычно нужно собрать сам концепт.',
                    'Step 11 — это отдельное действие переноса: выбери target brand и переведи приложение туда, когда positioning, references и launch intent стабилизировались.',
                    'Если target brand ещё нет, сначала создай обычный бренд. До этого move panel остаётся заблокированной.',
                ],
                callout: 'Выводить приложение из No Brand стоит тогда, когда ему уже нужны shared release info и brand references, а не просто более красивый copy.',
                mediaLabel: 'Move to brand',
                mediaHint: 'Покажи Step 11 panel с открытым target-brand selector.',
            },
            {
                id: 'collaboration-and-guards',
                eyebrow: 'Guards',
                tocLabel: 'Collaboration',
                title: 'Совместная работа и guards',
                summary: 'ZefGen блокирует запись или смену страниц там, где это предотвращает конфликт или потерю данных.',
                points: [
                    'Бренд может стать read-only, если другой пользователь уже держит editing lock.',
                    'Start editing нужен для явного захвата write-доступа вместо тихого перетирания чужой работы.',
                    'У Accounts есть свой unsaved-change guard, который остановит выход со страницы до разрешения правок.',
                ],
                mediaLabel: 'Read-only и guard states',
                mediaHint: 'Подойдёт read-only banner или предупреждение о несохранённых изменениях.',
            },
            {
                id: 'deliverables-export',
                eyebrow: 'Финиш',
                tocLabel: 'Deliverables',
                title: 'Deliverables и export',
                summary: 'Deliverables — это handoff-конец процесса после того, как финальные выборы очищены от шума.',
                points: [
                    'Экспортируй только после того, как Step 10 уже достаточно собран, чтобы другой человек сразу понял финальный набор.',
                    'ZIP downloads и финальные asset bundles существуют, чтобы убрать ручной сбор материалов в конце.',
                    'Смотри на deliverables как на release-ready package, а не как на склад промежуточных вариантов.',
                ],
                mediaLabel: 'Пакет deliverables',
                mediaHint: 'Поставь сюда export controls или deliverables rail, когда появится финальный набор.',
            },
        ],
    },
};

export const getHelpCenterCopy = (lang: Language) => CONTENT_BY_LANG[lang] || CONTENT_BY_LANG.en;
