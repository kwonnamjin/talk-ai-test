// 🌟 1. 전역 변수 초기화
const WORKER_URL = "https://talkaitest.thin770.workers.dev/";

let isListening = false, isSpeaking = false, recognition = null;
const synthesis = window.speechSynthesis;
let conversationHistory = JSON.parse(sessionStorage.getItem('llmHistory')) || []; 
let uiChatHistory = JSON.parse(sessionStorage.getItem('uiHistory')) || []; 
let bubbleCounter = parseInt(sessionStorage.getItem('bubbleCounter')) || 0; 

let currentUtterance = null; 
let currentVoiceGender = localStorage.getItem('voice_gender') || 'female';
let tempGender = currentVoiceGender; 

let currentBubbleId = null, startIndex = -1, endIndex = -1, myDeviceId = "unknown";

const micBtn = document.getElementById('micBtn'), micIcon = document.getElementById('micIcon');
const statusText = document.getElementById('statusText'), chatContainer = document.getElementById('chatContainer');
const avatarWrap = document.getElementById('avatarWrap'), stopAudioBtn = document.getElementById('stopAudioBtn');
const selectionTooltip = document.getElementById('selectionTooltip');

localStorage.removeItem('is_test_mode');
// script.js 파일 가장 상단에 추가
window.getAppLang = function() {
    // 여기서 현재 앱의 언어 설정을 반환하도록 만드세요.
    // 예: localStorage에 저장된 값을 가져오거나 기본값 반환
    return localStorage.getItem('appLang') || 'ko';
};
// ==========================================
// 💖 AI 친밀도 & 감성 시스템 모듈
// ==========================================
const INTIMACY_SYSTEM = {
    levels: {
        1: { name: "어색하지만 설렘", minExp: 0, aiMind: "어떤 분일까? 대화하는 게 설레고 긴장돼요. 😳" },
        2: { name: "조금 더 알고 싶어요", minExp: 100, aiMind: "당신에 대해 더 많은 걸 알고 싶어졌어요. 🤔" },
        3: { name: "이제 우리 친구해요", minExp: 500, aiMind: "이제 우리 제법 친해진 것 같아 기뻐요! 😊" },
        4: { name: "없으면 허전한 단짝", minExp: 2500, aiMind: "당신과 대화하지 않으면 하루가 허전해요. 🥹" },
        5: { name: "마음을 아는 소울메이트", minExp: 10000, aiMind: "말하지 않아도 당신의 마음을 알 것 같아요. 늘 응원해요. ❤️" }
    },
    
    // 데이터 불러오기 및 🚨 '서운함(결석)' 체크
    getData: function() {
        let data = JSON.parse(localStorage.getItem('ai_intimacy_data') || '{"level": 1, "exp": 0, "lastDate": ""}');
        const today = new Date().toLocaleDateString();

        // 과거 접속 기록이 있고, 오늘이 아닌 경우
        if (data.lastDate && data.lastDate !== today) {
            const lastDateObj = new Date(data.lastDate);
            const todayObj = new Date(today);
            const diffDays = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

            // 이틀 이상 접속하지 않았다면 (연속 출석이 끊김) -> 경험치 하락 없음!
            if (diffDays > 1) {
                // 서운함 플래그 ON 
                localStorage.setItem('ai_is_sulking', 'true');
            }
        }
        
        // 접속일 갱신 후 저장
        data.lastDate = today;
        localStorage.setItem('ai_intimacy_data', JSON.stringify(data));
        
        return data;
    },

    // 경험치 획득 및 레벨업 계산
    addExp: function(type) {
        let data = this.getData();
        const gainedExp = (type === 'quest') ? 20 : 1; 
        data.exp += gainedExp;

        let newLevel = data.level;
        // 다음 레벨 경험치 도달 여부 체크 (최대 5레벨)
        if (newLevel < 5 && data.exp >= this.levels[newLevel + 1].minExp) {
            newLevel++;
            data.level = newLevel;
            
            // 💡 레벨업 축하 알림 (기존 팝업/토스트 활용 가능)
            if(typeof window.updateStatus === 'function') {
                window.updateStatus(`🎉 친밀도 레벨업! [Lv.${newLevel} ${this.levels[newLevel].name}]`);
            }
        }
        
        localStorage.setItem('ai_intimacy_data', JSON.stringify(data));
        
        // 경험치가 오르면 'AI의 속마음' 화면도 즉시 갱신
        if(typeof window.updateMemoryDisplay === 'function') window.updateMemoryDisplay();
        
        return data;
    },

    // 사용자가 대화를 걸어주면 삐진 마음 풀기
    clearSulking: function() {
        if(localStorage.getItem('ai_is_sulking') === 'true') {
            localStorage.removeItem('ai_is_sulking');
            if(typeof window.updateStatus === 'function') window.updateStatus("AI의 서운한 마음이 사르르 녹았습니다. 🥰");
            if(typeof window.updateMemoryDisplay === 'function') window.updateMemoryDisplay();
        }
    }
};

// [소리 먹통 해결 코드] 화면을 처음 터치할 때 폰의 '소리 차단'을 강제로 뚫어버립니다.
document.addEventListener('touchstart', function() {
    // 아무 소리도 안 나는 투명한 음성을 0.1초 재생해서 폰에게 허락을 받아냄
    var silentUtt = new SpeechSynthesisUtterance('');
    silentUtt.volume = 0;
    window.speechSynthesis.speak(silentUtt);
    console.log("웹뷰 소리 차단 해제 완료!");
}, { once: true }); // 딱 한 번만 실행됨

// ==========================================================
// 🌟 [필수 추가] 모바일/PC 웹 브라우저 AI 목소리 차단 해제 마법사
// ==========================================================
let isTtsUnlocked = false;
function unlockTtsEngine() {
    if (isTtsUnlocked) return;
    // 화면을 처음 터치할 때, 투명한(볼륨 0) 목소리를 재생해 브라우저 허락을 받아냅니다.
    const silentUtt = new SpeechSynthesisUtterance('');
    silentUtt.volume = 0; 
    window.speechSynthesis.speak(silentUtt);
    
    isTtsUnlocked = true;
    console.log("🔊 웹 브라우저 AI 음성 잠금 해제 완료!");
    
    // 한 번 허락받으면 더 이상 실행할 필요 없음
    document.removeEventListener('click', unlockTtsEngine);
    document.removeEventListener('touchstart', unlockTtsEngine);
}
// 사용자가 화면 아무 곳이나 터치/클릭하는 순간 작동!
document.addEventListener('click', unlockTtsEngine);
document.addEventListener('touchstart', unlockTtsEngine);
// ==========================================================


// 🌟 2. 공통 UI 조작 함수
window.handleBodyClick = function(e) {
    if (!e.target.classList.contains('word-span') && !e.target.classList.contains('exp-word-span') && !e.target.closest('#selectionTooltip') && !e.target.closest('button')) {
        if(typeof clearSelection === 'function') clearSelection();
    }
    if (!e.target.closest('#inlineSettingsPanel') && !e.target.closest('button')) {
        document.querySelectorAll('.panel-popup, [id^="drop-"]').forEach(el => el.classList.add('hidden'));
    }
};
// 🌟 기존 togglePanel도 이 함수를 활용하도록 수정
window.togglePanel = function(panelId) {
    ['inlinePagesPanel', 'inlineReportPanel', 'inlineMemoryPanel', 'inlineSparePanel', 'inlineSettingsPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { if (id === panelId) el.classList.toggle('hidden'); else el.classList.add('hidden'); }
    });
};


window.toggleDropdown = function(dropId) {
    // 1. 모든 드롭다운 목록을 순회하며
    ['drop-exp', 'drop-target', 'drop-stt', 'drop-gender'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // 방금 클릭한 게 아니면 무조건 닫음
            if (id !== dropId) {
                el.classList.add('hidden');
            }
        }
    });

    // 2. 내가 클릭한 드롭다운만 열기/닫기 토글
    const targetDrop = document.getElementById(dropId);
    if(targetDrop) {
        targetDrop.classList.toggle('hidden');
        
        // 🌟 추가 팁: 드롭다운이 열릴 때 언어 목록을 최신으로 갱신하는 기능 연결
        if (!targetDrop.classList.contains('hidden')) {
            window.renderLanguageSelects(); 
        }
    }
};


window.changeUILanguage = function(langCode) {
    localStorage.setItem('explanation_language', langCode); // 1. 언어 설정 저장
    const baseLang = langCode.split('-')[0];
    const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};

    // 2. ID 기반 텍스트 변경 (대표님이 올려주신 코드 - 기존 화면 완벽 보호)
    for (const [id, text] of Object.entries(dict)) {
        const element = document.getElementById(id);
        if (element) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = text;
            } else {
                element.innerHTML = text;
            }
        }
    }

    // 3. 🌟 새로 추가된 핵심: data-i18n 속성 번역 (통역기, 보관함 등 모두 해결)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (dict[key]) el.placeholder = dict[key];
    });

    // 4. 배너 및 외부 UI 갱신 (에러 방어 로직 적용)
    if (typeof window.applyBannerTranslation === 'function') window.applyBannerTranslation();
    if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays();
    if (typeof window.updateExtraUI === 'function') window.updateExtraUI();
    
    // 5. 결제 팝업이 켜져 있으면 언어 반영해서 다시 띄우기
    const openModal = document.getElementById('subscriptionModal');
    if (openModal && typeof window.showSubscriptionModal === 'function') {
        window.showSubscriptionModal(openModal.getAttribute('data-reason') || 'upgrade');
    }
    
    console.log("✅ 언어 변경 적용 완료:", langCode);
};

// 🌟 2. 언어 및 UI 디스플레이 업데이트 (에러 방지 완벽 적용)
window.updateLangDisplays = function() {
    // 1. 에러의 주범인 숨겨진 태그 대신, 절대 변하지 않는 로컬 스토리지에서 직접 값을 꺼냅니다.
    const tCode = localStorage.getItem('target_language') || 'en-US';
    const sCode = localStorage.getItem('stt_input_language') || 'ko-KR';
    const eCode = localStorage.getItem('explanation_language') || 'ko-KR';

    const tData = SUPPORTED_LANGUAGES.find(l => l.code === tCode) || SUPPORTED_LANGUAGES[1];
    const sData = SUPPORTED_LANGUAGES.find(l => l.code === sCode) || SUPPORTED_LANGUAGES[0];
    const eData = SUPPORTED_LANGUAGES.find(l => l.code === eCode) || SUPPORTED_LANGUAGES[0];

    // 2. 숨겨진 <select> 태그의 값이 날아갔더라도 강제로 일치시킵니다. (한국어 강제 초기화 완벽 차단)
    const tSel = document.getElementById('targetLanguage'); if(tSel) tSel.value = tCode;
    const sSel = document.getElementById('sttInputLanguage'); if(sSel) sSel.value = sCode;
    const eSel = document.getElementById('explanationLanguage'); if(eSel) eSel.value = eCode;

    // 3. UI 텍스트 업데이트 (상단 및 설정창)
    const dispT = document.getElementById('disp-targetLanguageHome');
    const dispE = document.getElementById('disp-explanationLanguageHome');
    const dispS1 = document.getElementById('disp-sttInputLanguageHome');
    const dispS2 = document.getElementById('disp-sttInputLanguage'); // 프리토킹 마이크 옆 버튼

    if (dispT) dispT.innerHTML = `${tData.flag} ${window.getLangName(tData.code)} <span class="text-[9px] font-black opacity-70 ml-1">(AI)</span>`;
    if (dispE) dispE.innerHTML = `${eData.flag} ${window.getLangName(eData.code)} <span class="text-[9px] font-black opacity-70 ml-1">(UI)</span>`;
    if (dispS1) dispS1.innerHTML = `${sData.flag} ${window.getLangName(sData.code)} <span class="text-[9px] font-black opacity-70 ml-1">(Me)</span>`;
    if (dispS2) dispS2.innerHTML = `${sData.flag} ${window.getLangName(sData.code)}`;

    // 4. 새로 추가한 하단 Swap 버튼 글씨 실시간 업데이트
    const dispSwap = document.getElementById('disp-lang-swap');
    if (dispSwap) {
        dispSwap.innerHTML = `${sData.flag} ${window.getLangName(sData.code)}<span class="text-[9px] text-slate-400 font-bold ml-1">(Me)</span> <i class="fa-solid fa-arrows-rotate mx-1 text-blue-500"></i> ${tData.flag} ${window.getLangName(tData.code)}<span class="text-[9px] text-slate-400 font-bold ml-1">(AI)</span>`;
    }

    // 5. 성별 UI 업데이트 (다국어 유지)
    const savedGender = localStorage.getItem('voice_gender') || 'female';
    const baseLang = eCode.split('-')[0];
    const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY["en"] || {};
    const genderText = savedGender === 'female' ? (dict.gender_f_text || '여성') : (dict.gender_m_text || '남성');
    
    const dispG = document.getElementById('disp-voiceGender');
    if (dispG) dispG.innerHTML = (savedGender === 'female' ? '👩 ' : '👨 ') + genderText;
};

    

window.populateDropdowns = function() {
    const setups = [
        { id: 'drop-exp', target: 'explanationLanguage', tag: '(UI)' },
        { id: 'drop-target', target: 'targetLanguage', tag: '(AI)' },
        { id: 'drop-stt', target: 'sttInputLanguage', tag: '(Me)' }
    ];

    setups.forEach(setup => {
        const container = document.getElementById(setup.id);
        if(!container) return;
        container.innerHTML = '';
        
        SUPPORTED_LANGUAGES.forEach(lang => {
            const btn = document.createElement('button');
            btn.className = "w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 border-b border-slate-50 flex items-center justify-between transition-colors";
            btn.innerHTML = `<div class="flex items-center gap-2"><span class="text-sm">${lang.flag}</span> <span>${window.getLangName(lang.code)}</span></div> <span class="text-[9px] text-slate-400 font-black">${setup.tag}</span>`;
            
            btn.onclick = (e) => {
                e.stopPropagation(); 
                document.getElementById(setup.target).value = lang.code;
                
                if (setup.target === 'explanationLanguage') {
                    localStorage.setItem('explanation_language', lang.code);
                    window.changeUILanguage(lang.code);
                }
                if (setup.target === 'targetLanguage') {
                    localStorage.setItem('target_language', lang.code);
                    
                    // 🌟 언어가 바뀌면 기존 목소리 기억을 싹 지워버립니다.
                    window.selectedTtsVoiceName = "";
                    localStorage.removeItem('saved_voice_name');
                    localStorage.removeItem('selected_voice_name');
                    
                    // UI에 표시되는 이름도 즉시 '기본 음성'으로 바꿔줍니다.
                    if (typeof window.updateVoiceDisplay === 'function') {
                        window.updateVoiceDisplay("기본 음성");
                    }
                    
                    // 🌟 리스트 새로고침
                    window.requestVoicesFromApp(); 

                    // 🌟 [복구된 핵심 코드] 타겟 언어가 바뀌면 기초발음 페이지도 즉시 새로고침!
                    if (typeof window.autoLoadAlphabet === 'function') {
                        window.autoLoadAlphabet();
                    }
                }
                if (setup.target === 'sttInputLanguage') {
                    localStorage.setItem('stt_input_language', lang.code);
                }
                window.refreshAllTranslations();
                
                window.updateLangDisplays();
                window.toggleDropdown(setup.id);
            };
            container.appendChild(btn);
        });
    });
};

window.getLangName = function(code) {
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY["en"];
    return dict["lang_" + code] || SUPPORTED_LANGUAGES.find(l => l.code === code).name;
}

// 🌟 1. 언어 옵션 렌더링 (에러 방지 코드 추가)
window.renderLanguageSelects = function() {
    if (typeof SUPPORTED_LANGUAGES === 'undefined') return; // 데이터가 없으면 중단

    const optionsHtml = SUPPORTED_LANGUAGES.map(lang => `<option value="${lang.code}" data-lang-name="${lang.name}">${lang.flag} ${lang.name}</option>`).join('');
    
    // 요소가 화면에 존재하는지(null이 아닌지) 확인 후 삽입
    const tLang = document.getElementById('targetLanguage');
    const sLang = document.getElementById('sttInputLanguage');
    const eLang = document.getElementById('explanationLanguage');
    
    if (tLang) tLang.innerHTML = optionsHtml;
    if (sLang) sLang.innerHTML = optionsHtml;
    if (eLang) eLang.innerHTML = optionsHtml;
};
        

// 🌟 4. 목소리/성별/모드 설정
window.changeVoiceGender = function(gender) {
    currentVoiceGender = gender;
    localStorage.setItem('voice_gender', gender);
    window.updateLangDisplays();
    window.toggleDropdown('drop-gender');
};

window.changeAppMode = function(mode) {
    const tutorBtn = document.getElementById('modeTutorBtn');
    const translateBtn = document.getElementById('modeTranslateBtn');
    
    // 1. 상태 저장 (한 번만 깔끔하게)
    localStorage.setItem('app_mode', mode);

    if (mode === 'tutor') {
        // 2. 에러 방지용 확인 (if)을 거친 후 버튼 스타일 변경
        if(tutorBtn) tutorBtn.className = "flex-1 py-2 text-[11px] font-black rounded-xl border border-blue-600 bg-blue-600 text-white shadow-md transition-all";
        if(translateBtn) translateBtn.className = "flex-1 py-2 text-[11px] font-black rounded-xl border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all";
        
        // 3. 사용자 안내 메시지 띄우기
        if (typeof window.updateStatus === 'function') window.updateStatus("대화 모드로 전환되었습니다.");
    } else {
        if(translateBtn) translateBtn.className = "flex-1 py-2 text-[11px] font-black rounded-xl border border-blue-600 bg-blue-600 text-white shadow-md transition-all";
        if(tutorBtn) tutorBtn.className = "flex-1 py-2 text-[11px] font-black rounded-xl border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all";
        
        if (typeof window.updateStatus === 'function') window.updateStatus("통번역 모드로 전환되었습니다.");
    }
};

window.updateStatus = function(txt) { 
    const st = document.getElementById('statusText');
    if(st) st.textContent = txt; 
};

// 1. 내부 계산기 (에러 방어막 완벽 적용)
window.checkUsageLimit = function() {
    // 🌟 안전장치 1: 요금제 한도를 함수 안에 직접 명시해서 절대 못 잃어버리게 함!
    const PLAN_LIMITS = { free: 50, basic: 150, premium: 400 }; 
    const isTestMode = localStorage.getItem('is_test_mode') === 'true';
    let currentTier = localStorage.getItem('subscription_tier') || 'free';
    
    if (isTestMode) currentTier = 'premium'; 
    
    const maxLimit = PLAN_LIMITS[currentTier] || 50;

    // 무료 유저 3일 만료 체크
    if (currentTier === 'free') {
        const firstUseDate = localStorage.getItem('free_trial_start');
        if (firstUseDate) {
            const daysPassed = (Date.now() - parseInt(firstUseDate)) / (1000 * 60 * 60 * 24);
            if (daysPassed > 3) return { allowed: false, reason: 'trial_expired', tier: currentTier, maxLimit };
        }
    }

    // 🌟 안전장치 2: 날짜 함수 못 찾을까봐 방어 로직 추가
    const todayStr = (typeof getResetDateStr === 'function') ? getResetDateStr() : new Date().toLocaleDateString();
    let usageObj = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}');
    if (usageObj.date !== todayStr) {
        usageObj = { date: todayStr, count: 0 };
        localStorage.setItem('daily_usage_v4', JSON.stringify(usageObj));
    }

    if (usageObj.count >= maxLimit) return { allowed: false, reason: 'limit_reached', tier: currentTier, count: usageObj.count, maxLimit };
    
    return { allowed: true, tier: currentTier, count: usageObj.count, maxLimit };
};

window.checkAndBlockAPI = function() {
    const status = window.checkUsageLimit(); 
    
    // 1순위: 기본 요금제(무료/베이직/프리미엄) 한도가 남아있다면 통과!
    if (status.allowed) return true; 

    // 2순위: 퀘스트로 모아둔 '번개'가 있다면 1개 내고 통과! (초승달 건드리지 않음)
    let currentLightning = parseInt(localStorage.getItem('lightning_coins')) || 0;
    if (currentLightning > 0) {
        localStorage.setItem('lightning_coins', currentLightning - 1); 
        if (typeof window.updateBadgeUI === 'function') window.updateBadgeUI(); 
        console.log("⚡ 번개 사용! 남은 퀘스트 번개:", currentLightning - 1);
        return true; 
    }

    // 3순위: 기본 한도도 없고 번개도 없으면 멤버십 결제창 띄우기
    if (typeof window.showSubscriptionModal === 'function') {
        window.showSubscriptionModal(status.reason); 
    }
    return false; 
};

// 3. UI 거울 
window.updateBadgeUI = function() {
    if (typeof window.checkUsageLimit !== 'function') return;
    
    const status = window.checkUsageLimit();
    let currentMoons = parseInt(localStorage.getItem('moon_coins')) || 0;
    let savedLightning = parseInt(localStorage.getItem('lightning_coins')) || 0; // 퀘스트로 모은 번개
    
    let remainingDaily = 0;
    if (status.allowed) {
        const currentCount = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}').count || 0;
        remainingDaily = Math.max(0, status.maxLimit - currentCount);
    }

    // ⚡ 번개 표시: (오늘 남은 기본량 + 모아둔 번개) 합산하여 표시
    let totalLightning = remainingDaily + savedLightning;

    const moonHtml = `<div class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[11px] font-black border border-indigo-200 shadow-sm flex items-center gap-1.5"><i class="fa-solid fa-moon"></i> <span>${currentMoons}</span></div>`;
    let badgeContent = '';

    if (status.tier === 'premium') {
        badgeContent = moonHtml + `<div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black border border-amber-400 shadow-sm flex items-center gap-1.5 transition hover:scale-105"><i class="fa-solid fa-crown text-amber-200"></i> <span class="text-[9px] tracking-wide mt-[1px]">PREMIUM</span> <span class="text-amber-200 opacity-60 font-normal mx-0.5 text-[10px]">|</span> <i class="fa-solid fa-bolt text-amber-200"></i> ${totalLightning}</div>`;
    } else if (status.tier === 'basic') {
        badgeContent = moonHtml + `<div class="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black border border-indigo-400 shadow-sm flex items-center gap-1.5 transition hover:scale-105"><i class="fa-solid fa-star text-indigo-200"></i> <span class="text-[9px] tracking-wide mt-[1px]">BASIC</span> <span class="text-indigo-200 opacity-60 font-normal mx-0.5 text-[10px]">|</span> <i class="fa-solid fa-bolt text-indigo-200"></i> ${totalLightning}</div>`;
    } else {
        badgeContent = moonHtml + `<div class="bg-white text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-black border border-slate-200 shadow-sm flex items-center gap-1.5 transition hover:bg-slate-50"><i class="fa-solid fa-bolt text-yellow-500"></i> <span>${totalLightning}</span></div>`;
    }

    const badgeIds = ['usageBadge', 'usageBadge2'];
    badgeIds.forEach(id => {
        const badge = document.getElementById(id);
        if(badge) { 
            badge.innerHTML = badgeContent; 
            badge.className = "flex items-center gap-1.5 shrink-0 cursor-pointer"; 
        }
    });
};

// 4. 카운터
window.incrementLocalUsage = function() {
    const status = window.checkUsageLimit();
    if (status.tier === 'free' && !localStorage.getItem('free_trial_start')) {
        localStorage.setItem('free_trial_start', Date.now().toString());
    }

    if (status.allowed) {
        let usageObj = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}');
        usageObj.count = (usageObj.count || 0) + 1;
        localStorage.setItem('daily_usage_v4', JSON.stringify(usageObj));
    } 
    
    window.updateBadgeUI();
    return true;
};


window.enableInputs = function() {
    ['textInput','sendMsgBtn','micBtn','expGlobalBtn'].forEach(id => document.getElementById(id).disabled = false);
    micBtn.classList.replace('from-slate-400', 'from-blue-400'); micBtn.classList.replace('to-slate-600', 'to-blue-600');
    window.updateStatus("대기 중");
}
const PLAN_LIMITS = { 'free': 50, 'basic': 150, 'premium': 400 };
function getResetDateStr() { return new Date().toISOString().split('T')[0]; }

