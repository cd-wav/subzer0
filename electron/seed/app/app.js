// subzer0 — the app. Everything here is yours to rewrite.
//
// The only fixed contract is `window.conv` (see electron/preload.js):
//   send(text), stop(), newChat(), reset(), exportApp(),
//   settings.get(), settings.set(patch),
//   models.list(), models.select(model),
//   sessions.list(), sessions.open(id),
//   updates.check(), updates.apply(),
//   onUpdate(cb), onError(cb), onSettings(cb), onSessions(cb),
//   onUpdateProgress(cb), onSandboxChange(cb)

const el = {
  log: document.getElementById('log'),
  composer: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  meter: document.getElementById('meter'),
  meterFill: document.getElementById('meterFill'),
  meterLeft: document.getElementById('meterLeft'),
  meterLocked: document.getElementById('meterLocked'),
  spend: document.getElementById('spend'),
  tokensLabel: document.getElementById('tokensLabel'),
  sessionTitle: document.getElementById('sessionTitle'),
  newChat: document.getElementById('newChat'),
  sessions: document.getElementById('sessions'),
  clearAll: document.getElementById('clearAll'),
  modelChip: document.getElementById('modelChip'),
  modelChipName: document.getElementById('modelChipName'),
  modelChipPlan: document.getElementById('modelChipPlan'),
  modelDot: document.getElementById('modelDot'),
  gear: document.getElementById('gear'),
  sheet: document.getElementById('settings'),
  close: document.getElementById('close'),
  models: document.getElementById('models'),
  modelSearch: document.getElementById('modelSearch'),
  modelNote: document.getElementById('modelNote'),
  variants: document.getElementById('variants'),
  reasoningNote: document.getElementById('reasoningNote'),
  personalities: document.getElementById('personalities'),
  personalityNote: document.getElementById('personalityNote'),
  themes: document.getElementById('themes'),
  accents: document.getElementById('accents'),
  densities: document.getElementById('densities'),
  fontSizes: document.getElementById('fontSizes'),
  showTokens: document.getElementById('showTokens'),
  budget: document.getElementById('budget'),
  shell: document.querySelector('.shell'),
  notesToggle: document.getElementById('notesToggle'),
  noteForm: document.getElementById('noteForm'),
  noteInput: document.getElementById('noteInput'),
  notesList: document.getElementById('notesList'),
  notesCount: document.getElementById('notesCount'),
  cmdMenu: document.getElementById('cmdMenu'),
  custom: document.getElementById('custom'),
  updateBtn: document.getElementById('updateBtn'),
  language: document.getElementById('language'),
  sessionSearch: document.getElementById('sessionSearch'),
  palette: document.getElementById('palette'),
  paletteInput: document.getElementById('paletteInput'),
  paletteList: document.getElementById('paletteList'),
}

const THEMES = [
  { id: 'dark', nameKey: 'dark', bg: '#000000', line: '#232323', accent: '#c9c9c9' },
  { id: 'light', nameKey: 'light', bg: '#fafafa', line: '#e4e4e4', accent: '#1a1a1a' },
  { id: 'system', nameKey: 'systemTheme', bg: '#6b6b6b', line: '#9a9a9a', accent: '#6d77ff' },
]

const ACCENTS = [
  { id: 'indigo', color: '#6d77ff', light: '#4b55e6' },
  { id: 'emerald', color: '#2fbf8f', light: '#128a63' },
  { id: 'amber', color: '#555555', light: '#2e2e2e' },
  { id: 'rose', color: '#e05a72', light: '#c23a55' },
  { id: 'violet', color: '#a06bff', light: '#7c46d8' },
  { id: 'slate', color: '#6b7280', light: '#3f4651' },
]

const DENSITIES = [
  { id: 'comfortable', nameKey: 'cozy' },
  { id: 'compact', nameKey: 'compactName' },
]

const FONT_SIZES = [
  { id: 'small', name: 's' },
  { id: 'medium', name: 'm' },
  { id: 'large', name: 'l' },
]

const PERSONAS = [
  { id: 'casual', name: 'casual', noteKey: 'personaCasual', prompt: 'be casual, warm, and friendly. use plain, relaxed language with occasional light humor.' },
  { id: 'serious', name: 'serious', noteKey: 'personaSerious', prompt: 'be serious, formal, and precise. no jokes, no slang, no emoji.' },
  { id: 'funny', name: 'funny', noteKey: 'personaFunny', prompt: 'be witty and playful. crack jokes and keep the tone light and entertaining.' },
  { id: 'concise', name: 'concise', noteKey: 'personaConcise', prompt: 'be brief and direct. short answers, no filler or preamble.' },
  { id: 'balanced', name: 'balanced', noteKey: 'personaOff', prompt: '' },
]

const PERSONALITY_KEY = 'subzer0.personality'
const ACCENT_KEY = 'subzer0.accent-violet'
const COMPACT_KEY = 'subzer0.compact'
const CUSTOM_KEY = 'subzer0.custom'
const CLEARED_KEY = 'subzer0.cleared'
const COMMANDS = ['persona', 'effort', 'model', 'version', 'compact', 'clear']

/* --------------------------------------------------------------- languages */

const LANGUAGES = [
  { id: 'en', name: 'english' },
  { id: 'ru', name: 'русский' },
  { id: 'de', name: 'deutsch' },
  { id: 'es', name: 'español' },
  { id: 'fr', name: 'français' },
  { id: 'pt', name: 'português' },
  { id: 'it', name: 'italiano' },
  { id: 'nl', name: 'nederlands' },
  { id: 'pl', name: 'polski' },
  { id: 'tr', name: 'türkçe' },
  { id: 'uk', name: 'українська' },
  { id: 'zh', name: '中文' },
]

