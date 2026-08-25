const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbydtL3c-D35jMntldTrQ9_mlcP9-9bqkaWdV6d8oRtQXc60YlUn4RVMElnXFyuvLXu_/exec';
const DATA_URLS = ['./vocabulary-question.json'];
const DATA_BUNDLE_URL = './vocabulary-data.js?v=2.9.1';
const HISTORY_KEY = 'clear_maker_2d_history';
const COMPLETED_PAGES_KEY = 'clear_maker_2d_completed_pages';
const SELECTED_PAGE_KEY = 'clear_maker_2d_selected_page';
const REMEDY_STORAGE_PREFIX = 'clear_maker_2d_remedy_';
const DEVICE_ID_KEY = 'clear_maker_2d_device_id';
const PASS_RATE = 0.83;

const state = {
    studentId: '',
    studentName: '',
    pages: [],
    currentPageIndex: 0,
    test: null,
    images: [],
    cameraStream: null,
    facingMode: 'environment',
    showRuby: false,
    isBankCollapsed: false,
};

const byId = id => document.getElementById(id);
const els = {
    setupModal: byId('setup-modal'),
    studentId: byId('student-id'),
    studentName: byId('student-name'),
    saveSetup: byId('save-setup-btn'),
    resetSetup: byId('reset-setup-btn'),
    settings: byId('settings-btn'),
    displayStudent: byId('display-student'),
    learnerRank: byId('learner-rank'),
    dataStatus: byId('data-status'),

    builder: byId('test-builder'),
    pageSelect: byId('page-select'),
    prevPageBtn: byId('prev-page-btn'),
    nextPageBtn: byId('next-page-btn'),
    metaPageTag: byId('meta-page-tag'),
    metaTargetGrade: byId('meta-target-grade'),
    metaQcount: byId('meta-qcount'),
    metaTitle: byId('meta-title'),
    metaInstructions: byId('meta-instructions'),
    questionOrderSelect: byId('question-order-select'),
    challengeProgress: byId('challenge-progress'),
    createTest: byId('create-test-btn'),

    remedyControls: byId('remedy-controls'),
    remedyCountLabel: byId('remedy-count-label'),
    remedyTest: byId('remedy-test-btn'),

    historyToggle: byId('history-toggle-btn'),
    historyClose: byId('history-close-btn'),
    historySection: byId('history-section'),
    historyList: byId('history-list'),

    questionSection: byId('question-section'),
    stickyWordBank: byId('sticky-word-bank'),
    wordBankCount: byId('word-bank-count'),
    wordBankChips: byId('word-bank-chips'),
    toggleRubyBtn: byId('toggle-ruby-btn'),
    resetChipsBtn: byId('reset-chips-btn'),
    collapseBankBtn: byId('collapse-bank-btn'),
    testRangeLabel: byId('test-range-label'),
    questionList: byId('question-list'),
    shuffleTestBtn: byId('shuffle-test-btn'),
    replaceTest: byId('replace-test-btn'),
    backToBuilderBtn: byId('back-to-builder-btn'),

    uploadSection: byId('upload-section'),
    cameraInput: byId('camera-input'),
    upload: byId('upload-btn'),
    previewContainer: byId('preview-container'),
    previewList: byId('image-preview-list'),
    addMore: byId('add-more-btn'),
    clearAll: byId('clear-all-btn'),
    evaluate: byId('evaluate-btn'),

    loading: byId('loading-indicator'),
    resultSection: byId('result-section'),
    resultBadge: byId('result-badge'),
    resultScore: byId('result-score'),
    resultContent: byId('result-content'),
    screenshot: byId('screenshot-btn'),
    newTest: byId('new-test-btn'),

    cameraModal: byId('camera-modal'),
    cameraVideo: byId('camera-video'),
    cameraCanvas: byId('camera-canvas'),
    cameraShutter: byId('camera-shutter-btn'),
    cameraSwitch: byId('camera-switch-btn'),
    cameraClose: byId('camera-close-btn'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    state.studentId = formatStudentId(localStorage.getItem('student_id') || '');
    state.studentName = localStorage.getItem('student_name') || '';
    els.studentId.value = state.studentId;
    els.studentName.value = state.studentName;
    updateStudentDisplay();
    if (!state.studentId || !state.studentName) els.setupModal.classList.remove('hidden');
    bindEvents();
    await loadVocabulary();
}

function bindEvents() {
    els.saveSetup.addEventListener('click', saveSetup);
    if (els.resetSetup) els.resetSetup.addEventListener('click', resetAllStudentData);
    els.settings.addEventListener('click', () => els.setupModal.classList.remove('hidden'));

    els.pageSelect.addEventListener('change', () => {
        state.currentPageIndex = Number(els.pageSelect.value);
        updatePageMeta();
    });
    els.prevPageBtn.addEventListener('click', () => {
        if (state.currentPageIndex > 0) {
            state.currentPageIndex--;
            els.pageSelect.value = state.currentPageIndex;
            updatePageMeta();
        }
    });
    els.nextPageBtn.addEventListener('click', () => {
        if (state.currentPageIndex < state.pages.length - 1) {
            state.currentPageIndex++;
            els.pageSelect.value = state.currentPageIndex;
            updatePageMeta();
        }
    });

    els.createTest.addEventListener('click', createTest);
    els.remedyTest.addEventListener('click', createRemedyTest);
    els.shuffleTestBtn.addEventListener('click', shuffleCurrentTestQuestions);
    els.replaceTest.addEventListener('click', recreateCurrentTest);
    if (els.backToBuilderBtn) els.backToBuilderBtn.addEventListener('click', recreateCurrentTest);

    els.toggleRubyBtn.addEventListener('click', toggleRuby);
    els.resetChipsBtn.addEventListener('click', resetWordChips);
    els.collapseBankBtn.addEventListener('click', toggleCollapseWordBank);

    els.historyToggle.addEventListener('click', showHistory);
    els.historyClose.addEventListener('click', () => els.historySection.classList.add('hidden'));

    els.upload.addEventListener('click', openCamera);
    els.addMore.addEventListener('click', openCamera);
    els.clearAll.addEventListener('click', clearImages);
    els.cameraInput.addEventListener('change', handleFileInput);
    els.cameraShutter.addEventListener('click', takePhoto);
    els.cameraSwitch.addEventListener('click', switchCamera);
    els.cameraClose.addEventListener('click', closeCamera);

    els.evaluate.addEventListener('click', evaluateAnswer);
    els.newTest.addEventListener('click', resetForNextTest);
    els.screenshot.addEventListener('click', saveResultImage);

    els.setupModal.addEventListener('click', event => {
        if (event.target === els.setupModal && state.studentId && state.studentName) els.setupModal.classList.add('hidden');
    });
}

async function loadVocabulary() {
    try {
        let source = null;
        const VOCABULARY_CACHE_KEY = 'clear_maker_2d_vocabulary_cache';

        // 1. ローカルキャッシュから即時読み込み（通信ゼロ・0ミリ秒ロード）
        const cachedStr = localStorage.getItem(VOCABULARY_CACHE_KEY);
        if (cachedStr) {
            try {
                source = JSON.parse(cachedStr);
                if (!Array.isArray(source) || source.length === 0) source = null;
            } catch (err) {
                console.warn('キャッシュが無効です', err);
                localStorage.removeItem(VOCABULARY_CACHE_KEY);
                source = null;
            }
        }

        // 2. キャッシュがない場合、GASから取得（初回のみ）
        if (!source && GAS_API_URL) {
            els.dataStatus.textContent = '初回データ取得中(5〜10秒)…';
            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'getVocabularyPages' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'success' && Array.isArray(data.pages) && data.pages.length > 0) {
                    source = data.pages;
                    try {
                        localStorage.setItem(VOCABULARY_CACHE_KEY, JSON.stringify(source));
                    } catch (e) {
                        console.warn('キャッシュ保存容量オーバー', e);
                    }
                }
            }
        }

        if (!source || !Array.isArray(source) || source.length === 0) {
            throw new Error('語彙データが見つかりませんでした');
        }

        state.pages = source;
        populatePageSelect();

        const totalQuestions = state.pages.reduce((sum, p) => sum + (p.questions ? p.questions.length : 0), 0);
        els.dataStatus.textContent = `${state.pages.length}ページ・${totalQuestions}問 読込完了`;
        els.dataStatus.classList.add('ready');
        els.createTest.disabled = false;

        updateProgressDisplay();
        updateRemedyCount();
    } catch (error) {
        console.error(error);
        els.dataStatus.textContent = '語彙データを読み込めません';
        alert(`語彙データの読み込みに失敗しました: ${error.message}`);
    }
}