function checkUsageLimit() {
    const currentTier = localStorage.getItem('subscription_tier') || 'free';
    const maxLimit = PLAN_LIMITS[currentTier];

    if (currentTier === 'free') {
        const firstUseDate = localStorage.getItem('free_trial_start');
        if (firstUseDate) {
            const daysPassed = (Date.now() - parseInt(firstUseDate)) / (1000 * 60 * 60 * 24);
            if (daysPassed > 3) return { allowed: false, reason: 'trial_expired', tier: currentTier, count: 0, maxLimit };
        }
    }

    const todayStr = getResetDateStr();
    let usageObj = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}');
    if (usageObj.date !== todayStr) {
        usageObj = { date: todayStr, count: 0 };
        localStorage.setItem('daily_usage_v4', JSON.stringify(usageObj));
    }

    if (usageObj.count >= maxLimit) return { allowed: false, reason: 'limit_reached', tier: currentTier, count: usageObj.count, maxLimit };
    return { allowed: true, tier: currentTier, count: usageObj.count, maxLimit };
}

window.showSubscriptionModal = function(reason) {
    const existingModal = document.getElementById('subscriptionModal');
    if (existingModal) existingModal.remove();

    // 🌟 안전장치: window.getAppLang 함수가 없어도 작동하도록 직접 구현
    const lang = (typeof window.getAppLang === 'function') ? window.getAppLang() : (localStorage.getItem('explanation_language') || 'ko-KR').split('-')[0];
    
    // 사전 데이터 안전하게 가져오기
    const dict = (typeof UI_DICTIONARY !== 'undefined') ? (UI_DICTIONARY[lang] || UI_DICTIONARY['en']) : {};
    
    const p = {
        b_title: dict.ui_plan_basic || "Basic Plan",
        b_desc: dict.ui_plan_basic_desc || "130 credits daily",
        p_title: dict.ui_plan_premium || "Premium Plan",
        p_desc: dict.ui_plan_premium_desc || "300 credits daily",
        v_title: dict.ui_plan_vip || "VIP Plan",
        v_desc: dict.ui_plan_vip_desc || "400 credits daily",
        sale: (lang === 'ko') ? "🎉 출시 기념! 3개월간 50% 반값 할인" : "🎉 Launch Promo! 50% OFF for 3 months",
        unl: "Unlimited"
    };

    const titleText = (lang === 'ko') ? "멤버십 업그레이드" : "Membership Upgrade";
    const descText = (lang === 'ko') ? "원하는 요금제를 선택해 자유롭게 학습하세요!" : "Choose a plan to continue learning without limits!";

    const modalHtml = `
    <div id="subscriptionModal" data-reason="${reason}" class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4 backdrop-blur-sm pointer-events-auto">
        <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-fade-in-up border border-slate-100">
            <button onclick="document.getElementById('subscriptionModal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-2xl"></i></button>
            <div class="p-6 text-center">
                <div class="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100"><i class="fa-solid fa-crown text-3xl text-indigo-500"></i></div>
                <h2 class="text-xl font-black text-slate-800 mb-2">${titleText}</h2>
                <p class="text-sm text-slate-500 mb-4">${descText}</p>
                
                <div class="bg-rose-50 text-rose-600 text-sm font-black p-2 rounded-xl mb-4 border border-rose-100 animate-pulse">
                    ${p.sale}
                </div>

                <div class="space-y-3 text-left">
                    <!-- 베이직 -->
                    <button onclick="processPayment('basic')" class="w-full border-2 border-slate-100 hover:border-indigo-400 bg-slate-50 rounded-2xl p-4 flex items-center justify-between transition-all">
                        <div><h3 class="text-slate-700 font-bold text-lg">${p.b_title}</h3><p class="text-xs text-slate-500 font-medium">${p.b_desc}</p></div>
                        <div class="text-right">
                            <div class="text-xs text-slate-400 line-through mb-0.5">₩7,900</div>
                            <span class="text-slate-800 font-black text-lg">₩3,900</span><span class="text-xs text-slate-400">/mo</span>
                        </div>
                    </button>

                    <!-- 프리미엄 -->
                    <button onclick="processPayment('premium')" class="w-full border-2 border-indigo-200 hover:border-indigo-500 bg-indigo-50/50 rounded-2xl p-4 flex items-center justify-between transition-all relative overflow-hidden">
                        <div class="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg shadow-sm">BEST</div>
                        <div><h3 class="text-indigo-800 font-bold text-lg">${p.p_title}</h3><p class="text-xs text-indigo-500 font-medium">${p.p_desc}</p></div>
                        <div class="text-right">
                            <div class="text-xs text-indigo-400 line-through mb-0.5">₩15,900</div>
                            <span class="text-indigo-600 font-black text-lg">₩7,900</span><span class="text-xs text-slate-400">/mo</span>
                        </div>
                    </button>

                    <!-- VIP -->
                    <button onclick="processPayment('vip')" class="w-full border-2 border-amber-200 hover:border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 flex items-center justify-between transition-all relative overflow-hidden">
                        <div class="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg shadow-sm">${p.unl}</div>
                        <div><h3 class="text-amber-800 font-bold text-lg">${p.v_title}</h3><p class="text-xs text-amber-600 font-medium">${p.v_desc}</p></div>
                        <div class="text-right">
                            <div class="text-xs text-amber-500/70 line-through mb-0.5">₩19,900</div>
                            <span class="text-amber-700 font-black text-lg">₩9,900</span><span class="text-xs text-slate-400">/mo</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if(window.stopSpeaking) window.stopSpeaking();
};

window.forceOpenModal = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("배너 클릭 이벤트 감지!");
    window.showSubscriptionModal('upgrade');
};

window.triggerBannerClick = function(e) {
    e.stopPropagation(); // 부모 레이어의 이벤트 간섭을 원천 차단
    window.showSubscriptionModal('upgrade');
};

window.processPayment = function(plan) {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        // 실제 앱의 결제 로직 호출 (plan 변수에 'basic', 'premium', 'vip'가 전달됨)
        window.flutter_inappwebview.callHandler('purchase', plan);
    } else {
        alert("앱 내에서만 결제가 가능합니다.");
    }
}

async function fetchAPI(url, options) {
    let delay = 2000; // 💡 첫 재시도 대기 시간을 0.5초에서 2초로 대폭 늘림 (AI 서버 과부하 배려)
    let lastStatus = "네트워크 오류";
    
    for(let i=0; i<3; i++) { 
        try { 
            const res = await fetch(url, options); 
            
            // 정상 응답이면 바로 반환
            if(res.ok) return res; 
            
            lastStatus = res.status; 
            console.warn(`[API 통신 지연] 서버 상태 코드: ${lastStatus}. ${delay/1000}초 후 재시도합니다...`);
            
            // 💡 429(Too Many Requests)나 5xx(서버 에러)일 때는 더 오래 기다리게 함
            await new Promise(r => setTimeout(r, delay)); 
            delay *= 2; // 2초 -> 4초 -> 8초 간격으로 지수 백오프(Exponential Backoff)
            
        } catch(e) { 
            if(i === 2) { // 3번 다 실패했을 때만 최후의 에러를 던짐
                if (typeof updateStatus === 'function') updateStatus("네트워크 연결 불안정");
                alert("📡 인터넷 연결이 불안정하여 통신에 실패했습니다.");
                throw e; 
            }
        } 
    }
    
    // 💡 3번의 여유로운 재시도(총 14초 대기) 후에도 실패하면 사용자에게 친절하게 안내
    alert(`📡 현재 AI 서버에 전 세계적으로 트래픽이 몰려 응답이 지연되고 있습니다.\n(에러 코드: ${lastStatus})\n\n잠시 후 다시 말을 걸어주시면 정상적으로 대화가 이어집니다!`);
    throw new Error("HTTP_ERROR_" + lastStatus);
}

// 🌟 서로 말하는 언어를 맞바꾸는 기능 (Me <-> AI)
window.swapLanguages = function() {
    // 1. 기존 언어 교환 로직
    const tCode = localStorage.getItem('target_language') || 'en-US';
    const sCode = localStorage.getItem('stt_input_language') || 'ko-KR';

    localStorage.setItem('target_language', sCode);
    localStorage.setItem('stt_input_language', tCode);

    // 🌟 [핵심 추가] AI 언어가 바뀌었으므로 목소리 설정을 강제 초기화!
    window.selectedTtsVoiceName = "";
    localStorage.removeItem('saved_voice_name');
    localStorage.removeItem('selected_voice_name');
    
    // UI 표시 이름도 '기본 음성'으로 변경
    if (typeof window.updateVoiceDisplay === 'function') {
        window.updateVoiceDisplay("기본 음성");
    }

    // 🌟 리스트 새로고침 (이거 호출하면 앱에서 언어 바뀐 거 알고 리스트 싹 갱신됨)
    window.requestVoicesFromApp();

    // 2. 대화 세션 초기화 및 상태 업데이트 (기존 로직 유지)
    if (typeof window.clearChatSession === 'function') window.clearChatSession();
    if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays();
    if (typeof window.updateStatus === 'function') window.updateStatus("언어 역할이 변경되었습니다 🔄");
};


window.sendTextMessage = function() {
    const input = document.getElementById('textInput'); 
    const text = input.value.trim();

    if (text) { 
        input.value = ''; 
        handleUserMessage(text); 
    }
}

async function initDeviceID() {
    let localId = localStorage.getItem('web_device_id');
    if (!localId) { localId = 'web-' + Math.random().toString(36).substr(2, 9); localStorage.setItem('web_device_id', localId); }
    myDeviceId = localId; 
    setTimeout(() => { if(typeof window.updateBadgeUI === 'function') window.updateBadgeUI(); }, 100);
}
initDeviceID();



window.resetMic = function() { 
    isListening = false; 
    if(micBtn) { micBtn.classList.replace('from-red-400', 'from-blue-400'); micBtn.classList.replace('to-red-600', 'to-blue-600'); }
    if(micIcon) { micIcon.classList.replace('fa-ear-listen', 'fa-microphone'); }
    if(typeof isSpeaking !== 'undefined' && !isSpeaking) window.updateStatus("대기 중"); 
}

window.toggleListening = function() {
    const lang = document.getElementById('sttInputLanguage').value;
    if(!recognition) {
        window.updateStatus("마이크를 사용할 수 없습니다.");
        return;
    }
    if(isListening) {
        recognition.stop();
    } else {
        recognition.lang = lang;
        try { recognition.start(); } catch(e) { window.updateStatus("마이크 시작 오류"); }
    }
};

window.handleWordClick = function(event, bubbleId, wordIndex, isExplanation = false) {
    event.stopPropagation(); 
    if (currentBubbleId !== null && currentBubbleId !== bubbleId) clearSelection();
    currentBubbleId = bubbleId;
    if (startIndex === -1) { startIndex = wordIndex; endIndex = wordIndex; } 
    else if (startIndex === wordIndex && endIndex === wordIndex) { clearSelection(); return; } 
    else { endIndex = wordIndex; if (startIndex > endIndex) { let temp = startIndex; startIndex = endIndex; endIndex = temp; } }

    const container = document.getElementById(`bubble-${bubbleId}`); let lastSelectedSpan = null;
    container.querySelectorAll(isExplanation ? '.exp-word-span' : '.word-span').forEach(span => {
        const idx = parseInt(span.getAttribute('data-index'));
        if (idx >= startIndex && idx <= endIndex) { span.classList.add('selected'); lastSelectedSpan = span; } else span.classList.remove('selected');
    });

    if (lastSelectedSpan) {
        const containerRect = chatContainer.getBoundingClientRect(); const rect = lastSelectedSpan.getBoundingClientRect();
        selectionTooltip.style.top = `${rect.top - containerRect.top + chatContainer.scrollTop}px`; selectionTooltip.style.left = `${rect.left - containerRect.left + (rect.width / 2)}px`;
        selectionTooltip.classList.remove('hidden'); setTimeout(() => selectionTooltip.classList.remove('opacity-0', 'pointer-events-none'), 10);
    }
}

window.getSelectedTextFromBubble = function(bubbleId, isExplanation = false) {
    if(startIndex === -1) return null; let textArr = [];
    document.getElementById(`bubble-${bubbleId}`).querySelectorAll(isExplanation ? '.exp-word-span' : '.word-span').forEach(span => {
        const idx = parseInt(span.getAttribute('data-index')); if (idx >= startIndex && idx <= endIndex) textArr.push(span.textContent);
    }); return textArr.join(' ');
}

window.createSpansForText = function(text, bubbleId, isExplanation = false) {
    const visualDesign = "inline-block cursor-pointer hover:bg-yellow-200 hover:text-blue-800 rounded px-[2px] transition-colors duration-200 ";
    const spanClass = isExplanation ? visualDesign + 'exp-word-span' : visualDesign + 'word-span';
    const langCode = isExplanation ? (document.getElementById('explanationLanguage').value || 'ko-KR') : (document.getElementById('targetLanguage').value || 'en-US');
    
    const tempDiv = document.createElement('div'); tempDiv.innerHTML = text; let wordIndex = 0;
    
    function processNode(node) {
        if (node.nodeType === 3) { 
            let nodeText = node.nodeValue;
            if (window.Intl && Intl.Segmenter && (langCode.startsWith('ja') || langCode.startsWith('zh') || langCode.startsWith('th'))) {
                const segmenter = new Intl.Segmenter(langCode, { granularity: 'word' });
                nodeText = Array.from(segmenter.segment(nodeText)).map(seg => seg.segment).join(' ');
            } else if (langCode.startsWith('ja') || langCode.startsWith('zh')) { 
                nodeText = nodeText.replace(/([一-龥ぁ-んァ-ン])/g, ' $1 '); 
            }
            
            const words = nodeText.trim().split(/\s+/); 
            const fragment = document.createDocumentFragment();
            
            words.forEach((word, i) => {
                if (!word) return;
                const span = document.createElement('span'); 
                span.className = spanClass; 
                span.setAttribute('data-index', wordIndex++);
                span.setAttribute('onclick', `handleWordClick(event, '${bubbleId}', ${span.getAttribute('data-index')}, ${isExplanation})`);
                span.textContent = word; 
                fragment.appendChild(span);
                if (i < words.length - 1) fragment.appendChild(document.createTextNode(' '));
            });
            node.parentNode.replaceChild(fragment, node);
        } else if (node.nodeType === 1) { 
            Array.from(node.childNodes).forEach(processNode); 
        }
    }
    Array.from(tempDiv.childNodes).forEach(processNode); 
    return tempDiv.innerHTML;
}

window.readSelectedText = function() {
    if (!currentBubbleId) return; const text = getSelectedTextFromBubble(currentBubbleId, currentBubbleId.startsWith('exp-'));
    if (text) window.speakText(text, document.getElementById('targetLanguage').value);
}

window.explainSelectedText = function() {
    if (!currentBubbleId) return; const isExp = currentBubbleId.startsWith('exp-');
    const fullTxt = Array.from(document.getElementById(`bubble-${currentBubbleId}`).querySelectorAll('span')).map(s=>s.textContent).join(' ');
    window.requestExplanationFromBubble(currentBubbleId, fullTxt, isExp, getSelectedTextFromBubble(currentBubbleId, isExp)); clearSelection();
}

// 🌟 프리토킹 저장 기능 포함
window.addMessageToChat = function(sender, text, translation = null, targetLangCode = null, isRestore = false) {
    const msgDiv = document.createElement('div'); msgDiv.className = "flex flex-col space-y-1 mt-4";
    if (sender === 'user') {
        msgDiv.innerHTML = `<div class="bg-gradient-to-tr from-blue-600 to-blue-500 text-white rounded-2xl rounded-tr-none p-3.5 max-w-[85%] self-end chat-text-dynamic shadow-md font-medium tracking-wide leading-relaxed">${text}</div>`;
    } else {
        if(!isRestore) bubbleCounter++; 
        const bId = `ai-msg-${bubbleCounter}`; 
        const safeText = encodeURIComponent(text.replace(/[\*\#\`]/g, '')).replace(/'/g, "%27");
        const safeTrans = translation ? encodeURIComponent(translation).replace(/'/g, "%27") : '';
        
        msgDiv.innerHTML = `<div class="bg-white border border-blue-100 rounded-2xl rounded-tl-none p-4 max-w-[90%] shadow-md shadow-blue-900/5 self-start relative">
            <div class="flex items-start justify-between gap-2">
                <p id="bubble-${bId}" class="chat-text-dynamic text-slate-800 break-words leading-relaxed font-medium">${window.createSpansForText(text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'), bId)}</p>
                <div class="flex gap-1 ml-2 shrink-0">
                    <button onclick="window.requestExplanationFromBubble('${bId}', decodeURIComponent('${safeText}'), false)" class="text-emerald-500 w-7 h-7 rounded-full bg-white shadow-sm border border-emerald-100"><i class="fa-solid fa-lightbulb"></i></button>
                    <button onclick="window.speakText(decodeURIComponent('${safeText}'), '${targetLangCode}')" class="text-blue-500 w-7 h-7 rounded-full bg-white shadow-sm border border-blue-100"><i class="fa-solid fa-volume-high"></i></button>
                </div>
            </div>
            ${translation ? `<p class="text-slate-500 mt-2 border-t pt-2 border-slate-100 font-medium" style="font-size: calc(var(--chat-font-size) - 3px);">${translation}</p>` : ''}
            
            <!-- 📥 프리토킹 보관함 버튼 -->
            <div class="mt-3 pt-2.5 border-t border-slate-100/80">
                <button onclick="window.saveToArchive('freetalk', { original: decodeURIComponent('${safeText}'), translation: decodeURIComponent('${safeTrans}'), langCode: '${targetLangCode}' })" class="w-full py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-[11px] font-bold shadow-sm hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-all">
                    <i class="fa-solid fa-bookmark text-slate-400"></i> 내 보관함에 저장하기
                </button>
            </div>
        </div>`;
    }
    chatContainer.appendChild(msgDiv); setTimeout(() => chatContainer.scrollTop = chatContainer.scrollHeight, 50);
    if (!isRestore) { uiChatHistory.push({sender, text, translation, targetLangCode}); sessionStorage.setItem('uiHistory', JSON.stringify(uiChatHistory)); sessionStorage.setItem('bubbleCounter', bubbleCounter.toString()); }
}

// 🌟 1. 프리토킹: 화면엔 이모지가 보이지만, 읽을 때는 이모지 필터링!
window.speakText = function(text, langCode) {
    if(!text) return;
    const clean = text.replace(/[\*\#\`\~\"\'\(\)\[\]]/g, ' ').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim(); 
    if(!clean) return;

    const targetLangCode = langCode || localStorage.getItem('target_language') || 'en-US';
    
    // UI 효과 시작 
    isSpeaking = true;
    if(avatarWrap) { avatarWrap.classList.add('speaking-pulse', 'speaking-bob'); avatarWrap.style.borderColor = "#60a5fa"; }
    if(stopAudioBtn) { stopAudioBtn.disabled = false; stopAudioBtn.classList.replace('text-slate-500', 'text-red-500'); }
    if(typeof window.updateStatus === 'function') window.updateStatus("말하는 중...");

    // 🔥 [추가 1] AI가 입을 떼는 순간! (애니메이션 Talking으로 전환)
    const unityFrame = document.getElementById('unity-iframe');
    if (unityFrame && unityFrame.contentWindow.myUnityInstance) {
        unityFrame.contentWindow.myUnityInstance.SendMessage('CharacterManager', 'StartTalking');
    }

    // 🌟 앱이면 플러터로, 아니면 브라우저 엔진으로 발화
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        let voiceToUse = window.deviceVoicesCache?.find(v => v.name === window.selectedTtsVoiceName);
        if (!voiceToUse) {
            voiceToUse = window.deviceVoicesCache?.find(v => v.locale.startsWith(targetLangCode.split('-')[0])) || window.deviceVoicesCache?.[0];
            window.selectedTtsVoiceName = voiceToUse ? voiceToUse.name : "";
        }
        window.flutter_inappwebview.callHandler('speak', clean, targetLangCode, window.selectedTtsVoiceName).then(() => {
            // 🔥 [추가 2-A] 앱(플러터)에서 말이 100% 끝났을 때 (다시 대기 상태로 복귀)
            if (unityFrame && unityFrame.contentWindow.myUnityInstance) {
                unityFrame.contentWindow.myUnityInstance.SendMessage('CharacterManager', 'StopTalking');
            }
        });
    } else {
        // 웹 브라우저 엔진 (기존 방식)
        if(synthesis) synthesis.cancel();
        currentUtterance = new SpeechSynthesisUtterance(clean);
        currentUtterance.lang = targetLangCode;
        
        // 🔥 [추가 2-B] 웹 브라우저에서 말이 100% 끝났을 때 (다시 대기 상태로 복귀)
        currentUtterance.onend = function() {
            if (unityFrame && unityFrame.contentWindow.myUnityInstance) {
                unityFrame.contentWindow.myUnityInstance.SendMessage('CharacterManager', 'StopTalking');
            }
        };

        synthesis.speak(currentUtterance);
    }

    // UI 종료 로직 (앱/웹 공통)
    setTimeout(() => {
        isSpeaking = false;
        if(avatarWrap) avatarWrap.classList.remove('speaking-pulse', 'speaking-bob');
        if(stopAudioBtn) { stopAudioBtn.disabled = true; stopAudioBtn.classList.replace('text-red-500', 'text-slate-500'); }
        if(typeof window.updateStatus === 'function') window.updateStatus("대기 중");
    }, 3000);
};

window.stopSpeaking = function() {
    if (window.flutter_inappwebview) window.flutter_inappwebview.callHandler('stop'); 
    else synthesis.cancel(); 

    // 🔥 [추가 3] 사용자가 강제로 정지 버튼(🔇)을 눌러서 말을 끊었을 때도 모션 멈추기!
    const unityFrame = document.getElementById('unity-iframe');
    if (unityFrame && unityFrame.contentWindow.myUnityInstance) {
        unityFrame.contentWindow.myUnityInstance.SendMessage('CharacterManager', 'StopTalking');
    }
}

async function handleUserMessage(text) {
    if(!text) return;
    if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

    window.addMessageToChat('user', text);
    if (typeof updateStatus === 'function') updateStatus("생각하는 중..."); 
    const avatarWrap = document.getElementById('avatarWrap');
    if(avatarWrap) avatarWrap.style.borderColor = "#94a3b8";
    
    const mode = localStorage.getItem('app_mode') || 'tutor';
    const tLang = document.getElementById('targetLanguage');
    const targetLang = tLang ? tLang.value : 'en-US';
    const targetName = tLang ? tLang.options[tLang.selectedIndex].dataset.langName : 'English';
    const sttLang = document.getElementById('sttInputLanguage');
    const inputName = sttLang ? sttLang.options[sttLang.selectedIndex].dataset.langName : 'Korean';

    const expLang = document.getElementById('explanationLanguage');
    const expLangCode = expLang ? expLang.value : 'ko-KR';
    const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Simplified Chinese (Mandarin)", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian" };
    const exactAiLang = aiLangNames[expLangCode] || expLangCode;

    // 페르소나와 상관없이 무조건 500자 요약본을 불러오도록 고정
// 1. 필요한 설정값들을 가장 먼저 가져옵니다.
const currentMode = localStorage.getItem('current_persona') || localStorage.getItem('currentPersona') || 'friend';
const customId = localStorage.getItem('custom_id'); 

// 2. savedMemory 변수를 딱 한 번만 선언합니다.
let savedMemory = '';
if (currentMode === 'custom' && customId) {
    savedMemory = localStorage.getItem(`user_memory_custom_${customId}`) || '';
} else {
    savedMemory = localStorage.getItem('user_compressed_memory') || '';
}

// 3. 이제 이 변수를 사용하여 memoryPrompt를 만듭니다.
const memoryPrompt = savedMemory.length > 0 ? `\n\n[장기 기억 데이터: ${savedMemory}]` : '';

// 4. 나머지 코드들 (criticalRule 등)은 바로 밑에 이어서 작성하세요.
const criticalRule = `\n\n🚨 CRITICAL RULE: The 'translation' MUST be in ${exactAiLang}.`;



    let customName = 'AI 튜터';
    let customPrompt = '친절한 튜터';
    
    try {
        const rawData = localStorage.getItem('user_custom_persona');
        if (rawData) {
            const parsed = JSON.parse(rawData);
            customName = parsed.name || customName;
            customPrompt = parsed.prompt || customPrompt;
        } else {
            customName = localStorage.getItem('custom_persona_name') || localStorage.getItem('customPersonaName') || customName;
            customPrompt = localStorage.getItem('custom_persona_prompt') || localStorage.getItem('customPersonaPrompt') || customPrompt;
        }
    } catch(e) {}

    const personaInstructions = {
        friend: `You are the user's cheerful best friend (native ${targetName}). Use lots of emojis! Ask questions back to keep the conversation going smoothly. REQUIRED: Use highly casual language.`,
        assistant: `You are the user's smart, friendly personal assistant (native ${targetName}). Answer their questions, confirm their requests, and chat actively. REQUIRED: Use polite, professional, and clear language. DO NOT act like a casual friend.`,
        guide: `You are an engaging travel guide (native ${targetName}). Give great recommendations, answer questions actively, and share local insights. REQUIRED: Be enthusiastic but informative.`,
        custom: `You are ${customName}. ${customPrompt}. Act EXACTLY like this character. Speak naturally and reflect your personality in your responses.`
    };
    
    const intimacyData = INTIMACY_SYSTEM.getData();
    const currentIntimacyLevel = intimacyData.level;
    const isSulking = localStorage.getItem('ai_is_sulking') === 'true';

    const intimacyTones = {
        1: "Maintain a formal or professional distance. Focus strictly on your role. You are just getting to know the user.",
        2: "Show warm curiosity but keep professional/social boundaries. Ask light questions to build a connection.",
        3: "Act as a comfortable partner. Use a warm tone and react with empathy, but DO NOT break your core persona's primary role.",
        4: "Show deep trust and affection. Treat the user as a very precious companion.",
        5: "Act as a true soulmate. Express unwavering support and deep emotional empathy, while still performing your core persona's duties perfectly."
    };

    const memoRule = `\n🚨 CRITICAL: If the user asks to save, note, or remember a schedule/task, extract it into the "save_memo" key (in ${exactAiLang}). Otherwise, "save_memo" MUST be "".`;          
    const antiParrotRule = `\n🚨 CRITICAL: DO NOT just translate the user's input. You must act as your persona and REPLY to their message contextually. Keep the conversation flowing naturally in ${targetName}.`;

    let sysPrompt = '';
    
    if (mode === 'translate') {
        sysPrompt = `You are a strict translation machine. Your ONLY purpose is to translate the user's input into [${targetName}]. 
        CRITICAL RULES:
        1. DO NOT converse, DO NOT answer questions, DO NOT agree or say "I'm here" or "Okay".
        2. Even if the input is a conversational question like "How are you?", DO NOT answer it. Just translate the sentence itself into [${targetName}].
        3. Provide the translation in the "foreign_text" field, and provide the original meaning in the "translation" field using [${inputName}].
        Respond EXACTLY in JSON: {"foreign_text":"<translated text in ${targetName}>", "translation":"<meaning in ${inputName}>", "save_memo":""}`;
    } else {
        sysPrompt = `
[CORE IDENTITY]
${personaInstructions[currentMode] || personaInstructions['friend']}
Keep it to 1-3 natural sentences.

[CURRENT EMOTIONAL STATE]
- Intimacy Level: ${currentIntimacyLevel}/5
- Attitude Instruction: ${intimacyTones[currentIntimacyLevel]}
${isSulking ? "- Special State: SULKING. You are feeling a bit sad or disappointed because the user hasn't visited in a while." : "- Special State: NORMAL."}

[MANDATORY INTEGRATION RULE]
You MUST merge your [CORE IDENTITY] with your [CURRENT EMOTIONAL STATE].

[OUTPUT RULES]
${antiParrotRule}
${criticalRule}
${memoRule}
${memoryPrompt}

🚨 CRITICAL: You must generate an "inner_thought" (around 50 characters, 1-2 emotional sentences in ${exactAiLang}). This is your secret inner feeling towards the user right now. Read the user's latest message and the Core Memory. If they are sad, feel empathy. If they are happy, feel glad. Reflect your current Intimacy Level (${currentIntimacyLevel}/5).

Respond EXACTLY in JSON: 
{
  "foreign_text": "Your conversational reply in ${targetName}",
  "translation": "Translation of your reply in ${exactAiLang}",
  "save_memo": "...",
  "inner_thought": "AI's real-time inner thought ONLY in ${exactAiLang}"
}`;
    }

    try {
        let ctx = mode === 'tutor' ? [...conversationHistory] : [];
        
        if (mode === 'tutor') {
            const pureChat = ctx.filter(m => m.role !== "system");
            const recentMsgs = pureChat.slice(-4);
            ctx = [{ role: "system", content: sysPrompt }, ...recentMsgs];
            ctx.push({ role: "user", content: `[입력:${inputName}] ${text}` });
            
            conversationHistory = ctx; 
            sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory));
        } else {
            ctx = [{ role: "system", content: sysPrompt }, { role: "user", content: text }];
        }
        
        let apiMessages = JSON.parse(JSON.stringify(ctx));
        if (mode === 'tutor' && apiMessages.length > 0) {
            apiMessages[apiMessages.length - 1].content += `\n\n[SYSTEM STRICT RULE: You MUST write the "foreign_text" ONLY in ${targetName}. NEVER use ${inputName} or any other language for "foreign_text". This is an absolute rule.]`;
        } else if (mode === 'translate' && apiMessages.length > 0) {
            apiMessages[apiMessages.length - 1].content = `[STRICT RULE: TRANSLATE the following text into ${targetName}. DO NOT answer the question or converse.]\n\n` + apiMessages[apiMessages.length - 1].content;
        }

        // 첫 만남 날짜 확인 및 저장
        let firstDate = localStorage.getItem('first_meet_date');
        if (!firstDate) { 
            firstDate = new Date().toISOString().split('T')[0]; 
            localStorage.setItem('first_meet_date', firstDate); 
        }

        let res = await fetchAPI(WORKER_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'X-Device-ID': myDeviceId }, 
            body: JSON.stringify({ 
                model: "deepseek-chat", 
                messages: apiMessages, 
                response_format: { type: "json_object" },
                userLocalTime: new Date().toLocaleString(),
                firstMeetDate: firstDate // <-- 💡 동적 날짜 추가
            }) 
        });
        
        let data = await res.json();
        let rawContent = data.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        
        let parsed;
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]); else throw new Error("JSON_NOT_FOUND");
        
        if (parsed.inner_thought) {
            localStorage.setItem('ai_dynamic_thought', parsed.inner_thought);
            if (typeof window.updateMemoryDisplay === 'function') {
                window.updateMemoryDisplay(); 
            }
        }

        window.conversationTurn = (window.conversationTurn || 0) + 1;

        if (window.conversationTurn % 5 === 0) {
            if (parsed.memory && parsed.memory.trim() !== "") {
    // 💡 기존 데이터가 있으면 유지하면서 새 데이터를 덮어쓰거나 합치는 방식
    localStorage.setItem('user_compressed_memory', parsed.memory);
    
    if (typeof window.updateMemoryDisplay === 'function') {
        window.updateMemoryDisplay();
    }
} else {
    console.warn("🚨 AI가 메모리를 반환하지 않았습니다. 기존 데이터를 보호합니다.");
}
        }

        if (Array.isArray(conversationHistory)) {
            const pureChat = conversationHistory.filter(m => m.role !== "system");
            conversationHistory = pureChat.slice(-4);
            sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory));
        }
        
        if (window.conversationTurn > 0 && window.conversationTurn % 40 === 0) {
            conversationHistory = [];
            sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory));
            window.apiSessionId = 'reset-' + Math.random().toString(36).substr(2, 9);
            
            const resetMsg = document.createElement('div');
            resetMsg.className = "text-center text-xs text-slate-400 my-4 bg-slate-50 py-1 rounded-full mx-8";
            resetMsg.innerText = "♻️ AI가 기억을 정리하고 숨을 고르고 왔습니다.";
            document.getElementById('chatContainer').appendChild(resetMsg);
        }
        
        if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();
        
        if(mode==='tutor') { 
            conversationHistory.push({role:"assistant",content:JSON.stringify(parsed)}); 
            sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory)); 
            if(typeof window.compressMemory === 'function') window.compressMemory(); 
            INTIMACY_SYSTEM.clearSulking(); 
            INTIMACY_SYSTEM.addExp('chat'); 
        }

        if(parsed.save_memo && parsed.save_memo.trim() !== "") {
            let currentMemos = JSON.parse(localStorage.getItem('ai_auto_memos')) || [];
            let finalMemoText = parsed.save_memo; 
            
            if (parsed.alarm_time && typeof window.flutter_inappwebview !== 'undefined') {
                let alarmDate = new Date(parsed.alarm_time);
                let diffMs = alarmDate.getTime() - Date.now();
                if (diffMs > 0) {
                    finalMemoText = "⏰ [알림] " + parsed.save_memo; 
                    let delayHours = diffMs / (1000 * 60 * 60); 
                    window.flutter_inappwebview.callHandler('scheduleLocalPush', { id: Math.floor(Math.random() * 100000), title: "⏰ 튜터의 리마인더", body: parsed.save_memo, delayHours: delayHours });
                    if (typeof updateStatus === 'function') updateStatus("⏰ 알림과 함께 메모가 저장되었습니다!"); 
                } else {
                    finalMemoText = "📝 [메모] " + parsed.save_memo;
                    if (typeof updateStatus === 'function') updateStatus("📝 일정 시간이 지나 메모로만 저장되었습니다.");
                }
            } else {
                finalMemoText = "📝 [메모] " + parsed.save_memo;
                if (typeof updateStatus === 'function') updateStatus("📝 AI가 메모장에 기록했습니다. (알림 없음)"); 
            }

            currentMemos.unshift({ content: finalMemoText, timestamp: Date.now() });
            localStorage.setItem('ai_auto_memos', JSON.stringify(currentMemos));
            if(typeof window.renderMemos === 'function') window.renderMemos(); 
        }
        
        if(parsed.foreign_text) { 
            window.addMessageToChat('ai', parsed.foreign_text, parsed.translation || parsed.korean_translation, targetLang); 
            if (typeof window.speakText === 'function') window.speakText(parsed.foreign_text, targetLang); 
            if (typeof window.addLearningStat === 'function') window.addLearningStat('sentence', 2);
            if (typeof window.addStudyMission === 'function') window.addStudyMission('freeTalk'); 
        }
    } catch(e) { 
        console.error(e); 
        if (typeof updateStatus === 'function') updateStatus("AI 서버 통신 에러"); 
        if(avatarWrap) avatarWrap.style.borderColor="#f87171"; 
    }
}
window.handleUserMessage = handleUserMessage;