const MESSAGES = {
  newChat: {
    en: 'new chat',
    ru: 'новый чат',
    de: 'neuer chat',
    es: 'nuevo chat',
    fr: 'nouvelle discussion',
    pt: 'nova conversa',
    it: 'nuova chat',
    nl: 'nieuwe chat',
    pl: 'nowy czat',
    tr: 'yeni sohbet',
    uk: 'новий чат',
    zh: '新对话',
  },
  recent: {
    en: 'recent',
    ru: 'недавние',
    de: 'zuletzt',
    es: 'recientes',
    fr: 'récents',
    pt: 'recentes',
    it: 'recenti',
    nl: 'recent',
    pl: 'ostatnie',
    tr: 'son',
    uk: 'нещодавні',
    zh: '最近',
  },
  clearAll: {
    en: 'clear all',
    ru: 'очистить всё',
    de: 'alle löschen',
    es: 'borrar todo',
    fr: 'tout effacer',
    pt: 'limpar tudo',
    it: 'cancella tutto',
    nl: 'alles wissen',
    pl: 'wyczyść wszystko',
    tr: 'tümünü temizle',
    uk: 'очистити все',
    zh: '全部清除',
  },
  confirmClear: {
    en: 'sure? tap again',
    ru: 'точно? нажми ещё',
    de: 'sicher? nochmal tippen',
    es: '¿seguro? pulsa otra vez',
    fr: 'sûr ? appuie encore',
    pt: 'certeza? toque de novo',
    it: 'sicuro? tocca ancora',
    nl: 'zeker? nog eens tikken',
    pl: 'pewien? kliknij ponownie',
    tr: 'emin misin? tekrar bas',
    uk: 'точно? натисни ще раз',
    zh: '确定？再点一次',
  },
  noChats: {
    en: 'no conversations yet',
    ru: 'пока нет разговоров',
    de: 'noch keine unterhaltungen',
    es: 'aún no hay conversaciones',
    fr: 'aucune discussion',
    pt: 'nenhuma conversa ainda',
    it: 'nessuna conversazione',
    nl: 'nog geen gesprekken',
    pl: 'brak rozmów',
    tr: 'henüz sohbet yok',
    uk: 'розмов ще немає',
    zh: '还没有对话',
  },
  settingsTitle: {
    en: 'settings',
    ru: 'настройки',
    de: 'einstellungen',
    es: 'ajustes',
    fr: 'réglages',
    pt: 'ajustes',
    it: 'impostazioni',
    nl: 'instellingen',
    pl: 'ustawienia',
    tr: 'ayarlar',
    uk: 'налаштування',
    zh: '设置',
  },
  modelTitle: {
    en: 'model',
    ru: 'модель',
    de: 'modell',
    es: 'modelo',
    fr: 'modèle',
    pt: 'modelo',
    it: 'modello',
    nl: 'model',
    pl: 'model',
    tr: 'model',
    uk: 'модель',
    zh: '模型',
  },
  personalityTitle: {
    en: 'personality',
    ru: 'характер',
    de: 'persönlichkeit',
    es: 'personalidad',
    fr: 'personnalité',
    pt: 'personalidade',
    it: 'personalità',
    nl: 'persoonlijkheid',
    pl: 'osobowość',
    tr: 'kişilik',
    uk: 'характер',
    zh: '风格',
  },
  reasoningTitle: {
    en: 'reasoning',
    ru: 'размышления',
    de: 'denkaufwand',
    es: 'razonamiento',
    fr: 'raisonnement',
    pt: 'raciocínio',
    it: 'ragionamento',
    nl: 'redeneren',
    pl: 'rozumowanie',
    tr: 'düşünme',
    uk: 'роздуми',
    zh: '推理',
  },
  appearanceTitle: {
    en: 'appearance',
    ru: 'вид',
    de: 'aussehen',
    es: 'apariencia',
    fr: 'apparence',
    pt: 'aparência',
    it: 'aspetto',
    nl: 'weergave',
    pl: 'wygląd',
    tr: 'görünüm',
    uk: 'вигляд',
    zh: '外观',
  },
  accent: {
    en: 'accent',
    ru: 'акцент',
    de: 'akzent',
    es: 'acento',
    fr: 'accent',
    pt: 'destaque',
    it: 'accento',
    nl: 'accent',
    pl: 'akcent',
    tr: 'vurgu',
    uk: 'акцент',
    zh: '强调色',
  },
  density: {
    en: 'density',
    ru: 'плотность',
    de: 'dichte',
    es: 'densidad',
    fr: 'densité',
    pt: 'densidade',
    it: 'densità',
    nl: 'dichtheid',
    pl: 'gęstość',
    tr: 'yoğunluk',
    uk: 'щільність',
    zh: '密度',
  },
  textSize: {
    en: 'text size',
    ru: 'размер текста',
    de: 'textgröße',
    es: 'tamaño del texto',
    fr: 'taille du texte',
    pt: 'tamanho do texto',
    it: 'dimensione testo',
    nl: 'tekstgrootte',
    pl: 'rozmiar tekstu',
    tr: 'yazı boyutu',
    uk: 'розмір тексту',
    zh: '字号',
  },
  chatTitle: {
    en: 'chat',
    ru: 'чат',
    de: 'chat',
    es: 'chat',
    fr: 'chat',
    pt: 'chat',
    it: 'chat',
    nl: 'chat',
    pl: 'czat',
    tr: 'sohbet',
    uk: 'чат',
    zh: '对话',
  },
  languageTitle: {
    en: 'language',
    ru: 'язык',
    de: 'sprache',
    es: 'idioma',
    fr: 'langue',
    pt: 'idioma',
    it: 'lingua',
    nl: 'taal',
    pl: 'język',
    tr: 'dil',
    uk: 'мова',
    zh: '语言',
  },
  languageNote: {
    en: 'ui language',
    ru: 'язык интерфейса',
    de: 'sprache der oberfläche',
    es: 'idioma de la interfaz',
    fr: "langue de l'interface",
    pt: 'idioma da interface',
    it: "lingua dell'interfaccia",
    nl: 'taal van de app',
    pl: 'język interfejsu',
    tr: 'arayüz dili',
    uk: 'мова інтерфейсу',
    zh: '界面语言',
  },
  tokenCounter: {
    en: 'token counter',
    ru: 'счётчик токенов',
    de: 'token-zähler',
    es: 'contador de tokens',
    fr: 'compteur de tokens',
    pt: 'contador de tokens',
    it: 'contatore token',
    nl: 'tokenteller',
    pl: 'licznik tokenów',
    tr: 'token sayacı',
    uk: 'лічильник токенів',
    zh: 'token 计数',
  },
  tokenBudget: {
    en: 'token budget',
    ru: 'лимит токенов',
    de: 'token-budget',
    es: 'límite de tokens',
    fr: 'budget de tokens',
    pt: 'limite de tokens',
    it: 'budget token',
    nl: 'tokenbudget',
    pl: 'limit tokenów',
    tr: 'token bütçesi',
    uk: 'ліміт токенів',
    zh: 'token 上限',
  },
  customPlaceholder: {
    en: 'custom instructions — always do this…',
    ru: 'свои инструкции — делай всегда…',
    de: 'eigene anweisungen — immer befolgen…',
    es: 'instrucciones propias — hazlo siempre…',
    fr: 'instructions perso — toujours faire…',
    pt: 'instruções próprias — sempre faça…',
    it: 'istruzioni personali — fai sempre…',
    nl: 'eigen instructies — altijd doen…',
    pl: 'własne instrukcje — zawsze rób…',
    tr: 'özel talimatlar — her zaman yap…',
    uk: 'власні інструкції — роби завжди…',
    zh: '自定义指令 — 每次都执行…',
  },
  searchModels: {
    en: 'search models',
    ru: 'поиск моделей',
    de: 'modelle suchen',
    es: 'buscar modelos',
    fr: 'chercher un modèle',
    pt: 'buscar modelos',
    it: 'cerca modelli',
    nl: 'modellen zoeken',
    pl: 'szukaj modeli',
    tr: 'model ara',
    uk: 'пошук моделей',
    zh: '搜索模型',
  },
  loading: {
    en: 'loading…',
    ru: 'загрузка…',
    de: 'lädt…',
    es: 'cargando…',
    fr: 'chargement…',
    pt: 'carregando…',
    it: 'caricamento…',
    nl: 'laden…',
    pl: 'ładowanie…',
    tr: 'yükleniyor…',
    uk: 'завантаження…',
    zh: '加载中…',
  },
  noModels: {
    en: 'no models available.',
    ru: 'моделей нет.',
    de: 'keine modelle verfügbar.',
    es: 'no hay modelos.',
    fr: 'aucun modèle.',
    pt: 'nenhum modelo.',
    it: 'nessun modello.',
    nl: 'geen modellen.',
    pl: 'brak modeli.',
    tr: 'model yok.',
    uk: 'моделей немає.',
    zh: '没有可用模型。',
  },
  noMatch: {
    en: 'no model matches “{q}”.',
    ru: 'нет модели «{q}».',
    de: 'kein modell für „{q}“.',
    es: 'ningún modelo coincide con «{q}».',
    fr: 'aucun modèle pour « {q} ».',
    pt: 'nenhum modelo para «{q}».',
    it: 'nessun modello per «{q}».',
    nl: 'geen model voor ‘{q}’.',
    pl: 'brak modelu „{q}”.',
    tr: '«{q}» ile eşleşen model yok.',
    uk: 'немає моделі «{q}».',
    zh: '没有匹配“{q}”的模型。',
  },
  ofModels: {
    en: '{n} of {total}',
    ru: '{n} из {total}',
    de: '{n} von {total}',
    es: '{n} de {total}',
    fr: '{n} sur {total}',
    pt: '{n} de {total}',
    it: '{n} di {total}',
    nl: '{n} van {total}',
    pl: '{n} z {total}',
    tr: '{total} modelden {n}',
    uk: '{n} з {total}',
    zh: '{n} / {total}',
  },
  dark: {
    en: 'dark',
    ru: 'тёмная',
    de: 'dunkel',
    es: 'oscuro',
    fr: 'sombre',
    pt: 'escuro',
    it: 'scuro',
    nl: 'donker',
    pl: 'ciemny',
    tr: 'koyu',
    uk: 'темна',
    zh: '深色',
  },
  light: {
    en: 'light',
    ru: 'светлая',
    de: 'hell',
    es: 'claro',
    fr: 'clair',
    pt: 'claro',
    it: 'chiaro',
    nl: 'licht',
    pl: 'jasny',
    tr: 'açık',
    uk: 'світла',
    zh: '浅色',
  },
  cozy: {
    en: 'cozy',
    ru: 'уютно',
    de: 'locker',
    es: 'cómodo',
    fr: 'confort',
    pt: 'conforto',
    it: 'comodo',
    nl: 'ruim',
    pl: 'luźno',
    tr: 'rahat',
    uk: 'затишно',
    zh: '宽松',
  },
  compactName: {
    en: 'compact',
    ru: 'плотно',
    de: 'kompakt',
    es: 'compacto',
    fr: 'compact',
    pt: 'compacto',
    it: 'compatto',
    nl: 'compact',
    pl: 'ciasno',
    tr: 'sıkı',
    uk: 'щільно',
    zh: '紧凑',
  },
  auto: {
    en: 'auto',
    ru: 'авто',
    de: 'auto',
    es: 'auto',
    fr: 'auto',
    pt: 'auto',
    it: 'auto',
    nl: 'auto',
    pl: 'auto',
    tr: 'oto',
    uk: 'авто',
    zh: '自动',
  },
  notSupported: {
    en: 'not supported by this model',
    ru: 'модель не поддерживает',
    de: 'von diesem modell nicht unterstützt',
    es: 'no compatible con este modelo',
    fr: 'non pris en charge',
    pt: 'não suportado',
    it: 'non supportato',
    nl: 'niet ondersteund',
    pl: 'nieobsługiwane',
    tr: 'desteklenmiyor',
    uk: 'не підтримується',
    zh: '此模型不支持',
  },
  inputPlaceholder: {
    en: 'tell me what to change…',
    ru: 'скажи, что изменить…',
    de: 'sag, was ich ändern soll…',
    es: 'dime qué cambiar…',
    fr: 'dis-moi quoi changer…',
    pt: 'diga o que mudar…',
    it: 'dimmi cosa cambiare…',
    nl: 'zeg wat ik moet wijzigen…',
    pl: 'powiedz, co zmienić…',
    tr: 'neyi değiştireyim…',
    uk: 'скажи, що змінити…',
    zh: '告诉我要改什么…',
  },
  introTitle: {
    en: 'what are we building?',
    ru: 'что строим?',
    de: 'was bauen wir?',
    es: '¿qué construimos?',
    fr: 'on construit quoi ?',
    pt: 'o que vamos criar?',
    it: 'cosa costruiamo?',
    nl: 'wat bouwen we?',
    pl: 'co budujemy?',
    tr: 'ne inşa ediyoruz?',
    uk: 'що будуємо?',
    zh: '我们要做什么？',
  },
  introLine: {
    en: 'type what you want and {model} will change it right here — layout, colors, whatever.',
    ru: 'напиши, что хочешь, и {model} изменит всё прямо здесь — вёрстку, цвета, что угодно.',
    de: 'sag, was du willst, und {model} ändert es direkt hier — layout, farben, egal.',
    es: 'escribe lo que quieres y {model} lo cambiará aquí mismo — diseño, colores, lo que sea.',
    fr: 'écris ce que tu veux et {model} le change ici — mise en page, couleurs, tout.',
    pt: 'escreva o que quer e {model} muda aqui mesmo — layout, cores, tudo.',
    it: 'scrivi cosa vuoi e {model} lo cambia qui — layout, colori, tutto.',
    nl: 'typ wat je wilt en {model} past het hier aan — layout, kleuren, maakt niet uit.',
    pl: 'napisz, czego chcesz, a {model} zmieni to tutaj — układ, kolory, cokolwiek.',
    tr: 'ne istediğini yaz, {model} burada değiştirsin — düzen, renkler, ne olursa.',
    uk: 'напиши, що хочеш, і {model} змінить усе тут — верстку, кольори, будь-що.',
    zh: '写下你的想法，{model} 会直接在这里改 — 布局、颜色，随便什么。',
  },
  examples: {
    en: 'examples:',
    ru: 'примеры:',
    de: 'beispiele:',
    es: 'ejemplos:',
    fr: 'exemples :',
    pt: 'exemplos:',
    it: 'esempi:',
    nl: 'voorbeelden:',
    pl: 'przykłady:',
    tr: 'örnekler:',
    uk: 'приклади:',
    zh: '示例：',
  },
  hintSidebar: {
    en: 'give it a sidebar',
    ru: 'добавь боковую панель',
    de: 'gib ihm eine seitenleiste',
    es: 'añade una barra lateral',
    fr: 'ajoute une barre latérale',
    pt: 'adicione uma barra lateral',
    it: 'aggiungi una barra laterale',
    nl: 'geef het een zijbalk',
    pl: 'dodaj panel boczny',
    tr: 'kenar çubuğu ekle',
    uk: 'додай бічну панель',
    zh: '加一个侧边栏',
  },
  hintTerminal: {
    en: 'make it feel like a terminal',
    ru: 'сделай как терминал',
    de: 'mach es wie ein terminal',
    es: 'hazlo como una terminal',
    fr: 'rends-le comme un terminal',
    pt: 'deixe como um terminal',
    it: 'fallo sembrare un terminale',
    nl: 'maak het als een terminal',
    pl: 'zrób jak terminal',
    tr: 'terminal gibi yap',
    uk: 'зроби як термінал',
    zh: '让它像终端',
  },
  hintNotes: {
    en: 'add a notes panel',
    ru: 'добавь панель заметок',
    de: 'füge ein notizpanel hinzu',
    es: 'añade un panel de notas',
    fr: 'ajoute un panneau de notes',
    pt: 'adicione um painel de notas',
    it: 'aggiungi un pannello note',
    nl: 'voeg een notitiepaneel toe',
    pl: 'dodaj panel notatek',
    tr: 'not paneli ekle',
    uk: 'додай панель нотаток',
    zh: '加一个笔记面板',
  },
  thoughts: {
    en: 'thoughts',
    ru: 'мысли',
    de: 'gedanken',
    es: 'ideas',
    fr: 'pensées',
    pt: 'ideias',
    it: 'pensieri',
    nl: 'gedachten',
    pl: 'myśli',
    tr: 'düşünceler',
    uk: 'думки',
    zh: '思考',
  },
  showThoughts: {
    en: 'show thoughts',
    ru: 'показать мысли',
    de: 'gedanken zeigen',
    es: 'mostrar ideas',
    fr: 'afficher les pensées',
    pt: 'mostrar ideias',
    it: 'mostra pensieri',
    nl: 'gedachten tonen',
    pl: 'pokaż myśli',
    tr: 'düşünceleri göster',
    uk: 'показати думки',
    zh: '显示思考',
  },
  hideThoughts: {
    en: 'hide thoughts',
    ru: 'скрыть мысли',
    de: 'gedanken verbergen',
    es: 'ocultar ideas',
    fr: 'masquer les pensées',
    pt: 'ocultar ideias',
    it: 'nascondi pensieri',
    nl: 'gedachten verbergen',
    pl: 'ukryj myśli',
    tr: 'düşünceleri gizle',
    uk: 'сховати думки',
    zh: '隐藏思考',
  },
  thinking: {
    en: 'thinking',
    ru: 'думаю',
    de: 'denke',
    es: 'pensando',
    fr: 'réflexion',
    pt: 'pensando',
    it: 'penso',
    nl: 'denken',
    pl: 'myślę',
    tr: 'düşünüyor',
    uk: 'думаю',
    zh: '思考中',
  },
  copy: {
    en: 'copy',
    ru: 'копировать',
    de: 'kopieren',
    es: 'copiar',
    fr: 'copier',
    pt: 'copiar',
    it: 'copia',
    nl: 'kopiëren',
    pl: 'kopiuj',
    tr: 'kopyala',
    uk: 'копіювати',
    zh: '复制',
  },
  copied: {
    en: 'copied',
    ru: 'скопировано',
    de: 'kopiert',
    es: 'copiado',
    fr: 'copié',
    pt: 'copiado',
    it: 'copiato',
    nl: 'gekopieerd',
    pl: 'skopiowano',
    tr: 'kopyalandı',
    uk: 'скопійовано',
    zh: '已复制',
  },
  chooseModel: {
    en: 'choose a model',
    ru: 'выбрать модель',
    de: 'modell wählen',
    es: 'elegir modelo',
    fr: 'choisir un modèle',
    pt: 'escolher modelo',
    it: 'scegli modello',
    nl: 'model kiezen',
    pl: 'wybierz model',
    tr: 'model seç',
    uk: 'вибрати модель',
    zh: '选择模型',
  },
  used: {
    en: 'used',
    ru: 'использовано',
    de: 'verbraucht',
    es: 'usados',
    fr: 'utilisés',
    pt: 'usados',
    it: 'usati',
    nl: 'gebruikt',
    pl: 'użyto',
    tr: 'kullanıldı',
    uk: 'використано',
    zh: '已用',
  },
  left: {
    en: 'left',
    ru: 'осталось',
    de: 'übrig',
    es: 'restantes',
    fr: 'restants',
    pt: 'restantes',
    it: 'rimasti',
    nl: 'over',
    pl: 'zostało',
    tr: 'kaldı',
    uk: 'залишилось',
    zh: '剩余',
  },
  percentOf: {
    en: '{pct}% of {budget}',
    ru: '{pct}% из {budget}',
    de: '{pct}% von {budget}',
    es: '{pct}% de {budget}',
    fr: '{pct}% sur {budget}',
    pt: '{pct}% de {budget}',
    it: '{pct}% di {budget}',
    nl: '{pct}% van {budget}',
    pl: '{pct}% z {budget}',
    tr: '{budget} içinde %{pct}',
    uk: '{pct}% з {budget}',
    zh: '占 {budget} 的 {pct}%',
  },
  offline: {
    en: 'ai offline',
    ru: 'ии офлайн',
    de: 'ki offline',
    es: 'ia sin conexión',
    fr: 'ia hors ligne',
    pt: 'ia offline',
    it: 'ia offline',
    nl: 'ai offline',
    pl: 'ai offline',
    tr: 'yapay zeka çevrimdışı',
    uk: 'іі офлайн',
    zh: 'ai 离线',
  },
  spend: {
    en: 'spent this conversation · {cost}',
    ru: 'потрачено в этом чате · {cost}',
    de: 'in diesem chat ausgegeben · {cost}',
    es: 'gastado en este chat · {cost}',
    fr: 'dépensé ici · {cost}',
    pt: 'gasto nesta conversa · {cost}',
    it: 'speso in questa chat · {cost}',
    nl: 'uitgegeven in dit gesprek · {cost}',
    pl: 'wydano w tej rozmowie · {cost}',
    tr: 'bu sohbette harcanan · {cost}',
    uk: 'витрачено в цьому чаті · {cost}',
    zh: '本对话花费 · {cost}',
  },
  notesTitle: {
    en: 'notes',
    ru: 'заметки',
    de: 'notizen',
    es: 'notas',
    fr: 'notes',
    pt: 'notas',
    it: 'note',
    nl: 'notities',
    pl: 'notatki',
    tr: 'notlar',
    uk: 'нотатки',
    zh: '笔记',
  },
  notePlaceholder: {
    en: 'jot a note…',
    ru: 'запиши заметку…',
    de: 'notiz notieren…',
    es: 'escribe una nota…',
    fr: 'note rapide…',
    pt: 'anote algo…',
    it: 'scrivi una nota…',
    nl: 'notitie maken…',
    pl: 'zapisz notatkę…',
    tr: 'not al…',
    uk: 'запиши нотатку…',
    zh: '记一笔…',
  },
  addNote: {
    en: 'add note',
    ru: 'добавить заметку',
    de: 'notiz hinzufügen',
    es: 'añadir nota',
    fr: 'ajouter une note',
    pt: 'adicionar nota',
    it: 'aggiungi nota',
    nl: 'notitie toevoegen',
    pl: 'dodaj notatkę',
    tr: 'not ekle',
    uk: 'додати нотатку',
    zh: '添加笔记',
  },
  addToComposer: {
    en: 'add to the composer',
    ru: 'в поле ввода',
    de: 'in den eingabebereich',
    es: 'al campo de texto',
    fr: 'vers la saisie',
    pt: 'para o campo',
    it: 'nel campo',
    nl: 'naar het invoerveld',
    pl: 'do pola tekstowego',
    tr: 'giriş alanına',
    uk: 'у поле вводу',
    zh: '放入输入框',
  },
  noNotes: {
    en: 'no notes yet',
    ru: 'пока нет заметок',
    de: 'noch keine notizen',
    es: 'aún no hay notas',
    fr: 'aucune note',
    pt: 'nenhuma nota',
    it: 'nessuna nota',
    nl: 'nog geen notities',
    pl: 'brak notatek',
    tr: 'henüz not yok',
    uk: 'нотаток ще немає',
    zh: '还没有笔记',
  },
  showNotes: {
    en: 'show notes',
    ru: 'показать заметки',
    de: 'notizen zeigen',
    es: 'mostrar notas',
    fr: 'afficher les notes',
    pt: 'mostrar notas',
    it: 'mostra note',
    nl: 'notities tonen',
    pl: 'pokaż notatki',
    tr: 'notları göster',
    uk: 'показати нотатки',
    zh: '显示笔记',
  },
  hideNotes: {
    en: 'hide notes',
    ru: 'скрыть заметки',
    de: 'notizen verbergen',
    es: 'ocultar notas',
    fr: 'masquer les notes',
    pt: 'ocultar notas',
    it: 'nascondi note',
    nl: 'notities verbergen',
    pl: 'ukryj notatki',
    tr: 'notları gizle',
    uk: 'сховати нотатки',
    zh: '隐藏笔记',
  },
  deleteNote: {
    en: 'delete note',
    ru: 'удалить заметку',
    de: 'notiz löschen',
    es: 'borrar nota',
    fr: 'supprimer la note',
    pt: 'apagar nota',
    it: 'elimina nota',
    nl: 'notitie verwijderen',
    pl: 'usuń notatkę',
    tr: 'notu sil',
    uk: 'видалити нотатку',
    zh: '删除笔记',
  },
  deleteChat: {
    en: 'delete conversation',
    ru: 'удалить разговор',
    de: 'unterhaltung löschen',
    es: 'borrar conversación',
    fr: 'supprimer la discussion',
    pt: 'apagar conversa',
    it: 'elimina conversazione',
    nl: 'gesprek verwijderen',
    pl: 'usuń rozmowę',
    tr: 'sohbeti sil',
    uk: 'видалити розмову',
    zh: '删除对话',
  },
  send: {
    en: 'send',
    ru: 'отправить',
    de: 'senden',
    es: 'enviar',
    fr: 'envoyer',
    pt: 'enviar',
    it: 'invia',
    nl: 'versturen',
    pl: 'wyślij',
    tr: 'gönder',
    uk: 'надіслати',
    zh: '发送',
  },
  stop: {
    en: 'stop',
    ru: 'стоп',
    de: 'stopp',
    es: 'detener',
    fr: 'arrêter',
    pt: 'parar',
    it: 'ferma',
    nl: 'stop',
    pl: 'stop',
    tr: 'durdur',
    uk: 'стоп',
    zh: '停止',
  },
  sendHint: {
    en: 'send (enter)',
    ru: 'отправить (enter)',
    de: 'senden (enter)',
    es: 'enviar (enter)',
    fr: 'envoyer (entrée)',
    pt: 'enviar (enter)',
    it: 'invia (invio)',
    nl: 'versturen (enter)',
    pl: 'wyślij (enter)',
    tr: 'gönder (enter)',
    uk: 'надіслати (enter)',
    zh: '发送（回车）',
  },
  updateLabel: {
    en: 'update',
    ru: 'обновить',
    de: 'aktualisieren',
    es: 'actualizar',
    fr: 'mettre à jour',
    pt: 'atualizar',
    it: 'aggiorna',
    nl: 'bijwerken',
    pl: 'zaktualizuj',
    tr: 'güncelle',
    uk: 'оновити',
    zh: '更新',
  },
  updateTo: {
    en: 'update to v{v}',
    ru: 'обновить до v{v}',
    de: 'aktualisieren auf v{v}',
    es: 'actualizar a v{v}',
    fr: 'mettre à jour vers v{v}',
    pt: 'atualizar para v{v}',
    it: 'aggiorna a v{v}',
    nl: 'bijwerken naar v{v}',
    pl: 'zaktualizuj do v{v}',
    tr: 'v{v} sürümüne güncelle',
    uk: 'оновити до v{v}',
    zh: '更新到 v{v}',
  },
  downloading: {
    en: 'downloading…',
    ru: 'загрузка…',
    de: 'lädt herunter…',
    es: 'descargando…',
    fr: 'téléchargement…',
    pt: 'baixando…',
    it: 'download…',
    nl: 'downloaden…',
    pl: 'pobieranie…',
    tr: 'indiriliyor…',
    uk: 'завантаження…',
    zh: '下载中…',
  },
  installing: {
    en: 'installing — the app will restart…',
    ru: 'установка — приложение перезапустится…',
    de: 'installation — app startet neu…',
    es: 'instalando — la app se reiniciará…',
    fr: "installation — l'app redémarre…",
    pt: 'instalando — o app vai reiniciar…',
    it: "installazione — l'app si riavvia…",
    nl: 'installeren — app start opnieuw…',
    pl: 'instalowanie — aplikacja się uruchomi ponownie…',
    tr: 'kuruluyor — uygulama yeniden başlayacak…',
    uk: 'встановлення — застосунок перезапуститься…',
    zh: '安装中 — 应用将重启…',
  },
  updateFailed: {
    en: 'update failed',
    ru: 'обновление не удалось',
    de: 'update fehlgeschlagen',
    es: 'error al actualizar',
    fr: 'échec de la mise à jour',
    pt: 'falha na atualização',
    it: 'aggiornamento non riuscito',
    nl: 'bijwerken mislukt',
    pl: 'aktualizacja nieudana',
    tr: 'güncelleme başarısız',
    uk: 'оновлення не вдалося',
    zh: '更新失败',
  },
  downloadingPct: {
    en: 'downloading {pct}%',
    ru: 'загружено {pct}%',
    de: 'lädt {pct}%',
    es: 'descargando {pct}%',
    fr: 'téléchargement {pct}%',
    pt: 'baixando {pct}%',
    it: 'download {pct}%',
    nl: 'downloaden {pct}%',
    pl: 'pobieranie {pct}%',
    tr: 'indiriliyor %{pct}',
    uk: 'завантаження {pct}%',
    zh: '下载中 {pct}%',
  },
  free: {
    en: 'free',
    ru: 'бесплатно',
    de: 'kostenlos',
    es: 'gratis',
    fr: 'gratuit',
    pt: 'grátis',
    it: 'gratis',
    nl: 'gratis',
    pl: 'darmowe',
    tr: 'ücretsiz',
    uk: 'безкоштовно',
    zh: '免费',
  },
  goName: {
    en: 'opencode go',
    ru: 'opencode go',
    de: 'opencode go',
    es: 'opencode go',
    fr: 'opencode go',
    pt: 'opencode go',
    it: 'opencode go',
    nl: 'opencode go',
    pl: 'opencode go',
    tr: 'opencode go',
    uk: 'opencode go',
    zh: 'opencode go',
  },
  paidName: {
    en: 'pay per token',
    ru: 'за токены',
    de: 'pro token',
    es: 'por token',
    fr: 'au token',
    pt: 'por token',
    it: 'a token',
    nl: 'per token',
    pl: 'za tokeny',
    tr: 'token başına',
    uk: 'за токени',
    zh: '按 token',
  },
  freeHint: {
    en: 'no subscription needed',
    ru: 'подписка не нужна',
    de: 'kein abo nötig',
    es: 'sin suscripción',
    fr: 'sans abonnement',
    pt: 'sem assinatura',
    it: 'senza abbonamento',
    nl: 'geen abonnement',
    pl: 'bez subskrypcji',
    tr: 'abonelik gerekmez',
    uk: 'підписка не потрібна',
    zh: '无需订阅',
  },
  goActive: {
    en: 'active on this account',
    ru: 'активна в аккаунте',
    de: 'im konto aktiv',
    es: 'activa en la cuenta',
    fr: 'active sur le compte',
    pt: 'ativa na conta',
    it: "attiva sull'account",
    nl: 'actief op account',
    pl: 'aktywna na koncie',
    tr: 'hesapta etkin',
    uk: 'активна в акаунті',
    zh: '账户已开通',
  },
  goInactive: {
    en: 'not active on this account',
    ru: 'не активна в аккаунте',
    de: 'im konto nicht aktiv',
    es: 'no activa en la cuenta',
    fr: 'pas active sur le compte',
    pt: 'inativa na conta',
    it: 'non attiva',
    nl: 'niet actief',
    pl: 'nieaktywna',
    tr: 'hesapta etkin değil',
    uk: 'не активна в акаунті',
    zh: '账户未开通',
  },
  goHint: {
    en: 'included in your subscription',
    ru: 'входит в подписку',
    de: 'in der subskription enthalten',
    es: 'incluida en la suscripción',
    fr: "inclus dans l'abonnement",
    pt: 'incluído na assinatura',
    it: "incluso nell'abbonamento",
    nl: 'inbegrepen in abonnement',
    pl: 'w ramach subskrypcji',
    tr: 'aboneliğe dahil',
    uk: 'входить у підписку',
    zh: '订阅内包含',
  },
  paidHint: {
    en: 'billed to your opencode balance',
    ru: 'списывается с баланса opencode',
    de: 'über opencode-guthaben',
    es: 'se cobra del saldo',
    fr: 'débité du solde opencode',
    pt: 'cobrado do saldo',
    it: 'addebitato sul saldo',
    nl: 'van opencode-saldo',
    pl: 'z salda opencode',
    tr: 'opencode bakiyesinden',
    uk: 'списується з балансу',
    zh: '从 opencode 余额扣除',
  },
  metered: {
    en: 'metered',
    ru: 'по счётчику',
    de: 'nach verbrauch',
    es: 'medido',
    fr: 'au compteur',
    pt: 'medido',
    it: 'a consumo',
    nl: 'gemeten',
    pl: 'licznikowo',
    tr: 'ölçülü',
    uk: 'за лічильником',
    zh: '按量计费',
  },
  personaCasual: {
    en: 'relaxed and friendly',
    ru: 'спокойно и дружелюбно',
    de: 'locker und freundlich',
    es: 'relajado y amable',
    fr: 'détendu et amical',
    pt: 'tranquilo e amigável',
    it: 'rilassato e amichevole',
    nl: 'ontspannen en vriendelijk',
    pl: 'swobodnie i życzliwie',
    tr: 'rahat ve samimi',
    uk: 'спокійно та дружньо',
    zh: '轻松友好',
  },
  personaSerious: {
    en: 'formal and precise',
    ru: 'формально и точно',
    de: 'formell und präzise',
    es: 'formal y preciso',
    fr: 'formel et précis',
    pt: 'formal e preciso',
    it: 'formale e preciso',
    nl: 'formeel en precies',
    pl: 'formalnie i precyzyjnie',
    tr: 'resmi ve net',
    uk: 'формально й точно',
    zh: '正式精准',
  },
  personaFunny: {
    en: 'witty and playful',
    ru: 'остроумно и игриво',
    de: 'witzig und verspielt',
    es: 'ingenioso y juguetón',
    fr: 'spirituel et joueur',
    pt: 'espirituoso e brincalhão',
    it: 'arguto e giocoso',
    nl: 'geestig en speels',
    pl: 'dowcipnie i zabawnie',
    tr: 'esprili ve oyuncu',
    uk: 'дотепно й грайливо',
    zh: '机智俏皮',
  },
  personaConcise: {
    en: 'brief and direct',
    ru: 'кратко и прямо',
    de: 'kurz und direkt',
    es: 'breve y directo',
    fr: 'bref et direct',
    pt: 'breve e direto',
    it: 'breve e diretto',
    nl: 'kort en direct',
    pl: 'krótko i wprost',
    tr: 'kısa ve net',
    uk: 'коротко й прямо',
    zh: '简短直接',
  },
  personaOff: {
    en: 'no persona',
    ru: 'без характера',
    de: 'keine persönlichkeit',
    es: 'sin personalidad',
    fr: 'sans personnalité',
    pt: 'sem personalidade',
    it: 'senza personalità',
    nl: 'geen persoonlijkheid',
    pl: 'bez osobowości',
    tr: 'kişilik yok',
    uk: 'без характеру',
    zh: '无风格',
  },
  personaSet: {
    en: 'persona set to {id}',
    ru: 'характер: {id}',
    de: 'persönlichkeit: {id}',
    es: 'personalidad: {id}',
    fr: 'personnalité : {id}',
    pt: 'personalidade: {id}',
    it: 'personalità: {id}',
    nl: 'persoonlijkheid: {id}',
    pl: 'osobowość: {id}',
    tr: 'kişilik: {id}',
    uk: 'характер: {id}',
    zh: '风格：{id}',
  },
  personaUnknown: {
    en: 'unknown persona · try {list}',
    ru: 'нет такого характера · {list}',
    de: 'unbekannt · {list}',
    es: 'personalidad desconocida · {list}',
    fr: 'inconnue · {list}',
    pt: 'desconhecida · {list}',
    it: 'sconosciuta · {list}',
    nl: 'onbekend · {list}',
    pl: 'nieznana · {list}',
    tr: 'bilinmeyen · {list}',
    uk: 'невідомий · {list}',
    zh: '未知风格 · {list}',
  },
  effortSet: {
    en: 'effort set to {id}',
    ru: 'усилие: {id}',
    de: 'aufwand: {id}',
    es: 'esfuerzo: {id}',
    fr: 'effort : {id}',
    pt: 'esforço: {id}',
    it: 'impegno: {id}',
    nl: 'inspanning: {id}',
    pl: 'wysiłek: {id}',
    tr: 'çaba: {id}',
    uk: 'зусилля: {id}',
    zh: '强度：{id}',
  },
  modelSet: {
    en: 'model set to {name}',
    ru: 'модель: {name}',
    de: 'modell: {name}',
    es: 'modelo: {name}',
    fr: 'modèle : {name}',
    pt: 'modelo: {name}',
    it: 'modello: {name}',
    nl: 'model: {name}',
    pl: 'model: {name}',
    tr: 'model: {name}',
    uk: 'модель: {name}',
    zh: '模型：{name}',
  },
  noModelMatch: {
    en: 'no model matches "{q}"',
    ru: 'нет модели «{q}»',
    de: 'kein modell „{q}“',
    es: 'ningún modelo «{q}»',
    fr: 'aucun modèle « {q} »',
    pt: 'nenhum modelo «{q}»',
    it: 'nessun modello «{q}»',
    nl: 'geen model ‘{q}’',
    pl: 'brak modelu „{q}”',
    tr: '«{q}» yok',
    uk: 'немає моделі «{q}»',
    zh: '没有模型“{q}”',
  },
  compactOn: {
    en: 'compact on',
    ru: 'плотно вкл',
    de: 'kompakt an',
    es: 'compacto activado',
    fr: 'compact activé',
    pt: 'compacto ligado',
    it: 'compatto attivo',
    nl: 'compact aan',
    pl: 'ciasno włączone',
    tr: 'sıkı açık',
    uk: 'щільно увімк',
    zh: '紧凑已开',
  },
  compactOff: {
    en: 'compact off',
    ru: 'плотно выкл',
    de: 'kompakt aus',
    es: 'compacto desactivado',
    fr: 'compact désactivé',
    pt: 'compacto desligado',
    it: 'compatto spento',
    nl: 'compact uit',
    pl: 'ciasno wyłączone',
    tr: 'sıkı kapalı',
    uk: 'щільно вимк',
    zh: '紧凑已关',
  },
  chatCleared: {
    en: 'chat cleared · context kept',
    ru: 'чат очищен · контекст сохранён',
    de: 'chat geleert · kontext bleibt',
    es: 'chat borrado · contexto intacto',
    fr: 'chat effacé · contexte gardé',
    pt: 'chat limpo · contexto mantido',
    it: 'chat pulita · contesto intatto',
    nl: 'chat gewist · context blijft',
    pl: 'czat wyczyszczony · kontekst został',
    tr: 'sohbet temizlendi · bağlam korundu',
    uk: 'чат очищено · контекст збережено',
    zh: '对话已清空 · 上下文保留',
  },
  unknownCommand: {
    en: 'unknown command · try ?persona ?effort ?model ?version ?compact ?clear',
    ru: 'неизвестная команда · попробуй ?persona ?effort ?model ?version ?compact ?clear',
    de: 'unbekannter befehl · ?persona ?effort ?model ?version ?compact ?clear',
    es: 'comando desconocido · prueba ?persona ?effort ?model ?version ?compact ?clear',
    fr: 'commande inconnue · essaie ?persona ?effort ?model ?version ?compact ?clear',
    pt: 'comando desconhecido · tente ?persona ?effort ?model ?version ?compact ?clear',
    it: 'comando sconosciuto · prova ?persona ?effort ?model ?version ?compact ?clear',
    nl: 'onbekend commando · probeer ?persona ?effort ?model ?version ?compact ?clear',
    pl: 'nieznana komenda · spróbuj ?persona ?effort ?model ?version ?compact ?clear',
    tr: 'bilinmeyen komut · ?persona ?effort ?model ?version ?compact ?clear',
    uk: 'невідома команда · спробуй ?persona ?effort ?model ?version ?compact ?clear',
    zh: '未知命令 · 试试 ?persona ?effort ?model ?version ?compact ?clear',
  },
  noAi: {
    en: 'this copy has no ai attached.',
    ru: 'в этой копии нет ии.',
    de: 'diese kopie hat keine ki.',
    es: 'esta copia no tiene ia.',
    fr: "cette copie n'a pas d'ia.",
    pt: 'esta cópia não tem ia.',
    it: 'questa copia non ha ia.',
    nl: 'deze kopie heeft geen ai.',
    pl: 'ta kopia nie ma ai.',
    tr: 'bu kopyada yapay zeka yok.',
    uk: 'у цій копії немає іі.',
    zh: '此副本没有接入 ai。',
  },
  nowLabel: {
    en: 'now',
    ru: 'сейчас',
    de: 'jetzt',
    es: 'ahora',
    fr: 'maintenant',
    pt: 'agora',
    it: 'ora',
    nl: 'nu',
    pl: 'teraz',
    tr: 'şimdi',
    uk: 'зараз',
    zh: '刚刚',
  },
  changeModel: {
    en: 'change model',
    ru: 'сменить модель',
    de: 'modell wechseln',
    es: 'cambiar modelo',
    fr: 'changer de modèle',
    pt: 'mudar modelo',
    it: 'cambia modello',
    nl: 'model wijzigen',
    pl: 'zmień model',
    tr: 'modeli değiştir',
    uk: 'змінити модель',
    zh: '切换模型',
  },
  done: {
    en: 'done',
    ru: 'готово',
    de: 'fertig',
    es: 'listo',
    fr: 'terminé',
    pt: 'pronto',
    it: 'fatto',
    nl: 'klaar',
    pl: 'gotowe',
    tr: 'bitti',
    uk: 'готово',
    zh: '完成',
  },
  systemTheme: {
    en: 'system',
    ru: 'системная',
    de: 'system',
    es: 'sistema',
    fr: 'système',
    pt: 'sistema',
    it: 'sistema',
    nl: 'systeem',
    pl: 'system',
    tr: 'sistem',
    uk: 'системна',
    zh: '跟随系统',
  },
  edit: {
    en: 'edit',
    ru: 'изменить',
    de: 'bearbeiten',
    es: 'editar',
    fr: 'modifier',
    pt: 'editar',
    it: 'modifica',
    nl: 'bewerken',
    pl: 'edytuj',
    tr: 'düzenle',
    uk: 'редагувати',
    zh: '编辑',
  },
  regenerate: {
    en: 'regenerate',
    ru: 'перегенерировать',
    de: 'neu erzeugen',
    es: 'regenerar',
    fr: 'régénérer',
    pt: 'regenerar',
    it: 'rigenera',
    nl: 'opnieuw',
    pl: 'generuj ponownie',
    tr: 'yeniden üret',
    uk: 'перегенерувати',
    zh: '重新生成',
  },
  closeLabel: {
    en: 'close',
    ru: 'закрыть',
    de: 'schließen',
    es: 'cerrar',
    fr: 'fermer',
    pt: 'fechar',
    it: 'chiudi',
    nl: 'sluiten',
    pl: 'zamknij',
    tr: 'kapat',
    uk: 'закрити',
    zh: '关闭',
  },
  palettePlaceholder: {
    en: 'type a command…',
    ru: 'введи команду…',
    de: 'befehl eingeben…',
    es: 'escribe un comando…',
    fr: 'tape une commande…',
    pt: 'digite um comando…',
    it: 'digita un comando…',
    nl: 'typ een commando…',
    pl: 'wpisz komendę…',
    tr: 'bir komut yaz…',
    uk: 'введіть команду…',
    zh: '输入命令…',
  },
  focusComposer: {
    en: 'focus composer',
    ru: 'в поле ввода',
    de: 'zum eingabefeld',
    es: 'ir al campo',
    fr: 'aller à la saisie',
    pt: 'ir ao campo',
    it: 'vai al campo',
    nl: 'naar invoerveld',
    pl: 'przejdź do pola',
    tr: 'giriş alanına git',
    uk: 'до поля вводу',
    zh: '聚焦输入框',
  },
  searchSessions: {
    en: 'search',
    ru: 'поиск',
    de: 'suchen',
    es: 'buscar',
    fr: 'chercher',
    pt: 'buscar',
    it: 'cerca',
    nl: 'zoeken',
    pl: 'szukaj',
    tr: 'ara',
    uk: 'пошук',
    zh: '搜索',
  },
  pinChat: {
    en: 'pin conversation',
    ru: 'закрепить',
    de: 'anheften',
    es: 'fijar',
    fr: 'épingler',
    pt: 'fixar',
    it: 'fissa',
    nl: 'vastzetten',
    pl: 'przypnij',
    tr: 'sabitle',
    uk: 'закріпити',
    zh: '置顶',
  },
  unpinChat: {
    en: 'unpin conversation',
    ru: 'открепить',
    de: 'lösen',
    es: 'desfijar',
    fr: 'désépingler',
    pt: 'desafixar',
    it: 'sfissa',
    nl: 'losmaken',
    pl: 'odepnij',
    tr: 'sabitlemeyi kaldır',
    uk: 'відкріпити',
    zh: '取消置顶',
  },
  commands: {
    en: 'commands',
    ru: 'команды',
    de: 'befehle',
    es: 'comandos',
    fr: 'commandes',
    pt: 'comandos',
    it: 'comandi',
    nl: 'commando’s',
    pl: 'komendy',
    tr: 'komutlar',
    uk: 'команди',
    zh: '命令',
  },
  noMatches: {
    en: 'no matches',
    ru: 'нет совпадений',
    de: 'keine treffer',
    es: 'sin resultados',
    fr: 'aucun résultat',
    pt: 'sem resultados',
    it: 'nessun risultato',
    nl: 'geen resultaten',
    pl: 'brak wyników',
    tr: 'eşleşme yok',
    uk: 'немає збігів',
    zh: '无匹配',
  },
}