function loadVocabularyBundle() {
    if (globalThis.CLEAR_MAKER_VOCABULARY) return Promise.resolve(globalThis.CLEAR_MAKER_VOCABULARY);
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = DATA_BUNDLE_URL;
        script.onload = () => globalThis.CLEAR_MAKER_VOCABULARY
            ? resolve(globalThis.CLEAR_MAKER_VOCABULARY)
            : reject(new Error('vocabulary-data.js に有効なデータがありません'));
        script.onerror = () => reject(new Error('JSONとJSの両方を取得できませんでした'));
        document.head.appendChild(script);
    });
}

function populatePageSelect() {
    const completedPages = getCompletedPages();
    els.pageSelect.innerHTML = state.pages.map((page, index) => {
        const pageNum = page.source?.page || (index + 1);
        const qCount = page.questions ? page.questions.length : 0;
        const isPassed = completedPages.includes(page.id || `page_${pageNum}`);
        const statusMark = isPassed ? '★ ' : '';
        return `<option value="${index}">${statusMark}p.${pageNum} : ${page.title || '語彙問題'} (${qCount}問)</option>`;
    }).join('');

    const savedPageId = localStorage.getItem(SELECTED_PAGE_KEY);
    if (savedPageId) {
        const foundIndex = state.pages.findIndex(p => (p.id || `page_${p.source?.page}`) === savedPageId);
        if (foundIndex !== -1) state.currentPageIndex = foundIndex;
    }
    els.pageSelect.value = state.currentPageIndex;
    updatePageMeta();
}

function updatePageMeta() {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;

    const pageNum = page.source?.page || (state.currentPageIndex + 1);
    els.metaPageTag.textContent = `Page ${pageNum}`;
    if (els.metaTargetGrade) els.metaTargetGrade.textContent = page.target?.grade || '';
    els.metaQcount.textContent = `${page.questions ? page.questions.length : 0}問`;
    els.metaTitle.textContent = page.title || '語彙類題';
    els.metaInstructions.textContent = page.instructions || '次の語群から最も適切な語を選び、空欄に書きなさい。';

    els.prevPageBtn.disabled = state.currentPageIndex === 0;
    els.nextPageBtn.disabled = state.currentPageIndex === state.pages.length - 1;

    localStorage.setItem(SELECTED_PAGE_KEY, page.id || `page_${pageNum}`);
}

function createTest() {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;

    let rawQuestions = (page.questions || []).map((q, idx) => ({
        number: idx + 1,
        id: q.id || `q${idx + 1}`,
        answerId: q.answer_id,
        answer: q.answer,
        reading: findReadingForWord(page, q.answer, q.answer_id),
        clozeSentence: q.cloze_sentence || q.sentence,
        sentence: q.sentence,
        ruby: q.ruby || [],
    }));

    const isRandom = els.questionOrderSelect && els.questionOrderSelect.value === 'random';
    if (isRandom) {
        rawQuestions = shuffleQuestionsArray(rawQuestions, page);
    }

    state.test = {
        page: page,
        pageIndex: state.currentPageIndex,
        questions: rawQuestions,
        isRemedy: false
    };

    renderTestView();
}

function shuffleCurrentTestQuestions() {
    if (!state.test || !state.test.questions || state.test.questions.length <= 1) return;
    state.test.questions = shuffleQuestionsArray(state.test.questions, state.test.page);
    renderTestView();
}