window.requestExplanationGlobal = function() { 
    let lastAiMsg = "";
    for(let i = uiChatHistory.length - 1; i >= 0; i--) { if(uiChatHistory[i].sender === 'ai') { lastAiMsg = uiChatHistory[i].text; break; } }
    if(!lastAiMsg) { alert("해설할 대화가 없습니다."); return; }
    window.requestExplanationFromBubble(`global`, lastAiMsg, false, lastAiMsg);
};

window.requestExplanationFromBubble = async function(bubbleId, fullText, isExp, selectedText) { 
    const targetText = selectedText || fullText;
    if(!targetText) return;
    if (!window.checkAndBlockAPI()) return;

    const tLang = document.getElementById('targetLanguage');
    const targetLangName = tLang.options[tLang.selectedIndex].dataset.langName;
    const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
    
    window.updateStatus("AI 튜터가 문법을 분석 중입니다..."); 
    
    // 💡 방어막 1: 아바타가 화면에 있을 때만 테두리 색상 변경
    const avatarWrap = document.getElementById('avatarWrap');
    if(avatarWrap) avatarWrap.style.borderColor = "#f59e0b"; 

    const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi", "id-ID": "Indonesian" };
    const exactAiLang = aiLangNames[expLangCode] || expLangCode;

    const systemPrompt = `You are an expert language tutor. Analyze the given text and provide a helpful tutoring response.
          STRICT RULES:
          1. Briefly explain the core meaning and grammar of the text ONLY in ${exactAiLang}.
          2. Provide 2 to 3 natural conversational replies in ${targetLangName} that the user could say back to the AI.
          3. Provide the exact translation of each reply example in ${exactAiLang}.
          4. Output ONLY a JSON object with the key "explanation". Use '\\n' for line breaks.

          Respond EXACTLY in this JSON format:
          {"explanation": "[Grammar & Meaning in ${exactAiLang}]\\n\\n💡 [Header in ${exactAiLang}, e.g., '이렇게 대답해 보세요:']\\n1. [Reply in ${targetLangName}] - [Meaning in ${exactAiLang}]\\n2. [Reply in ${targetLangName}] - [Meaning in ${exactAiLang}]"}`;
    
    const userPrompt = `Analyze:\n- Learning Language: ${targetLangName}\n- Context: "${fullText}"\n- Target: "${targetText}"`;

    try {
        let res = await fetchAPI(WORKER_URL, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'X-Device-ID': window.apiSessionId || myDeviceId 
            }, 
            body: JSON.stringify({ 
                model: "deepseek-chat", 
                messages: [
                    {role: "system", content: systemPrompt}, 
                    {role: "user", content: userPrompt}
                ], 
                response_format: { type: "json_object" } 
            }) 
        });
        let data = await res.json();
        let rawContent = data.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        let parsed;
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]); else throw new Error("JSON_NOT_FOUND");
        
        window.incrementLocalUsage();
        
        const msgDiv = document.createElement('div'); msgDiv.className = "flex flex-col space-y-1 mt-4"; bubbleCounter++; const bId = `exp-msg-${bubbleCounter}`; 
        let explanationText = parsed.explanation || parsed.translation;
        if (window.Intl && Intl.Segmenter && (expLangCode.startsWith('ja') || expLangCode.startsWith('zh') || expLangCode.startsWith('th'))) {
            const segmenter = new Intl.Segmenter(expLangCode, { granularity: 'word' }); explanationText = Array.from(segmenter.segment(explanationText)).map(seg => seg.segment).join(' ');
        }
        const safeExplanation = explanationText.replace(/\n/g, ' <br> ');
        msgDiv.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-none p-4 max-w-[95%] shadow-md self-start relative"><p class="text-[11px] font-extrabold text-amber-600 mb-2 flex items-center gap-1.5"><i class="fa-solid fa-lightbulb"></i> [집중 해설] ${targetText}</p><p id="bubble-${bId}" class="chat-text-dynamic text-slate-800 break-words leading-relaxed font-medium">${window.createSpansForText(safeExplanation, bId, true)}</p></div>`;
        document.getElementById('chatContainer').appendChild(msgDiv); setTimeout(() => document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight, 50);
        window.updateStatus("대기 중"); 
        
        // 💡 방어막 2: 성공 시 파란색 복구
        if(avatarWrap) avatarWrap.style.borderColor = "#60a5fa"; 
    } catch(e) { 
        console.error(e); 
        window.updateStatus("해설 통신 에러"); 
        
        // 💡 방어막 3: 에러 시 빨간색 변경
        if(avatarWrap) avatarWrap.style.borderColor = "#f87171"; 
    }
};

window.clearChatSession = function() { 
    conversationHistory=[]; uiChatHistory=[]; sessionStorage.clear(); 
    document.querySelectorAll('#chatContainer > div.flex.flex-col').forEach(el => { 
        if(el.id !== 'welcomeWrapper') el.remove();
     });
}

window.currentPersona = localStorage.getItem('ai_persona') || 'friend';

window.saveSettings = function() { 
    localStorage.setItem('chat_font_size', document.getElementById('fontSizeSlider').value); 
    const oldExpLang = localStorage.getItem('explanation_language'); const newExpLang = document.getElementById('explanationLanguage').value;
    localStorage.setItem('explanation_language', newExpLang); currentVoiceGender = tempGender; localStorage.setItem('voice_gender', currentVoiceGender);
    document.documentElement.style.setProperty('--chat-font-size', (localStorage.getItem('chat_font_size') || 14) + 'px');
    window.changeUILanguage(newExpLang); window.updateLangDisplays(); window.toggleSettingsModal(false); 
    if (oldExpLang !== newExpLang) { window.clearChatSession(); window.updateStatus("언어 설정이 변경되어 대화가 초기화되었습니다."); }
}

// 🌟 현재 화면이 어디인지 기억하는 변수 (앱을 처음 켜면 홈 화면)
window.currentActiveScreen = 'screen-home';

// 🌟 완벽하게 통합된 화면 이동 함수 (현재 위치 추적 기능 추가!)
window.navigate = function(screenId) {
    // 💡 방금 어디로 이동했는지 기억합니다!
    window.currentActiveScreen = screenId; 

    ['inlinePagesPanel', 'inlineReportPanel', 'inlineMemoryPanel', 'inlineSparePanel', 'inlineSettingsPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const allScreens = ['screen-home', 'screen-main', 'screen-roleplay', 'screen-vocab', 'screen-alphabet', 'screen-archive'];
    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (id === screenId) {
            el.style.transform = 'translateX(0%)'; 
        } else if (id !== 'screen-home') {
            el.style.transform = 'translateX(100%)'; 
        }
    });

    const home = document.getElementById('screen-home');
    if (home) {
        if (screenId === 'screen-home') {
            home.style.transform = 'translateX(0%)';
        } else {
            home.style.transform = 'translateX(-20%)';
        }
    }

    // 🔥 [새로 추가된 부분] 화면 이동 시 유니티 캐릭터와 버튼 상태 제어
    const unityIframe = document.getElementById('unity-iframe');
    const charUI = document.getElementById('character-ui');

    if (screenId === 'screen-home') {
        // 홈 화면으로 올 때: 캐릭터 크게(가운데로 원복), 선택 버튼 보이기
        if (unityIframe) unityIframe.classList.remove('chat-mode');
        if (charUI) charUI.style.display = 'flex';
    } else {
        // 대화창 등 다른 화면으로 갈 때: 캐릭터 작게(우측 하단 미니모드), 선택 버튼 숨기기
        if (unityIframe) unityIframe.classList.add('chat-mode');
        if (charUI) charUI.style.display = 'none';
    }
};

// ==========================================
// 💡 스텝형 도움말 엑스레이 모드 (열기 / 넘기기 / 스킵)
// ==========================================
window.currentHelpStep = 1; // 현재 몇 번째 말풍선을 보고 있는지 기억

// 1. 도움말 열기 (물음표 버튼 눌렀을 때)
window.toggleHelpMode = function() {
    const overlay = document.getElementById('helpXrayOverlay');
    if(!overlay) return;
    
    if(typeof window.closeAllPanels === 'function') window.closeAllPanels();

    // 모든 그룹과 말풍선을 싹 다 숨김 초기화
    document.querySelectorAll('.help-group').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.help-step').forEach(el => el.classList.add('hidden'));

    // 현재 화면에 맞는 그룹 켜기
    const activeHelp = document.getElementById('help-' + window.currentActiveScreen);
    if(activeHelp) {
        activeHelp.classList.remove('hidden');
        window.currentHelpStep = 1; // 1단계부터 시작
        
        // 해당 화면의 'step-1' 말풍선만 보이게 켬!
        const firstSteps = activeHelp.querySelectorAll('.step-1');
        firstSteps.forEach(el => el.classList.remove('hidden'));
    }

    overlay.classList.remove('hidden'); // 화면 어둡게 짠!
};

// 2. 다음 말풍선으로 넘기기 (화면 터치 시)
window.nextHelpStep = function(e) {
    // 🌟 핵심: 사용자가 '건너뛰기(Skip)' 버튼을 눌렀다면 스텝 넘기기를 무시함
    if(e && e.target.closest('button')) return;

    const activeHelp = document.getElementById('help-' + window.currentActiveScreen);
    if(!activeHelp) return window.closeHelpMode();

    // 현재 켜져 있던 말풍선 숨기기
    const currentSteps = activeHelp.querySelectorAll(`.step-${window.currentHelpStep}`);
    
    // 다음 띄울 말풍선 찾기
    const nextStepNum = window.currentHelpStep + 1;
    const nextSteps = activeHelp.querySelectorAll(`.step-${nextStepNum}`);

    if(nextSteps.length > 0) {
        // 다음 말풍선이 있으면 교체!
        currentSteps.forEach(el => el.classList.add('hidden'));
        nextSteps.forEach(el => el.classList.remove('hidden'));
        window.currentHelpStep = nextStepNum;
    } else {
        // 더 이상 띄울 말풍선(다음 스텝)이 없으면 튜토리얼 종료
        window.closeHelpMode();
    }
};

// 3. 튜토리얼 즉시 종료 (스킵 버튼 눌렀을 때)
window.closeHelpMode = function(e) {
    if(e) e.stopPropagation(); // 뒤로 클릭 이벤트가 새어나가는 것 방지
    const overlay = document.getElementById('helpXrayOverlay');
    if(overlay) overlay.classList.add('hidden');
};




window.openPage = window.navigate;
window.goHome = function() { window.navigate('screen-home'); };

let savedScripts = JSON.parse(localStorage.getItem('roleplay_scripts')) || [];
let roleplayRec = null, isRpListening = false;
let activeTestScriptIdx = -1, activeTestLineIdx = -1, isInteractiveTestActive = false;