const LANGUAGE_KEY = 'subzer0.language'

function loadLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    return LANGUAGES.some((lang) => lang.id === stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

function persistLanguage() {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language)
  } catch {
    /* memory-only is fine */
  }
}

let language = loadLanguage()

function t(key, vars) {
  const entry = MESSAGES[key]
  let text = (entry && (entry[language] ?? entry.en)) ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

function renderLanguageOptions() {
  if (!el.language) return
  const frag = document.createDocumentFragment()
  for (const lang of LANGUAGES) {
    const option = document.createElement('option')
    option.value = lang.id
    option.textContent = lang.name
    frag.appendChild(option)
  }
  el.language.replaceChildren(frag)
  el.language.value = language
}

/** Translate the static markup, then re-render everything built in javascript. */
function applyLanguage() {
  document.documentElement.lang = language
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n)
  }
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) {
    node.placeholder = t(node.dataset.i18nPlaceholder)
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle)
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria))
  }
  if (el.language) el.language.value = language
  setSendBusy(busy)
  applyNotesOpen()
  renderNotes()
  applySettings()
  renderSessionTitle()
  renderMessages()
  renderTokens()
  renderUpdate()
}

function storedPersonality() {
  try {
    return window.localStorage.getItem(PERSONALITY_KEY) ?? null
  } catch {
    return null
  }
}