function shuffleQuestionsArray(questions, page) {
    const isPaired = (page?.layout_type === 'paired') ||
                     (page?.title && (page.title.includes('対で覚える') || page.title.includes('対になる')));

    let shuffled = [];
    if (isPaired && questions.length >= 2) {
        // ペア問題は2問1組のペア単位でシャッフル
        const pairs = [];
        for (let i = 0; i < questions.length; i += 2) {
            pairs.push([questions[i], questions[i + 1]].filter(Boolean));
        }
        for (let i = pairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
        }
        shuffled = pairs.flat();
    } else {
        // 通常問題は全問シャッフル
        shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
    }

    // 番号を 1〜N に再採番
    return shuffled.map((q, index) => ({
        ...q,
        number: index + 1
    }));
}

function createRemedyTest() {
    const remedyWords = getActiveRemedyWords();
    if (!remedyWords.length) return alert('現在、要復習の語彙はありません！');

    const sample = remedyWords.slice(0, 12);
    state.test = {
        page: {
            title: '🔥 苦手克服チャレンジ（要復習語彙）',
            instructions: '過去に間違えた語彙です。語群を参考に空欄に正しい語を書きなさい。',
            target: { grade: '復習特訓' },
            source: { page: 'Remedy' },
            vocabulary: sample.map(item => ({ id: item.wordId, word: item.word, reading: item.reading || '' })),
        },
        pageIndex: -1,
        questions: sample.map((item, idx) => ({
            number: idx + 1,
            id: item.wordId,
            answerId: item.wordId,
            answer: item.word,
            reading: item.reading || '',
            clozeSentence: item.clozeSentence || `${item.word}: {{blank}}`,
            sentence: item.sentence || item.word,
            ruby: [],
            isRemedyItem: true,
        })),
        isRemedy: true
    };

    renderTestView();
}

function findReadingForWord(page, answer, answerId) {
    if (!page.vocabulary) return '';
    const match = page.vocabulary.find(v => v.id === answerId || v.word === answer);
    return match ? match.reading || '' : '';
}

function renderTestView() {
    const page = state.test.page;
    const questions = state.test.questions;

    // スティッキー語群のレンダリング
    renderStickyWordBank(page);

    // 問題リストのレンダリング（通常 vs ペア vs 同音・同訓セット）
    const pageNumStr = String(page.source?.page || '');
    const pageNum = parseInt(pageNumStr.replace(/\D/g, '')) || 0;
    const isPaired = (page.layout_type === 'paired') ||
                     (page.title && (page.title.includes('対で覚える') || page.title.includes('対になる')));
    const isHomonym = (page.layout_type === 'homonym') ||
                      (pageNum >= 161 && pageNum <= 166) ||
                      (page.title && (page.title.includes('同音異義') || page.title.includes('同訓異字')));

    if (isHomonym && questions.length >= 2) {
        renderHomonymQuestions(questions, page);
    } else if (isPaired && questions.length >= 2) {
        renderPairedQuestions(questions);
    } else {
        renderNormalQuestions(questions);
    }

    // 画面切り替え
    els.builder.classList.add('hidden');
    els.questionSection.classList.remove('hidden');
    els.uploadSection.classList.remove('hidden');
    els.resultSection.classList.add('hidden');

    state.images = [];
    renderImages();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStickyWordBank(page) {
    let vocabList = [];
    if (Array.isArray(page.vocabulary)) {
        if (Array.isArray(page.word_bank_order) && page.word_bank_order.length > 0) {
            const map = new Map(page.vocabulary.map(v => [v.id, v]));
            vocabList = page.word_bank_order.map(id => map.get(id)).filter(Boolean);
            page.vocabulary.forEach(v => { if (!vocabList.includes(v)) vocabList.push(v); });
        } else {
            vocabList = page.vocabulary;
        }
    }

    els.wordBankCount.textContent = `${vocabList.length}語`;
    els.wordBankChips.innerHTML = vocabList.map(v => {
        const readingHtml = v.reading ? `<span class="ruby-text">${escapeHtml(v.reading)}</span>` : '';
        return `<button type="button" class="word-chip" data-word-id="${escapeHtml(v.id || v.word)}" data-word="${escapeHtml(v.word)}">
            ${readingHtml}
            <span>${escapeHtml(v.word)}</span>
        </button>`;
    }).join('');

    els.wordBankChips.querySelectorAll('.word-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('used');
        });
    });

    state.showRuby = false;
    els.stickyWordBank.classList.remove('show-ruby');
    els.toggleRubyBtn.textContent = 'ルビ: OFF';
    els.toggleRubyBtn.classList.remove('active');

    state.isBankCollapsed = false;
    els.stickyWordBank.classList.remove('collapsed');
    els.collapseBankBtn.textContent = '折りたたむ ▲';
}

function toggleRuby() {
    state.showRuby = !state.showRuby;
    els.stickyWordBank.classList.toggle('show-ruby', state.showRuby);
    els.toggleRubyBtn.textContent = state.showRuby ? 'ルビ: ON' : 'ルビ: OFF';
    els.toggleRubyBtn.classList.toggle('active', state.showRuby);
}

function resetWordChips() {
    els.wordBankChips.querySelectorAll('.word-chip').forEach(chip => {
        chip.classList.remove('used');
    });
}

function toggleCollapseWordBank() {
    state.isBankCollapsed = !state.isBankCollapsed;
    els.stickyWordBank.classList.toggle('collapsed', state.isBankCollapsed);
    els.collapseBankBtn.textContent = state.isBankCollapsed ? '展開 ▼' : '折りたたむ ▲';
}

function renderNormalQuestions(questions) {
    els.questionList.innerHTML = questions.map(q => {
        const sentenceHtml = formatClozeSentence(q.clozeSentence, q.ruby);
        return `<div class="vocab-question-card">
            <div class="vocab-q-header">
                <span class="vocab-q-num">${q.number}</span>
            </div>
            <div class="vocab-sentence">${sentenceHtml}</div>
        </div>`;
    }).join('');
}