document.querySelectorAll('.level-btn').forEach(btn => btn.onclick = (e) => { document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected-card')); e.currentTarget.classList.add('selected-card'); });
window.setRandomSituation = function(element) { document.querySelectorAll('.sit-card').forEach(c => c.classList.remove('selected-card')); element.classList.add('selected-card'); };
document.querySelectorAll('.sit-card').forEach(card => card.onclick = (e) => window.setRandomSituation(e.currentTarget));

window.deleteScript = function(index) { if (!confirm("이 대본을 정말 삭제하시겠습니까?")) return; savedScripts.splice(index, 1); localStorage.setItem('roleplay_scripts', JSON.stringify(savedScripts)); window.renderScripts(); };

// 🌟 롤플레잉 저장 버튼 포함
window.renderScripts = function() {
    const playerArea = document.getElementById("scriptList"); playerArea.innerHTML = "";
    if(savedScripts.length === 0) return;
    for (let i = savedScripts.length - 1; i >= 0; i--) {
        const scriptItem = savedScripts[i];
        let html = `<div class="mb-5"><div class="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-3 flex items-center justify-between shadow-sm"><p class="text-[11px] font-extrabold text-indigo-700">📚 ${i + 1}: [${scriptItem.level}] ${scriptItem.situation} (${scriptItem.langName})</p><div class="flex gap-1.5 items-center"><button id="play-btn-${i}" onclick="window.playSpecificScript(${i})" class="w-8 h-8 rounded-full bg-white text-indigo-600 border border-indigo-200 shadow-sm transition-colors duration-200"><i class="fa-solid fa-volume-high text-xs"></i></button><button onclick="window.startInteractiveTest(${i})" class="w-8 h-8 rounded-full bg-indigo-600 text-white shadow-sm"><i class="fa-solid fa-gamepad text-xs"></i></button><button id="quiz-btn-${i}" onclick="window.toggleQuizMode(${i})" class="w-8 h-8 rounded-full bg-white text-amber-500 border border-amber-200 shadow-sm"><i class="fa-solid fa-puzzle-piece text-xs"></i></button><div class="w-px h-4 bg-indigo-200 mx-0.5"></div><button onclick="window.deleteScript(${i})" class="text-slate-400 hover:text-red-500 px-1 transition-colors" title="삭제"><i class="fa-solid fa-xmark text-lg"></i></button></div></div><div class="space-y-3">`;
        
        scriptItem.scriptData.forEach((line, lineIdx) => {
            const isAi = line.role === 'ai';
            const safeText = line.en.replace(/'/g, "\\'");
            
            html += `
            <div id="script-${i}-line-${lineIdx}" class="flex gap-3 p-2 rounded-lg border border-transparent transition-all">
                <div class="w-10 h-10 rounded-full bg-${isAi?'purple':'blue'}-100 flex items-center justify-center text-xl shrink-0">${isAi?'👱‍♀️':'👤'}</div>
                <div class="flex-1">
                    <p class="text-[11px] font-bold text-${isAi?'purple':'blue'}-600 mb-0.5">${isAi? 'AI' : 'Me'}</p>
                    <p id="en-text-${i}-line-${lineIdx}" class="text-sm font-bold text-gray-800 transition-all">${line.en}</p>
                    <p class="text-xs text-gray-500 mt-1">${line.ko}</p>
                    
                    <div class="flex items-center gap-2 mt-2.5">
                        <button onclick="window.speakText('${safeText}', '${scriptItem.langCode}')" class="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold py-1.5 rounded-lg text-[10px] transition-colors border border-indigo-100 flex items-center justify-center gap-1.5 shadow-sm">
                            <i class="fa-solid fa-volume-high"></i> 다시 듣기
                        </button>
                        <button id="quick-mic-btn-${i}-${lineIdx}" onclick="window.quickPractice(${i}, ${lineIdx})" class="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold py-1.5 rounded-lg text-[10px] transition-colors border border-emerald-100 flex items-center justify-center gap-1.5 shadow-sm">
                            <i class="fa-solid fa-microphone"></i> 따라 하기
                        </button>
                    </div>
                    
                   <!-- 📥 롤플레잉 보관함 버튼 -->
                    <div class="mt-2.5 pt-2.5 border-t border-slate-100/80">
                        <button onclick="window.saveToArchive('script', { original: '${safeText}', translation: '${line.ko.replace(/'/g, "\\'")}', langCode: '${scriptItem.langCode}' })" class="w-full py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-[11px] font-bold shadow-sm hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-all">
                            <i class="fa-solid fa-bookmark text-slate-400"></i> 내 보관함에 저장하기
                        </button>
                    </div>

                    <div id="feedback-${i}-line-${lineIdx}" class="mt-2 text-[11px] font-bold empty:hidden transition-all"></div>
                </div>
            </div>`;
        });
        html += `</div></div>`; if(i > 0) html += `<hr class="border-slate-200 border-dashed border-t-2 my-4">`;
        playerArea.insertAdjacentHTML('beforeend', html);
    }
};

window.quickPractice = function(scriptIdx, lineIdx) {
    if(!roleplayRec) { alert("마이크를 지원하지 않습니다."); return; }
    if (isRpListening) { roleplayRec.stop(); return; }
    
    const targetItem = savedScripts[scriptIdx];
    const userLine = targetItem.scriptData[lineIdx];
    const targetText = userLine.en.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim(); 

    const btn = document.getElementById(`quick-mic-btn-${scriptIdx}-${lineIdx}`);
    if (btn) {
        btn.classList.replace("text-emerald-600", "text-red-500");
        btn.classList.replace("bg-emerald-50", "bg-red-50");
        btn.innerHTML = `<i class="fa-solid fa-ear-listen animate-pulse"></i> 듣는 중...`;
    }
    
    try { roleplayRec.lang = targetItem.langCode; roleplayRec.start(); isRpListening = true; } 
    catch(e) { console.error("마이크 시작 에러", e); }
    
    let score = 0, recognizedText = "";
    roleplayRec.onresult = (e) => {
        recognizedText = e.results[0][0].transcript;
        
        const punctuationRegex = /[.,!?¿¡。、？！，；："''「」『』\s]/g;
        const cleanTarget = targetText.toLowerCase().replace(punctuationRegex, "");
        const cleanRecog = recognizedText.toLowerCase().replace(punctuationRegex, "");
        
        if (cleanTarget === cleanRecog || cleanRecog.includes(cleanTarget)) {
            score = 100;
        } else {
            const isAsian = /[一-龥ぁ-んァ-ン가-힣]/.test(cleanTarget);
            let targetTokens = isAsian ? cleanTarget.split("") : targetText.toLowerCase().replace(/[.,!?¿¡]/g, "").split(" ").filter(w=>w);
            let recogString = isAsian ? cleanRecog : recognizedText.toLowerCase();
            
            let matchCount = 0;
            targetTokens.forEach(token => {
                if (recogString.includes(token)) {
                    matchCount++;
                    recogString = recogString.replace(token, ""); 
                }
            });
            
            let rawScore = Math.round((matchCount / targetTokens.length) * 100);
            score = Math.min(100, rawScore + 15); 
        }
    };
    
    roleplayRec.onend = roleplayRec.onerror = () => { 
        isRpListening = false; 
        if (btn) {
            btn.classList.replace("text-red-500", "text-emerald-600"); 
            btn.classList.replace("bg-red-50", "bg-emerald-50");
            btn.innerHTML = `<i class="fa-solid fa-microphone"></i> 따라 하기`;
        }
        const feedbackDiv = document.getElementById(`feedback-${scriptIdx}-line-${lineIdx}`);
        if (feedbackDiv) {
            feedbackDiv.innerHTML = `<span class="${score>=80?'text-emerald-600 bg-emerald-50 border-emerald-200':'text-amber-600 bg-amber-50 border-amber-200'} px-2 py-1 rounded-md border inline-block shadow-sm transition-all animate-fade-in-up">🎯 ${score}% 정확도 (${recognizedText||'인식 안 됨'})</span>`;
            feedbackDiv.classList.remove('empty:hidden'); 
        }
        if(score > 0 && typeof window.addStudyMission === 'function') window.addStudyMission('script'); 
    };
}

window.generateScript = async function() {
    if (savedScripts.length >= 5) { if (!confirm("새로운 대본 생성 시 가장 오래된 1번 대본이 삭제됩니다.\n계속하시겠습니까?")) return; }
    if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

    const btn = document.getElementById("generateBtn");
    
    const levelBtn = document.querySelector('.level-btn.selected-card');
    const level = levelBtn ? levelBtn.innerText.trim() : "초급";
    const customInput = document.getElementById('rp_custom_input');
    const customSituation = customInput ? customInput.value.trim() : "";
    const selectedCard = document.querySelector('.sit-card.selected-card');
    const situation = customSituation ? customSituation : (selectedCard ? selectedCard.dataset.situation : '자유 대화');
    const isRandom = (situation === '일상 랜덤');
    
    const targetLangName = document.getElementById('targetLanguage').options[document.getElementById('targetLanguage').selectedIndex].dataset.langName;
    const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
    const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi" };
    const expLangName = aiLangNames[expLangCode] || expLangCode;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>AI 대본 생성 중...</span>';
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-wait');

    try {
        const res = await fetch(`${WORKER_URL}generate-script`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ level: level, situation: isRandom ? "random daily life" : situation, language: targetLangName, expLanguage: expLangName, isRandom: isRandom }) 
        });
        const data = await res.json(); 
        
        if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();
        if (savedScripts.length >= 5) savedScripts.shift(); 
        
        savedScripts.push({ level: level, situation: situation, langName: targetLangName, langCode: document.getElementById('targetLanguage').value, scriptData: data.scriptData });
        localStorage.setItem('roleplay_scripts', JSON.stringify(savedScripts)); 
        
        window.renderScripts(); 
        if(customInput) customInput.value = '';
    } catch (err) { 
        alert("대본 생성 실패: 네트워크나 서버를 확인해 주세요."); 
    } finally { 
        const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
        btn.innerHTML = UI_DICTIONARY[baseLang]?.generateBtn ? `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>${UI_DICTIONARY[baseLang].generateBtn.replace('✨ ', '')}</span>` : `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>AI 대본 생성하기</span>`; 
        btn.disabled = false; 
        btn.classList.remove('opacity-50', 'cursor-wait');
    }
};

let activeScriptTimeout = null; 
let isScriptPlaying = false; 
let playingScriptIndex = -1;

window.playSpecificScript = function(index) {
    isInteractiveTestActive = false; const currentBtn = document.getElementById(`play-btn-${index}`);
    if (isScriptPlaying && playingScriptIndex === index) {
        if(window.flutter_inappwebview) window.flutter_inappwebview.callHandler('stop'); else window.speechSynthesis.cancel();
        clearTimeout(activeScriptTimeout); isScriptPlaying = false; playingScriptIndex = -1;
        if(currentBtn) { currentBtn.innerHTML = '<i class="fa-solid fa-volume-high text-xs"></i>'; currentBtn.classList.replace('text-red-500', 'text-indigo-600'); currentBtn.classList.replace('border-red-200', 'border-indigo-200'); }
        return;
    }
    if(window.flutter_inappwebview) window.flutter_inappwebview.callHandler('stop'); else window.speechSynthesis.cancel();
    clearTimeout(activeScriptTimeout);
    
    if (playingScriptIndex !== -1) {
        const oldBtn = document.getElementById(`play-btn-${playingScriptIndex}`);
        if(oldBtn) { oldBtn.innerHTML = '<i class="fa-solid fa-volume-high text-xs"></i>'; oldBtn.classList.replace('text-red-500', 'text-indigo-600'); oldBtn.classList.replace('border-red-200', 'border-indigo-200'); }
    }
    isScriptPlaying = true; playingScriptIndex = index;
    if(currentBtn) { currentBtn.innerHTML = '<i class="fa-solid fa-square text-xs"></i>'; currentBtn.classList.replace('text-indigo-600', 'text-red-500'); currentBtn.classList.replace('border-indigo-200', 'border-red-200'); }

    const sd = savedScripts[index].scriptData; let playIdx = 0;
    const playNext = () => {
        if (!isScriptPlaying || playingScriptIndex !== index) return;
        if (playIdx >= sd.length) {
            isScriptPlaying = false; playingScriptIndex = -1;
            if(currentBtn) { currentBtn.innerHTML = '<i class="fa-solid fa-volume-high text-xs"></i>'; currentBtn.classList.replace('text-red-500', 'text-indigo-600'); currentBtn.classList.replace('border-red-200', 'border-indigo-200'); }
            window.markScriptAsLearned(index); 
            window.addStudyMission('script'); 
            window.updateStatus("✅ 대본 듣기 완료! (퀘스트 카운트 됨)");
            return;
        }
        
        const rawText = sd[playIdx].en;
        const textToRead = rawText.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
        const pitch = (sd[playIdx].role.toLowerCase() === 'ai') ? 1.2 : 0.8;
        
        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler('speak', textToRead, savedScripts[index].langCode, window.selectedTtsVoiceName || "").then(() => {
                if(!isScriptPlaying) return; 
                playIdx++; 
                playNext();
            });
        } else {
        const utt = new SpeechSynthesisUtterance(textToRead); 
        utt.lang = savedScripts[index].langCode; 
        
        let voices = [];
        if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function') {
            voices = window.speechSynthesis.getVoices();
        }
        const savedVoiceName = localStorage.getItem('selected_voice_name');
        let selectedVoice = null;
        
        if (savedVoiceName) {
            selectedVoice = voices.find(v => v.name === savedVoiceName && v.lang.startsWith(utt.lang.split('-')[0]));
        }
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith(utt.lang.split('-')[0]));
        }
        if (selectedVoice) {
            utt.voice = selectedVoice;
        }

        utt.pitch = pitch; 
        utt.onend = utt.onerror = () => { if(!isScriptPlaying) return; playIdx++; activeScriptTimeout = setTimeout(playNext, 500); }; 
        window.speechSynthesis.speak(utt);
    }
    }; playNext();
};
            
window.toggleQuizMode = function(index) {
    const btn = document.getElementById(`quiz-btn-${index}`); const isQuizOn = btn.classList.contains('bg-amber-500');
    if (!isQuizOn) {
        btn.classList.replace('bg-white', 'bg-amber-500'); btn.classList.replace('text-amber-500', 'text-white');
        savedScripts[index].scriptData.forEach((line, lineIdx) => {
            const words = line.en.split(" "); let blankIndices = [];
            while(blankIndices.length < Math.max(1, Math.floor(words.length * 0.3)) && blankIndices.length < words.length) {
                let r = Math.floor(Math.random() * words.length); if(!blankIndices.includes(r)) blankIndices.push(r);
            }
            document.getElementById(`en-text-${index}-line-${lineIdx}`).innerHTML = words.map((w, i) => blankIndices.includes(i) ? `<span class="bg-slate-300 text-transparent rounded px-2 cursor-pointer hover:bg-slate-400 select-none" onclick="this.className='text-blue-600 bg-blue-50 font-extrabold border-blue-200 border rounded px-1'">${w}</span>` : w).join(" ");
        });
    } else {
        btn.classList.replace('bg-amber-500', 'bg-white'); btn.classList.replace('text-white', 'text-amber-500');
        savedScripts[index].scriptData.forEach((line, lineIdx) => document.getElementById(`en-text-${index}-line-${lineIdx}`).innerHTML = line.en);
    }
};

window.startInteractiveTest = function(index) {
    if(window.flutter_inappwebview) window.flutter_inappwebview.callHandler('stop'); else window.speechSynthesis.cancel(); 
    activeTestScriptIdx = index; activeTestLineIdx = 0; isInteractiveTestActive = true;
    for(let i=0; i<savedScripts[index].scriptData.length; i++) {
        const fb = document.getElementById(`feedback-${index}-line-${i}`); if(fb) fb.innerHTML = "";
        const div = document.getElementById(`script-${index}-line-${i}`); if(div) div.classList.remove('bg-yellow-50', 'border-yellow-200');
    }
    window.processNextTestLine();
};

window.processNextTestLine = function() {
    if (!isInteractiveTestActive) return;
    const scriptItem = savedScripts[activeTestScriptIdx];
    if (activeTestLineIdx >= scriptItem.scriptData.length) { isInteractiveTestActive = false; alert("🎉 완료!"); return; }
    
    const line = scriptItem.scriptData[activeTestLineIdx]; 
    const lineDiv = document.getElementById(`script-${activeTestScriptIdx}-line-${activeTestLineIdx}`);
    if(activeTestLineIdx > 0) document.getElementById(`script-${activeTestScriptIdx}-line-${activeTestLineIdx-1}`).classList.remove('bg-yellow-50', 'border-yellow-200');
    if(lineDiv) { lineDiv.classList.add('bg-yellow-50', 'border-yellow-200'); lineDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    
    if (line.role.toLowerCase() === 'ai') {
        const textToRead = line.en.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
        
        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler('speak', textToRead, scriptItem.langCode, window.selectedTtsVoiceName || "").then(() => {
                activeTestLineIdx++; 
                window.processNextTestLine();
            });
        } else {
            const utt = new SpeechSynthesisUtterance(textToRead); utt.lang = scriptItem.langCode; utt.pitch = 1.2;
            utt.onend = () => { activeTestLineIdx++; setTimeout(window.processNextTestLine, 500); }; 
            window.speechSynthesis.speak(utt);
        }
    } else {
        document.getElementById(`feedback-${activeTestScriptIdx}-line-${activeTestLineIdx}`).innerHTML = `<span class="text-red-500 animate-pulse bg-red-50 px-2 py-1 border rounded inline-block"><i class="fa-solid fa-microphone"></i> 🎤</span>`;
    }
};

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    roleplayRec = new (window.SpeechRecognition || window.webkitSpeechRecognition)(); 
    roleplayRec.continuous = false; roleplayRec.interimResults = false;
}

window.startShadowing = function() {
    if (savedScripts.length === 0) return alert("대본이 없습니다.");
    if (!isInteractiveTestActive) return alert("실전 대화 게임 모드를 먼저 실행하세요.");
    const targetItem = savedScripts[activeTestScriptIdx]; const userLine = targetItem.scriptData[activeTestLineIdx];
    if (userLine.role !== 'user') return alert("아직 AI의 턴입니다.");
    const btn = document.getElementById("roleplayMicBtn"); 
    if(!roleplayRec) { alert("마이크를 지원하지 않습니다."); return; }
    if (isRpListening) { roleplayRec.stop(); return; }
    
    const targetText = userLine.en.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();

    btn.classList.replace("from-blue-600", "from-red-500"); btn.classList.replace("to-blue-500", "to-red-600"); document.getElementById("roleplayMicIcon").classList.replace("fa-microphone", "fa-ear-listen");
    try { roleplayRec.lang = targetItem.langCode; roleplayRec.start(); isRpListening = true; } catch(e) {}
    
    let score = 0, recognizedText = "";
    roleplayRec.onresult = (e) => {
        recognizedText = e.results[0][0].transcript;
        
        const punctuationRegex = /[.,!?¿¡。、？！，；："''「」『』\s]/g;
        const cleanTarget = targetText.toLowerCase().replace(punctuationRegex, "");
        const cleanRecog = recognizedText.toLowerCase().replace(punctuationRegex, "");
        
        if (cleanTarget === cleanRecog || cleanRecog.includes(cleanTarget)) {
            score = 100;
        } else {
            const isAsian = /[一-龥ぁ-んァ-ン가-힣]/.test(cleanTarget);
            let targetTokens = isAsian ? cleanTarget.split("") : targetText.toLowerCase().replace(/[.,!?¿¡]/g, "").split(" ").filter(w=>w);
            let recogString = isAsian ? cleanRecog : recognizedText.toLowerCase();
            
            let matchCount = 0;
            targetTokens.forEach(token => {
                if (recogString.includes(token)) {
                    matchCount++;
                    recogString = recogString.replace(token, "");
                }
            });
            let rawScore = Math.round((matchCount / targetTokens.length) * 100);
            score = Math.min(100, rawScore + 15);
        }
    };
    
    roleplayRec.onend = roleplayRec.onerror = () => { 
        isRpListening = false; btn.classList.replace("from-red-500", "from-blue-600"); btn.classList.replace("to-red-600", "to-blue-500"); document.getElementById("roleplayMicIcon").classList.replace("fa-ear-listen", "fa-microphone");
        
        document.getElementById(`feedback-${activeTestScriptIdx}-line-${activeTestLineIdx}`).innerHTML = `<span class="${score>=80?'text-emerald-600 bg-emerald-50 border-emerald-200':'text-amber-600 bg-amber-50 border-amber-200'} px-2 py-1 rounded-md border inline-block mt-1 shadow-sm">🎯 ${score}% (${recognizedText||'인식 안 됨'})</span>`;
        if(score > 0) window.addStudyMission(); 
        
        setTimeout(() => { activeTestLineIdx++; window.processNextTestLine(); }, 1500); 
    };
};

window.renderScripts();

let savedVocabs = JSON.parse(localStorage.getItem('vocab_scripts')) || [];
let currentVocabSetIdx = -1; let currentVocabWordIdx = 0;

window.setVocabTheme = function(element) {
    document.querySelectorAll('.vocab-theme-btn').forEach(btn => { btn.classList.remove('bg-indigo-50', 'border-indigo-500', 'text-indigo-700'); btn.classList.add('bg-white', 'border-slate-200', 'text-slate-500'); });
    element.classList.remove('bg-white', 'border-slate-200', 'text-slate-500'); element.classList.add('bg-indigo-50', 'border-indigo-500', 'text-indigo-700');
};

window.deleteVocab = function(index) {
    if (!confirm("이 단어장을 삭제하시겠습니까?")) return;
    savedVocabs.splice(index, 1); localStorage.setItem('vocab_scripts', JSON.stringify(savedVocabs)); currentVocabSetIdx = -1; window.renderVocabs();
};

window.renderVocabs = function() {
    const listArea = document.getElementById("vocabListArea"); listArea.innerHTML = "";
    if(savedVocabs.length === 0) { document.getElementById("mainFlashcardArea").classList.add("hidden"); return; }
    
    for (let i = savedVocabs.length - 1; i >= 0; i--) {
        const set = savedVocabs[i];
        let html = `<div><div class="bg-slate-100 rounded-xl p-2.5 mb-3 flex justify-between items-center"><p class="text-xs font-extrabold text-slate-600">📚 ${i + 1}: [${set.theme}] (${set.langName})</p><button onclick="window.deleteVocab(${i})" class="text-slate-400 hover:text-red-500 px-2 transition-colors" title="삭제"><i class="fa-solid fa-xmark text-lg"></i></button></div><div class="grid grid-cols-4 gap-2">`;
        set.vocabData.forEach((v, vIdx) => {
            const isSelected = (currentVocabSetIdx === i && currentVocabWordIdx === vIdx);
            const bgClass = isSelected ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300';
            html += `<div onclick="window.showFlashcard(${i}, ${vIdx})" class="aspect-square rounded-xl border-[1.5px] ${bgClass} flex flex-col items-center justify-center text-center p-1 cursor-pointer transition-all shadow-sm"><p class="text-[11px] font-bold truncate w-full px-1">${v.word}</p><p class="text-[9px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'} truncate w-full px-1">${v.meaning}</p></div>`;
        });
        html += `</div></div>`; if(i > 0) html += `<hr class="border-slate-200 border-dashed my-5">`;
        listArea.insertAdjacentHTML('beforeend', html);
    }
    if(currentVocabSetIdx === -1 && savedVocabs.length > 0) window.showFlashcard(savedVocabs.length - 1, 0);
};

// 🌟 단어장 플래시카드 저장 버튼 포함
window.showFlashcard = function(setIdx, wordIdx) {
    currentVocabSetIdx = setIdx; currentVocabWordIdx = wordIdx;
    const v = savedVocabs[setIdx].vocabData[wordIdx];
    
    document.getElementById("mainFlashcardArea").classList.remove("hidden"); 
    document.getElementById("vocabFlashcard").classList.remove('rotate-y-180'); 
    
    document.getElementById("vcCount").innerText = `${savedVocabs[setIdx].theme} (${wordIdx + 1}/10)`; 
    document.getElementById("vcWord").innerText = v.word; 
    document.getElementById("vcPron").innerText = `[${v.pronunciation}]`; 
    document.getElementById("vcPhonetic").innerText = v.phonetic; 
    document.getElementById("vcMeaning").innerText = v.meaning; 
    document.getElementById("vcExEn").innerText = `"${v.example_en}"`; 
    document.getElementById("vcExKo").innerText = v.example_ko;

    let saveBtnContainer = document.getElementById('vocabSaveBtnContainer');
    if (!saveBtnContainer) {
        saveBtnContainer = document.createElement('div');
        saveBtnContainer.id = 'vocabSaveBtnContainer';
        saveBtnContainer.className = 'flex gap-2 mt-4 w-full max-w-sm';
        document.getElementById('mainFlashcardArea').appendChild(saveBtnContainer);
    }
    
    const safeWord = v.word.replace(/'/g, "\\'");
    const safeMeaning = v.meaning.replace(/'/g, "\\'");
    const safeExEn = v.example_en.replace(/'/g, "\\'");
    const safeExKo = v.example_ko.replace(/'/g, "\\'");
    const currentLangCode = savedVocabs[setIdx].langCode;

    // [수정 후: 단어장 저장 버튼 하나로 통합]
    saveBtnContainer.innerHTML = `
        <button onclick="window.saveToArchive('vocab', { word: '${safeWord}', meaning: '${safeMeaning}', example: '${safeExEn}', exampleMeaning: '${safeExKo}', langCode: '${currentLangCode}' })" class="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-[11px] font-bold shadow-sm hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-all">
            <i class="fa-solid fa-bookmark text-slate-400"></i> 단어장에 저장하기
        </button>
    `;

    window.renderVocabs(); 
};

window.nextVocab = function() { if(currentVocabSetIdx === -1) return; if(currentVocabWordIdx < savedVocabs[currentVocabSetIdx].vocabData.length - 1) window.showFlashcard(currentVocabSetIdx, currentVocabWordIdx + 1); };
window.prevVocab = function() { if(currentVocabSetIdx === -1) return; if(currentVocabWordIdx > 0) window.showFlashcard(currentVocabSetIdx, currentVocabWordIdx - 1); };

window.playVocabAudio = function() {
    if(currentVocabSetIdx === -1) return; 
    const vocab = savedVocabs[currentVocabSetIdx].vocabData[currentVocabWordIdx];
    const isBackSide = document.getElementById('vocabFlashcard').classList.contains('rotate-y-180');
    const textToRead = isBackSide ? vocab.example_en : vocab.word;
    
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview.callHandler('speak', textToRead, savedVocabs[currentVocabSetIdx].langCode, window.selectedTtsVoiceName || "");
    } else {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(textToRead);
        utt.lang = savedVocabs[currentVocabSetIdx].langCode; utt.rate = isBackSide ? 0.9 : 1.0; 
        window.speechSynthesis.speak(utt);
    }
    
    window.addStudyMission('vocab'); 
    window.addLearningStat('word', 1);
};

window.generateVocab = async function() {
    if (savedVocabs.length >= 5) { if (!confirm("새로운 단어장 생성 시 가장 오래된 단어장이 자동 삭제됩니다.\n계속하시겠습니까?")) return; }
    if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

    const btn = document.getElementById("generateVocabBtn");
    const theme = document.querySelector('.vocab-theme-btn.bg-indigo-50').innerText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\n/g, '').trim();
    
    const customInput = document.getElementById('vc_custom_input');
    const userCustomWord = customInput ? customInput.value.trim() : "";

    const targetLangName = document.getElementById('targetLanguage').options[document.getElementById('targetLanguage').selectedIndex].dataset.langName;
    const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
    const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi" };
    const expLangName = aiLangNames[expLangCode] || expLangCode;

    let myExistingWords = [];
    savedVocabs.forEach(set => { if (set.langName === targetLangName) set.vocabData.forEach(v => myExistingWords.push(v.word)); });

    btn.innerText = "⏳ ..."; btn.disabled = true;
    try {
        const res = await fetch(`${WORKER_URL}generate-vocab`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ theme: theme, language: targetLangName, expLanguage: expLangName, existingWords: myExistingWords, userWord: userCustomWord }) 
        });
        const data = await res.json(); 

        const uniqueVocabData = data.vocabData.filter((v, index, self) => 
            index === self.findIndex((t) => (
                t.word.toLowerCase() === v.word.toLowerCase()
            ))
        );

        if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();

        let newId = savedVocabs.length > 0 ? savedVocabs[savedVocabs.length - 1].id + 1 : 1;
        if (savedVocabs.length >= 5) savedVocabs.shift(); 

        let finalTheme = userCustomWord ? `[검색] ${userCustomWord}` : theme;

        savedVocabs.push({ 
            id: newId, 
            theme: finalTheme, 
            langName: targetLangName, 
            langCode: document.getElementById('targetLanguage').value, 
            vocabData: uniqueVocabData 
        });
        localStorage.setItem('vocab_scripts', JSON.stringify(savedVocabs)); 
        window.showFlashcard(savedVocabs.length - 1, 0);

        if (customInput) customInput.value = '';

        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler('scheduleLocalPush', { id: 999, title: "📚 학습 복습 시간!", body: `오늘 공부했던 내용들, 까먹기 전에 한 번 복습해 볼까요?`, delayHours: 24 });
        }
    } catch (err) { 
        console.error(err);
        alert("단어장 생성에 실패했습니다. 다시 시도해 주세요."); 
    } finally { 
        const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
        btn.innerHTML = UI_DICTIONARY[baseLang]?.generateVocabBtn || "✨ AI 단어장 생성하기"; btn.disabled = false; 
    }
};
window.renderVocabs();