function persistPersonality(id) {
  try {
    window.localStorage.setItem(PERSONALITY_KEY, id)
  } catch {
    /* memory-only is fine */
  }
}

function normalizePersonality() {
  if (!PERSONAS.some((p) => p.id === settings.personality)) {
    settings.personality = storedPersonality() || 'balanced'
  }
}

function withContext(text) {
  const persona = PERSONAS.find((p) => p.id === settings.personality)
  const parts = []
  if (persona && persona.prompt) parts.push(`[persona: ${persona.id}]\n${persona.prompt}`)
  if (customInstructions.trim()) parts.push(`[instructions]\n${customInstructions.trim()}`)
  if (!parts.length) return text
  return `${text}\n\n${parts.join('\n\n')}`
}

function cleanUserText(text) {
  if (!text) return text
  return text.replace(/\r?\n\r?\n\[(persona|instructions)[\s\S]*$/, '')
}

function loadCustom() {
  try {
    return window.localStorage.getItem(CUSTOM_KEY) ?? ''
  } catch {
    return ''
  }
}

function loadCleared() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CLEARED_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveCleared() {
  try {
    window.localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedMessages))
  } catch {
    /* memory-only is fine */
  }
}

/** Hide the transcript through the last cleared message, keeping the real history. */
function visibleMessages() {
  const marker = sessionID ? clearedMessages[sessionID] : null
  if (!marker) return messages
  const index = messages.findIndex((message) => message.id === marker)
  return index === -1 ? messages : messages.slice(index + 1)
}