function renderPairedQuestions(questions) {
    const pairs = [];
    for (let i = 0; i < questions.length; i += 2) {
        pairs.push({
            pairNum: Math.floor(i / 2) + 1,
            q1: questions[i],
            q2: questions[i + 1] || null
        });
    }

    els.questionList.innerHTML = pairs.map(p => {
        const q1Html = `<div class="paired-item">
            <span class="vocab-q-num">${p.q1.number}</span>
            <span class="vocab-sentence">${formatClozeSentence(p.q1.clozeSentence, p.q1.ruby)}</span>
        </div>`;

        const q2Html = p.q2 ? `<div class="paired-item">
            <span class="vocab-q-num">${p.q2.number}</span>
            <span class="vocab-sentence">${formatClozeSentence(p.q2.clozeSentence, p.q2.ruby)}</span>
        </div>` : '';

        return `<div class="paired-group-card">
            <div class="paired-group-header">
                <span>↔ 対比・対になる語 (第${p.pairNum}組: ${p.q1.number}${p.q2 ? ` & ${p.q2.number}` : ''})</span>
            </div>
            ${q1Html}
            ${q2Html}
        </div>`;
    }).join('');
}

function renderHomonymQuestions(questions, page) {
    // 読みごとに全体から集約してグループ化（シャッフルされても必ず組になるようにする）
    const groupMap = new Map();

    questions.forEach(q => {
        const reading = findReadingForWord(page, q.answer, q.answerId) || (q.ruby && q.ruby[0] && q.ruby[0].rt) || '';
        // 読みが取得できない場合は一意のキーにする
        const key = reading ? reading : `unknown-${q.id}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, { reading: reading, questions: [] });
        }
        groupMap.get(key).questions.push(q);
    });

    const groups = Array.from(groupMap.values());

    // 各グループ内の問題番号を昇順にソート（シャッフル時でもセット内は番号順に見やすくする）
    groups.forEach(g => {
        g.questions.sort((a, b) => a.number - b.number);
    });

    const isHomophone = page.title && page.title.includes('同音異義');
    const isHeterograph = page.title && page.title.includes('同訓異字');
    const typeName = isHomophone ? '同音異義語' : (isHeterograph ? '同訓異字' : '同音・同訓');

    els.questionList.innerHTML = groups.map((g, gIdx) => {
        const qNums = g.questions.map(q => q.number);
        const numRange = qNums.length > 1 ? `${qNums[0]} 〜 ${qNums[qNums.length - 1]}` : `${qNums[0]}`;
        const readingBadge = g.reading ? `<span class="homonym-reading-badge">読み: 「${escapeHtml(g.reading)}」</span>` : '';

        const itemsHtml = g.questions.map(q => {
            const sentenceHtml = formatClozeSentence(q.clozeSentence, q.ruby);
            return `<div class="homonym-item">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <span class="vocab-q-num">${q.number}</span>
                    <span class="vocab-sentence">${sentenceHtml}</span>
                </div>
            </div>`;
        }).join('');

        return `<div class="homonym-group-card">
            <div class="homonym-group-header">
                <div class="homonym-group-title">
                    <span>🔷 ${typeName}セット (第${gIdx + 1}組: Q${numRange})</span>
                </div>
                ${readingBadge}
            </div>
            ${itemsHtml}
        </div>`;
    }).join('');
}

function formatClozeSentence(clozeSentence, rubyList) {
    if (!clozeSentence) return '';
    let text = escapeHtml(clozeSentence);

    // 空欄トークンの置換
    text = text.replace(/\{\{blank\}\}/g, '<span class="vocab-blank">〔　　〕</span>');
    text = text.replace(/\[\[([\s\S]*?)\]\]/g, '<mark>$1</mark>');

    // ルビの適用
    if (Array.isArray(rubyList) && rubyList.length > 0) {
        rubyList.forEach(r => {
            if (r.text && r.reading) {
                const escapedText = escapeHtml(r.text);
                const escapedReading = escapeHtml(r.reading);
                const rubyTag = `<ruby>${escapedText}<rt>${escapedReading}</rt></ruby>`;
                text = text.split(escapedText).join(rubyTag);
            }
        });
    }

    return text.replace(/\n/g, '<br>');
}

function recreateCurrentTest() {
    els.questionSection.classList.add('hidden');
    els.uploadSection.classList.add('hidden');
    els.resultSection.classList.add('hidden');
    els.builder.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForNextTest() {
    if (state.currentPageIndex < state.pages.length - 1) {
        state.currentPageIndex++;
        els.pageSelect.value = state.currentPageIndex;
        updatePageMeta();
    }
    recreateCurrentTest();
}

async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        els.cameraInput.click();
        return;
    }
    try {
        if (state.cameraStream) stopStream();
        state.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: state.facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        els.cameraVideo.srcObject = state.cameraStream;
        els.cameraModal.classList.remove('hidden');
    } catch (error) {
        console.warn('Camera fallback:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('📷 カメラへのアクセスが許可されていません。\n\n【カメラの許可方法】\n・iPad / iPhone: アドレスバー左の「ぁあ(AA)」→「Webサイトの設定」→「カメラ」を【許可】にする（または端末の【設定】→【Safari】→【カメラ】）\n・Android / PC: アドレスバー左の鍵アイコン→「権限」→「カメラ」を【許可】にする\n\n※このまま「写真ライブラリ（アルバム）」から写真を選んで提出することもできます。');
        }
        els.cameraInput.click();
    }
}

function closeCamera() {
    els.cameraModal.classList.add('hidden');
    stopStream();
}

function stopStream() {
    if (state.cameraStream) state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
    els.cameraVideo.srcObject = null;
}

async function switchCamera() {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    await openCamera();
}

function takePhoto() {
    const video = els.cameraVideo;
    if (!video.videoWidth) return;
    const canvas = els.cameraCanvas;
    const size = fitSize(video.videoWidth, video.videoHeight, 1600);
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d').drawImage(video, 0, 0, size.width, size.height);
    addImageDataUrl(canvas.toDataURL('image/jpeg', 0.8));
    closeCamera();
}

async function handleFileInput(event) {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
        try {
            addImageDataUrl(await resizeImageFile(file));
        } catch (error) {
            console.error(error);
            alert('画像を読み込めませんでした。');
        }
    }
    event.target.value = '';
}

function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const image = new Image();
            image.onerror = reject;
            image.onload = () => {
                const size = fitSize(image.width, image.height, 1600);
                const canvas = document.createElement('canvas');
                canvas.width = size.width;
                canvas.height = size.height;
                canvas.getContext('2d').drawImage(image, 0, 0, size.width, size.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function fitSize(width, height, maxWidth) {
    if (width <= maxWidth) return { width, height };
    return { width: maxWidth, height: Math.round(height * maxWidth / width) };
}

function addImageDataUrl(dataUrl) {
    const comma = dataUrl.indexOf(',');
    state.images.push({ mimeType: 'image/jpeg', data: dataUrl.slice(comma + 1), preview: dataUrl });
    renderImages();
}

function renderImages() {
    els.previewList.innerHTML = state.images.map((image, index) =>
        `<div class="image-preview-item">
            <img src="${image.preview}" alt="答案 ${index + 1}">
            <button type="button" data-remove-image="${index}" aria-label="削除">×</button>
        </div>`
    ).join('');

    els.previewList.querySelectorAll('[data-remove-image]').forEach(button => {
        button.addEventListener('click', () => {
            state.images.splice(Number(button.dataset.removeImage), 1);
            renderImages();
        });
    });

    const hasImages = state.images.length > 0;
    els.previewContainer.classList.toggle('hidden', !hasImages);
    els.evaluate.classList.toggle('hidden', !hasImages);
    els.upload.textContent = hasImages ? '別の写真を追加する' : '解答を撮影・追加する';
}

function clearImages() {
    state.images = [];
    renderImages();
}

async function evaluateAnswer() {
    if (!state.test || !state.images.length) return;

    const answerKey = state.test.questions.map(q =>
        `${q.number}. 正答「${q.answer}」${q.reading ? ` (読み: ${q.reading})` : ''}\n文: ${q.sentence || q.clozeSentence}`
    ).join('\n\n');

    const prompt = `あなたは高校国語・現代文の語彙テストの厳格な採点官です。
生徒はノートや解答用紙に問題番号（1〜${state.test.questions.length}）とともに【単語（漢字・カタカナ語）のみ】を手書きしています。
答案画像を正確に読み取り、下の問題番号と正答表に一問ずつ厳密に照合して採点してください。

【採点基準（極めて厳格に判定してください）】
1. 生徒が書いた単語が、正答と「完全一致」している場合のみ ○（正解）とします。
2. 正答と異なる単語（他の問題の単語など）、誤字・脱字（トメ・ハネ・部首違い）、読みがな（ひらがな）での記入、空欄・未記入は、すべて例外なく【 ×（不正解）】と判定してください。
3. 全${state.test.questions.length}問すべてについて判定を出力してください。
4. 正解数（○の数）を正確にカウントし、[得点] に「正解数/${state.test.questions.length}」と記載してください。
5. 83%以上の正解（12問中10問以上）で合格、それ未満（9問以下）はすべて「再チャレンジ」です。

【問題と正答表】
${answerKey}

【最重要ルール: 単語の重複使用の禁止】
- 語群の単語は1問につき1度しか使えません。
- 答案内で同じ単語が2箇所以上で重複回答されている場合は、通常採点を中止し、[判定] 再提出（単語の重複使用あり） / [得点] 0/${state.test.questions.length} としてください。

【出力フォーマット】
[判定]
合格 または 再チャレンジ
[得点]
正解数/${state.test.questions.length}
[詳細]
1. ○ 読み取り「（生徒が書いた文字）」 / 正答「（正答単語）」
2. × 読み取り「（生徒が書いた文字）」 / 正答「（正答単語）」
（全番号を必ず出力。×の理由や誤字の指摘があれば簡潔に追記）
[ひとこと]
アドバイスや励ましのコメント。`;

    setGradingState(true);
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                apiKey: 'server',
                isStudentApp: true,
                subject: 'other',
                model: 'gemini-3.7-flash',
                userPrompt: prompt,
                images: { student: state.images.map(({ mimeType, data }) => ({ mimeType, data })) }
            }),
        });

        if (!response.ok) throw new Error(`採点サーバー HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const text = getAiText(data);
        console.log('AI Grading Raw Output:\n', text);
        const result = displayResult(text);

        if (result.isResubmit) {
            saveHistory(text, result);
            els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const wrongAnswers = extractWrongAnswers(text);

        if (state.test.isRemedy) {
            const wrongWordIds = new Set(wrongAnswers.map(w => w.wordId || w.word));
            const masteredWords = state.test.questions
                .filter(q => !wrongWordIds.has(q.id) && !wrongWordIds.has(q.answer))
                .map(q => q.id || q.answer);

            masterRemedyWords(masteredWords);
            if (wrongAnswers.length > 0) recordWrongAnswersToRemedy(wrongAnswers);
        } else {
            if (result.passed) {
                markPageCompleted(state.test.page.id || `page_${state.test.page.source?.page}`);
            }
            if (wrongAnswers.length > 0) {
                recordWrongAnswersToRemedy(wrongAnswers);
            }
        }

        saveHistory(text, result);
        updateProgressDisplay();
        updateRemedyCount();
        populatePageSelect();

        syncProgressToGas(result, wrongAnswers);

        els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error(error);
        alert(`採点できませんでした。通信状態を確認してもう一度お試しください。\n${error.message}`);
    } finally {
        setGradingState(false);
    }
}

function setGradingState(active) {
    els.loading.classList.toggle('hidden', !active);
    els.evaluate.disabled = active;
    if (active) els.resultSection.classList.add('hidden');
}

function getAiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(part => part.text || '').join('').trim();
    if (!text) throw new Error(data?.candidates?.[0]?.finishReason ? `AI応答: ${data.candidates[0].finishReason}` : '採点結果が空でした');
    return text;
}

function displayResult(text) {
    // 単語の重複使用や再提出の判定
    const isResubmit = text.includes('再提出') || text.includes('重複使用') || text.includes('重複回答') || text.includes('同じ単語が複数');
    
    // フロントエンド側の読み取り単語重複チェック（二重判定）
    const studentWords = [];
    const detailLines = text.split('\n');
    detailLines.forEach(line => {
        const m = line.match(/^\d+\.\s*[○◯●◎✓×✕✖xX✗]?\s*読み取り[「『]([^」』]+)[」』]/);
        if (m) {
            const w = m[1].trim();
            if (w && w !== '未記入' && w !== '空欄' && w !== '判読不能' && w !== '無記入') {
                studentWords.push(w);
            }
        }
    });

    const duplicates = studentWords.filter((w, idx) => studentWords.indexOf(w) !== idx);
    const hasFrontEndDuplicates = duplicates.length > 0;

    if (isResubmit || hasFrontEndDuplicates) {
        els.resultBadge.className = 'result-badge retry';
        els.resultBadge.textContent = '再提出';
        els.resultScore.textContent = 'ノーカウント';

        const dupWordName = duplicates.length > 0 ? `「${[...new Set(duplicates)].join('」「')}」` : '';
        const details = text.replace(/\[判定\][\s\S]*?(?=\[得点\]|\[詳細\]|$)/, '').replace(/\[得点\][\s\S]*?(?=\[詳細\]|$)/, '').trim();
        els.resultContent.innerHTML = sanitizeHtml(marked.parse(details || text, { breaks: true }));

        const warningCard = document.createElement('div');
        warningCard.className = 'challenge-result locked';
        warningCard.style.border = '2px solid #f59e0b';
        warningCard.style.background = '#fffbeb';
        warningCard.style.color = '#b45309';
        warningCard.style.padding = '14px 16px';
        warningCard.style.borderRadius = '12px';
        warningCard.style.marginBottom = '16px';
        warningCard.innerHTML = `
            <strong style="font-size: 1.05rem; display: flex; align-items: center; gap: 6px;">⚠️ 単語が重複して使われています（ノーカウント）</strong>
            <span style="font-size: 0.9rem; line-height: 1.6; margin-top: 4px; display: block;">
                ${dupWordName ? `同じ単語 ${dupWordName} が2回以上使用されています。<br>` : ''}
                語群の単語は<strong>1問につき1度しか使えません</strong>。語群の消し込み機能などを活用し、すべて異なる単語を当てはめて再度撮影・提出してください。
            </span>
        `;
        els.resultContent.prepend(warningCard);
        els.resultSection.classList.remove('hidden');
        els.newTest.textContent = 'もう一度撮影する';

        return { correct: 0, total: state.test.questions.length, passed: false, isResubmit: true };
    }

    const totalQuestions = state.test?.questions?.length || 12;
    const lines = text.split('\n');
    let verifiedCorrectCount = 0;
    let verifiedWrongCount = 0;

    // 各問の判定と読み取り単語の二重検証
    lines.forEach(line => {
        const trimmed = line.trim();
        const detailMatch = trimmed.match(/^(\d+)\.\s*([○◯●◎✓×✕✖xX✗])?\s*(?:読み取り[「『]([^」』]*)[」』])?\s*(?:\/\s*正答[「『]([^」』]*)[」』])?/);
        if (detailMatch) {
            const mark = detailMatch[2] || '';
            const readWord = (detailMatch[3] || '').trim();
            const answerWord = (detailMatch[4] || '').trim();

            const isMarkCircle = /[○◯●◎✓]/.test(mark);
            const isMarkCross = /[×✕✖xX✗]/.test(mark);

            // 読み取りと正答が取得できている場合の一致検証
            if (readWord && answerWord) {
                if (readWord === answerWord && isMarkCircle) {
                    verifiedCorrectCount++;
                } else {
                    verifiedWrongCount++;
                }
            } else if (isMarkCircle) {
                verifiedCorrectCount++;
            } else if (isMarkCross) {
                verifiedWrongCount++;
            }
        }
    });

    const scoreMatch = text.match(/\[得点\]\s*\n?\s*(\d+)\s*\/\s*(\d+)/) || text.match(/(\d+)\s*問中\s*(\d+)\s*問正解/);
    let correct = null;
    let total = totalQuestions;

    if (verifiedCorrectCount > 0 || verifiedWrongCount > 0) {
        correct = verifiedCorrectCount;
        total = (verifiedCorrectCount + verifiedWrongCount) >= totalQuestions ? (verifiedCorrectCount + verifiedWrongCount) : totalQuestions;
    } else if (scoreMatch) {
        if (text.match(/問中/)) {
            total = Number(scoreMatch[1]);
            correct = Number(scoreMatch[2]);
        } else {
            correct = Number(scoreMatch[1]);
            total = Number(scoreMatch[2]);
        }
    }

    if (correct === null) {
        correct = 0;
    }

    const judgementMatch = (text.match(/\[判定\]\s*\n?([^\n]+)/) || [])[1] || '';
    const passThreshold = Math.ceil(total * PASS_RATE); // 12問中10問以上で合格 (83%)
    const passed = (correct >= passThreshold) && !judgementMatch.includes('再チャレンジ') && !judgementMatch.includes('不合格') && !judgementMatch.includes('再提出');

    els.resultBadge.className = `result-badge ${passed ? 'pass' : 'retry'}`;
    els.resultBadge.textContent = passed ? '合格' : '再チャレンジ';
    els.resultScore.textContent = `${correct} / ${total}`;

    const details = text.replace(/\[判定\][\s\S]*?(?=\[得点\]|\[詳細\]|$)/, '').replace(/\[得点\][\s\S]*?(?=\[詳細\]|$)/, '').trim();
    els.resultContent.innerHTML = sanitizeHtml(marked.parse(details || text, { breaks: true }));
    els.resultSection.classList.remove('hidden');
    els.newTest.textContent = passed ? '次のテストへ進む' : 'もう一度解く';

    return { correct, total, passed, isResubmit: false };
}

function extractWrongAnswers(text) {
    const wrong = [];
    const lines = text.split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();
        const detailMatch = trimmed.match(/^(\d+)\.\s*([○◯●◎✓×✕✖xX✗])?\s*(?:読み取り[「『]([^」』]*)[」』])?\s*(?:\/\s*正答[「『]([^」』]*)[」』])?(.*)$/);
        if (detailMatch) {
            const num = Number(detailMatch[1]);
            const mark = detailMatch[2] || '';
            const readWord = (detailMatch[3] || '').trim();
            const answerWord = (detailMatch[4] || '').trim();
            const extra = (detailMatch[5] || '').trim();

            const isMarkCircle = /[○◯●◎✓]/.test(mark);
            const isMarkCross = /[×✕✖xX✗]/.test(mark);

            let isWrong = false;
            if (isMarkCross) {
                isWrong = true;
            } else if (readWord && answerWord && readWord !== answerWord) {
                isWrong = true;
            } else if (!isMarkCircle && !readWord) {
                isWrong = true;
            }

            if (isWrong) {
                const q = state.test?.questions?.find(item => item.number === num);
                if (q) {
                    wrong.push({
                        wordId: q.id || `No.${q.number || num}`,
                        number: q.number || num,
                        word: q.answer,
                        reading: q.reading || '',
                        sentence: q.sentence || q.clozeSentence || '',
                        clozeSentence: q.clozeSentence || q.sentence || '',
                        studentAnswer: readWord || '未記入',
                        feedback: extra || (readWord ? `「${readWord}」と解答` : '')
                    });
                }
            }
        }
    });
    return wrong;
}