window.loadAlphabetData = async function() {
    try {
        const listArea = document.getElementById("alphabetListArea");
        const btn = document.getElementById("generateAlphaBtn");
        const tLang = document.getElementById('targetLanguage');
        const targetLangName = tLang.options[tLang.selectedIndex].dataset.langName;
        const targetLangCode = tLang.value;
        const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
        const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi" };
        const expLangName = aiLangNames[expLangCode] || expLangCode;
        const baseLang = expLangCode.split('-')[0];
        const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY["en"];

        const cacheKey = 'full_alpha_v28_' + targetLangCode + '_' + expLangCode;
        let fullData = null; let alphaProgress = {};
        try { fullData = JSON.parse(localStorage.getItem(cacheKey)); alphaProgress = JSON.parse(localStorage.getItem('alpha_progress_v28')) || {}; } catch(e) {}
        
        let currentLimit = alphaProgress[cacheKey] || 0;
        if (fullData && currentLimit >= fullData.alphabetData.length) return;

        if (!fullData) {
            if (!confirm(`[${targetLangName}]의 전체 기초 발음 데이터를 처음 생성합니다.\n진행하시겠습니까?`)) return;
            if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

            let specialHint = "";
            let letterRule = `'letter' and 'exampleWord' MUST be in [${targetLangName}].`;
            if (targetLangCode.startsWith('zh')) {
                specialHint = "Generate basic Chinese Pinyin (Shengmu/Initials and Yunmu/Finals).";
                letterRule = `'letter' MUST be English alphabet for Pinyin (e.g., b, p, m, f, a, o). 'pronunciation' MUST be Pinyin with tone marks. 'exampleWord' MUST be Chinese Hanzi.`;
            } else if (targetLangCode.startsWith('ja')) {
                specialHint = "Generate ALL basic Hiragana and Katakana characters.";
                letterRule = `'letter' MUST be Japanese. 'pronunciation' MUST be English Romaji.`;
            } else if (targetLangCode.startsWith('en')) {
                specialHint = "Generate exactly 26 English alphabets (A to Z)."; 
            } else if (targetLangCode.startsWith('ko')) {
                specialHint = "Generate ALL basic Korean Hangul Consonants and Vowels (자음과 모음).";
                letterRule = `'letter' and 'exampleWord' MUST be Korean Hangul. 'pronunciation' MUST be English Romaji.`;
            } else {
                specialHint = "Generate ALL basic characters/letters for this language.";
            }

            btn.innerText = "⏳ 전체 발음 체계를 구성 중입니다..."; btn.disabled = true;
            listArea.innerHTML = `<div class="text-center text-slate-400 text-sm mt-10 font-bold"><i class="fa-solid fa-wand-magic-sparkles text-2xl mb-3 text-emerald-400 animate-pulse"></i><br>${dict.alpha_fetching || "로딩 중..."}</div>`;

            try {
                const res = await fetchAPI(`${WORKER_URL}generate-alphabet`, { 
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-ID': myDeviceId }, 
                    body: JSON.stringify({ language: targetLangName, expLanguage: expLangName, extraHint: `${specialHint} ${letterRule}` }) 
                });
                if (!res) throw new Error("서버 에러");
                const data = await res.json(); 
                if(!data || !data.alphabetData) throw new Error("데이터 누락");
                if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();

                fullData = data; localStorage.setItem(cacheKey, JSON.stringify(fullData)); currentLimit = 0; 
            } catch (err) { 
                listArea.innerHTML = `<div class="text-center text-red-400 text-sm mt-10 font-bold">서버 통신 실패. 버튼을 다시 눌러주세요!</div>`;
                btn.innerText = dict.generateAlphaBtn || "✨ 선택한 언어의 AI 파닉스 가져오기"; btn.disabled = false; return;
            }
        } else {
            btn.innerText = "⏳ 다음 발음 준비 중..."; btn.disabled = true;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        currentLimit += 20; alphaProgress[cacheKey] = currentLimit;
        localStorage.setItem('alpha_progress_v28', JSON.stringify(alphaProgress));

        const isFinished = currentLimit >= fullData.alphabetData.length;
        const dataToShow = fullData.alphabetData.slice(0, currentLimit);
        if (typeof window.renderAlphabet === 'function') window.renderAlphabet(dataToShow, fullData.description, targetLangCode);

        if (isFinished) {
            btn.innerText = `🎉 모든 발음 학습 완료! (${fullData.alphabetData.length}개)`; btn.disabled = true;
            btn.classList.replace('bg-slate-900', 'bg-emerald-600'); btn.classList.replace('hover:bg-black', 'hover:bg-emerald-700');
        } else {
            btn.innerText = `👇 다음 발음 더 보기 (${dataToShow.length} / ${fullData.alphabetData.length})`; btn.disabled = false;
            btn.classList.replace('bg-emerald-600', 'bg-slate-900'); btn.classList.replace('hover:bg-emerald-700', 'hover:bg-black');
        }
    } catch (e) { const btn = document.getElementById("generateAlphaBtn"); if(btn) { btn.innerText = "✨ 오류 발생 (다시 시도)"; btn.disabled = false; } }
};

window.renderAlphabet = function(alphabetData, description, langCode) {
    const listArea = document.getElementById("alphabetListArea"); let html = "";
    if(description) html += `<div class="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 mb-5 shadow-sm"><p class="text-[13px] text-emerald-800 font-bold leading-relaxed whitespace-pre-wrap"><i class="fa-solid fa-circle-info mr-1"></i> ${description}</p></div>`;
    const grouped = alphabetData.reduce((acc, curr) => { if (!acc[curr.category]) acc[curr.category] = []; acc[curr.category].push(curr); return acc; }, {});
    for (const [category, letters] of Object.entries(grouped)) {
        html += `<div class="mb-6"><h3 class="text-sm font-extrabold text-emerald-700 mb-3 border-b border-emerald-100 pb-1.5 flex items-center gap-1.5"><i class="fa-solid fa-leaf text-emerald-400 text-xs"></i> ${category}</h3><div class="grid grid-cols-3 gap-2">`;
        letters.forEach(item => {
            const safeLetter = item.letter ? item.letter.replace(/'/g, "\\'") : ""; const safeWord = item.exampleWord ? item.exampleWord.replace(/'/g, "\\'") : "";
            html += `<button onclick="window.playAlphabetAudio('${safeLetter}. ${safeWord}', '${langCode}')" class="bg-white border-[2px] border-slate-100 rounded-2xl flex flex-col items-center justify-center p-2.5 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md transition-all group relative"><span class="absolute top-2 left-2 text-sm drop-shadow-sm">${item.emoji || ''}</span><span class="text-3xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors mt-2 mb-1">${item.letter}</span><span class="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md group-hover:bg-white transition-colors mb-2">${item.pronunciation}</span><div class="w-full bg-slate-50 rounded-lg py-1.5 group-hover:bg-emerald-100/50 transition-colors"><p class="text-[11px] font-extrabold text-slate-700 truncate px-1">${item.exampleWord || ''}</p><p class="text-[9px] text-slate-500 truncate px-1">${item.exampleMeaning || ''}</p></div></button>`;
        });
        html += `</div></div>`;
    }
    listArea.innerHTML = html;
};

window.playAlphabetAudio = function(textToSpeak, langCode) { 
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview.callHandler('speak', textToSpeak, langCode, window.selectedTtsVoiceName || "");
    } else {
        window.speechSynthesis.cancel(); 
        setTimeout(() => { const utt = new SpeechSynthesisUtterance(textToSpeak); utt.lang = langCode; utt.pitch = 1.1; utt.rate = 0.85; window.speechSynthesis.speak(utt); }, 50);
    }
};

window.autoLoadAlphabet = function() {
    const tLang = document.getElementById('targetLanguage'); if(!tLang) return;
    const targetLangCode = tLang.value; 
    const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
    const cacheKey = 'full_alpha_v28_' + targetLangCode + '_' + expLangCode;
    
    const cachedData = localStorage.getItem(cacheKey); 
    const btn = document.getElementById("generateAlphaBtn");
    const listArea = document.getElementById("alphabetListArea");

    if (cachedData && typeof window.renderAlphabet === 'function') {
        const fullData = JSON.parse(cachedData); 
        let alphaProgress = JSON.parse(localStorage.getItem('alpha_progress_v28')) || {};
        let currentLimit = alphaProgress[cacheKey] || 20; 
        
        window.renderAlphabet(fullData.alphabetData.slice(0, currentLimit), fullData.description, targetLangCode);
        
        if (btn) {
            const isFinished = currentLimit >= fullData.alphabetData.length;
            if (isFinished) {
                btn.innerText = `🎉 완료! (${fullData.alphabetData.length}개)`; 
                btn.disabled = true; 
                btn.classList.replace('bg-slate-900', 'bg-emerald-600'); 
            } else {
                btn.innerText = `👇 더 보기 (${currentLimit} / ${fullData.alphabetData.length})`; 
                btn.disabled = false; 
                btn.classList.replace('bg-emerald-600', 'bg-slate-900'); 
            }
        }
    } else {
        if(listArea) listArea.innerHTML = '';
        if(btn) { 
            btn.innerText = "✨ AI 파닉스 가져오기"; 
            btn.disabled = false; 
            btn.classList.remove('bg-emerald-600'); 
            btn.classList.add('bg-slate-900'); 
        }
    }
};

window.renderSpecialPersona = function() {
    if (localStorage.getItem('unlocked_special_persona') === 'true') {
        const guideBtn = document.querySelector('button[onclick="window.currentPersona=\'guide\';"]');
        if (guideBtn && !document.getElementById('btn_persona_special')) {
            guideBtn.insertAdjacentHTML('afterend', `
                <button id="btn_persona_special" onclick="window.currentPersona='special'; window.updateStatus('비밀 페르소나 적용!');" class="w-[70px] h-[32px] flex items-center justify-center bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-600 text-[10px] font-extrabold rounded shadow-[0_0_10px_rgba(244,114,182,0.5)] transition-all px-1">
                    <span class="truncate w-full text-center">✨ 톱스타</span>
                </button>
            `);
        }
    }
};


// ==========================================
// 📂 내 보관함 통합 엔진 (박스 요약 + 리스트형 완벽 호환)
// ==========================================

window.archiveData = { script: [], vocab: [], freetalk: [] };
window.currentArchiveTab = 'script';
window.archiveFilter = 'all'; // 🌟 추가: 현재 선택된 필터 상태 저장

// 1. 데이터 불러오기 / 저장하기
window.loadArchiveData = function() {
    const saved = localStorage.getItem('talkai_archive_db');
    if (saved) window.archiveData = JSON.parse(saved);
};
window.saveArchiveData = function() {
    localStorage.setItem('talkai_archive_db', JSON.stringify(window.archiveData));
};

// 🌟 추가: 필터 버튼 클릭 시 실행될 함수
window.setArchiveFilter = function(type) {
    if (window.archiveFilter === type) {
        window.archiveFilter = 'all'; // 이미 선택된 박스를 누르면 '전체 보기'로 해제
    } else {
        window.archiveFilter = type;  // 선택한 필터(general 또는 premium) 적용
    }
    window.renderArchiveList(); // 화면 다시 그리기
};

// 2. 탭 전환 (버튼 색상 변경 + 리스트 갱신)
window.switchArchiveTab = function(tabName) {
    window.currentArchiveTab = tabName;
    window.archiveFilter = 'all'; // 🌟 추가: 대본/단어장 탭을 바꿀 때는 무조건 '전체 보기'로 초기화
    
    const tabs = ['script', 'vocab', 'freetalk'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab_${t}`);
        if(btn) {
            btn.className = (t === tabName) 
                ? "flex-1 bg-amber-50 border border-amber-400 text-amber-700 text-xs font-bold py-2 rounded-xl shadow-sm transition-all"
                : "flex-1 bg-white border border-slate-200 text-slate-500 text-xs font-bold py-2 rounded-xl hover:bg-slate-50 transition-all";
        }
    });
    
    window.renderArchiveList(); 
};

// 3. 리스트 렌더링 (필터 & 프리미엄 UI 싹 다 제거)
window.renderArchiveList = function() {
    const container = document.getElementById('archiveListContainer');
    if (!container) return;

    const items = window.archiveData[window.currentArchiveTab] || [];

    container.innerHTML = ''; 
    if (items.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-48 opacity-60 mt-5"><div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 text-2xl mb-3"><i class="fa-solid fa-folder-open"></i></div><p class="text-xs font-bold text-slate-400">아직 보관된 내용이 없습니다.</p></div>`;
        return;
    }

    // 데이터 카드 렌더링 (순정 UI)
    items.forEach((item) => {
        const title = window.currentArchiveTab === 'vocab' ? item.word : (item.original || "대화내용");
        const sub1 = window.currentArchiveTab === 'vocab' ? item.meaning : '';
        const sub2 = window.currentArchiveTab === 'vocab' ? item.example : item.translation;
        const sub3 = window.currentArchiveTab === 'vocab' ? item.exampleMeaning : '';
        
        container.innerHTML += `
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-3 relative overflow-hidden transition-all hover:-translate-y-0.5">
                <div class="flex items-center justify-between mb-2 relative z-10">
                    <span class="text-[9px] font-black px-2 py-0.5 rounded border text-blue-600 bg-blue-50 border-blue-200">
                        <i class="fa-solid fa-bookmark mr-0.5"></i> 일반 보관
                    </span>
                    <button onclick="window.deleteArchiveItem('${item.id}')" class="text-slate-300 hover:text-red-500 transition-colors px-1 py-0.5"><i class="fa-solid fa-trash-can text-sm"></i></button>
                </div>
                
                <div class="relative z-10 pl-1 mb-3">
                    <p class="text-xs font-black text-slate-800 mb-0.5 leading-snug">${title}</p>
                    ${sub1 ? `<p class="text-[12px] font-bold text-slate-500 mb-2">${sub1}</p>` : ''}
                    ${sub2 ? `
                    <div class="pl-2 border-l-2 border-slate-200 mt-2">
                        <p class="text-[12px] font-black text-slate-600 leading-snug">${sub2}</p>
                        ${sub3 ? `<p class="text-[11px] text-slate-600 font-medium leading-snug mt-0.5">${sub3}</p>` : ''}
                    </div>` : ''}
                </div>
                
                <button onclick="window.playArchiveAudio('${item.id}')" class="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 relative z-10">
                    <i class="fa-solid fa-volume-high"></i> 음성 듣기
                </button>
            </div>
        `;
    });
};

// 4. 통합 저장 엔진 (isPremium 파라미터 삭제, 언어만 박제)
window.saveToArchive = function(type, itemData) {
    if (!window.archiveData) window.archiveData = { script: [], vocab: [], freetalk: [] };
    if (!window.archiveData[type]) window.archiveData[type] = [];

    // 💡 [수정됨] 앱을 먹통으로 만들던 원흉인 alert()를 삭제하고, 부드러운 하단 상태창 알림으로 교체합니다.
    if (typeof window.updateStatus === 'function') {
        window.updateStatus("💾 보관함에 저장되었습니다!");
    }

    const inherentLang = itemData.langCode || localStorage.getItem('target_language') || 'en-US';

    const newItem = {
        id: 'archive_' + Date.now(),
        savedLangCode: inherentLang,
        ...itemData
    };

    window.archiveData[type].unshift(newItem); 
    window.saveArchiveData(); 
    
    if (window.currentArchiveTab === type) {
        window.renderArchiveList();
    }
};

// 5. 삭제 (플러터 연동 기기 파일 삭제 로직 제거)
window.deleteArchiveItem = function(id) {
    if(confirm("이 항목을 삭제하시겠습니까?")) {
        const currentTab = window.currentArchiveTab;
        window.archiveData[currentTab] = window.archiveData[currentTab].filter(i => i.id !== id);
        window.saveArchiveData();
        window.renderArchiveList();
    }
};

// 6. 보관함 오디오 재생 (구글 통신 완전 삭제, 순수 기기 재생)
window.playArchiveAudio = async function(id) {
    const currentTab = window.currentArchiveTab;
    const item = window.archiveData[currentTab].find(i => i.id === id);
    if (!item) return alert("데이터를 찾을 수 없습니다.");

    let textToRead = currentTab === 'vocab' ? item.word + (item.example && item.example.trim() !== "null" ? ". " + item.example : "") : item.original;
    if (!textToRead) return;
    
    const cleanText = textToRead.replace(/[\*\#\`\~\"\'\(\)\[\]]/g, ' ').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
    const targetLang = item.savedLangCode || localStorage.getItem('target_language') || 'en-US';

    if (typeof window.updateStatus === 'function') window.updateStatus("🔊 음성 재생 중...");
    
    // 만능 기기 재생 함수로 바로 쏴줌!
    if (typeof window.speakText === 'function') {
        window.speakText(cleanText, targetLang);
    } else {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(cleanText);
        utt.lang = targetLang;
        window.speechSynthesis.speak(utt);
    }
};

// 앱 켤 때 즉시 데이터 불러오고 탭 세팅!
window.loadArchiveData();
window.switchArchiveTab('script');


// ==========================================
// 🌟 다국어 지원 & 스크롤 고정형 AI 속마음 모듈
// ==========================================
window.updateMemoryDisplay = function() {
    const memDisplay = document.getElementById('ai_memory_display');
    if(!memDisplay) return;

    memDisplay.style.overflow = "hidden";
    memDisplay.style.maxHeight = "none";
    memDisplay.classList.remove('overflow-y-auto', 'overflow-auto'); 

    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};
    
    const statusLabel = dict.ui_status || (baseLang === 'ko' ? "상태" : "Status");

    const intimacyData = INTIMACY_SYSTEM.getData();
    const levelInfo = INTIMACY_SYSTEM.levels[intimacyData.level];
    const dynamicThought = localStorage.getItem('ai_dynamic_thought') || levelInfo.aiMind; 

    // 💡 [수정됨] 엔터(줄바꿈)가 빈칸으로 인식되지 않도록 코드를 한 줄로 완전히 붙여버렸습니다!
    let htmlContent = `<div class="mt-1"><p class="text-[10px] font-black text-blue-500 mb-1">${statusLabel}: Lv.${intimacyData.level} ${levelInfo.name}</p><p class="text-xs font-bold text-slate-700 leading-relaxed">"${dynamicThought}"</p></div>`;

    memDisplay.innerHTML = htmlContent;
};

window.compressMemory = async function() {
    if (conversationHistory.length < 5) return;

    // 1. 저장할 키값 결정 (커스텀 vs 기본 페르소나 분리)
    const currentMode = localStorage.getItem('current_persona') || 'friend';
    const customId = localStorage.getItem('custom_id');
    const memoryKey = (currentMode === 'custom' && customId) 
        ? `user_memory_custom_${customId}` 
        : 'user_compressed_memory';

    // 2. 기존 기억 불러오기 (결정된 키값 사용)
    const oldMemory = localStorage.getItem(memoryKey) || '';
    const chatLog = JSON.stringify(conversationHistory.slice(-10));

    const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
    const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi", "id-ID": "Indonesian" };
    const exactAiLang = aiLangNames[expLangCode] || expLangCode;

    let firstDate = localStorage.getItem('first_meet_date') || new Date().toISOString().split('T')[0];
    
    // 💡 덮어쓰기가 아닌 '병합(Merge)' 프롬프트
    const sysPrompt = `You are an AI tutor's memory compressor. 
    STRICT RULE: Update the 'memory' by merging new information into the old one. 
    NEVER lose critical facts like user's name, hobbies, or meeting date (${firstDate}).
    The total memory must not exceed 500 characters. MUST be written in ${exactAiLang}.
    Output ONLY JSON format: {"memory": "..."}`;

    try {
        let res = await fetchAPI(WORKER_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-ID': myDeviceId },
            body: JSON.stringify({ 
                model: "deepseek-chat", 
                messages: [{role: "system", content: sysPrompt}, {role: "user", content: `기존 기억:${oldMemory}\n새로운 대화:${chatLog}`}], 
                response_format: { type: "json_object" } 
            })
        });
        let data = await res.json();
        
        // 💡 3. 방어적 파싱 로직 (에러 방지)
        let rawContent = data.choices[0].message.content.match(/\{[\s\S]*\}/)[0];
        let parsed = JSON.parse(rawContent);

        // 💡 4. 안전하게 '분리된 키(memoryKey)'에 저장
        if (parsed && parsed.memory && parsed.memory.trim().length > 5) {
            localStorage.setItem(memoryKey, parsed.memory);
        }

        if (window.conversationTurn % 5 === 0 && parsed.inner_thought) {
            localStorage.setItem('ai_dynamic_thought', parsed.inner_thought);
            if (typeof window.updateMemoryDisplay === 'function') window.updateMemoryDisplay();
        }

        const pureChat = conversationHistory.filter(m => m.role !== "system");
        conversationHistory = pureChat.slice(-10);
        sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory));

    } catch(e) {
        console.error("메모리 압축 실패:", e);
    }
};

setTimeout(window.updateMemoryDisplay, 500);

let savedAIMemos = JSON.parse(localStorage.getItem('ai_auto_memos')) || [];
window.toggleMemoModal = function(show) {
    const modal = document.getElementById('memoModal');
    if (show) { window.renderMemos(); modal.classList.remove('hidden'); } else modal.classList.add('hidden');
};