function persistCustom() {
  try {
    window.localStorage.setItem(CUSTOM_KEY, customInstructions)
  } catch {
    /* memory-only is fine */
  }
}

function loadCompact() {
  try {
    return window.localStorage.getItem(COMPACT_KEY) === '1'
  } catch {
    return false
  }
}

function applyCompact() {
  document.documentElement.dataset.compact = compact ? 'on' : 'off'
}

const HINTS = ['hintSidebar', 'hintTerminal', 'hintNotes']

const DEFAULT_SETTINGS = {
  model: { providerID: 'opencode', id: 'deepseek-v4.1-flash-free', variant: 'default' },
  theme: 'dark',
  accent: 'slate',
  density: 'comfortable',
  fontSize: 'medium',
  showTokens: true,
  budget: 200000,
  personality: 'balanced',
}

let settings = structuredClone(DEFAULT_SETTINGS)
let models = []
let modelsLoaded = false
let modelQuery = ''
/** 'unknown' until a Go model has actually run: there is no plan endpoint. */
let goStatus = 'unknown'
let sessions = []
let sessionID = null
let messages = []
/**
 * Last message id hidden per session by ?clear. The conversation itself is kept
 * so the model still remembers it; only the transcript is trimmed.
 */
let clearedMessages = loadCleared()
let lastTokens = null
let lastCost = 0
let busy = false
let pending = null
/** @type {{ message: string, kind?: string } | null} */
let error = null
/** Message count when the error appeared, so a later reply clears it. */
let errorAt = 0
/** Transient command feedback rendered like a status line. */
let notice = null
/** denser chat spacing, toggled with ?compact. */
let compact = loadCompact()
applyCompact()
/** user-written custom instructions, appended to each message. */
let customInstructions = loadCustom()

/* theme can follow the OS instead of a hard dark/light setting */
const THEME_MODE_KEY = 'subzer0.theme-mode'
function loadThemeMode() {
  try {
    const value = window.localStorage.getItem(THEME_MODE_KEY)
    return value === 'system' || value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}
let themeMode = loadThemeMode()
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function effectiveTheme() {
  if (themeMode === 'system') return darkQuery.matches ? 'dark' : 'light'
  if (themeMode === 'dark' || themeMode === 'light') return themeMode
  return settings.theme
}
/** Latest release from window.conv.updates; drives the Update message. */
let release = null
let updateBusy = false
let updateNote = ''

/* ------------------------------------------------------------------ settings */

function activeAccent() {
  const accent = ACCENTS.find((entry) => entry.id === settings.accent) ?? ACCENTS[0]
  return effectiveTheme() === 'light' ? accent.light : accent.color
}

function applySettings() {
  normalizePersonality()
  const root = document.documentElement
  root.dataset.theme = effectiveTheme()
  root.dataset.density = settings.density
  root.dataset.size = settings.fontSize
  root.style.setProperty('--accent', activeAccent())

  el.meter.hidden = !settings.showTokens && !(lastCost > 0)
  el.meter.classList.toggle('spend-only', !settings.showTokens)
  el.showTokens.checked = Boolean(settings.showTokens)
  el.budget.value = String(settings.budget)
  el.custom.value = customInstructions

  const model = selectedModel()
  el.modelChipName.textContent = model?.name ?? settings.model.id
  el.modelChipPlan.textContent = model
    ? model.plan === 'go'
      ? 'go'
      : model.plan === 'paid'
        ? t('metered')
        : t('free')
    : ''
  el.modelDot.dataset.plan = model?.plan ?? 'free'

  renderModels()
  renderVariants()
  renderPersonality()
  renderThemes()
  renderAccents()
  renderSegments(el.densities, DENSITIES, settings.density, (id) => save({ density: id }))
  renderSegments(el.fontSizes, FONT_SIZES, settings.fontSize, (id) => save({ fontSize: id }))
  renderSessions()
}

async function save(patch) {
  settings = {
    ...settings,
    ...patch,
    model: { ...settings.model, ...(patch.model ?? {}) },
  }
  if ('personality' in patch) persistPersonality(settings.personality)
  applySettings()

  try {
    const next = await window.conv.settings.set(patch)
    if (next) {
      settings = next
      applySettings()
    }
  } catch (cause) {
    error = { message: String(cause?.message ?? cause) }
    renderMessages()
  }
}

function selectedModel() {
  return (
    models.find(
      (model) => model.id === settings.model.id && model.providerID === settings.model.providerID
    ) ?? null
  )
}

/* ------------------------------------------------------------------ sessions */

const HIDDEN_KEY = 'subzer0.hidden-sessions'

function loadHiddenSessions() {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY)
    const list = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

let hiddenSessions = loadHiddenSessions()

function persistHiddenSessions() {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenSessions]))
  } catch {
    /* memory-only is fine */
  }
}

const PINNED_KEY = 'subzer0.pinned-sessions'

function loadPinnedSessions() {
  try {
    const raw = window.localStorage.getItem(PINNED_KEY)
    const list = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

let pinnedSessions = loadPinnedSessions()

function persistPinnedSessions() {
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify([...pinnedSessions]))
  } catch {
    /* memory-only is fine */
  }
}

let sessionQuery = ''

function visibleSessions() {
  const query = sessionQuery.trim().toLowerCase()
  const visible = sessions.filter((session) => !hiddenSessions.has(session.id))
  const filtered = query
    ? visible.filter((session) => (session.title || '').toLowerCase().includes(query))
    : visible
  const pinned = []
  const rest = []
  for (const session of filtered) {
    ;(pinnedSessions.has(session.id) ? pinned : rest).push(session)
  }
  return [...pinned, ...rest]
}

function timeAgo(stamp) {
  if (!stamp) return ''
  const seconds = Math.max(0, Math.round((Date.now() - stamp) / 1000))
  if (seconds < 60) return t('nowLabel')
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

function renderSessionTitle() {
  const current = sessions.find((session) => session.id === sessionID)
  el.sessionTitle.textContent = current?.title || t('newChat')
}

function renderSessions() {
  const visible = visibleSessions()
  el.clearAll.hidden = !visible.length

  if (!visible.length) {
    el.sessions.innerHTML = `<p class="rail-empty">${t('noChats')}</p>`
    return
  }

  const frag = document.createDocumentFragment()
  for (const session of visible) {
    const row = document.createElement('div')
    row.className = 'session-row'
    if (session.id === sessionID) row.setAttribute('aria-current', 'true')
    if (pinnedSessions.has(session.id)) row.dataset.pinned = 'true'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'session'

    const name = document.createElement('span')
    name.className = 'session-name'
    name.textContent = session.title || t('newChat')

    const meta = document.createElement('span')
    meta.className = 'session-meta'
    meta.textContent = timeAgo(session.updated)

    button.append(name, meta)
    button.addEventListener('click', () => {
      void window.conv.sessions.open(session.id)
    })

    const pin = document.createElement('button')
    pin.type = 'button'
    pin.className = 'session-pin'
    const pinned = pinnedSessions.has(session.id)
    pin.title = pinned ? t('unpinChat') : t('pinChat')
    pin.setAttribute('aria-pressed', String(pinned))
    pin.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M9 3 4 8M8 2.5l3.5 3.5M6.5 3l-4 4L1 9.5l3.5 3.5L7 11l4-4M5 5l4 4"/></svg>'
    pin.addEventListener('click', (event) => {
      event.stopPropagation()
      if (pinnedSessions.has(session.id)) pinnedSessions.delete(session.id)
      else pinnedSessions.add(session.id)
      persistPinnedSessions()
      renderSessions()
    })

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'session-del'
    del.title = t('deleteChat')
    del.setAttribute('aria-label', `${t('deleteChat')} · ${session.title || t('newChat')}`)
    del.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="m2.5 2.5 5 5m0-5-5 5"/></svg>'
    del.addEventListener('click', (event) => {
      event.stopPropagation()
      void window.conv.sessions.remove(session.id)
    })

    row.append(button, pin, del)
    frag.appendChild(row)
  }

  el.sessions.replaceChildren(frag)
}

function refreshSessions() {
  window.conv.sessions
    .list()
    .then((list) => {
      sessions = list ?? []
      renderSessions()
    })
    .catch(() => {})
}

/* --------------------------------------------------------------------- notes */

const NOTES_KEY = 'subzer0.notes'
const NOTES_OPEN_KEY = 'subzer0.notes-open'

function readStore(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* memory-only is fine */
  }
}

function loadNotes() {
  try {
    const list = JSON.parse(readStore(NOTES_KEY) ?? '[]')
    if (!Array.isArray(list)) return []
    return list
      .filter((note) => note && typeof note.text === 'string' && note.text.trim())
      .map((note) => ({
        id: String(note.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        text: note.text,
      }))
      .slice(0, 200)
  } catch {
    return []
  }
}

let notes = loadNotes()
let notesOpen = readStore(NOTES_OPEN_KEY) !== '0'

function persistNotes() {
  writeStore(NOTES_KEY, JSON.stringify(notes))
}

function applyNotesOpen() {
  el.shell.dataset.notes = notesOpen ? 'on' : 'off'
  el.notesToggle.setAttribute('aria-pressed', String(notesOpen))
  el.notesToggle.title = notesOpen ? t('hideNotes') : t('showNotes')
}

function addNote(text) {
  const clean = text.trim()
  if (!clean) return
  notes.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: clean })
  notes = notes.slice(0, 200)
  persistNotes()
  renderNotes()
}