function getCompletedPages() {
    try {
        return JSON.parse(localStorage.getItem(COMPLETED_PAGES_KEY) || '[]');
    } catch {
        return [];
    }
}

function markPageCompleted(pageId) {
    if (!pageId) return;
    const completed = getCompletedPages();
    if (!completed.includes(pageId)) {
        completed.push(pageId);
        localStorage.setItem(COMPLETED_PAGES_KEY, JSON.stringify(completed));
    }
}

function updateProgressDisplay() {
    const completed = getCompletedPages();
    const total = state.pages.length;
    const count = completed.length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;

    els.challengeProgress.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong>学習進捗: ${count} / ${total} テスト クリア</strong>
            <span style="font-weight: 800; font-size: 0.9rem;">${percent}%</span>
        </div>
        <div style="width: 100%; height: 8px; background: #cbd5e1; border-radius: 999px; overflow: hidden;">
            <div style="width: ${percent}%; height: 100%; background: var(--primary-color); border-radius: 999px; transition: width 0.4s ease;"></div>
        </div>
    `;
    updateLearnerRank();
}

function getRemedyData() {
    try {
        return JSON.parse(localStorage.getItem(REMEDY_STORAGE_PREFIX + (state.studentId || 'default')) || '{}');
    } catch {
        return {};
    }
}

function saveRemedyData(data) {
    localStorage.setItem(REMEDY_STORAGE_PREFIX + (state.studentId || 'default'), JSON.stringify(data));
}

function recordWrongAnswersToRemedy(wrongItems) {
    const data = getRemedyData();
    wrongItems.forEach(item => {
        const id = item.wordId || item.word;
        if (!id) return;
        if (!data[id]) {
            data[id] = {
                wordId: id,
                word: item.word,
                reading: item.reading || '',
                sentence: item.sentence || '',
                clozeSentence: item.clozeSentence || '',
                missCount: 0,
                mastered: false,
                lastMissedAt: new Date().toISOString()
            };
        }
        data[id].missCount = (data[id].missCount || 0) + 1;
        data[id].mastered = false;
        data[id].lastMissedAt = new Date().toISOString();
    });
    saveRemedyData(data);
}

function masterRemedyWords(masteredIds) {
    if (!masteredIds || !masteredIds.length) return;
    const data = getRemedyData();
    masteredIds.forEach(id => {
        if (data[id]) {
            data[id].mastered = true;
            data[id].masteredAt = new Date().toISOString();
        }
    });
    saveRemedyData(data);
}

function getActiveRemedyWords() {
    const data = getRemedyData();
    return Object.values(data).filter(item => !item.mastered);
}

function updateRemedyCount() {
    const active = getActiveRemedyWords();
    els.remedyCountLabel.textContent = `要復習: ${active.length}語`;
    els.remedyControls.classList.toggle('hidden', active.length === 0);
}

function saveHistory(text, result) {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history.unshift({
            date: new Date().toLocaleString('ja-JP'),
            title: state.test?.page?.title || '語彙テスト',
            page: state.test?.page?.source?.page || '',
            score: `${result.correct || 0} / ${result.total || 0}`,
            passed: result.passed,
            details: text
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
    } catch (e) {
        console.warn('History save failed:', e);
    }
}

function showHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (!history.length) {
            els.historyList.innerHTML = '<p class="history-empty">まだ採点履歴がありません。</p>';
        } else {
            els.historyList.innerHTML = history.map(item => `
                <div class="history-item">
                    <div>
                        <span class="badge ${item.passed ? 'page-badge' : 'grade-badge'}">${item.passed ? '合格' : '再挑戦'}</span>
                        <strong>${escapeHtml(item.title)} ${item.page ? `(p.${item.page})` : ''}</strong>
                    </div>
                    <p>得点: ${escapeHtml(item.score)}</p>
                    <time>${escapeHtml(item.date)}</time>
                </div>
            `).join('');
        }
        els.historySection.classList.remove('hidden');
        els.historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        console.warn(e);
    }
}

async function saveResultImage() {
    const btn = els.screenshot;
    if (!els.resultSection || els.resultSection.classList.contains('hidden')) {
        alert('保存する採点結果がありません。');
        return;
    }

    if (typeof html2canvas === 'undefined') {
        alert('画像生成ライブラリを読み込み中です。少し待ってから再度お試しください。');
        return;
    }

    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '📸 画像を生成中…';
    }

    try {
        const target = els.resultSection;
        const studentInfo = (state.studentName || state.studentId || '生徒').replace(/[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff_-]/g, '_');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const fileName = `語彙採点結果_${studentInfo}_${dateStr}.png`;

        const canvas = await html2canvas(target, {
            scale: Math.min(2, window.devicePixelRatio || 2),
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            ignoreElements: el => el.classList.contains('screenshot-exclude') || el.id === 'screenshot-btn' || el.id === 'new-test-btn'
        });

        // 1. スマホの Web Share API (画像直接保存 / LINE共有等) を優先
        if (navigator.share && navigator.canShare) {
            try {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
                if (blob) {
                    const file = new File([blob], fileName, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: '語彙テスト採点結果',
                            text: `${state.studentName || '生徒'}さんの語彙テスト採点結果です。`
                        });
                        return;
                    }
                }
            } catch (shareErr) {
                if (shareErr.name === 'AbortError') return;
                console.warn('Web Share API error, falling back to download:', shareErr);
            }
        }

        // 2. PC / Web Share 非対応環境: ダウンロードリンクをトリガー
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('画像保存エラー:', error);
        alert('画像の保存に失敗しました。画面のスクリーンショット機能もお試しください。');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

function formatStudentId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return /^\d+$/.test(raw) ? raw.padStart(4, '0') : raw;
}

function getTotalQuestionsCount() {
    return state.pages.reduce((sum, p) => sum + (p.questions ? p.questions.length : 0), 0);
}

function getMasteredQuestionsCount() {
    const completedPageIds = getCompletedPages();
    let count = 0;
    state.pages.forEach(p => {
        const pageId = p.id || `page_${p.source?.page}`;
        if (completedPageIds.includes(pageId)) {
            count += (p.questions ? p.questions.length : 0);
        }
    });
    return count;
}

function getLearnerRank(rate) {
    if (rate >= 95) return { name: 'マスター 👑', className: 'rank-master' };
    if (rate >= 85) return { name: 'プロフェッショナル', className: 'rank-professional' };
    if (rate >= 70) return { name: 'エキスパート', className: 'rank-expert' };
    if (rate >= 50) return { name: 'スペシャリスト', className: 'rank-specialist' };
    if (rate >= 30) return { name: 'ルーキー', className: 'rank-rookie' };
    if (rate >= 15) return { name: 'ノービス', className: 'rank-novice' };
    return { name: 'ビギナー', className: 'rank-beginner' };
}

function updateLearnerRank() {
    if (!els.learnerRank) return;
    const total = getTotalQuestionsCount();
    const mastered = getMasteredQuestionsCount();
    const rate = total > 0 ? (mastered / total) * 100 : 0;
    const rank = getLearnerRank(rate);
    els.learnerRank.textContent = rank.name;
    els.learnerRank.className = `learner-rank ${rank.className}`;
    els.learnerRank.title = `達成率: ${Math.round(rate)}% (${mastered}/${total}問)`;
}

function updateStudentDisplay() {
    els.displayStudent.textContent = state.studentName ? `${state.studentId || 'NoID'} ${state.studentName}` : '未設定';
    updateLearnerRank();
}

function saveSetup() {
    const id = formatStudentId(els.studentId.value);
    const name = els.studentName.value.trim();
    if (!id || !name) return alert('生徒番号と氏名を入力してください。');
    state.studentId = id;
    state.studentName = name;
    localStorage.setItem('student_id', id);
    localStorage.setItem('student_name', name);
    els.studentId.value = id;
    updateStudentDisplay();
    els.setupModal.classList.add('hidden');
    updateRemedyCount();
}

function resetAllStudentData() {
    const ok = confirm('⚠️ この端末に保存されている生徒情報・学習進捗・採点履歴・苦手リストをすべて初期化しますか？\n（最初からやり直すことができます）');
    if (!ok) return;

    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.startsWith('clear_maker_2d_') ||
                key === 'student_id' ||
                key === 'student_name'
            )) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        state.studentId = '';
        state.studentName = '';
        state.test = null;
        if (els.studentId) els.studentId.value = '';
        if (els.studentName) els.studentName.value = '';

        alert('端末の学習データを初期化しました。');
        location.reload();
    } catch (err) {
        console.error('Reset failed:', err);
        alert('初期化中にエラーが発生しました。ブラウザのサイトデータを消去してください。');
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeHtml(html) {
    return String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

async function syncProgressToGas(result, wrongAnswers) {
    if (!state.studentId) return;
    try {
        const pageNum = state.test?.page?.source?.page || (state.test?.pageIndex + 1) || 0;
        const total = getTotalQuestionsCount();
        const mastered = getMasteredQuestionsCount();
        const rate = total > 0 ? (mastered / total) * 100 : 0;
        const rank = getLearnerRank(rate);

        // 1. テスト得点・合否・進捗保存
        fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'saveVocabularyProgress',
                studentId: state.studentId,
                studentName: state.studentName,
                testRange: `p.${pageNum}`,
                correct: result.correct || 0,
                total: result.total || state.test?.questions?.length || 12,
                score: `${result.correct || 0} / ${result.total || state.test?.questions?.length || 12}`,
                passed: result.passed ? '合格' : '再チャレンジ',
                clearedThrough: mastered,
                rank: rank.name
            })
        }).catch(err => console.warn('Progress sync error:', err));

        // 2. 不正解ログ送信
        if (wrongAnswers && wrongAnswers.length > 0) {
            fetch(GAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'saveVocabularyWrongAnswers',
                    studentId: state.studentId,
                    studentName: state.studentName,
                    range: `p.${pageNum}`,
                    wrongAnswers: wrongAnswers.map(w => ({
                        targetNumber: w.wordId || w.word,
                        word: w.word,
                        questionText: w.sentence || w.clozeSentence || '',
                        studentAnswer: w.studentAnswer || '',
                        feedback: w.feedback || ''
                    }))
                })
            }).catch(err => console.warn('Wrong answer sync error:', err));
        }
    } catch (e) {
        console.warn('Sync error:', e);
    }
}