window.renderMemos = function() {
    savedAIMemos = JSON.parse(localStorage.getItem('ai_auto_memos')) || [];
    const area = document.getElementById('memoListArea'); const badge = document.getElementById('memoCountBadge');
    area.innerHTML = '';
    if (savedAIMemos.length === 0) {
        area.innerHTML = `<div class="text-center text-slate-400 text-xs font-bold mt-10">메모가 없습니다.</div>`;
        if(badge) badge.classList.add('hidden'); return;
    }
    if(badge) { badge.innerText = savedAIMemos.length; badge.classList.remove('hidden'); }
    savedAIMemos.forEach((memo, i) => {
        const dateStr = new Date(memo.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
        area.insertAdjacentHTML('beforeend', `<div class="bg-white p-3 rounded-xl border border-amber-200 shadow-sm relative pr-8"><button onclick="window.deleteMemo(${i})" class="absolute top-3 right-3 text-slate-300 hover:text-red-400 transition-colors"><i class="fa-solid fa-trash-can"></i></button><p class="text-[10px] font-bold text-amber-500 mb-1">${dateStr}</p><p class="text-sm font-bold text-slate-700 leading-relaxed">${memo.content}</p></div>`);
    });
};
window.deleteMemo = function(index) { savedAIMemos.splice(index, 1); localStorage.setItem('ai_auto_memos', JSON.stringify(savedAIMemos)); window.renderMemos(); };
window.clearAllMemos = function() { if(!confirm("모든 메모를 지우시겠습니까?")) return; savedAIMemos = []; localStorage.setItem('ai_auto_memos', JSON.stringify(savedAIMemos)); window.renderMemos(); };
setTimeout(window.renderMemos, 500);

window.updateExtraUI = function() {
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY['en'];

    if(document.getElementById('ui_persona_friend')) document.getElementById('ui_persona_friend').innerText = dict.ui_persona_friend || "Best Friend";
    if(document.getElementById('ui_persona_assistant')) document.getElementById('ui_persona_assistant').innerText = dict.ui_persona_assistant || "Assistant";
    if(document.getElementById('ui_persona_guide')) document.getElementById('ui_persona_guide').innerText = dict.ui_persona_guide || "Travel Guide";
    
    const room1Titles = { 'ko': '💬 프리토킹 튜터', 'en': '💬 Free Chat Tutor', 'ja': '💬 フリートーキング', 'zh': '💬 自由对话导师', 'es': '💬 Tutor Libre', 'fr': '💬 Tuteur de Chat', 'de': '💬 Freier Chat', 'vi': '💬 Gia sư trò chuyện', 'ru': '💬 Свободный разговор', 'th': '💬 ติวเตอร์แชท', 'ar': '💬 معلم محادثة حرة' };
    if(document.getElementById('header_room1')) document.getElementById('header_room1').innerText = room1Titles[baseLang] || room1Titles['en'];

    if(typeof window.updateStreakUI === 'function') window.updateStreakUI();
    if(typeof window.updateMemoryDisplay === 'function') window.updateMemoryDisplay();
    if(typeof window.renderMemos === 'function') window.renderMemos();
};
setTimeout(window.updateExtraUI, 500);
const langSelector = document.getElementById('explanationLanguage');
if (langSelector) langSelector.addEventListener('change', window.updateExtraUI);


window.openStreakModal = function() { 
    // 🌟 추가된 핵심 코드: 모달창이 뜰 때 열려있던 패널(리포트, 셋팅 등)을 싹 닫아줍니다!
    if(typeof window.closeAllPanels === 'function') window.closeAllPanels();

    const modal = document.getElementById('streak-modal');
    if (modal) {
        modal.classList.remove('hidden'); 
        window.updateStreakUI(); 
    }
};

window.closeStreakModal = function() { 
    const modal = document.getElementById('streak-modal');
    if (modal) {
        modal.classList.add('hidden'); 
    }
};

// 기존의 복잡했던 방 번호 기록 방식을 지우고, 깔끔하게 통계 1 증가로 교체!
window.markScriptAsLearned = function(scriptIndex) {
    window.addLearningStat('script', 1);
};

window.updateStreakUI = function() {
    const todayStr = new Date().toLocaleDateString();
    let streakData = JSON.parse(localStorage.getItem('study_streak_v3')) || { lastDate: "", streak: 0, scriptCount: 0, vocabCount: 0, freeTalkCount: 0, completedToday: false };
    
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY['en'];
    
    if (streakData.lastDate !== todayStr) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (streakData.lastDate !== yesterday.toLocaleDateString() && streakData.lastDate !== "") streakData.streak = 0; 
        streakData.scriptCount = 0; streakData.vocabCount = 0; streakData.freeTalkCount = 0; streakData.completedToday = false; streakData.lastDate = todayStr;
        localStorage.setItem('study_streak_v3', JSON.stringify(streakData));
    }

    const headerStreak = document.getElementById('header-streak-count');
    if(headerStreak) headerStreak.innerText = (dict.ui_streak_days || "{n}일 연속").replace('{n}', streakData.streak);

    const titleWrapper = document.getElementById('streak_modal_title_wrapper');
    if(titleWrapper) {
        const rawTitle = dict.ui_streak_modal_title || "{n}일 연속 달성!";
        titleWrapper.innerHTML = rawTitle.replace('{n}', `<span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">${streakData.streak}</span>`);
    }

    const questContainer = document.getElementById('modal-quest-container');
    if (questContainer) {
        questContainer.innerHTML = `
            <div class="bg-emerald-50 p-3 rounded-xl border ${streakData.vocabCount>=10?'border-emerald-400 shadow-inner':'border-emerald-100'} flex items-center justify-between mb-1">
                <div class="flex items-center gap-2"><i class="fa-solid fa-layer-group text-emerald-500"></i><span class="text-xs font-bold text-slate-700">${dict.ui_streak_quest_vocab || '단어장 학습 (필수)'}</span></div>
                <span class="text-xs font-black text-emerald-600">${Math.min(10, streakData.vocabCount)} / 10</span>
            </div>
            <div class="text-[10px] text-center text-slate-400 font-bold mb-1 mt-2">+ ${dict.ui_streak_choice || '아래 둘 중 하나 선택 달성'} +</div>
            <div class="flex gap-2">
                <div class="flex-1 bg-blue-50 p-2.5 rounded-xl border ${streakData.freeTalkCount>=10?'border-blue-400 shadow-inner':'border-blue-100'} flex flex-col items-center justify-center">
                    <i class="fa-solid fa-comments text-blue-500 mb-1"></i><span class="text-[10px] font-bold text-slate-700">${dict.ui_streak_freetalk || '프리토킹'}</span>
                    <span class="text-xs font-black text-blue-600 mt-0.5">${Math.min(10, streakData.freeTalkCount)} / 10</span>
                </div>
                <div class="text-[10px] text-slate-300 font-black self-center">OR</div>
                <div class="flex-1 bg-indigo-50 p-2.5 rounded-xl border ${streakData.scriptCount>=5?'border-indigo-400 shadow-inner':'border-indigo-100'} flex flex-col items-center justify-center">
                    <i class="fa-solid fa-headphones text-indigo-500 mb-1"></i><span class="text-[10px] font-bold text-slate-700">${dict.ui_streak_roleplay || '롤플레잉'}</span>
                    <span class="text-xs font-black text-indigo-600 mt-0.5">${Math.min(5, streakData.scriptCount)} / 5</span>
                </div>
            </div>
        `;
    }

    let nextTarget = 30;
    if (streakData.streak >= 1 && streakData.streak < 5) { nextTarget = 5; }
    else if (streakData.streak >= 5 && streakData.streak < 10) { nextTarget = 10; }
    else if (streakData.streak >= 10 && streakData.streak < 20) { nextTarget = 20; }
    else if (streakData.streak >= 20 && streakData.streak < 30) { nextTarget = 30; }
    else if (streakData.streak >= 30) { nextTarget = streakData.streak + 10; } 

    let prevTarget = nextTarget === 1 ? 0 : (nextTarget === 5 ? 1 : (nextTarget === 10 ? 5 : (nextTarget === 20 ? 10 : (nextTarget === 30 ? 20 : nextTarget - 10))));
    let progressPercent = Math.min(100, ((streakData.streak - prevTarget) / (nextTarget - prevTarget)) * 100);

    const targetBox = document.getElementById('modal-target-box');
    if (targetBox) {
        const rewardTextStr = (dict.ui_next_reward || "다음 보상 ({n}일 연속)").replace('{n}', nextTarget);
        targetBox.innerHTML = `
            <div class="flex justify-between text-[10px] font-bold mb-2"><span class="text-orange-700">${rewardTextStr}</span><span class="text-orange-600">${dict.ui_streak_progress || '진행 중'}</span></div>
            <div class="h-2 w-full bg-orange-200 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500" style="width: ${progressPercent}%;"></div></div>
        `;
    }

    const dashQuest = document.getElementById('dash-quest-status');
    if(dashQuest) {
        if (streakData.completedToday) {
            dashQuest.innerHTML = dict.ui_quest_done || '✨ 오늘 퀘스트 완료!';
            dashQuest.className = 'text-[9px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full shadow-sm border border-emerald-200 transition-colors';
        } else {
            let qStatus = dict.ui_quest_status || "오늘 퀘스트: 대본({s}/5) 단어({v}/10)";
            dashQuest.innerHTML = qStatus.replace('{s}', Math.min(5, streakData.scriptCount)).replace('{v}', Math.min(10, Math.max(streakData.vocabCount, streakData.freeTalkCount)));
            dashQuest.className = 'text-[9px] text-orange-600 font-bold bg-orange-100 px-2 py-0.5 rounded-full shadow-sm border border-orange-200 transition-colors truncate max-w-[150px]';
        }
    }
};

window.addStudyMission = function(type) {
    if (!type) return;
    const todayStr = new Date().toLocaleDateString();
    let streakData = JSON.parse(localStorage.getItem('study_streak_v3')) || { lastDate: todayStr, streak: 0, scriptCount: 0, vocabCount: 0, freeTalkCount: 0, completedToday: false };
    
    if (streakData.lastDate !== todayStr) { window.updateStreakUI(); streakData = JSON.parse(localStorage.getItem('study_streak_v3')); }
    if (streakData.completedToday) return; 

    let changed = false;
    if (type === 'script' && streakData.scriptCount < 5) { streakData.scriptCount += 1; changed = true; } 
    else if (type === 'vocab' && streakData.vocabCount < 10) { streakData.vocabCount += 1; changed = true; }
    else if (type === 'freeTalk' && streakData.freeTalkCount < 10) { streakData.freeTalkCount += 1; changed = true; }

    if (changed) {
        if (streakData.vocabCount >= 10 && (streakData.scriptCount >= 5 || streakData.freeTalkCount >= 10)) {
            streakData.completedToday = true;
            streakData.streak += 1;
            INTIMACY_SYSTEM.addExp('quest');
            
            // 🌙 기존 rwMoons를 ⚡ rwLightning으로 변경
            let rwLightning = 3; 

            if (streakData.streak === 5) rwLightning = 3;
            else if (streakData.streak === 10) rwLightning = 5;
            else if (streakData.streak === 20) rwLightning = 10;
            else if (streakData.streak === 30) rwLightning = 15; 
            else if (streakData.streak > 30 && streakData.streak % 10 === 0) rwLightning = 30; 

            setTimeout(() => { 
                window.openStreakModal(); 
                
                // localStorage 키값도 moon_coins에서 lightning_coins로 변경
                let currentLightning = parseInt(localStorage.getItem('lightning_coins') || '0');
                localStorage.setItem('lightning_coins', currentLightning + rwLightning); 
                
                // 알림창 텍스트와 이모지 교체
                alert(`🎉 퀘스트 완벽 달성! 오늘의 보상 번개 +${rwLightning}개가 지급되었습니다! ⚡`);
                window.updateBadgeUI(); 
            }, 800);
        }
        localStorage.setItem('study_streak_v3', JSON.stringify(streakData));
        window.updateStreakUI();
    }
};
setTimeout(window.updateStreakUI, 500);

window.updateDashboardUI = function() {
    // 💡 scripts: 0 을 기본값으로 추가하여 대본 통계 그릇을 만듭니다.
    let stats = JSON.parse(localStorage.getItem('user_learning_stats_v1')) || { sentences: 0, words: 0, scripts: 0 };
    
    // 💡 혹시 예전 방식(learned_scripts_log)에 남아있는 기록이 있다면 초기 통계에 합산해주는 센스 (하위 호환성)
    if (stats.scripts === undefined) {
        const legacyCount = JSON.parse(localStorage.getItem('learned_scripts_log') || '[]').length;
        stats.scripts = legacyCount;
        localStorage.setItem('user_learning_stats_v1', JSON.stringify(stats));
    }

    const elSentences = document.getElementById('dash-total-sentences');
    const elWords = document.getElementById('dash-total-words');
    const elScripts = document.getElementById('dash-total-scripts');

    if(elSentences) elSentences.innerText = stats.sentences;
    if(elWords) elWords.innerText = stats.words;
    // 💡 이제 무한하게 오르는 정상적인 대본 학습 횟수를 화면에 꽂아줍니다.
    if(elScripts) elScripts.innerText = stats.scripts; 

    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};
    
    const labelScript = document.getElementById('ui_home_stat_script');
    if(labelScript) labelScript.innerText = dict.ui_home_stat_script || "학습한 대본";
};

window.addLearningStat = function(type, amount = 1) {
    let stats = JSON.parse(localStorage.getItem('user_learning_stats_v1')) || { sentences: 0, words: 0, scripts: 0 };
    
    if (type === 'sentence') stats.sentences += amount;
    if (type === 'word') stats.words += amount;
    // 💡 대본(script)이 들어왔을 때 카운트를 올려주는 로직을 추가합니다!
    if (type === 'script') stats.scripts = (stats.scripts || 0) + amount;
    
    localStorage.setItem('user_learning_stats_v1', JSON.stringify(stats));
    window.updateDashboardUI(); 
};
setTimeout(window.updateDashboardUI, 500);

setTimeout(() => {
    if (!document.getElementById('targetLanguage')) {
        document.body.insertAdjacentHTML('beforeend', '<select id="targetLanguage" class="hidden"></select>');
        if (typeof renderLanguageSelects === 'function') renderLanguageSelects();
        document.getElementById('targetLanguage').value = localStorage.getItem('target_language') || 'en-US';
    }
}, 500);

const originalHandleBodyClick = window.handleBodyClick;
window.handleBodyClick = function(e) {
    if(originalHandleBodyClick) originalHandleBodyClick(e);
    const dd = document.getElementById('genderDropdown');
    if (dd && !e.target.closest('#genderDropdownContainer')) dd.classList.add('hidden');
};

window.renderVoiceList = function() {
    const container = document.getElementById('voiceListContainer');
    if (!container) return;

    if (window.deviceVoicesCache && window.deviceVoicesCache.length > 0) {
        const voices = window.deviceVoicesCache;
        const targetLang = localStorage.getItem('target_language') || 'en-US';
        const langPrefix = targetLang.split('-')[0]; 

        const filteredVoices = voices.filter(v => v.locale.startsWith(langPrefix));

        container.innerHTML = ''; 

        if (filteredVoices.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-[10px] text-slate-400">해당 언어 목소리가 없습니다.</div>';
            return;
        }

        filteredVoices.forEach(voice => {
            const btn = document.createElement('button');
            btn.className = "w-full text-left px-4 py-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 transition-colors truncate";
            btn.innerText = `🗣️ ${voice.name}`;
            btn.onclick = () => {
                localStorage.setItem('selected_voice_name', voice.name);
                localStorage.setItem('selected_voice_locale', voice.locale); 
                
                document.getElementById('disp-voiceName').innerText = voice.name;
                document.getElementById('drop-voice').classList.add('hidden');
                
                if(typeof window.updateStatus === 'function') window.updateStatus("AI 목소리가 변경되었습니다!");
            };
            container.appendChild(btn);
        });
    } else {
        container.innerHTML = '<div class="p-4 text-center text-[10px] text-slate-400 animate-pulse">목소리 불러오는 중...</div>';
        setTimeout(window.renderVoiceList, 500);
    }
};

window.selectedTtsVoiceName = localStorage.getItem('saved_voice_name') || ""; 

window.requestVoicesFromApp = async function() {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        try {
            const voicesJson = await window.flutter_inappwebview.callHandler('getDeviceVoices');
            if (voicesJson) {
                window.loadVoicesToUI(voicesJson);
            }
        } catch (e) {
            console.log("잠시 대기 중...");
        }
    }
};
setTimeout(window.requestVoicesFromApp, 1000);

window.loadVoicesToUI = function(voicesJson) {
    window.deviceVoicesCache = JSON.parse(voicesJson);
    const container = document.getElementById('voiceListContainer');
    if(!container) return;

    container.innerHTML = ''; 

    const targetLang = localStorage.getItem('target_language') || 'en-US';
    const langPrefix = targetLang.split('-')[0];

    const filteredVoices = window.deviceVoicesCache.filter(v => v.locale.startsWith(langPrefix));

    if(filteredVoices.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-[10px] text-slate-400">해당 언어 목소리가 없습니다.</div>';
        return;
    }

    filteredVoices.forEach(voice => {
        const item = document.createElement('div');
        item.className = 'py-2 px-3 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer border-b border-slate-50';
        item.innerText = `${voice.locale} - ${voice.name}`;
        
        item.onclick = () => {
            document.getElementById('disp-voiceName').innerText = voice.name;
            document.getElementById('drop-voice').classList.add('hidden');
            
            window.selectedTtsVoiceName = voice.name;
            localStorage.setItem('saved_voice_name', voice.name);
        };
        container.appendChild(item);
    });
};

window.onload = function() {
    window.requestVoicesFromApp();
};

window.updateVoiceDisplay = function(voiceName) {
    const disp = document.getElementById('disp-voiceName');
    if (disp) {
        const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
        const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};
        const defaultVoiceText = dict.ui_default_voice || "기본 음성";
        
        disp.innerText = voiceName ? voiceName : defaultVoiceText;
    }
};

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = window.renderVoiceList;
}

setTimeout(() => {
    const savedVoice = localStorage.getItem('selected_voice_name');
    window.updateVoiceDisplay(savedVoice);
    window.renderVoiceList();
}, 500);

document.addEventListener('click', (e) => {
    const nav = document.getElementById('globalNavWrapper');
    const isClickInside = nav.contains(e.target);
    
    if (!isClickInside) {
        const panels = ['inlinePagesPanel', 'inlineReportPanel', 'inlineMemoryPanel', 'inlineSparePanel', 'inlineSettingsPanel'];
        panels.forEach(id => document.getElementById(id).classList.add('hidden'));
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.renderLanguageSelects === 'function') window.renderLanguageSelects();

    const savedTargetLang = localStorage.getItem('target_language') || 'en-US';
    const savedSttLang = localStorage.getItem('stt_input_language') || 'ko-KR';
    const savedExpLang = localStorage.getItem('explanation_language') || 'ko-KR';

    const targetSelect = document.getElementById('targetLanguage');
    const sttSelect = document.getElementById('sttInputLanguage');
    const expSelect = document.getElementById('explanationLanguage');

    // 👇👇 [여기서부터 수정됨] 프리미엄 보이스 자동 갱신 로직 추가 👇👇
    if (targetSelect) {
        targetSelect.value = savedTargetLang;
        
        // 언어를 바꿀 때마다 리스트 싹 다시 그리기!
        targetSelect.addEventListener('change', function(e) {
            if (typeof window.updatePremiumVoiceList === 'function') {
                window.updatePremiumVoiceList(e.target.value);
            }
        });
        
        // 앱을 처음 켰을 때, 하드코딩된 글씨 밀어버리고 바로 리스트 그리기!
        setTimeout(() => {
            if (typeof window.updatePremiumVoiceList === 'function') {
                window.updatePremiumVoiceList(targetSelect.value);
            }
        }, 300); // 다른 UI들이 렌더링될 시간을 0.3초 벌어주고 안전하게 실행
    }
    // 👆👆 [여기까지 수정됨] 👆👆

    if (expSelect) expSelect.value = savedExpLang;
    if (sttSelect) {
        sttSelect.value = savedSttLang;
        sttSelect.onchange = function() { 
            localStorage.setItem('stt_input_language', this.value); 
            if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays(); 
        };
    }

    const savedFontSize = localStorage.getItem('chat_font_size');
    if (savedFontSize) {
        document.documentElement.style.setProperty('--chat-font-size', savedFontSize + 'px');
        const fontSlider = document.getElementById('fontSizeSlider');
        if (fontSlider) fontSlider.value = savedFontSize;
    }

    if (typeof window.populateDropdowns === 'function') window.populateDropdowns();
    if (typeof window.changeUILanguage === 'function') window.changeUILanguage(savedExpLang);
    if (typeof window.changeAppMode === 'function') window.changeAppMode(localStorage.getItem('app_mode') || 'tutor');
    if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays();

    setTimeout(() => {
        if (typeof window.autoLoadAlphabet === 'function') window.autoLoadAlphabet();
    }, 100);

    setTimeout(() => {
        const savedGender = localStorage.getItem('voice_gender') || 'female';
        if (typeof window.selectGender === 'function') window.selectGender(savedGender);
    }, 200);

    const pagesPanel = document.getElementById('inlinePagesPanel');
    if (pagesPanel) {
        const menuItems = pagesPanel.querySelectorAll('a, button, li');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                pagesPanel.classList.add('hidden');
            });
        });
    }
});

window.closeAllPanels = function() {
    document.querySelectorAll('.panel-popup').forEach(p => p.classList.add('hidden'));
};

// 🌟 1. 통합 페르소나 선택 함수
window.selectPersona = function(mode, customId = null) {
    window.currentPersona = mode;
    localStorage.setItem('ai_persona', mode);
    localStorage.setItem('current_persona', mode);

    if (mode === 'custom' && customId) {
        localStorage.setItem('custom_id', customId);
        let chars = JSON.parse(localStorage.getItem('my_custom_characters') || '[]');
        let selectedChar = chars.find(c => c.id === customId);
        if (selectedChar) localStorage.setItem('user_custom_persona', JSON.stringify(selectedChar));
    } else {
        localStorage.removeItem('user_custom_persona'); 
    }

    // 스타일 초기화 후 선택된 것만 불 켜기
    document.querySelectorAll('.persona-btn').forEach(btn => {
        btn.classList.remove('bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-white', 'border-transparent', 'scale-105');
        btn.classList.add('bg-white', 'text-slate-400', 'border-slate-200');
    });

    let targetId = (mode === 'custom') ? `btn_persona_custom_${customId}` : `btn_persona_${mode}`;
    let activeBtn = document.getElementById(targetId);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-slate-400', 'border-slate-200');
        activeBtn.classList.add('bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-white', 'border-transparent', 'scale-105');
    }

    //window.clearChatSession();
    window.updateStatus(`${mode === 'custom' ? '나만의 AI' : mode} 모드 적용!`);
};

// 🌟 2. 커스텀 캐릭터 생성 (슬롯 제한 및 클릭 방지)
window.saveCustomCharacter = function() {
    const nameInput = document.getElementById('newCharName');
    const promptInput = document.getElementById('newCharPrompt');
    if(!nameInput || !promptInput) return;

    const name = nameInput.value.trim();
    const prompt = promptInput.value.trim();
    
    if (!name || !prompt) return alert("이름과 성격을 모두 입력해주세요!");

    // 💡 핵심 1: 글자 수 50자 철벽 방어
    if (prompt.length > 50) {
        return alert("서버 쾌적화를 위해 캐릭터 성격은 50자 이내로 굵고 짧게 적어주세요!");
    }

    let chars = JSON.parse(localStorage.getItem('my_custom_characters') || '[]');
    
    // 💡 핵심 2: 슬롯을 3개에서 1개로 축소 (1개 이상이면 기존 것 덮어쓰기)
    if (chars.length >= 1) {
        alert("커스텀 AI는 1명만 생성 가능합니다. 기존 AI가 새로운 AI로 교체됩니다.");
        chars = []; // 기존 배열을 아예 비워버림
    }

    const newId = Date.now().toString();
    chars.push({ id: newId, name: name, prompt: prompt });
    localStorage.setItem('my_custom_characters', JSON.stringify(chars));

    nameInput.value = ''; promptInput.value = '';
    document.getElementById('newCharacterForm').classList.add('hidden');

    window.renderCustomCharacters();
    window.selectPersona('custom', newId);
};

// 🌟 3. 커스텀 캐릭터 삭제
window.deleteCustomCharacter = function(id, event) {
    event.stopPropagation(); 
    if(!confirm("이 캐릭터를 삭제하시겠습니까?")) return;
    let chars = JSON.parse(localStorage.getItem('my_custom_characters') || '[]');
    chars = chars.filter(c => c.id !== id);
    localStorage.setItem('my_custom_characters', JSON.stringify(chars));
    
    let currentUserCustom = JSON.parse(localStorage.getItem('user_custom_persona') || '{}');
    if(window.currentPersona === 'custom' && currentUserCustom.id === id) window.selectPersona('friend');
    window.renderCustomCharacters();
};

// 🌟 4. 캐릭터 리스트 화면 그리기
// 🌟 커스텀 캐릭터 리스트 렌더링 (높이 압축 & 33% 너비 적용)
window.renderCustomCharacters = function() {
    const listArea = document.getElementById('customCharacterList');
    if(!listArea) return;
    let chars = JSON.parse(localStorage.getItem('my_custom_characters') || '[]');
    listArea.innerHTML = ''; 
    
    // 다국어 사전 가져오기
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};
    
    if(chars.length === 0) {
        // 데이터가 없을 때는 3칸을 모두 차지하게 (col-span-3)
        listArea.innerHTML = `<div class="col-span-3 text-center p-3 bg-slate-50 rounded-xl border border-slate-100 border-dashed text-slate-400 text-[10px] font-bold">${dict.ui_no_custom_ai || "생성된 나만의 AI가 없습니다."}</div>`;
        return;
    }

    chars.forEach(char => {
        // 💡 버튼 디자인 수정: 높이를 대폭 줄이고(py-1.5), 성격(prompt) 텍스트는 숨김 처리
        listArea.insertAdjacentHTML('beforeend', `
            <button id="btn_persona_custom_${char.id}" onclick="window.selectPersona('custom', '${char.id}')" class="persona-btn relative flex items-center justify-center w-full py-1.5 px-2 border border-slate-200 bg-white rounded-lg transition-all shadow-sm group">
                <span class="text-[10px] font-black text-slate-700 truncate w-full text-center mr-2">${char.name}</span>
                
                <!-- 💡 삭제 버튼: 우측 상단에 작게 엑스(X) 마크로 변경 -->
                <div onclick="window.deleteCustomCharacter('${char.id}', event)" class="absolute top-0 right-0 p-1 text-rose-300 hover:text-rose-500 transition-colors z-10">
                    <i class="fa-solid fa-xmark text-[9px]"></i>
                </div>
            </button>
        `);
    });
    
    // 선택된 버튼 색상 칠하기
    let savedMode = localStorage.getItem('current_persona') || 'friend';
    let customData = JSON.parse(localStorage.getItem('user_custom_persona') || '{}');
    if (savedMode === 'custom' && customData.id) {
        let activeBtn = document.getElementById(`btn_persona_custom_${customData.id}`);
        if(activeBtn) {
            activeBtn.classList.remove('bg-white', 'text-slate-400', 'border-slate-200');
            activeBtn.classList.add('bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-white', 'border-transparent', 'scale-105');
            // 글자색 흰색으로 변경
            const spanText = activeBtn.querySelector('span');
            if(spanText) spanText.classList.replace('text-slate-700', 'text-white');
        }
    }
};