function removeNote(id) {
  notes = notes.filter((note) => note.id !== id)
  persistNotes()
  renderNotes()
}

function useNote(note) {
  const current = el.input.value.trim()
  el.input.value = current ? `${current} ${note.text}` : note.text
  el.input.focus()
  el.input.setSelectionRange(el.input.value.length, el.input.value.length)
  autosize()
}

function renderNotes() {
  el.notesCount.textContent = notes.length ? String(notes.length) : ''

  if (!notes.length) {
    el.notesList.innerHTML = `<p class="notes-empty">${t('noNotes')}</p>`
    return
  }

  const frag = document.createDocumentFragment()
  for (const note of notes) {
    const row = document.createElement('div')
    row.className = 'note-row'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'note'
    button.textContent = note.text
    button.title = t('addToComposer')
    button.addEventListener('click', () => useNote(note))

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'note-del'
    del.title = t('deleteNote')
    del.setAttribute('aria-label', t('deleteNote'))
    del.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="m2.5 2.5 5 5m0-5-5 5"/></svg>'
    del.addEventListener('click', (event) => {
      event.stopPropagation()
      removeNote(note.id)
    })

    row.append(button, del)
    frag.appendChild(row)
  }

  el.notesList.replaceChildren(frag)
}

/* -------------------------------------------------------------------- models */

const GROUPS = [
  { plan: 'free', labelKey: 'free', hintKey: 'freeHint' },
  { plan: 'go', labelKey: 'goName', hintKey: null },
  { plan: 'paid', labelKey: 'paidName', hintKey: 'paidHint' },
]

function goHint() {
  if (goStatus === 'inactive') return t('goInactive')
  if (goStatus === 'active') return t('goActive')
  return t('goHint')
}

function modelMeta(model) {
  if (model.plan === 'paid') {
    const { input, output } = model.price ?? {}
    return input || output ? `$${input} / $${output} per m` : t('metered')
  }
  return model.context ? `${Math.round(model.context / 1000)}k` : ''
}

function modelRow(model) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'model'
  const active = model.id === settings.model.id && model.providerID === settings.model.providerID
  button.setAttribute('aria-pressed', String(active))

  const dot = document.createElement('span')
  dot.className = 'dot'

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = model.name

  const meta = document.createElement('span')
  meta.className = 'meta'
  meta.textContent = modelMeta(model)

  button.append(dot, name, meta)
  button.addEventListener('click', () => {
    const keep =
      settings.model.variant === 'default' || model.variants.includes(settings.model.variant)
    void save({
      model: {
        providerID: model.providerID,
        id: model.id,
        variant: keep ? settings.model.variant : 'default',
      },
    })
  })
  return button
}

function renderModels() {
  if (!models.length) {
    el.models.innerHTML = `<p class="empty">${modelsLoaded ? t('noModels') : t('loading')}</p>`
    el.modelNote.textContent = ''
    return
  }

  const query = modelQuery.trim().toLowerCase()
  const visible = models.filter(
    (model) =>
      !query ||
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query)
  )

  const frag = document.createDocumentFragment()

  for (const group of GROUPS) {
    const items = visible.filter((model) => model.plan === group.plan)
    if (!items.length) continue

    const head = document.createElement('div')
    head.className = 'model-group'
    head.dataset.plan = group.plan

    const label = document.createElement('span')
    label.textContent = t(group.labelKey)

    const hint = document.createElement('span')
    hint.className = 'model-group-hint'
    hint.textContent = group.plan === 'go' ? goHint() : group.hintKey ? t(group.hintKey) : ''

    head.append(label, hint)
    frag.appendChild(head)

    for (const model of items) frag.appendChild(modelRow(model))
  }

  if (!frag.childNodes.length) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = t('noMatch', { q: modelQuery.trim() })
    frag.appendChild(empty)
  }

  el.models.replaceChildren(frag)
  el.modelNote.textContent = t('ofModels', { n: visible.length, total: models.length })
}

/* ------------------------------------------------------------------ variants */

function renderVariants() {
  const model = selectedModel()
  const variants = model?.variants ?? []
  const options = ['default', ...variants]

  el.reasoningNote.textContent = variants.length ? `${variants.join(' / ')}` : t('notSupported')

  const frag = document.createDocumentFragment()
  for (const variant of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(settings.model.variant === variant))
    button.textContent = variant === 'default' ? t('auto') : variant
    button.disabled = !variants.length && variant !== 'default'
    button.addEventListener('click', () => {
      void save({ model: { variant } })
    })
    frag.appendChild(button)
  }

  el.variants.replaceChildren(frag)
}

/* -------------------------------------------------------------------- themes */

function renderThemes() {
  const frag = document.createDocumentFragment()

  for (const theme of THEMES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'theme'
    button.setAttribute('aria-pressed', String((themeMode ?? settings.theme) === theme.id))

    const preview = document.createElement('span')
    preview.className = 'preview'
    preview.style.background = theme.bg
    preview.style.borderColor = theme.line

    const lineA = document.createElement('i')
    lineA.style.background = theme.line
    const lineB = document.createElement('i')
    lineB.style.background = theme.accent
    preview.append(lineA, lineB)

    const label = document.createElement('span')
    label.className = 'theme-label'
    label.textContent = t(theme.nameKey)

    button.append(preview, label)
    button.addEventListener('click', () => {
      if (theme.id === 'system') {
        themeMode = 'system'
        try {
          window.localStorage.setItem(THEME_MODE_KEY, 'system')
        } catch {
          /* memory-only is fine */
        }
        applySettings()
      } else {
        themeMode = null
        try {
          window.localStorage.removeItem(THEME_MODE_KEY)
        } catch {
          /* memory-only is fine */
        }
        void save({ theme: theme.id })
      }
    })
    frag.appendChild(button)
  }

  el.themes.replaceChildren(frag)
}

function renderAccents() {
  const frag = document.createDocumentFragment()
  for (const accent of ACCENTS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'swatch'
    button.style.setProperty('--swatch', settings.theme === 'light' ? accent.light : accent.color)
    button.setAttribute('aria-pressed', String(settings.accent === accent.id))
    button.title = accent.id
    button.setAttribute('aria-label', accent.id)
    button.addEventListener('click', () => {
      void save({ accent: accent.id })
    })
    frag.appendChild(button)
  }
  el.accents.replaceChildren(frag)
}

function renderSegments(container, options, current, onPick) {
  const frag = document.createDocumentFragment()
  for (const option of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(current === option.id))
    button.textContent = option.nameKey ? t(option.nameKey) : option.name
    button.addEventListener('click', () => onPick(option.id))
    frag.appendChild(button)
  }
  container.replaceChildren(frag)
}

function renderPersonality() {
  const persona = PERSONAS.find((p) => p.id === settings.personality) ?? PERSONAS[0]
  el.personalityNote.textContent = persona.noteKey ? t(persona.noteKey) : ''
  renderSegments(el.personalities, PERSONAS, settings.personality, (id) => save({ personality: id }))
}

/* ------------------------------------------------------------------ updates */

async function checkForUpdate() {
  if (!window.conv.updates) return
  try {
    const result = await window.conv.updates.check()
    if (result && result.ok) {
      release = result
      updateNote = ''
      // Auto-update: install the newest release in the background whenever one
      // is available, no click needed. Skip only while a turn is in flight so
      // an active reply is never cut off mid-generation.
      if (result.available && !busy) void applyUpdate()
    }
  } catch {
    /* offline, no gh, or an older host build: nothing to show */
  }
  renderUpdate()
}

async function applyUpdate() {
  if (updateBusy || !window.conv.updates) return
  updateBusy = true
  updateNote = t('downloading')
  renderUpdate()

  try {
    const result = await window.conv.updates.apply()
    if (result && result.ok === false) {
      updateBusy = false
      updateNote = result.reason || t('updateFailed')
      renderUpdate()
    }
  } catch (cause) {
    updateBusy = false
    updateNote = String(cause?.message ?? cause)
    renderUpdate()
  }
}

/** Host progress lines are english; translate the two shapes we know. */
function localizeProgress(message) {
  const text = String(message ?? '')
  if (/^installing/i.test(text)) return t('installing')
  const percent = text.match(/^downloading\s+(\d+)%/i)
  if (percent) return t('downloadingPct', { pct: percent[1] })
  if (/^downloading\b/i.test(text)) return t('downloading')
  return text
}

function renderUpdate() {
  if (!el.updateBtn) return
  if (updateBusy) {
    el.updateBtn.textContent = updateNote || t('updateLabel')
    el.updateBtn.disabled = true
    el.updateBtn.hidden = false
  } else if (release?.available) {
    el.updateBtn.textContent = t('updateTo', { v: release.latest })
    el.updateBtn.disabled = false
    el.updateBtn.hidden = false
  } else {
    el.updateBtn.hidden = true
  }
}

/* ------------------------------------------------------------------- messages */

function intro() {
  const wrap = document.createElement('div')
  wrap.className = 'intro'

  const modelName = (selectedModel()?.name || settings.model?.id || 'the model').toLowerCase()

  const title = document.createElement('h1')
  title.textContent = t('introTitle')

  const line = document.createElement('p')
  line.textContent = t('introLine', { model: modelName })

  const examplesLabel = document.createElement('div')
  examplesLabel.className = 'intro-examples'
  examplesLabel.textContent = t('examples')

  const hints = document.createElement('div')
  hints.className = 'intro-hints'
  for (const hintKey of HINTS) {
    const hint = t(hintKey)
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'hint'
    chip.textContent = hint
    chip.addEventListener('click', () => {
      el.input.value = hint
      el.input.focus()
      autosize()
    })
    hints.appendChild(chip)
  }

  const keys = document.createElement('div')
  keys.className = 'intro-keys'
  const shortcuts = [
    ['⌘P', t('commands')],
    ['⌘K', t('settingsTitle')],
    ['⌘N', t('newChat')],
    ['esc', t('stop')],
    ['↑', t('edit')],
    ['/', t('focusComposer')],
  ]
  for (const [key, label] of shortcuts) {
    const row = document.createElement('span')
    row.className = 'key'
    const kbd = document.createElement('kbd')
    kbd.textContent = key
    row.append(kbd, document.createTextNode(' ' + label))
    keys.appendChild(row)
  }

  wrap.append(title, line, examplesLabel, hints, keys)
  return wrap
}

/** Reasoning blocks the user collapsed, keyed by assistant message id. */
const collapsedThoughts = new Set()
/** Messages whose finished thoughts have already been compacted automatically. */
const settledThoughts = new Set()