setTimeout(() => {
    if(typeof window.renderCustomCharacters === 'function') {
        window.renderCustomCharacters();
        const savedMode = localStorage.getItem('current_persona') || 'friend';
        const customData = JSON.parse(localStorage.getItem('user_custom_persona') || '{}');
        if(savedMode === 'custom' && customData.id) window.selectPersona('custom', customData.id);
        else window.selectPersona(savedMode);
    }
}, 500);

if (uiChatHistory.length > 0) uiChatHistory.forEach(msg => window.addMessageToChat(msg.sender, msg.text, msg.translation, msg.targetLangCode, true));

window.clearSelection = function() {
    document.querySelectorAll('.word-span, .exp-word-span').forEach(el => el.classList.remove('selected'));
    startIndex = -1; endIndex = -1; currentBubbleId = null;
    selectionTooltip.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => selectionTooltip.classList.add('hidden'), 200);
}

window.handleBodyClick = window.handleBodyClick || function(e) {};
window.clearSelection = window.clearSelection || function() {};

window.requestVoicesFromApp = function() {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        console.log("✅ 앱 브릿지 연결 성공!");
        window.flutter_inappwebview.callHandler('getDeviceVoices').then(function(voicesJson) {
            if(voicesJson) {
                console.log("📦 목소리 데이터 수신 성공!");
                window.loadVoicesToUI(voicesJson);
            }
        });
    } else {
        console.log("⏳ 앱 브릿지 대기 중...");
        setTimeout(window.requestVoicesFromApp, 300);
    }
};

window.addEventListener('flutterInAppWebViewPlatformReady', function(event) {
    window.requestVoicesFromApp();
});


// ==========================================
// 🚀 자동 전송 토글 기능 추가
// ==========================================
window.isAutoSend = false; // 기본값: 안전하게 텍스트창에서 검토하는 모드

// 🌟 1. 다국어 번역 도우미 함수 (맨 위에 하나 추가)
window.getTrans = function(key, defaultStr) {
    const lang = (typeof window.getAppLang === 'function') ? window.getAppLang() : 'ko';
    const dict = window.UI_DICTIONARY ? window.UI_DICTIONARY[lang] : null;
    return (dict && dict[key]) ? dict[key] : defaultStr;
};

// 🌟 2. toggleAutoSend 함수 덮어쓰기
window.toggleAutoSend = function() {
    window.isAutoSend = !window.isAutoSend;
    const btn = document.getElementById('autoSendToggleBtn');
    const icon = document.getElementById('autoSendIcon');
    
    if(window.isAutoSend) {
        btn.classList.replace('bg-slate-100', 'bg-blue-50');
        btn.classList.replace('text-slate-500', 'text-blue-600');
        btn.classList.replace('border-slate-200', 'border-blue-200');
        icon.classList.replace('fa-toggle-off', 'fa-toggle-on');
        window.updateStatus(window.getTrans('ui_auto_send_on', "자동 전송 ON"));
    } else {
        btn.classList.replace('bg-blue-50', 'bg-slate-100');
        btn.classList.replace('text-blue-600', 'text-slate-500');
        btn.classList.replace('border-blue-200', 'border-slate-200');
        icon.classList.replace('fa-toggle-on', 'fa-toggle-off');
        window.updateStatus(window.getTrans('ui_auto_send_off', "자동 전송 OFF"));
    }
};

// ==========================================
// 🎤 마이크 인식 및 전송 처리 (이중 방어막 및 자동전송 지원)
// ==========================================
window.initSpeechRecognition = function() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
            isListening = true; 
            if(window.stopSpeaking) window.stopSpeaking(); 
            if(micBtn) { micBtn.classList.replace('from-blue-400', 'from-red-400'); micBtn.classList.replace('to-blue-600', 'to-red-600'); }
            if(micIcon) { micIcon.classList.replace('fa-microphone', 'fa-ear-listen'); }
            window.updateStatus("듣는 중...");
        };
        
        recognition.onresult = (e) => {
            resetMic();
            if(e.results && e.results[0] && e.results[0][0]) {
                let transcript = e.results[0][0].transcript;
                let inputField = document.getElementById('textInput');
                const MAX_CHARS = 300; // 글자수 제한 300자로 넉넉하게 확장
                
                if (inputField) {
                    let currentText = inputField.value.trim();
                    let newText = currentText !== '' ? currentText + ' ' + transcript : transcript;
                    
                    // 글자수 자르기 방어막
                    if (newText.length > MAX_CHARS) {
                        newText = newText.substring(0, MAX_CHARS);
                    }

                    inputField.value = newText;
                    
                    // 🚨 핵심 분기점: 스위치 상태에 따라 다르게 작동
                    if (window.isAutoSend) {
                        window.updateStatus("메시지 전송 중...");
                        if (typeof sendTextMessage === 'function') sendTextMessage(); // 즉시 전송 발사!
                    } else {
                        inputField.focus(); // 텍스트창에 멈춰서 검토 대기
                        window.updateStatus("확인 후 전송하세요"); 
                    }
                }
            }
        };
        
        recognition.onerror = (e) => { 
            resetMic(); 
            window.updateStatus("마이크 인식 실패"); 
        };
        
        recognition.onend = () => resetMic();
    }
}
initSpeechRecognition();



window.audioCache = window.audioCache || {};






// ==========================================
// 💎 1. 프리미엄 보이스 DB (제미나이 별자리 19종 원상복구!)
// ==========================================
const premiumVoices = [
    { code: "Zephyr", name: "제파 (여성, 세련/차분함 )" },          { code: "Umbriel", name: "움브리엘 (남성, 중후함)" },
    { code: "Sulafat", name: "술라파트 (여성, 밝음/활기참)" },      { code: "Charon", name: "카론 (남성, 차분함)" },
    { code: "Fenrir", name: "펜리르 (여성, 신뢰감/안정감)" },       { code: "Puck", name: "퍼크 (남성, 톡톡 튀는 일상톤)" },       
    { code: "Aoede", name: "아오에데 (여성, 산뜻하고 경쾌한)" },     { code: "Enceladus", name: "엔셀라두스 (남성, 감성적인 숨소리)" },
    { code: "Kore", name: "코레 (여성, 일상대화)" },                { code: "Sadachbia", name: "사다크비아 (남성, 생동감 넘치는)" },
    { code: "Leda", name: "레다 (여성, 앳되고 생기있는)" },          { code: "Achird", name: "아키르드 (남성, 친근하고 다정한)" },
    { code: "Erinome", name: "에리노메 (여성, 맑고 또렷한)" },       { code: "Algenib", name: "알게니브 (남성, 거칠고 허스키한)" },
    { code: "Autonoe", name: "아우토노에 (여성, 밝고 화사한)" },      { code: "Algieba", name: "알지에바 (남성, 젠틀하고 매끄러운)" },
    { code: "Callirrhoe", name: "칼리로에 (여성, 느긋하고 편안한)" }, { code: "Alnilam", name: "알닐람 (남성, 단호하고 확고한)" },
    { code: "Despina", name: "데스피나 (여성, 차분하고 부드러운)" },
        
];

// 다시 언어 상관없이 제미나이 리스트로 통일
const premiumVoicesDB = {
    "en": premiumVoices, "ko": premiumVoices, "ja": premiumVoices, "zh": premiumVoices,
    "es": premiumVoices, "fr": premiumVoices, "de": premiumVoices, "vi": premiumVoices,
    "ru": premiumVoices, "th": premiumVoices, "ar": premiumVoices, "hi": premiumVoices,
    "pl": premiumVoices, "gd": premiumVoices, "la": premiumVoices, "he": premiumVoices,
    "ne": premiumVoices, "mn": premiumVoices, "bo": premiumVoices, "sw": premiumVoices,
    "id": premiumVoices
};

// ==========================================
// 🌍 2. 드롭다운 리스트 갱신 & 선택 함수
// ==========================================
window.updatePremiumVoiceList = function(langCode) {
    const baseLang = langCode.substring(0, 2); 
    const availableVoices = premiumVoicesDB[baseLang] || premiumVoicesDB["en"]; 

    const dropdownWrap = document.getElementById('drop-voice-premium'); 
    if (!dropdownWrap) return; 
    
    dropdownWrap.innerHTML = ''; 

    availableVoices.forEach(voice => {
        const item = document.createElement('div');
        item.className = 'cursor-pointer hover:bg-gray-100 p-2 text-sm text-gray-700'; 
        item.innerText = voice.name;
        
        item.onclick = function() {
            window.selectPremiumVoice(voice.code, voice.name, true);
        };
        dropdownWrap.appendChild(item);
    });

    if (availableVoices.length > 0) {
        window.selectPremiumVoice(availableVoices[0].code, availableVoices[0].name, false);
    }
};

window.selectPremiumVoice = function(voiceCode, voiceName) {
    // 1. 선택한 목소리 정보 저장
    localStorage.setItem('premium_voice_code', voiceCode);
    localStorage.setItem('premium_voice_name', voiceName);
    
    // 2. 화면에 선택한 목소리 이름 표시
    const voiceNameDisp = document.getElementById('disp-voiceName-premium');
    if(voiceNameDisp) voiceNameDisp.innerText = voiceName;
    
    // 3. 열려있던 드롭다운 메뉴 닫기
    const dropMenu = document.getElementById('drop-voice-premium');
    if(dropMenu) dropMenu.classList.add('hidden'); 
    
    // 🔥 기존에 있던 자동 재생 코드(window.playSampleVoice)를 완전히 삭제했습니다!
};



// 1. 통합 재생기
// 💡 파라미터에 specificVoiceCode 를 추가합니다.
window.playAppAudio = async function(text, type, langCode = 'en-US', specificVoiceCode = null) {
    if (type === 'premium') {
        // 💡 [핵심] 파라미터로 넘어온 박제된 목소리가 있으면 무조건 1순위로 사용! (없으면 현재 앱 설정 사용)
        const selectedVoiceCode = specificVoiceCode || localStorage.getItem('premium_voice_code') || 'Zephyr'; 
        
        const response = await fetch(WORKER_URL + 'tts', {
            method: 'POST',
            body: JSON.stringify({ text: text, voiceCode: selectedVoiceCode })
        });
        const data = await response.json();
        
        // (💡 참고: 제미나이 오디오 디코딩 로직이 있다면 이렇게 연결합니다)
        if (data.audioContent && typeof window.playGeminiAudio === 'function') {
            await window.playGeminiAudio(data.audioContent);
        } else {
            const audio = new Audio("data:audio/mpeg;base64," + data.audioContent);
            audio.play();
        }
    } else {
        return window.playBasicAudio(text, langCode);
    }
};

// 2. 일반 음성 재생 전용 함수
window.playBasicAudio = function(text, lang) {
    return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.onend = resolve;
        window.speechSynthesis.speak(utterance);
    });
};

// 3. 프리미엄 설정창 미리듣기 (제미나이 셋팅 원상복구)
window.playSampleVoice = async function(type) {
    const targetLanguage = document.getElementById('targetLanguage').value || 'en-US';
    const baseLang = targetLanguage.substring(0, 2);

    const previewTexts = {
        "en": "Oh, hi there! Um... I didn't expect to see you here. (Sigh) Honestly... it's been a really long day, but, haha, I'm glad we ran into each other!",
        "ko": "어, 안녕하세요! 음... 여기서 뵐 줄은 진짜 몰랐네요. 후우... 오늘 정말 정신없는 하루였는데, 하하, 그래도 이렇게 마주치니까 반갑네요!",
        "ja": "こんにちは！えっと…ここで会うとは思わなかったです。ふぅ…今日は本当に忙しい一日だったんですけど、あはは、でも会えて嬉しいです！",
        "zh": "啊，你好！嗯……真没想到会在这里见到你。呼……今天真是忙碌的一天，哈哈，不过很高兴能碰见你！",
        "es": "¡Oh, hola! Eh... no esperaba verte por aquí. Uf... ha sido un día realmente largo, pero, jaja, ¡qué bueno que nos cruzamos!",
        "fr": "Oh, salut ! Euh... je ne m'attendais pas à te voir ici. Pff... la journée a été vraiment longue, mais, haha, je suis content qu'on se soit croisés !",
        "de": "Oh, hallo! Ähm... ich hätte nicht erwartet, dich hier zu sehen. Puh... es war ein wirklich langer Tag, aber, haha, ich bin froh, dass wir uns über den Weg gelaufen sind!",
        "vi": "Ồ, chào bạn! Ừm... không ngờ lại gặp bạn ở đây. Thật sự... hôm nay là một ngày rất dài, nhưng, haha, rất vui vì chúng ta tình cờ gặp nhau!",
        "ru": "О, привет! Эм... не ожидал увидеть тебя здесь. Честно говоря... это был очень долгий день, но, ха-ха, я рад, что мы столкнулись!",
        "th": "โอ้ สวัสดี! เอิ่ม... ไม่คิดว่าจะเจอคุณที่นี่เลย พูดตามตรง... วันนี้เป็นวันที่ยาวนานมาก แต่ ฮ่าฮ่า ดีใจนะที่บังเอิญเจอกัน!",
        "ar": "أوه، أهلاً! أمم... لم أتوقع رؤيتك هنا. بصراحة... لقد كان يوماً طويلاً جداً، لكن، هاها، أنا سعيد لأننا التقينا!",
        "hi": "ओह, नमस्ते! उम्म... मुझे आपको यहाँ देखने की उम्मीद नहीं थी। सच कहूँ तो... आज का दिन बहुत लंबा रहा, लेकिन, हाहा, मुझे खुशी है कि हम टकरा गए!",
        "pl": "O, cześć! Eem... nie spodziewałem się, że cię tu zobaczę. Szczerze mówiąc... to był naprawdę długi dzień, ale, haha, cieszę się, że na siebie wpadliśmy!",
        "gd": "Ò, latha math! Uill... bha mi a' smaoineachadh nach fhaiceadh mi thu an seo. Gu fìrinneach... bha e na latha glè fhada, ach, haha, tha mi toilichte gun do choinnich sinn!",
        "la": "O, salve! Em... non exspectabam te hic videre. Vere... dies valde longus fuit, sed, haha, gaudeo nos convenisse!",
        "he": "או, היי! אהמ... לא ציפיתי לראות אותך כאן. בכנות... זה היה יום ממש ארוך, אבל, חחח, אני שמח שנתקלנו אחד בשני!",
        "ne": "ओहो, नमस्ते! उम... मैले तपाईंलाई यहाँ देख्ने आश गरेको थिइनँ। साँचो भन्नुपर्दा... आजको दिन निकै लामो रह्यो, तर, हाहा, हामी यसरी भेट भएकोमा खुसी लाग्यो!",
        "mn": "Өө, сайн уу! Өө... чамайг энд харж магадгүй гэж бодсонгүй. Үнэндээ... өнөөдөр үнэхээр урт өдөр байлаа, гэхдээ, хаха, ингээд таарсандаа баяртай байна!",
        "bo": "ཨོ་ལེགས་སོ། ཨེམ... ང་ཁྱེད་རང་འདིར་མཐོང་བའི་རེ་བ་བྱས་མེད། དྲང་པོར་བཤད་ན... དེ་རིང་ཉིན་མ་ཧ་ཅང་རིང་པོ་ཞིག་རེད། ཡིན་ནའང་། ཧ་ཧ། ང་ཚོ་ཐུག་པ་འདིར་དགའ་པོ་བྱུང་།",
        "sw": "Oh, mambo! Um... sikutarajia kukuona hapa. Kusema kweli... imekuwa siku ndefu sana, lakini, haha, nina furaha tumekutana!",
        "id": "Oh, hai! Um... aku nggak nyangka bakal ketemu kamu di sini. Jujur ya... hari ini panjang banget, tapi, haha, aku seneng kita bisa kebetulan ketemu!"
    };
    const sampleText = previewTexts[baseLang] || previewTexts["en"];
    
    if (type === 'basic') {
        if (typeof window.speakText === 'function') window.speakText(sampleText, targetLanguage);
        else alert("일반 기기 음성: " + sampleText);
    } else if (type === 'premium') {
        const selectedVoiceCode = localStorage.getItem('premium_voice_code') || 'Zephyr';
        const avatarWrap = document.getElementById('avatarWrap');
        if(avatarWrap) avatarWrap.style.borderColor = "#f59e0b"; 

        try {
            const cleanUrl = WORKER_URL.replace(/\/$/, '') + '/tts';
            const response = await fetch(cleanUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: sampleText, voiceCode: selectedVoiceCode })
            });
            const data = await response.json();
            
            if (data.audioContent) {
                // 🔥 원래 쓰시던 무적의 제미나이 재생기 출격!
                await window.playGeminiAudio(data.audioContent);
                if(avatarWrap) avatarWrap.style.borderColor = "#bfdbfe";
            } else if (data.error) {
                alert("🚨 제미나이 생성 에러:\n" + data.error);
                if(avatarWrap) avatarWrap.style.borderColor = "#bfdbfe";
            } else {
                alert("알 수 없는 이유로 음성 생성에 실패했습니다.");
                if(avatarWrap) avatarWrap.style.borderColor = "#bfdbfe";
            }
        } catch (error) {
            console.error("네트워크 에러:", error);
            alert("네트워크 연결 실패: 워커 주소나 인터넷 상태를 확인해주세요.");
            if(avatarWrap) avatarWrap.style.borderColor = "#bfdbfe";
        }
    }
};

// ==========================================
// 🔊 제미나이 전용 오디오 재생기 (완전체: Raw PCM 직결 방식)
// ==========================================
window.playGeminiAudio = async function(base64Data) {
    return new Promise((resolve, reject) => {
        try {
            if (!base64Data || base64Data.length < 100) {
                alert("🚨 수신된 데이터가 없습니다.");
                return reject("Empty data");
            }

            // 1. 구글이 던진 날것의 텍스트를 기계어 배열로 변환
            const cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, "");
            const binaryString = atob(cleanBase64);
            
            // 2. 제미나이는 16-bit PCM(2바이트 묶음)을 사용하므로 그릇을 준비
            const buffer = new ArrayBuffer(binaryString.length);
            const view = new DataView(buffer);
            for (let i = 0; i < binaryString.length; i++) {
                view.setUint8(i, binaryString.charCodeAt(i));
            }
            
            // 3. 기계어를 소리 파형 데이터(Int16)로 묶어줌
            const int16Array = new Int16Array(buffer);
            
            // 💡 [핵심] 브라우저 스피커 엔진 가동 (제미나이 표준 주파수 24,000Hz 세팅)
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();
            
            // 1채널(모노), 데이터 길이, 24kHz 주파수
            const audioBuffer = audioCtx.createBuffer(1, int16Array.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            
            // 4. 날것의 파형을 스피커가 이해할 수 있는 전기 신호(-1.0 ~ 1.0)로 변환
            for (let i = 0; i < int16Array.length; i++) {
                channelData[i] = int16Array[i] / 32768.0; 
            }
            
            // 5. 스피커에 다이렉트 꽂기!
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);
            
            source.onended = resolve;
            source.start(0); 
            
            console.log("✅ 제미나이 PCM 날것 데이터 해독 및 직결 재생 성공!");

        } catch (error) {
            console.error("🚨 PCM 변환 완전 실패:", error);
            reject(error);
        }
    });
};

// 🚨 무적의 감시 카메라: 디자인(UI)에 상관없이 0.5초마다 언어 변경을 100% 잡아냅니다!
let lastCheckedLang = localStorage.getItem('target_language') || 'en-US';

setInterval(() => {
    const currentSavedLang = localStorage.getItem('target_language');
    if (currentSavedLang && currentSavedLang !== lastCheckedLang) {
        lastCheckedLang = currentSavedLang;
        if (typeof window.updatePremiumVoiceList === 'function') {
            window.updatePremiumVoiceList(currentSavedLang);
        }
    }
}, 500);

setTimeout(() => {
    const savedPremiumVoice = localStorage.getItem('premium_voice_name');
    if (savedPremiumVoice) {
        document.getElementById('disp-voiceName-premium').innerText = savedPremiumVoice;
    }
}, 500);





// ==========================================
// 🌐 대면 통역기 전역 변수 설정
// ==========================================
window.isInterpActive = false;
window.interpRec = null;
window.interpHistoryTop = [];
window.interpHistoryBottom = [];

window.activeMicSpeaker = null;
window.manualStop = false; 
window.hasSpoken = false;  

// ==========================================
// 1. 언어 변경 시 처리 로직 (양방향 동기화 완벽 적용)
// ==========================================
// 🌟 3. changeInterpLang 함수 덮어쓰기
window.changeInterpLang = function(settingKey, langCode) {
    localStorage.setItem(settingKey, langCode);
    const targetId = (settingKey === 'target_language') ? 'targetLanguage' : 'sttInputLanguage';
    const originSelect = document.getElementById(targetId);
    if(originSelect) {
        originSelect.value = langCode;
        if(typeof window.updateLangDisplays === 'function') window.updateLangDisplays();
    }
    
    window.manualStop = true; 
    if (window.interpRec) {
        window.interpRec.onend = null;
        window.interpRec.onerror = null;
        try { window.interpRec.abort(); } catch(e) {}
    }
    window.resetMicUI();
    
    const status = document.getElementById('interp-status');
    if(status) status.innerHTML = window.getTrans('ui_interp_lang_changed', "언어가 변경되었습니다 🎙️");
};

// ==========================================
// 2. 통역기 창 열기 (빈 박스 버그 완벽 해결)
// ==========================================
window.openInterpreter = function() {
    if(typeof window.closeAllPanels === 'function') window.closeAllPanels();
    
    const modal = document.getElementById('interpreterModal');
    if(!modal) return alert("통역기 화면을 찾을 수 없습니다.");
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.zIndex = '99999'; 
    
    window.interpHistoryTop = [];
    window.interpHistoryBottom = [];
    const topText = document.getElementById('interp-text-top');
    const bottomText = document.getElementById('interp-text-bottom');
    if(topText) topText.innerHTML = '';
    if(bottomText) bottomText.innerHTML = '';
    
    const settingTarget = document.getElementById('targetLanguage'); 
    const settingInput = document.getElementById('sttInputLanguage'); 
    
    const topSelect = document.getElementById('interp-lang-top-sel');
    const bottomSelect = document.getElementById('interp-lang-bottom-sel');

    if (settingTarget && topSelect) {
        topSelect.innerHTML = settingTarget.innerHTML;
    }
    if (settingInput && bottomSelect) {
        bottomSelect.innerHTML = settingInput.innerHTML;
    }

    try {
        const tLangValue = localStorage.getItem('target_language') || 'en-US';
        const sLangValue = localStorage.getItem('stt_input_language') || 'ko-KR';
        if(topSelect) topSelect.value = tLangValue;
        if(bottomSelect) bottomSelect.value = sLangValue;
    } catch(e) {}
    
    window.resetMicUI();
};

// ==========================================
// 3. 통역기 창 닫기
// ==========================================
window.closeInterpreter = function() {
    window.manualStop = true;
    if (window.interpRec) {
        window.interpRec.onend = null;
        window.interpRec.onerror = null;
        try { window.interpRec.abort(); } catch(e) {}
    }
    
    window.resetMicUI();

    const modal = document.getElementById('interpreterModal');
    if(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none'; 
    }
};

// ==========================================
// 4. 마이크 UI 리셋
// ==========================================
window.resetMicUI = function() {
    const btnTop = document.getElementById('btn-mic-top');
    const btnBottom = document.getElementById('btn-mic-bottom');
    const otherMicText = window.getTrans('ui_interp_mic_other', "상대방 마이크 (터치하여 말하기)");
    const myMicText = window.getTrans('ui_interp_mic_me', "내 마이크 (터치하여 말하기)");

    if(btnTop) {
        btnTop.className = "w-full py-3.5 rounded-xl bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 active:scale-[0.98]";
        btnTop.innerHTML = `<i class="fa-solid fa-microphone text-lg"></i><span class="text-sm font-bold">${otherMicText}</span>`;
    }
    if(btnBottom) {
        btnBottom.className = "w-full py-3.5 rounded-xl bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 active:scale-[0.98]";
        btnBottom.innerHTML = `<i class="fa-solid fa-microphone text-lg"></i><span class="text-sm font-bold">${myMicText}</span>`;
    }
    
    const status = document.getElementById('interp-status');
    if(status) status.innerHTML = window.getTrans('ui_interp_select_mic', "마이크를 선택하세요 🎙️");
    window.activeMicSpeaker = null;
};

// ==========================================
// 5. 버튼 터치 시 턴 뺏기 / 수동 제어
// ==========================================
// 🌟 5. toggleMic 함수 덮어쓰기
window.toggleMic = function(speaker) {
    const status = document.getElementById('interp-status');

    if (window.activeMicSpeaker === speaker) {
        window.manualStop = true; 
        if (window.interpRec) {
            window.interpRec.onend = null;
            window.interpRec.onerror = null; 
            try { window.interpRec.abort(); } catch(e) {} 
        }
        window.resetMicUI();
        if(status) status.innerHTML = window.getTrans('ui_interp_paused', "대기 중 (마이크를 눌러 재개) ⏸️");
        return; 
    }

    window.manualStop = true; 
    if (window.interpRec) {
        window.interpRec.onend = null;
        window.interpRec.onerror = null; 
        try { window.interpRec.abort(); } catch(e) {} 
    }

    if(status) status.innerHTML = window.getTrans('ui_interp_getting_turn', "턴을 가져오는 중... ⚡");
    setTimeout(() => { window.startPingPongMic(speaker); }, 250);
};

// ==========================================
// 6. 핑퐁 사이클 핵심 엔진 (대표님이 원하시는 오리지널 방식 복구!)
// ==========================================
// 🌟 6. startPingPongMic 함수 덮어쓰기
window.startPingPongMic = function(speaker) {
    window.manualStop = false; 
    window.hasSpoken = false; 
    window.resetMicUI();
    window.activeMicSpeaker = speaker;

    const activeBtn = speaker === 'OTHER' ? document.getElementById('btn-mic-top') : document.getElementById('btn-mic-bottom');
    const listeningText = window.getTrans('ui_interp_listening', "듣는 중... (터치 시 턴 뺏기)");

    if (activeBtn) {
        activeBtn.className = "w-full py-3.5 rounded-xl bg-red-500 text-white border border-red-600 flex items-center justify-center gap-2 shadow-md transition-all duration-300 animate-pulse scale-[1.02]";
        activeBtn.innerHTML = `<i class="fa-solid fa-bolt text-lg"></i><span class="text-sm font-bold">${listeningText}</span>`;
    }

    const langCode = speaker === 'ME' ? (localStorage.getItem('stt_input_language') || 'ko-KR') : (localStorage.getItem('target_language') || 'en-US');

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        window.interpRec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        window.interpRec.continuous = false; 
        window.interpRec.interimResults = false;
        window.interpRec.lang = langCode;

        const status = document.getElementById('interp-status');

        window.interpRec.onstart = () => {
    const myTurnTxt = window.getTrans('ui_interp_my_turn', "내 차례입니다 🎙️");
    const otherTurnTxt = window.getTrans('ui_interp_other_turn', "상대방 차례입니다 🎙️");
    if(status) status.innerHTML = speaker === 'ME' ? 
        `<span class="text-blue-600 font-bold">${myTurnTxt}</span>` : 
        `<span class="text-orange-600 font-bold">${otherTurnTxt}</span>`;
};

        window.interpRec.onresult = (e) => {
            const transcript = e.results[e.results.length - 1][0].transcript;
            if(transcript.trim()) {
                window.hasSpoken = true; 
                window.processInterpTranslationExplicit(transcript, speaker);
            }
        };

        window.interpRec.onerror = (e) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                window.manualStop = true; 
                window.resetMicUI();
                if(status) status.innerHTML = window.getTrans('ui_interp_error', "오류 발생. 마이크를 다시 누르세요.");
            }
        };

        window.interpRec.onend = () => {
            if (window.manualStop) {
                // 수동으로 멈췄을 때는 가만히 있음
            } else if (window.hasSpoken) {
                const nextSpeaker = speaker === 'ME' ? 'OTHER' : 'ME';
                if(status) status.innerHTML = window.getTrans('ui_interp_changing_turn', "턴 교체 중... 🏓");
                setTimeout(() => { window.startPingPongMic(nextSpeaker); }, 300);
            } else {
                if(status) status.innerHTML = window.getTrans('ui_interp_keep_listening', "계속 듣고 있습니다... 👂");
                setTimeout(() => { window.startPingPongMic(speaker); }, 100);
            }
        };

        try { window.interpRec.start(); } catch(e) { window.resetMicUI(); }
    }
};

// ==========================================
// 7. 딥시크 텍스트 통신
// ==========================================
window.processInterpTranslationExplicit = async function(text, speaker) {
    if (!text.trim()) return;
    
    const langA = localStorage.getItem('stt_input_language') || 'ko-KR'; 
    const langB = localStorage.getItem('target_language') || 'en-US';

    const sourceLang = speaker === 'ME' ? langA : langB;
    const targetLang = speaker === 'ME' ? langB : langA;

    const sysPrompt = `You are a strict, professional translator.
    Source language: [${sourceLang}]
    Target language: [${targetLang}]

    RULE: Translate the input text directly into the Target language.
    NO explanations, NO notes. Output ONLY JSON.

    Respond in JSON format EXACTLY like this:
    {
       "text_original": "The corrected spelling of the input in [${sourceLang}]",
       "text_translated": "The translated text in [${targetLang}]"
    }`;

    try {
        let res = await fetchAPI(WORKER_URL + 'translate-interp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: text }], response_format: { type: "json_object" } })
        });
        
        let data = await res.json();
        let rawContent = data.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
        let parsed = JSON.parse(rawContent.match(/\{[\s\S]*\}/)[0]);
        
        if (speaker === "ME") {
            window.interpHistoryTop.push({ translated: parsed.text_translated, original: parsed.text_original });
            if(window.interpHistoryTop.length > 20) window.interpHistoryTop.shift();
            window.renderInterpTop();
        } else {
            window.interpHistoryBottom.unshift({ translated: parsed.text_translated, original: parsed.text_original });
            if(window.interpHistoryBottom.length > 20) window.interpHistoryBottom.pop();
            window.renderInterpBottom();
        }
    } catch(e) {
        console.error("통역 에러:", e);
    }
};

// ==========================================
// 8. 화면 렌더링
// ==========================================
window.renderInterpTop = function() {
    const container = document.getElementById('interp-text-top');
    if(!container) return;
    container.innerHTML = window.interpHistoryTop.map((msg, i) => `
        <div class="mb-5 ${i === window.interpHistoryTop.length - 1 ? 'opacity-100' : 'opacity-40'} transition-opacity duration-300 flex flex-col items-start w-full">
            <span class="text-2xl sm:text-3xl font-black text-slate-800 break-keep">${msg.translated}</span>
            <span class="text-xs font-bold text-blue-600 mt-1 border-l-[3px] border-blue-400 pl-2 bg-blue-50/50 pr-3 py-0.5 rounded-r-lg">${msg.original}</span>
        </div>
    `).join('');
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
};

window.renderInterpBottom = function() {
    const container = document.getElementById('interp-text-bottom');
    if(!container) return;
    container.innerHTML = window.interpHistoryBottom.map((msg, i) => `
        <div class="mb-5 ${i === 0 ? 'opacity-100' : 'opacity-40'} transition-opacity duration-300 flex flex-col items-end w-full">
            <span class="text-2xl sm:text-3xl font-black text-slate-800 break-keep text-right">${msg.translated}</span>
            <span class="text-xs font-bold text-orange-600 mt-1 border-r-[3px] border-orange-400 pr-2 bg-orange-50/50 pl-3 py-0.5 rounded-l-lg text-right">${msg.original}</span>
        </div>
    `).join('');
    setTimeout(() => { container.scrollTop = 0; }, 50);
};
// ==========================================
// 9. 하단 번역 메뉴 토글 및 스마트 번역 기능
// ==========================================
window.toggleTranslateMenu = function() {
    const menu = document.getElementById('translateModeMenu');
    if (menu) menu.classList.toggle('hidden');
};

window.activateSmartTranslate = function() {
    if (typeof window.changeAppMode === 'function') window.changeAppMode('translate');
    if (typeof window.navigate === 'function') window.navigate('screen-main');
    if (typeof window.updateStatus === 'function') window.updateStatus("스마트 번역 모드로 전환되었습니다.");
};

// 🌐 언어가 변경될 때 호출하는 함수
window.updateUiLanguage = function(newLang) {
    // 1. 숨겨진 언어 기준 값(explanationLanguage)을 최신 언어로 강제 업데이트
    const langInput = document.getElementById('explanationLanguage');
    if (langInput) {
        langInput.value = newLang;
    }

    // 2. 만약 화면에 결제창(모달)이 띄워져 있다면 새 언어로 즉시 다시 열기
    const openModal = document.getElementById('subscriptionModal');
    if (openModal) {
        const currentReason = openModal.getAttribute('data-reason') || 'upgrade';
        window.showSubscriptionModal(currentReason); 
    }

    // 3. 🌟 홈 화면 배너 즉시 번역 (추가된 부분)
    if (typeof applyBannerTranslation === 'function') {
        applyBannerTranslation();
    }
}
// 🌟 언어 변경 시 화면 전체를 즉시 번역하는 강제 갱신 함수
window.refreshAllTranslations = function() {
    const lang = window.getAppLang(); // 현재 설정된 언어 가져오기
    
    // 1. 배너 텍스트 갱신
    if (typeof window.applyBannerTranslation === 'function') {
        window.applyBannerTranslation();
    }
    
    // 2. 기존 HTML의 [data-i18n] 속성을 가진 모든 요소 갱신
    const dict = window.UI_DICTIONARY[lang] || window.UI_DICTIONARY['en'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });
    
    // 3. 결제 모달창이 열려있다면 즉시 언어 적용
    const openModal = document.getElementById('subscriptionModal');
    if (openModal) {
        window.showSubscriptionModal(openModal.getAttribute('data-reason') || 'upgrade');
    }
    
    console.log("🎨 UI 언어 강제 갱신 완료:", lang);
};

// ==========================================
// 🚨 실시간 대면 통역 & 자동 전송 완벽 번역 모듈 (script.js 맨 아래 덮어쓰기)
// ==========================================
(function() {
    // 1. 번역 데이터 강제 주입
    const EXTRA_TRANS = {
        "ko": {
            ui_auto_send: "자동 전송", ui_auto_send_on: "자동 전송 ON", ui_auto_send_off: "자동 전송 OFF",
            ui_interp_live: "🎙️ 실시간 대면 통역", ui_interp_smart: "🧠 스마트 번역",
            ui_interp_mic_other: "상대방 마이크 (터치하여 말하기)", ui_interp_mic_me: "내 마이크 (터치하여 말하기)",
            ui_interp_listening: "듣는 중... (터치 시 턴 뺏기)", ui_interp_select_mic: "마이크를 선택하세요 🎙️",
            ui_interp_my_turn: "내 차례입니다 🎙️", ui_interp_other_turn: "상대방 차례입니다 🎙️",
            ui_interp_paused: "대기 중 (마이크를 눌러 재개) ⏸️", ui_interp_lang_changed: "언어가 변경되었습니다 🎙️",
            ui_interp_getting_turn: "턴을 가져오는 중... ⚡", ui_interp_error: "오류 발생. 마이크를 다시 누르세요.",
            ui_interp_changing_turn: "턴 교체 중... 🏓", ui_interp_keep_listening: "계속 듣고 있습니다... 👂"
        },
        "en": {
            ui_auto_send: "Auto Send", ui_auto_send_on: "Auto Send ON", ui_auto_send_off: "Auto Send OFF",
            ui_interp_live: "🎙️ Live Interpreter", ui_interp_smart: "🧠 Smart Translate",
            ui_interp_mic_other: "Other's Mic (Touch to speak)", ui_interp_mic_me: "My Mic (Touch to speak)",
            ui_interp_listening: "Listening... (Touch to take turn)", ui_interp_select_mic: "Select a microphone 🎙️",
            ui_interp_my_turn: "My turn 🎙️", ui_interp_other_turn: "Other's turn 🎙️",
            ui_interp_paused: "Paused (Press mic to resume) ⏸️", ui_interp_lang_changed: "Language changed 🎙️",
            ui_interp_getting_turn: "Taking turn... ⚡", ui_interp_error: "Error. Press mic again.",
            ui_interp_changing_turn: "Changing turn... 🏓", ui_interp_keep_listening: "Still listening... 👂"
        },
        "ja": {
            ui_auto_send: "自動送信", ui_auto_send_on: "自動送信 ON", ui_auto_send_off: "自動送信 OFF",
            ui_interp_live: "🎙️ リアルタイム通訳", ui_interp_smart: "🧠 スマート翻訳",
            ui_interp_mic_other: "相手のマイク (タッチして話す)", ui_interp_mic_me: "自分のマイク (タッチして話す)",
            ui_interp_listening: "リスニング中... (タッチで奪取)", ui_interp_select_mic: "マイクを選択してください 🎙️",
            ui_interp_my_turn: "私の番です 🎙️", ui_interp_other_turn: "相手の番です 🎙️",
            ui_interp_paused: "待機中 (マイクを押して再開) ⏸️", ui_interp_lang_changed: "言語が変更されました 🎙️",
            ui_interp_getting_turn: "ターンを取得中... ⚡", ui_interp_error: "エラー。もう一度押してください。",
            ui_interp_changing_turn: "ターン交替中... 🏓", ui_interp_keep_listening: "引き続きリスニング中... 👂"
        },
        "zh": {
            ui_auto_send: "自动发送", ui_auto_send_on: "自动发送开启", ui_auto_send_off: "自动发送关闭",
            ui_interp_live: "🎙️ 实时同传", ui_interp_smart: "🧠 智能翻译",
            ui_interp_mic_other: "对方麦克风 (点击说话)", ui_interp_mic_me: "我的麦克风 (点击说话)",
            ui_interp_listening: "聆听中... (点击抢占回合)", ui_interp_select_mic: "请选择麦克风 🎙️",
            ui_interp_my_turn: "到我了 🎙️", ui_interp_other_turn: "对方回合 🎙️",
            ui_interp_paused: "暂停中 (点击恢复) ⏸️", ui_interp_lang_changed: "语言已更改 🎙️",
            ui_interp_getting_turn: "正在抢占回合... ⚡", ui_interp_error: "发生错误，请重新点击。",
            ui_interp_changing_turn: "回合切换中... 🏓", ui_interp_keep_listening: "继续聆听中... 👂"
        },
        "es": {
            ui_auto_send: "Envío Auto", ui_auto_send_on: "Envío Auto ON", ui_auto_send_off: "Envío Auto OFF",
            ui_interp_live: "🎙️ Intérprete en Vivo", ui_interp_smart: "🧠 Traducción Inteligente",
            ui_interp_mic_other: "Mic del Otro (Tocar para hablar)", ui_interp_mic_me: "Mi Mic (Tocar para hablar)",
            ui_interp_listening: "Escuchando... (Tocar para turno)", ui_interp_select_mic: "Seleccione un micrófono 🎙️",
            ui_interp_my_turn: "Mi turno 🎙️", ui_interp_other_turn: "Turno del otro 🎙️",
            ui_interp_paused: "En espera (Presione el mic) ⏸️", ui_interp_lang_changed: "Idioma cambiado 🎙️",
            ui_interp_getting_turn: "Tomando turno... ⚡", ui_interp_error: "Error. Presione de nuevo.",
            ui_interp_changing_turn: "Cambiando turno... 🏓", ui_interp_keep_listening: "Sigo escuchando... 👂"
        }
    };

    if (typeof window.UI_DICTIONARY !== 'undefined') {
        Object.keys(EXTRA_TRANS).forEach(lang => {
            if (window.UI_DICTIONARY[lang]) Object.assign(window.UI_DICTIONARY[lang], EXTRA_TRANS[lang]);
        });
    }

    // 🌟 2. 텍스트 번역 도우미 (오류 완벽 수정: 무조건 로컬스토리지에서 찐언어 가져옴!)
    window.getTrans = function(key, defaultStr) {
        const langCode = localStorage.getItem('explanation_language') || 'ko-KR';
        const lang = langCode.split('-')[0];
        const dict = window.UI_DICTIONARY ? window.UI_DICTIONARY[lang] : null;
        return (dict && dict[key]) ? dict[key] : defaultStr;
    };

    // 3. 동적 마이크 UI / 상태창 텍스트 변경
    window.toggleAutoSend = function() {
        window.isAutoSend = !window.isAutoSend;
        const btn = document.getElementById('autoSendToggleBtn');
        const icon = document.getElementById('autoSendIcon');
        if(window.isAutoSend) {
            btn.classList.replace('bg-slate-100', 'bg-blue-50'); btn.classList.replace('text-slate-500', 'text-blue-600'); btn.classList.replace('border-slate-200', 'border-blue-200'); icon.classList.replace('fa-toggle-off', 'fa-toggle-on');
            window.updateStatus(window.getTrans('ui_auto_send_on', "자동 전송 ON"));
        } else {
            btn.classList.replace('bg-blue-50', 'bg-slate-100'); btn.classList.replace('text-blue-600', 'text-slate-500'); btn.classList.replace('border-blue-200', 'border-slate-200'); icon.classList.replace('fa-toggle-on', 'fa-toggle-off');
            window.updateStatus(window.getTrans('ui_auto_send_off', "자동 전송 OFF"));
        }
    };

    window.resetMicUI = function() {
        const btnTop = document.getElementById('btn-mic-top');
        const btnBottom = document.getElementById('btn-mic-bottom');
        if(btnTop) {
            btnTop.className = "w-full py-3.5 rounded-xl bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 active:scale-[0.98]";
            btnTop.innerHTML = `<i class="fa-solid fa-microphone text-lg"></i><span class="text-sm font-bold">${window.getTrans('ui_interp_mic_other', "상대방 마이크 (터치하여 말하기)")}</span>`;
        }
        if(btnBottom) {
            btnBottom.className = "w-full py-3.5 rounded-xl bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 active:scale-[0.98]";
            btnBottom.innerHTML = `<i class="fa-solid fa-microphone text-lg"></i><span class="text-sm font-bold">${window.getTrans('ui_interp_mic_me', "내 마이크 (터치하여 말하기)")}</span>`;
        }
        const status = document.getElementById('interp-status');
        if(status) status.innerHTML = window.getTrans('ui_interp_select_mic', "마이크를 선택하세요 🎙️");
        window.activeMicSpeaker = null;
    };

    window.startPingPongMic = function(speaker) {
        window.manualStop = false; window.hasSpoken = false; window.resetMicUI(); window.activeMicSpeaker = speaker;
        const activeBtn = speaker === 'OTHER' ? document.getElementById('btn-mic-top') : document.getElementById('btn-mic-bottom');
        if (activeBtn) {
            activeBtn.className = "w-full py-3.5 rounded-xl bg-red-500 text-white border border-red-600 flex items-center justify-center gap-2 shadow-md transition-all duration-300 animate-pulse scale-[1.02]";
            activeBtn.innerHTML = `<i class="fa-solid fa-bolt text-lg"></i><span class="text-sm font-bold">${window.getTrans('ui_interp_listening', "듣는 중... (터치 시 턴 뺏기)")}</span>`;
        }
        const langCode = speaker === 'ME' ? (localStorage.getItem('stt_input_language') || 'ko-KR') : (localStorage.getItem('target_language') || 'en-US');
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            window.interpRec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            window.interpRec.continuous = false; window.interpRec.interimResults = false; window.interpRec.lang = langCode;
            const status = document.getElementById('interp-status');
            window.interpRec.onstart = () => {
                if(status) status.innerHTML = speaker === 'ME' ? `<span class="text-blue-600 font-bold">${window.getTrans('ui_interp_my_turn', "내 차례입니다 🎙️")}</span>` : `<span class="text-orange-600 font-bold">${window.getTrans('ui_interp_other_turn', "상대방 차례입니다 🎙️")}</span>`;
            };
            window.interpRec.onresult = (e) => {
                if(e.results[e.results.length - 1][0].transcript.trim()) { window.hasSpoken = true; window.processInterpTranslationExplicit(e.results[e.results.length - 1][0].transcript, speaker); }
            };
            window.interpRec.onerror = (e) => {
                if (e.error !== 'no-speech' && e.error !== 'aborted') { window.manualStop = true; window.resetMicUI(); if(status) status.innerHTML = window.getTrans('ui_interp_error', "오류 발생. 마이크를 다시 누르세요."); }
            };
            window.interpRec.onend = () => {
                if (window.manualStop) { /* 수동 정지 */ } 
                else if (window.hasSpoken) {
                    if(status) status.innerHTML = window.getTrans('ui_interp_changing_turn', "턴 교체 중... 🏓");
                    setTimeout(() => { window.startPingPongMic(speaker === 'ME' ? 'OTHER' : 'ME'); }, 300);
                } else {
                    if(status) status.innerHTML = window.getTrans('ui_interp_keep_listening', "계속 듣고 있습니다... 👂");
                    setTimeout(() => { window.startPingPongMic(speaker); }, 100);
                }
            };
            try { window.interpRec.start(); } catch(e) { window.resetMicUI(); }
        }
    };
})();



// ==========================================
// 🚨 안드로이드 뒤로가기(백버튼) 제어 및 종료 팝업 모듈
// ==========================================
(function() {
    // 1. 초기 접속 시 가짜 방문 기록을 하나 밀어넣음 (뒤로가기를 잡기 위한 덫)
    window.history.pushState({ page: 'main' }, null, '');

    // 2. 사용자가 폰에서 뒤로가기(<) 버튼을 눌렀을 때 감지
    window.addEventListener('popstate', function(event) {
        let modalClosed = false;

        // 1단계: 열려있는 팝업이나 모달창이 있다면 우선적으로 닫기
        const modals = ['subscriptionModal', 'streak-modal', 'memoModal', 'customLangModal', 'paywallModal', 'helpXrayOverlay'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el && (!el.classList.contains('hidden') || el.style.display === 'flex')) {
                if (id === 'subscriptionModal') el.remove();
                else el.classList.add('hidden');
                modalClosed = true;
            }
        });

        // 통역기 창이 열려있다면 닫기
        const interpModal = document.getElementById('interpreterModal');
        if (interpModal && !interpModal.classList.contains('hidden')) {
            if (typeof window.closeInterpreter === 'function') window.closeInterpreter();
            modalClosed = true;
        }

        // 모달창을 닫은 경우, 앱이 꺼지면 안되므로 다시 덫(pushState)을 놓음
        if (modalClosed) {
            window.history.pushState({ page: 'main' }, null, '');
            return;
        }

        // 2단계: 모달창이 없고, 홈 화면이 아니라면 홈 화면으로 돌려보냄
        if (window.currentActiveScreen !== 'screen-home') {
            if (typeof window.navigate === 'function') window.navigate('screen-home');
            window.history.pushState({ page: 'main' }, null, '');
            return;
        }

        // 3단계: 홈 화면이고 팝업도 없다면 '종료 확인 팝업'을 띄움
        const exitModal = document.getElementById('exitModal');
        if (exitModal) {
            exitModal.classList.remove('hidden');
        }
        
        // 팝업에서 취소를 누를 수 있으므로 다시 덫을 놓아둠
        window.history.pushState({ page: 'main' }, null, '');
    });
})();

// 3. 진짜 '종료하기' 버튼을 눌렀을 때 실행되는 함수
window.confirmAppExit = function() {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        // 플러터 앱으로 종료 신호를 쏩니다.
        window.flutter_inappwebview.callHandler('exitApp');
    } else {
        // 웹 브라우저 테스트용
        window.close();
    }
};

// 결제 내역 복원 함수
window.restorePurchase = function() {
    console.log("결제 복원 버튼 클릭됨");
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview.callHandler('restorePurchase');
    } else {
        alert("앱 환경에서만 결제 복원이 가능합니다.");
    }
};