function renderMessages() {
  const stick = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 90
  el.log.replaceChildren()

  const shown = visibleMessages()

  if (!shown.length && !busy && !pending && !error && !notice) {
    el.log.appendChild(intro())
    return
  }

  let lastAssistantId = null
  let lastUserText = ''
  for (const message of shown) {
    if (message.type === 'assistant') lastAssistantId = message.id
    else if (message.type === 'user') {
      lastUserText = cleanUserText(message.text ?? message.payload?.text)
    }
  }

  for (const [messageIndex, message] of shown.entries()) {
    if (message.type === 'user') {
      const text = cleanUserText(message.text ?? message.payload?.text)
      if (!text) continue
      const bubble = document.createElement('div')
      bubble.className = 'msg user'
      const body = document.createElement('span')
      body.className = 'msg-body'
      body.textContent = text
      const edit = document.createElement('button')
      edit.type = 'button'
      edit.className = 'msg-action'
      edit.textContent = t('edit')
      edit.addEventListener('click', () => {
        el.input.value = text
        el.input.focus()
        autosize()
        renderCmdMenu()
      })
      bubble.append(body, edit)
      el.log.appendChild(bubble)
      continue
    }

    if (message.type !== 'assistant') continue

    const thoughtParts = []
    const textParts = []
    for (const part of message.content ?? []) {
      if (part.type === 'reasoning' || part.type === 'thinking') {
        if (part.text && part.text.trim()) thoughtParts.push(part.text.trim())
        continue
      }
      if (part.type === 'text' && part.text && part.text.trim()) textParts.push(part.text)
    }

    if (thoughtParts.length) {
      const key = message.id ?? `assistant-${messageIndex}`
      const settled = message.id !== lastAssistantId || !busy
      if (settled && !settledThoughts.has(key)) {
        settledThoughts.add(key)
        collapsedThoughts.add(key)
      }

      const thoughtText = thoughtParts.join('\n\n')
      const block = document.createElement('div')
      block.className = 'msg thinking'
      block.setAttribute('role', 'button')
      block.tabIndex = 0
      const collapsed = collapsedThoughts.has(key)
      block.classList.toggle('collapsed', collapsed)
      block.setAttribute('aria-expanded', String(!collapsed))
      block.title = collapsed ? t('showThoughts') : t('hideThoughts')
      block.textContent = collapsed ? t('thoughts') : thoughtText

      const toggle = () => {
        if (collapsedThoughts.has(key)) collapsedThoughts.delete(key)
        else collapsedThoughts.add(key)
        const next = collapsedThoughts.has(key)
        block.classList.toggle('collapsed', next)
        block.setAttribute('aria-expanded', String(!next))
        block.title = next ? t('showThoughts') : t('hideThoughts')
        block.textContent = next ? t('thoughts') : thoughtText
      }

      block.addEventListener('click', toggle)
      block.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle()
        }
      })
      el.log.appendChild(block)
    }

    for (const text of textParts) renderAssistantText(el.log, text)

    if (message.id === lastAssistantId && lastUserText && !busy) {
      const redo = document.createElement('button')
      redo.type = 'button'
      redo.className = 'msg-action redo'
      redo.textContent = t('regenerate')
      redo.addEventListener('click', () => {
        el.input.value = lastUserText
        autosize()
        void submit()
      })
      el.log.appendChild(redo)
    }
  }

  if (pending) {
    const bubble = document.createElement('div')
    bubble.className = 'msg user'
    bubble.textContent = pending
    el.log.appendChild(bubble)
  }

  if (busy) {
    const indicator = document.createElement('div')
    indicator.className = 'working'
    indicator.innerHTML = `<span class="working-label">${t('thinking')}</span><span class="dot"></span><span class="dot"></span><span class="dot"></span>`
    // Anchor the animations to the wall clock so they do not restart on each render.
    const now = Date.now()
    indicator.querySelector('.working-label').style.animationDelay = `-${now % 2400}ms`
    indicator.querySelectorAll('.dot').forEach((dot, index) => {
      const phase = (((now - index * 160) % 1200) + 1200) % 1200
      dot.style.animationDelay = `-${phase}ms`
    })
    el.log.appendChild(indicator)
  }

  if (error) {
    const line = document.createElement('div')
    line.className = 'error'

    const text = document.createElement('span')
    text.textContent = error.message ?? String(error)
    line.appendChild(text)

    if (error.kind === 'limit' || error.kind === 'plan') {
      const action = document.createElement('button')
      action.type = 'button'
      action.className = 'err-action'
      action.textContent = t('chooseModel')
      action.addEventListener('click', () => void openSheet())
      line.appendChild(action)
    }

    el.log.appendChild(line)
  }

  if (notice) {
    const line = document.createElement('div')
    line.className = 'notice'
    line.textContent = notice
    el.log.appendChild(line)
  }

  if (stick) el.log.scrollTop = el.log.scrollHeight
}

function formatCost(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(6)}`
}

function renderSpend() {
  const text = formatCost(lastCost)
  el.spend.textContent = text
  el.spend.title = text ? t('spend', { cost: text }) : ''
  el.spend.hidden = !text
  el.meter.hidden = !settings.showTokens && !(lastCost > 0)
}

function addCodeBlock(container, code) {
  const pre = document.createElement('pre')
  pre.className = 'code'
  const inner = document.createElement('code')
  inner.textContent = code.replace(/\n$/, '')
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'code-copy'
  btn.textContent = t('copy')
  btn.addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(inner.textContent).catch(() => {})
    btn.textContent = t('copied')
    setTimeout(() => (btn.textContent = t('copy')), 1200)
  })
  pre.append(btn, inner)
  container.appendChild(pre)
}

/** Inline markdown: `code`, **bold**, __bold__, *italic*, _italic_, [text](url). */
function appendInline(parent, text) {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let match
  while ((match = re.exec(text))) {
    if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)))
    last = match.index + match[0].length
    const token = match[0]
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      const code = document.createElement('code')
      code.className = 'inline'
      code.textContent = token.slice(1, -1)
      parent.appendChild(code)
    } else if (token.startsWith('**') && token.length > 4) {
      const bold = document.createElement('strong')
      bold.textContent = token.slice(2, -2)
      parent.appendChild(bold)
    } else if (token.startsWith('__') && token.length > 4) {
      const bold = document.createElement('strong')
      bold.textContent = token.slice(2, -2)
      parent.appendChild(bold)
    } else if (token.startsWith('*') && token.length > 2) {
      const em = document.createElement('em')
      em.textContent = token.slice(1, -1)
      parent.appendChild(em)
    } else if (token.startsWith('_') && token.length > 2) {
      const em = document.createElement('em')
      em.textContent = token.slice(1, -1)
      parent.appendChild(em)
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (link) {
        const label = link[1]
        const url = link[2]
        if (/^(https?|mailto):/i.test(url)) {
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.textContent = label
          anchor.target = '_blank'
          anchor.rel = 'noopener noreferrer'
          parent.appendChild(anchor)
        } else {
          parent.appendChild(document.createTextNode(label))
        }
      }
    }
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)))
}

const isFence = (line) => /^\s*```/.test(line)
const isHr = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
const isQuote = (line) => /^\s*>\s?/.test(line)
const isBullet = (line) => /^\s*[-*+]\s+/.test(line)
const isOrdered = (line) => /^\s*\d+[.)]\s+/.test(line)

/** Block-level markdown: code fences, headings, lists, quotes, rules, paragraphs. */
function renderMarkdown(container, text) {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (isFence(line)) {
      const buffer = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i].trim())) {
        buffer.push(lines[i])
        i++
      }
      i++ // closing fence
      addCodeBlock(container, buffer.join('\n'))
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const el = document.createElement(level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5')
      el.className = 'md-heading'
      appendInline(el, heading[2])
      container.appendChild(el)
      i++
      continue
    }

    if (isHr(line)) {
      container.appendChild(document.createElement('hr'))
      i++
      continue
    }

    if (isQuote(line)) {
      const quote = document.createElement('blockquote')
      while (i < lines.length && isQuote(lines[i])) {
        const p = document.createElement('p')
        appendInline(p, lines[i].replace(/^\s*>\s?/, ''))
        quote.appendChild(p)
        i++
      }
      container.appendChild(quote)
      continue
    }

    if (isBullet(line) || isOrdered(line)) {
      const ordered = isOrdered(line)
      const list = document.createElement(ordered ? 'ol' : 'ul')
      while (i < lines.length) {
        const current = lines[i].trim()
        if (ordered && isOrdered(lines[i])) {
          const li = document.createElement('li')
          appendInline(li, current.replace(/^\d+[.)]\s+/, ''))
          list.appendChild(li)
          i++
        } else if (!ordered && isBullet(lines[i])) {
          const li = document.createElement('li')
          appendInline(li, current.replace(/^[-*+]\s+/, ''))
          list.appendChild(li)
          i++
        } else break
      }
      container.appendChild(list)
      continue
    }

    if (!trimmed) {
      i++
      continue
    }

    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isFence(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !isHr(lines[i]) &&
      !isQuote(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    const p = document.createElement('p')
    appendInline(p, para.join('\n'))
    container.appendChild(p)
  }
}

function renderAssistantText(container, text) {
  const wrap = document.createElement('div')
  wrap.className = 'msg assistant md'
  renderMarkdown(wrap, text)
  container.appendChild(wrap)
}

function renderCmdMenu() {
  const value = el.input.value
  if (!value.startsWith('?') || value.includes(' ')) {
    el.cmdMenu.hidden = true
    return
  }
  const frag = document.createDocumentFragment()
  for (const cmd of COMMANDS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cmd-item'
    btn.textContent = `?${cmd}`
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      el.input.value = `?${cmd} `
      el.input.focus()
      autosize()
      el.cmdMenu.hidden = true
    })
    frag.appendChild(btn)
  }
  el.cmdMenu.replaceChildren(frag)
  el.cmdMenu.hidden = false
}

function renderTokens(tokens, cost) {
  if (tokens) lastTokens = tokens
  if (typeof cost === 'number') lastCost = cost
  renderSpend()
  if (!settings.showTokens || !lastTokens) {
    el.tokensLabel.textContent = ''
    return
  }

  const used =
    (lastTokens.input ?? 0) + (lastTokens.output ?? 0) + (lastTokens.reasoning ?? 0)
  const left = Math.max(0, settings.budget - used)
  const pct = Math.min(100, (used / settings.budget) * 100)

  el.tokensLabel.textContent = `${used.toLocaleString('en-US')} ${t('used')} · ${left.toLocaleString('en-US')} ${t('left')}`
  el.meterLeft.textContent = t('percentOf', {
    pct: pct.toFixed(1),
    budget: settings.budget.toLocaleString('en-US'),
  })
  el.meterFill.style.width = pct + '%'
  el.meterFill.className = 'meter-fill' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '')
}

/* --------------------------------------------------------------------- sheet */

async function openSheet() {
  if (!el.sheet.open) el.sheet.showModal()
  applySettings()

  if (modelsLoaded) return

  el.models.innerHTML = `<p class="empty">${t('loading')}</p>`
  try {
    models = (await window.conv.models.list()) ?? []
  } catch (cause) {
    models = []
    modelsLoaded = true
    el.models.innerHTML = `<p class="empty">${t('noModels')} ${String(
      cause?.message ?? cause
    )}</p>`
    return
  }
  modelsLoaded = true
  applySettings()
}

function closeSheet() {
  if (el.sheet.open) el.sheet.close()
}

/* ---------------------------------------------------------------- palette */

let paletteIndex = 0
let paletteItems = []

function paletteActions() {
  const entries = []
  const activeTheme = themeMode ?? settings.theme

  entries.push({
    id: 'new',
    label: t('newChat'),
    hint: '⌘N',
    run: () => window.conv.newChat(),
  })
  entries.push({
    id: 'settings',
    label: t('settingsTitle'),
    hint: '⌘K',
    run: () => openSheet(),
  })
  entries.push({
    id: 'focus',
    label: t('focusComposer'),
    hint: '/',
    run: () => el.input.focus(),
  })
  entries.push({
    id: 'edit',
    label: t('edit'),
    hint: '↑',
    run: () => {
      const text = lastUserMessageText()
      if (text) {
        el.input.value = text
        autosize()
        el.input.focus()
      }
    },
  })
  entries.push({
    id: 'notes',
    label: t('notesTitle'),
    active: notesOpen,
    run: () => {
      notesOpen = !notesOpen
      writeStore(NOTES_OPEN_KEY, notesOpen ? '1' : '0')
      applyNotesOpen()
    },
  })
  entries.push({
    id: 'tokens',
    label: t('tokenCounter'),
    active: settings.showTokens,
    run: () => void save({ showTokens: !settings.showTokens }),
  })
  for (const theme of THEMES) {
    entries.push({
      id: `theme-${theme.id}`,
      label: t(theme.nameKey),
      active: activeTheme === theme.id,
      run: () => {
        if (theme.id === 'system') {
          themeMode = 'system'
          try {
            window.localStorage.setItem(THEME_MODE_KEY, 'system')
          } catch {
            /* memory-only is fine */
          }
          applySettings()
        } else {
          themeMode = null
          try {
            window.localStorage.removeItem(THEME_MODE_KEY)
          } catch {
            /* memory-only is fine */
          }
          void save({ theme: theme.id })
        }
      },
    })
  }
  for (const density of DENSITIES) {
    entries.push({
      id: `density-${density.id}`,
      label: t(density.nameKey),
      active: settings.density === density.id,
      run: () => void save({ density: density.id }),
    })
  }
  entries.push({
    id: 'clear',
    label: t('clearAll'),
    run: () => {
      for (const session of visibleSessions()) hiddenSessions.add(session.id)
      persistHiddenSessions()
      renderSessions()
    },
  })
  return entries
}

function openPalette() {
  if (!el.palette) return
  el.palette.hidden = false
  el.paletteInput.value = ''
  renderPalette('')
  el.paletteInput.focus()
}

function closePalette() {
  if (!el.palette) return
  el.palette.hidden = true
  el.paletteInput.value = ''
}

function renderPalette(query) {
  const q = query.trim().toLowerCase()
  paletteItems = paletteActions().filter((item) => !q || item.label.toLowerCase().includes(q))
  paletteIndex = 0
  const frag = document.createDocumentFragment()
  paletteItems.forEach((item, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'palette-item'
    if (index === paletteIndex) button.classList.add('active')
    button.dataset.index = String(index)

    const label = document.createElement('span')
    label.className = 'palette-label'
    label.textContent = item.label

    const tail = document.createElement('span')
    tail.className = 'palette-tail'
    if (item.active) tail.textContent = 'on'
    else if (item.hint) tail.textContent = item.hint

    button.append(label, tail)
    button.addEventListener('click', () => {
      closePalette()
      item.run()
    })
    button.addEventListener('mousemove', () => {
      if (Number(button.dataset.index) !== paletteIndex) {
        paletteIndex = Number(button.dataset.index)
        paintPaletteSelection()
      }
    })
    frag.appendChild(button)
  })

  if (!paletteItems.length) {
    const empty = document.createElement('p')
    empty.className = 'palette-empty'
    empty.textContent = t('noMatches')
    frag.appendChild(empty)
  }

  el.paletteList.replaceChildren(frag)
  paintPaletteSelection()
}

function paintPaletteSelection() {
  const nodes = el.paletteList.querySelectorAll('.palette-item')
  nodes.forEach((node, index) => node.classList.toggle('active', index === paletteIndex))
  const active = el.paletteList.querySelector('.palette-item.active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

function paletteRun() {
  const item = paletteItems[paletteIndex]
  if (!item) return
  closePalette()
  item.run()
}

/* --------------------------------------------------------------------- submit */

function setSendBusy(on) {
  el.send.classList.toggle('busy', on)
  el.send.title = on ? t('stop') : t('sendHint')
  el.send.setAttribute('aria-label', on ? t('stop') : t('send'))
}

function showNotice(text) {
  notice = text
  error = null
  renderMessages()
}

function handleCommand(text) {
  const parts = text.slice(1).trim().split(/\s+/)
  const name = (parts[0] || '').toLowerCase()
  const arg = parts.slice(1).join(' ').trim()

  switch (name) {
    case 'persona': {
      const id = arg.toLowerCase()
      if (!id) {
        const current = PERSONAS.find((p) => p.id === settings.personality)
        showNotice(`persona: ${current?.name ?? 'balanced'} · ${PERSONAS.map((p) => p.id).join(', ')}`)
      } else if (PERSONAS.some((p) => p.id === id)) {
        void save({ personality: id })
        showNotice(t('personaSet', { id }))
      } else {
        showNotice(t('personaUnknown', { list: PERSONAS.map((p) => p.id).join(', ') }))
      }
      return
    }
    case 'effort': {
      const variants = ['default', ...(selectedModel()?.variants ?? [])]
      if (!arg) {
        showNotice(`effort: ${settings.model.variant} · ${variants.join(', ')}`)
      } else {
        void save({ model: { variant: arg } })
        showNotice(t('effortSet', { id: arg }))
      }
      return
    }
    case 'model': {
      if (!arg) {
        showNotice(`model: ${selectedModel()?.name ?? settings.model.id}`)
      } else {
        const m = models.find(
          (x) =>
            x.name.toLowerCase().includes(arg.toLowerCase()) ||
            x.id.toLowerCase().includes(arg.toLowerCase())
        )
        if (m) {
          const keep =
            settings.model.variant === 'default' || m.variants.includes(settings.model.variant)
          void save({ model: { providerID: m.providerID, id: m.id, variant: keep ? settings.model.variant : 'default' } })
          showNotice(t('modelSet', { name: m.name }))
        } else {
          showNotice(t('noModelMatch', { q: arg }))
        }
      }
      return
    }
    case 'version': {
      showNotice(`subzer0 · ${selectedModel()?.name ?? settings.model.id} · ${settings.model.variant}`)
      return
    }
    case 'compact': {
      compact = !compact
      try {
        window.localStorage.setItem(COMPACT_KEY, compact ? '1' : '0')
      } catch {
        /* memory-only is fine */
      }
      applyCompact()
      showNotice(compact ? t('compactOn') : t('compactOff'))
      return
    }
    case 'clear': {
      const last = messages[messages.length - 1]
      if (sessionID && last?.id) {
        clearedMessages[sessionID] = last.id
        saveCleared()
      }
      showNotice(t('chatCleared'))
      return
    }
    default:
      showNotice(t('unknownCommand'))
  }
}

async function submit() {
  const text = el.input.value.trim()
  if (!text || busy) return

  if (text.startsWith('?')) {
    el.input.value = ''
    autosize()
    handleCommand(text)
    return
  }

  error = null
  notice = null
  errorAt = 0
  pending = text
  el.input.value = ''
  autosize()
  busy = true
  setSendBusy(true)
  renderMessages()

  try {
    const result = await window.conv.send(withContext(text))
    if (result && result.ok === false) {
      error = {
        message: result.reason
          ? `${t('noAi')} (${result.reason})`
          : t('noAi'),
      }
      busy = false
      pending = null
      setSendBusy(false)
      renderMessages()
    }
  } catch (cause) {
    error = { message: String(cause?.message ?? cause) }
    busy = false
    pending = null
    setSendBusy(false)
    renderMessages()
  }
}

function autosize() {
  el.input.style.height = 'auto'
  el.input.style.height = Math.min(220, el.input.scrollHeight) + 'px'
}

/* ----------------------------------------------------------------------- wire */

// Boot splash: hold for 3s, then fade out and remove.
const bootEl = document.getElementById('boot')
if (bootEl) {
  setTimeout(() => {
    bootEl.classList.add('hide')
    setTimeout(() => bootEl.remove(), 600)
  }, 3000)
}

el.composer.addEventListener('submit', (event) => {
  event.preventDefault()
  void submit()
})

el.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
  }
})

el.input.addEventListener('input', () => {
  autosize()
  renderCmdMenu()
})

el.cmdMenu.addEventListener('click', () => {
  el.cmdMenu.hidden = true
})

el.custom.addEventListener('input', () => {
  customInstructions = el.custom.value
  persistCustom()
})

el.gear.addEventListener('click', () => void openSheet())
el.modelChip.addEventListener('click', () => void openSheet())
el.close.addEventListener('click', closeSheet)

el.notesToggle.addEventListener('click', () => {
  notesOpen = !notesOpen
  writeStore(NOTES_OPEN_KEY, notesOpen ? '1' : '0')
  applyNotesOpen()
})

el.noteForm.addEventListener('submit', (event) => {
  event.preventDefault()
  addNote(el.noteInput.value)
  el.noteInput.value = ''
  el.noteInput.focus()
})

applyNotesOpen()
renderNotes()

el.language?.addEventListener('change', () => {
  language = el.language.value
  persistLanguage()
  applyLanguage()
})

renderLanguageOptions()
applyLanguage()

el.sessionSearch?.addEventListener('input', () => {
  sessionQuery = el.sessionSearch.value
  renderSessions()
})

el.paletteInput?.addEventListener('input', () => {
  renderPalette(el.paletteInput.value)
})

el.paletteInput?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    paletteIndex = Math.min(paletteItems.length - 1, paletteIndex + 1)
    paintPaletteSelection()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    paletteIndex = Math.max(0, paletteIndex - 1)
    paintPaletteSelection()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    paletteRun()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closePalette()
  }
})

el.palette?.addEventListener('mousedown', (event) => {
  if (event.target === el.palette) closePalette()
})

el.sheet.addEventListener('click', (event) => {
  if (event.target === el.sheet) closeSheet()
})

el.newChat.addEventListener('click', () => {
  void window.conv.newChat()
})

el.send.addEventListener('click', (event) => {
  if (busy) {
    event.preventDefault()
    void window.conv.stop()
  }
})

el.updateBtn?.addEventListener('click', () => void applyUpdate())

// Follow the OS light/dark preference live when the "system" theme is chosen.
if (darkQuery.addEventListener) {
  darkQuery.addEventListener('change', () => {
    if (themeMode === 'system') applySettings()
  })
}

el.showTokens.addEventListener('change', () => {
  void save({ showTokens: el.showTokens.checked })
})

el.budget.addEventListener('change', () => {
  const value = Number(el.budget.value)
  if (Number.isFinite(value) && value > 0) void save({ budget: value })
})

el.modelSearch.addEventListener('input', () => {
  modelQuery = el.modelSearch.value
  renderModels()
})

// "Clear all" asks once (first click arms it for 4s). It only clears the rail
// in this app — the OpenCode sessions are left untouched.
let clearArmedAt = 0
let clearArmTimer = null

function disarmClear() {
  clearArmedAt = 0
  el.clearAll.classList.remove('arm')
  el.clearAll.textContent = t('clearAll')
}

el.clearAll.addEventListener('click', () => {
  if (Date.now() - clearArmedAt < 4000) {
    disarmClear()
    for (const session of visibleSessions()) hiddenSessions.add(session.id)
    persistHiddenSessions()
    renderSessions()
    return
  }
  clearArmedAt = Date.now()
  el.clearAll.classList.add('arm')
  el.clearAll.textContent = t('confirmClear')
  if (clearArmTimer) clearTimeout(clearArmTimer)
  clearArmTimer = setTimeout(disarmClear, 4000)
})

function lastUserMessageText() {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'user') {
      const text = cleanUserText(messages[i].text ?? messages[i].payload?.text)
      if (text) return text
    }
  }
  return ''
}

document.addEventListener('keydown', (event) => {
  const mod = event.ctrlKey || event.metaKey
  const target = event.target
  const typing =
    target &&
    (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)

  if (mod && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void openSheet()
    return
  }
  if (mod && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    void window.conv.newChat()
    return
  }
  if (mod && event.key.toLowerCase() === 'p') {
    event.preventDefault()
    openPalette()
    return
  }
  if (mod) return

  // "/" focuses the composer when not already typing.
  if (event.key === '/' && !typing) {
    event.preventDefault()
    el.input.focus()
    return
  }

  if (event.key === 'Escape') {
    if (!el.palette.hidden) {
      closePalette()
      return
    }
    if (el.sheet.open) {
      closeSheet()
      return
    }
    if (busy) {
      void window.conv.stop()
      return
    }
    el.input.blur()
    return
  }

  // ↑ in an empty composer reloads the last message for editing.
  if (event.key === 'ArrowUp' && typing && el.input === target && el.input.value === '') {
    event.preventDefault()
    el.input.value = lastUserMessageText()
    autosize()
    renderCmdMenu()
  }
})

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[880, 1174.66].forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.start(t)
      o.stop(t + 0.4)
    })
  } catch {
    /* audio unavailable */
  }
}

function notifyDone() {
  try {
    if (window.Notification && Notification.permission === 'granted') {
      new Notification('subzer0', { body: t('done') })
    } else if (window.Notification && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  } catch {
    /* notifications unavailable */
  }
  playChime()
}

window.conv.onUpdate((update) => {
  const prevBusy = busy
  messages = update.messages ?? []
  busy = Boolean(update.busy)
  pending = null
  notice = null
  if (update.settings) settings = update.settings
  if (update.providers?.go) goStatus = update.providers.go
  if (update.sessionID) sessionID = update.sessionID

  if (error && messages.length > errorAt) {
    error = null
    errorAt = 0
  }

  if (prevBusy && !busy && messages.length) notifyDone()

  setSendBusy(busy)
  applySettings()
  renderMessages()
  renderTokens(update.tokens, update.cost)
})

window.conv.onSettings((next) => {
  settings = next
  applySettings()
})

window.conv.onSessions((payload) => {
  sessions = payload?.sessions ?? []
  if (payload?.current) sessionID = payload.current
  renderSessions()
  renderSessionTitle()
})

window.conv.onError((payload) => {
  error = { message: payload?.message ?? String(payload), kind: payload?.kind }
  errorAt = messages.length
  renderMessages()
})

window.conv.onUpdateProgress?.((payload) => {
  if (payload?.message) {
    updateNote = localizeProgress(payload.message)
    renderUpdate()
  }
})

// Re-check for new releases once in a while without waiting for a reload.
setInterval(() => void checkForUpdate(), 6 * 60 * 60 * 1000)

window.conv.init().then(async (result) => {
  if (result?.settings) {
    settings = result.settings
  }
  // restore the last-chosen personality; the host may not carry it across reloads.
  const stored = storedPersonality()
  if (PERSONAS.some((p) => p.id === stored)) settings.personality = stored
  normalizePersonality()
  customInstructions = loadCustom()
  // Undo the earlier one-time violet default, then forget it.
  try {
    if (window.localStorage.getItem(ACCENT_KEY) === '1') {
      settings.accent = 'slate'
      window.localStorage.removeItem(ACCENT_KEY)
      void window.conv.settings.set({ accent: 'slate' })
    }
  } catch {
    /* nothing to restore */
  }
  if (result?.sessionID) sessionID = result.sessionID
  if (Array.isArray(result?.sessions)) sessions = result.sessions

  applySettings()
  refreshSessions()
  void checkForUpdate()

  renderSessionTitle()

  // Fetch the model list once so the settings sheet is instant.
  try {
    models = (await window.conv.models.list()) ?? []
    modelsLoaded = true
    applySettings()
    renderMessages()
  } catch {
    /* the sheet will retry */
  }
})
