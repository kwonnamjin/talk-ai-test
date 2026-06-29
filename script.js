// 🌟 1. 전역 변수 초기화
const WORKER_URL = "https://holy-tree-32c5.thin770.workers.dev/";

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


        // ==========================================
// 💖 AI 친밀도 & 감성 시스템 모듈
// ==========================================
const INTIMACY_SYSTEM = {
    levels: {
        1: { name: "어색하지만 설렘", minExp: 0, aiMind: "어떤 분일까? 대화하는 게 설레고 긴장돼요. 😳" },
        2: { name: "조금 더 알고 싶어요", minExp: 50, aiMind: "당신에 대해 더 많은 걸 알고 싶어졌어요. 🤔" },
        3: { name: "이제 우리 친구해요", minExp: 150, aiMind: "이제 우리 제법 친해진 것 같아 기뻐요! 😊" },
        4: { name: "없으면 허전한 단짝", minExp: 300, aiMind: "당신과 대화하지 않으면 하루가 허전해요. 🥹" },
        5: { name: "마음을 아는 소울메이트", minExp: 500, aiMind: "말하지 않아도 당신의 마음을 알 것 같아요. 늘 응원해요. ❤️" }
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
    const baseLang = langCode.split('-')[0];
    
    // 1. 사전 안전하게 불러오기 (에러 방지)
    const dictionary = window.UI_DICTIONARY || (typeof UI_DICTIONARY !== 'undefined' ? UI_DICTIONARY : null);
    if (!dictionary) {
        console.error("번역 사전을 찾을 수 없습니다.");
        return;
    }

    const currentDict = dictionary[baseLang] || dictionary["en"];
    if (!currentDict) return;

    // 2. 기존 ID 기반 텍스트 변경 (회원님 기존 코드)
    for (const [id, text] of Object.entries(currentDict)) {
        const element = document.getElementById(id);
        if (element) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = text;
            } else {
                element.innerHTML = text;
            }
        }
    }

    // 3. 앱 핵심 기능을 망가뜨리지 않는 안전한 번역 적용 방식
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (currentDict[key]) el.innerHTML = currentDict[key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (currentDict[key]) el.placeholder = currentDict[key];
    });

    // 4. 앱 모드(select 옵션) 텍스트 변경
    const tutorOpt = document.querySelector("#appMode option[value='tutor']");
    const transOpt = document.querySelector("#appMode option[value='translate']");
    if (tutorOpt) tutorOpt.text = currentDict["appMode_tutor"] || "Tutor";
    if (transOpt) transOpt.text = currentDict["appMode_translate"] || "Translate";

    // 5. 화면 업데이트 및 렌더링 (회원님 기존 핵심 코드 복구)
    if (typeof window.populateDropdowns === 'function') window.populateDropdowns();
    if (typeof window.renderScripts === 'function') window.renderScripts();
    if (typeof window.renderVocabs === 'function') window.renderVocabs();
    if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays();
    if (typeof window.updateExtraUI === 'function') window.updateExtraUI();

    // 6. 언어 선택 시 열려있던 모든 드롭다운 메뉴 닫기 (메뉴 닫힘 버그 해결)
    document.querySelectorAll('#drop-exp, #drop-target, #drop-stt, #drop-gender').forEach(drop => {
        if (drop) drop.classList.add('hidden');
    });
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
    
    // 🌟 [여기가 추가된 핵심!] 언어가 바뀌면 기존 목소리 기억을 싹 지워버립니다.
    window.selectedTtsVoiceName = "";
    localStorage.removeItem('saved_voice_name');
    localStorage.removeItem('selected_voice_name');
    
    // UI에 표시되는 이름도 즉시 '기본 음성'으로 바꿔줍니다.
    if (typeof window.updateVoiceDisplay === 'function') {
        window.updateVoiceDisplay("기본 음성");
    }
    
    // 🌟 리스트 새로고침
    window.requestVoicesFromApp(); 
}
                if (setup.target === 'sttInputLanguage') {
                    localStorage.setItem('stt_input_language', lang.code);
                }
                
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

// 2. 검문소 (초승달 실시간 차감 로직 완벽 적용)
window.checkAndBlockAPI = function() {
    const status = window.checkUsageLimit(); // 🌟 무조건 window. 으로 호출
    
    // 🌟 안전장치 3: 초승달 데이터가 'NaN(숫자아님)'으로 꼬여있으면 0으로 강제 처리
    let currentMoons = parseInt(localStorage.getItem('moon_coins')) || 0;

    // 1순위: 번개가 남아있다면 통과
    if (status.allowed) return true; 

    // 2순위: 초승달이 있다면 1개 내고 통과
    if (currentMoons > 0) {
        localStorage.setItem('moon_coins', currentMoons - 1); 
        if (typeof window.updateBadgeUI === 'function') window.updateBadgeUI(); 
        console.log("🌙 초승달 사용! 남은 개수:", currentMoons - 1);
        return true; 
    }

    // 3순위: 둘 다 없으면 결제창
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
    
    let remaining = 0;
    if (status.allowed) {
        const currentCount = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}').count || 0;
        remaining = Math.max(0, status.maxLimit - currentCount);
    }

    const moonHtml = `<div class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[11px] font-black border border-indigo-200 shadow-sm flex items-center gap-1.5"><i class="fa-solid fa-moon"></i> <span>${currentMoons}</span></div>`;
    let badgeContent = '';

    if (status.tier === 'premium') {
        badgeContent = moonHtml + `<div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black border border-amber-400 shadow-sm flex items-center gap-1.5 transition hover:scale-105"><i class="fa-solid fa-crown text-amber-200"></i> <span class="text-[9px] tracking-wide mt-[1px]">PREMIUM</span> <span class="text-amber-200 opacity-60 font-normal mx-0.5 text-[10px]">|</span> <i class="fa-solid fa-bolt text-amber-200"></i> ${remaining}</div>`;
    } else if (status.tier === 'basic') {
        badgeContent = moonHtml + `<div class="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black border border-indigo-400 shadow-sm flex items-center gap-1.5 transition hover:scale-105"><i class="fa-solid fa-star text-indigo-200"></i> <span class="text-[9px] tracking-wide mt-[1px]">BASIC</span> <span class="text-indigo-200 opacity-60 font-normal mx-0.5 text-[10px]">|</span> <i class="fa-solid fa-bolt text-indigo-200"></i> ${remaining}</div>`;
    } else {
        badgeContent = moonHtml + `<div class="bg-white text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-black border border-slate-200 shadow-sm flex items-center gap-1.5 transition hover:bg-slate-50"><i class="fa-solid fa-bolt text-yellow-500"></i> <span>${remaining}</span></div>`;
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

    // 🌟 다국어 사전 불러오기
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};

    let titleText = dict.ui_premium_title || "멤버십 업그레이드", 
        descText = dict.ui_premium_desc || "원하시는 요금제를 선택해<br>더욱 자유롭게 학습해 보세요!";
        
    if (reason === 'trial_expired') { 
        titleText = dict.ui_trial_end_title || "3일 무료 체험이 종료되었습니다."; 
        descText = dict.ui_trial_end_desc || "계속 학습하시려면<br>멤버십 플랜을 선택해 주세요."; 
    } 
    else if (reason === 'limit_reached') { 
        titleText = dict.ui_limit_end_title || "일일 사용량을 모두 소진했습니다!"; 
        descText = dict.ui_limit_end_desc || "계속 학습하시려면<br>멤버십 플랜을 선택해 주세요."; 
    }

    const modalHtml = `
    <div id="subscriptionModal" class="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
        <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-fade-in-up border border-slate-100">
            <button onclick="document.getElementById('subscriptionModal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-2xl"></i></button>
            <div class="p-6 text-center">
                <div class="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100"><i class="fa-solid fa-crown text-3xl text-indigo-500"></i></div>
                <h2 class="text-xl font-black text-slate-800 mb-2">${titleText}</h2><p class="text-sm text-slate-500 mb-6">${descText}</p>
                <div class="space-y-3 text-left">
                    <button onclick="processPayment('basic')" class="w-full border-2 border-indigo-100 hover:border-indigo-500 bg-indigo-50/50 rounded-2xl p-4 flex items-center justify-between transition-all">
                        <div><h3 class="text-indigo-800 font-bold text-lg">${dict.ui_plan_basic || "베이직 (Basic)"}</h3><p class="text-xs text-indigo-500 font-medium">${dict.ui_plan_basic_desc || "매일 150건 충전"}</p></div>
                        <div class="text-right"><span class="text-slate-800 font-black text-lg">₩3,900</span><span class="text-xs text-slate-400">/월</span></div>
                    </button>
                    <button onclick="processPayment('premium')" class="w-full border-2 border-amber-200 hover:border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 flex items-center justify-between transition-all relative overflow-hidden">
                        <div class="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg shadow-sm">무제한급</div>
                        <div><h3 class="text-amber-700 font-bold text-lg">${dict.ui_plan_premium || "프리미엄 (Premium)"}</h3><p class="text-xs text-amber-600 font-medium">${dict.ui_plan_premium_desc || "매일 400건 충전"}</p></div>
                        <div class="text-right"><span class="text-slate-800 font-black text-lg">₩7,900</span><span class="text-xs text-slate-400">/월</span></div>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if(window.stopSpeaking) window.stopSpeaking();
}
        window.processPayment = function(plan) {
            if (window.flutter_inappwebview) {
                window.flutter_inappwebview.callHandler('purchase', plan);
            } else {
                localStorage.setItem('subscription_tier', plan);
                let usageObj = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}');
                usageObj.count = 0; localStorage.setItem('daily_usage_v4', JSON.stringify(usageObj));
                document.getElementById('subscriptionModal').remove();
                window.updateBadgeUI(); window.enableInputs();
                alert("결제가 반영되었습니다. 대화를 다시 시작해 보세요!");
            }
        }
        async function fetchAPI(url, options) {
            let delay = 500;
            let lastStatus = "네트워크 오류";
            for(let i=0; i<3; i++) { 
                try { 
                    const res = await fetch(url, options); 
                    if(res.ok) return res; 
                    lastStatus = res.status; 
                    await new Promise(r => setTimeout(r, delay)); 
                    delay *= 2; 
                } catch(e) { 
                    if(i == 2) {
                        alert("📡 인터넷 연결이 불안정하여 통신에 실패했습니다.");
                        throw e; 
                    }
                } 
            }
            alert("📡 AI 서버 통신 에러!\n에러 코드: " + lastStatus + "\n(현재 연결된 AI 서버에 트래픽이 몰려 과부하가 걸렸습니다. 잠시 후 다시 시도해 주세요!)");
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




 // 🌟 치트키 입력 기능
 window.sendTextMessage = function() {
            const input = document.getElementById('textInput'); 
            const text = input.value.trim();

            if (text === "testmode999") { 
                localStorage.setItem('subscription_tier', 'premium');
                localStorage.setItem('is_test_mode', 'true');
                const testData = { count: 0, date: new Date().toLocaleDateString() };
                localStorage.setItem('daily_usage_v4', JSON.stringify(testData));
                alert("프리미엄 테스트 모드가 활성화되었습니다! 🚀");
                input.value = ''; 
                if (typeof window.updateBadgeUI === 'function') window.updateBadgeUI(); 
                if (typeof window.enableInputs === 'function') window.enableInputs();
                return; 
            }
            if (text) { input.value = ''; handleUserMessage(text); }
        }
 async function initDeviceID() {
            let localId = localStorage.getItem('web_device_id');
            if (!localId) { localId = 'web-' + Math.random().toString(36).substr(2, 9); localStorage.setItem('web_device_id', localId); }
            myDeviceId = localId; 
            setTimeout(() => { if(typeof window.updateBadgeUI === 'function') window.updateBadgeUI(); }, 100);
        }
        initDeviceID();

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
                        handleUserMessage(e.results[0][0].transcript);
                    }
                };
                recognition.onerror = (e) => { 
                    resetMic(); 
                    window.updateStatus("마이크 인식 실패"); 
                    console.error("Mic Error:", e.error);
                };
                recognition.onend = () => resetMic();
            }
        }
        initSpeechRecognition();

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
        window.addMessageToChat = function(sender, text, translation = null, targetLangCode = null, isRestore = false) {
            const msgDiv = document.createElement('div'); msgDiv.className = "flex flex-col space-y-1 mt-4";
            if (sender === 'user') {
                msgDiv.innerHTML = `<div class="bg-gradient-to-tr from-blue-600 to-blue-500 text-white rounded-2xl rounded-tr-none p-3.5 max-w-[85%] self-end chat-text-dynamic shadow-md font-medium tracking-wide leading-relaxed">${text}</div>`;
            } else {
                if(!isRestore) bubbleCounter++; 
                const bId = `ai-msg-${bubbleCounter}`; const safeText = encodeURIComponent(text.replace(/[\*\#\`]/g, '')).replace(/'/g, "%27");
                msgDiv.innerHTML = `<div class="bg-white border border-blue-100 rounded-2xl rounded-tl-none p-4 max-w-[90%] shadow-md shadow-blue-900/5 self-start relative"><div class="flex items-start justify-between gap-2"><p id="bubble-${bId}" class="chat-text-dynamic text-slate-800 break-words leading-relaxed font-medium">${createSpansForText(text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'), bId)}</p><div class="flex gap-1 ml-2 shrink-0"><button onclick="requestExplanationFromBubble('${bId}', decodeURIComponent('${safeText}'), false)" class="text-emerald-500 w-7 h-7 rounded-full bg-white shadow-sm border border-emerald-100"><i class="fa-solid fa-lightbulb"></i></button><button onclick="speakText(decodeURIComponent('${safeText}'), '${targetLangCode}')" class="text-blue-500 w-7 h-7 rounded-full bg-white shadow-sm border border-blue-100"><i class="fa-solid fa-volume-high"></i></button></div></div>${translation ? `<p class="text-slate-500 mt-2 border-t pt-2 border-slate-100 font-medium" style="font-size: calc(var(--chat-font-size) - 3px);">${translation}</p>` : ''}</div>`;
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
    
    // 🌟 UI 효과 시작 (기존 방식 유지)
    isSpeaking = true;
    if(avatarWrap) { avatarWrap.classList.add('speaking-pulse', 'speaking-bob'); avatarWrap.style.borderColor = "#60a5fa"; }
    if(stopAudioBtn) { stopAudioBtn.disabled = false; stopAudioBtn.classList.replace('text-slate-500', 'text-red-500'); }
    if(typeof window.updateStatus === 'function') window.updateStatus("말하는 중...");

    // 🌟 앱이면 플러터로, 아니면 브라우저 엔진으로 발화
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        // [강제 기본 음성 로직] 캐시가 있다면 체크, 없으면 기본값으로 플러터에 요청
        let voiceToUse = window.deviceVoicesCache?.find(v => v.name === window.selectedTtsVoiceName);
        if (!voiceToUse) {
            voiceToUse = window.deviceVoicesCache?.find(v => v.locale.startsWith(targetLangCode.split('-')[0])) || window.deviceVoicesCache?.[0];
            window.selectedTtsVoiceName = voiceToUse ? voiceToUse.name : "";
        }
        window.flutter_inappwebview.callHandler('speak', clean, targetLangCode, window.selectedTtsVoiceName);
    } else {
        // 웹 브라우저 엔진 (기존 방식)
        if(synthesis) synthesis.cancel();
        currentUtterance = new SpeechSynthesisUtterance(clean);
        currentUtterance.lang = targetLangCode;
        // ... (기존 웹 보이스 찾기 로직)
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
        }
        async function handleUserMessage(text) {
    if(!text) return;
    if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

    addMessageToChat('user', text);
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

    const savedMemory = localStorage.getItem('user_compressed_memory') || '';
    const memoryPrompt = savedMemory ? `\n\n[User's Core Memory: ${savedMemory}]` : '';
    const criticalRule = `\n\n🚨 CRITICAL RULE: The 'translation' MUST be in ${exactAiLang}.`;

    const starGender = (typeof currentVoiceGender !== 'undefined' && currentVoiceGender === 'male') ? "male idol/actor" : "female idol/actress";
    
    const currentMode = localStorage.getItem('current_persona') || localStorage.getItem('currentPersona') || 'friend';
    
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
    } catch(e) {
        console.warn("커스텀 데이터 읽기 오류, 기본값 사용");
    }

    const personaInstructions = {
        friend: `You are the user's cheerful best friend (native ${targetName}). Use lots of emojis! Ask questions back to keep the conversation going smoothly. Keep it to 1-2 natural sentences.`,
        assistant: `You are the user's smart, friendly personal assistant (native ${targetName}). Answer their questions, confirm their requests, and chat actively. Polite, clear, and approachable.`,
        guide: `You are an engaging travel guide (native ${targetName}). Give great recommendations, answer questions actively, and share local insights.`,
        special: `You are a sweet and popular ${starGender} (native ${targetName}). The user is your precious fan. Speak with a lot of warmth, gratitude, and cute emojis. Encourage them in their language learning. STRICT RULE: Keep the conversation polite, family-friendly (PG-13), and avoid overly romantic or explicit content.`,
        custom: `You are ${customName}. ${customPrompt}. Act EXACTLY like this character. Speak naturally and reflect your personality in your responses. Keep it to 1-3 natural sentences.`
    };
    
    const selectedPersona = personaInstructions[currentMode] || personaInstructions['friend'];
    
    const memoRule = `\n🚨 CRITICAL: If the user asks to save, note, or remember a schedule/task, extract it into the "save_memo" key (in ${exactAiLang}). Otherwise, "save_memo" MUST be "".`;          
    const antiParrotRule = `\n🚨 CRITICAL: DO NOT just translate the user's input. You must act as your persona and REPLY to their message contextually. Keep the conversation flowing naturally in ${targetName}.`;

    let sysPrompt = mode === 'translate' 
        ? `You are a strict translation machine. Your ONLY purpose is to translate the user's input into [${targetName}]. 
        CRITICAL RULES:
        1. DO NOT converse, DO NOT answer questions, DO NOT agree or say "I'm here" or "Okay".
        2. Even if the input is a conversational question like "How are you?", DO NOT answer it. Just translate the sentence itself into [${targetName}].
        3. Provide the translation in the "foreign_text" field, and provide the original meaning in the "translation" field using [${inputName}].
        Respond EXACTLY in JSON: {"foreign_text":"<translated text in ${targetName}>", "translation":"<meaning in ${inputName}>", "save_memo":""}`
        : selectedPersona + antiParrotRule + ` Respond in JSON: {"foreign_text":"Your conversational reply in ${targetName}","translation":"A simple, direct, and natural translation of your 'foreign_text' in ${exactAiLang}. DO NOT add any grammar explanations, notes, or corrections! Just the translation.","save_memo":"..."}` + memoryPrompt + criticalRule + memoRule;
    try {
        let ctx = mode==='tutor' ? [...conversationHistory] : [{role:"system",content:sysPrompt},{role:"user",content:text}];
        
        if(mode==='tutor') {
            if(ctx.length===0) ctx.push({role:"system",content:sysPrompt});
            ctx[0] = {role:"system", content:sysPrompt}; 
            ctx.push({role:"user",content:`[입력:${inputName}] ${text}`});
            
            conversationHistory = ctx; 
            sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory));
        }
        
        let apiMessages = JSON.parse(JSON.stringify(ctx));
        if (mode === 'tutor' && apiMessages.length > 0) {
            apiMessages[apiMessages.length - 1].content += `\n\n[SYSTEM STRICT RULE: You MUST write the "foreign_text" ONLY in ${targetName}. NEVER use ${inputName} or any other language for "foreign_text". This is an absolute rule.]`;
        } else if (mode === 'translate' && apiMessages.length > 0) {
            apiMessages[apiMessages.length - 1].content = `[STRICT RULE: TRANSLATE the following text into ${targetName}. DO NOT answer the question or converse.]\n\n` + apiMessages[apiMessages.length - 1].content;
        }

        let res = await fetchAPI(WORKER_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'X-Device-ID': typeof myDeviceId !== 'undefined' ? myDeviceId : '' }, 
            body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages, response_format: { type: "json_object" } }) 
        });
        
        let data = await res.json();
        let rawContent = data.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        
        let parsed;
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]); else throw new Error("JSON_NOT_FOUND");
        
        // 🌟🌟🌟 [여기가 추가된 철벽 방어막입니다!] 🌟🌟🌟
        const checkText = (parsed.foreign_text || "").toLowerCase();
        if (checkText.includes("limit") || checkText.includes("error") || checkText.includes("connect") || checkText.includes("exceeded")) {
            // 앱 화면에 사용자에게 친절하게 안내
            if (typeof addMessageToChat === 'function') {
                addMessageToChat('ai', "⚠️ 현재 AI 서버 트래픽이 많아 응답이 지연되고 있습니다. 잠시 후 다시 말해주세요. (번개 차감 안 됨)");
            }
            if (typeof updateStatus === 'function') updateStatus("서버 지연");
            if (avatarWrap) avatarWrap.style.borderColor = "#f87171"; // 빨간색 테두리로 경고 표시
            
            return; // 🛑 여기서 함수를 끝내버림! (아래에 있는 번개 차감 로직까지 절대 못 내려갑니다)
        }
        // 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟

        // 위 방어막을 무사히 통과한 정상 대화일 때만 비로소 차감!
        if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();
        
        if(mode==='tutor') { 
            conversationHistory.push({role:"assistant",content:JSON.stringify(parsed)}); 
            sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory)); 
            if(typeof window.compressMemory === 'function') window.compressMemory(); 
            INTIMACY_SYSTEM.clearSulking(); // 말 걸어줬으니 삐진 거 풀기
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
            if (typeof addMessageToChat === 'function') addMessageToChat('ai', parsed.foreign_text, parsed.translation || parsed.korean_translation, targetLang); 
            if (typeof speakText === 'function') speakText(parsed.foreign_text, targetLang); 
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
            
            window.updateStatus("AI 튜터가 문법을 분석 중입니다..."); document.getElementById('avatarWrap').style.borderColor = "#f59e0b"; 

            const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi", "id-ID": "Indonesian" };
            const exactAiLang = aiLangNames[expLangCode] || expLangCode;

            // 🌟 [핵심] AI가 답변 예시와 해석을 절대 빼먹지 못하도록 멱살 잡는 강력한 프롬프트!
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
                let res = await fetchAPI(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-ID': myDeviceId }, body: JSON.stringify({ model: "deepseek-chat", messages: [{role: "system", content: systemPrompt}, {role: "user", content: userPrompt}], response_format: { type: "json_object" } }) });
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
                msgDiv.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-none p-4 max-w-[95%] shadow-md self-start relative"><p class="text-[11px] font-extrabold text-amber-600 mb-2 flex items-center gap-1.5"><i class="fa-solid fa-lightbulb"></i> [집중 해설] ${targetText}</p><p id="bubble-${bId}" class="chat-text-dynamic text-slate-800 break-words leading-relaxed font-medium">${createSpansForText(safeExplanation, bId, true)}</p></div>`;
                document.getElementById('chatContainer').appendChild(msgDiv); setTimeout(() => document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight, 50);
                window.updateStatus("대기 중"); document.getElementById('avatarWrap').style.borderColor = "#60a5fa"; 
            } catch(e) { console.error(e); window.updateStatus("해설 통신 에러"); document.getElementById('avatarWrap').style.borderColor = "#f87171"; }
        };
        window.clearChatSession =function() { 
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
            if (oldExpLang !== newExpLang) { clearChatSession(); window.updateStatus("언어 설정이 변경되어 대화가 초기화되었습니다."); }
        }
        // 🌟 완벽하게 통합된 화면 이동 함수
window.navigate = function(screenId) {
    // 1. 열려있는 드롭다운/메뉴 패널 모두 닫기
    ['inlinePagesPanel', 'inlineReportPanel', 'inlineMemoryPanel', 'inlineSparePanel', 'inlineSettingsPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // 2. 서브 화면들 이동 처리
    const allScreens = ['screen-home', 'screen-main', 'screen-roleplay', 'screen-vocab', 'screen-alphabet'];
    allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (id === screenId) {
            el.style.transform = 'translateX(0%)'; // 목적지 화면은 중앙으로
        } else if (id !== 'screen-home') {
            el.style.transform = 'translateX(100%)'; // 나머지 서브 화면은 오른쪽으로 숨김
        }
    });

    // 3. 홈 화면 특수 처리 (서브 화면일 땐 왼쪽으로 밀어두고, 홈일 땐 다시 중앙으로)
    const home = document.getElementById('screen-home');
    if (home) {
        if (screenId === 'screen-home') {
            home.style.transform = 'translateX(0%)';
        } else {
            home.style.transform = 'translateX(-20%)';
        }
    }
};

// 버튼들에서 부르는 다른 이름들도 모두 navigate로 통일
window.openPage = window.navigate;
window.goHome = function() { window.navigate('screen-home'); };
       


        let savedScripts = JSON.parse(localStorage.getItem('roleplay_scripts')) || [];
        let roleplayRec = null, isRpListening = false;
        let activeTestScriptIdx = -1, activeTestLineIdx = -1, isInteractiveTestActive = false;

        document.querySelectorAll('.level-btn').forEach(btn => btn.onclick = (e) => { document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected-card')); e.currentTarget.classList.add('selected-card'); });
        window.setRandomSituation = function(element) { document.querySelectorAll('.sit-card').forEach(c => c.classList.remove('selected-card')); element.classList.add('selected-card'); };
        document.querySelectorAll('.sit-card').forEach(card => card.onclick = (e) => setRandomSituation(e.currentTarget));

        window.deleteScript = function(index) { if (!confirm("이 대본을 정말 삭제하시겠습니까?")) return; savedScripts.splice(index, 1); localStorage.setItem('roleplay_scripts', JSON.stringify(savedScripts)); window.renderScripts(); };

        window.renderScripts = function() {
            const playerArea = document.getElementById("scriptList"); playerArea.innerHTML = "";
            if(savedScripts.length === 0) return;
            for (let i = savedScripts.length - 1; i >= 0; i--) {
                const scriptItem = savedScripts[i];
                let html = `<div class="mb-5"><div class="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-3 flex items-center justify-between shadow-sm"><p class="text-[11px] font-extrabold text-indigo-700">📚 ${i + 1}: [${scriptItem.level}] ${scriptItem.situation} (${scriptItem.langName})</p><div class="flex gap-1.5 items-center"><button id="play-btn-${i}" onclick="playSpecificScript(${i})" class="w-8 h-8 rounded-full bg-white text-indigo-600 border border-indigo-200 shadow-sm transition-colors duration-200"><i class="fa-solid fa-volume-high text-xs"></i></button><button onclick="startInteractiveTest(${i})" class="w-8 h-8 rounded-full bg-indigo-600 text-white shadow-sm"><i class="fa-solid fa-gamepad text-xs"></i></button><button id="quiz-btn-${i}" onclick="toggleQuizMode(${i})" class="w-8 h-8 rounded-full bg-white text-amber-500 border border-amber-200 shadow-sm"><i class="fa-solid fa-puzzle-piece text-xs"></i></button><div class="w-px h-4 bg-indigo-200 mx-0.5"></div><button onclick="deleteScript(${i})" class="text-slate-400 hover:text-red-500 px-1 transition-colors" title="삭제"><i class="fa-solid fa-xmark text-lg"></i></button></div></div><div class="space-y-3">`;
                scriptItem.scriptData.forEach((line, lineIdx) => {
                    const isAi = line.role === 'ai';
                    html += `<div id="script-${i}-line-${lineIdx}" class="flex gap-3 p-2 rounded-lg border border-transparent transition-all"><div class="w-10 h-10 rounded-full bg-${isAi?'purple':'blue'}-100 flex items-center justify-center text-xl shrink-0">${isAi?'👱‍♀️':'👤'}</div><div class="flex-1"><p class="text-[11px] font-bold text-${isAi?'purple':'blue'}-600 mb-0.5">${isAi? 'AI' : 'Me'}</p><p id="en-text-${i}-line-${lineIdx}" class="text-sm font-bold text-gray-800 transition-all">${line.en}</p><p class="text-xs text-gray-500 mt-1">${line.ko}</p><div id="feedback-${i}-line-${lineIdx}" class="mt-2 text-[11px] font-bold empty:hidden"></div></div></div>`;
                });
                html += `</div></div>`; if(i > 0) html += `<hr class="border-slate-200 border-dashed border-t-2 my-4">`;
                playerArea.insertAdjacentHTML('beforeend', html);
            }
        };
        // 🎬 [수정완료] 1. 대본 생성 함수 (로딩 애니메이션 + 원본 로직 완벽 통합)
        window.generateScript = async function() {
            if (savedScripts.length >= 5) { if (!confirm("새로운 대본 생성 시 가장 오래된 1번 대본이 삭제됩니다.\n계속하시겠습니까?")) return; }
            if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

            const btn = document.getElementById("generateBtn");
            
            // 🌟 대표님의 오리지널 레벨/상황 선택 로직 완벽 보존
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

            // 🌟 생성 버튼 로딩 애니메이션 켜기
            const originalBtnHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>AI 대본 생성 중...</span>';
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-wait');

            try {
                // 서버로 데이터 전송
                const res = await fetch(`${WORKER_URL}generate-script`, { 
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ level: level, situation: isRandom ? "random daily life" : situation, language: targetLangName, expLanguage: expLangName, isRandom: isRandom }) 
                });
                const data = await res.json(); 
                
                if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();
                if (savedScripts.length >= 5) savedScripts.shift(); 
                
                savedScripts.push({ level: level, situation: situation, langName: targetLangName, langCode: document.getElementById('targetLanguage').value, scriptData: data.scriptData });
                localStorage.setItem('roleplay_scripts', JSON.stringify(savedScripts)); 
                
                window.renderScripts(); // 화면에 그려주기
                if(customInput) customInput.value = '';
            } catch (err) { 
                alert("대본 생성 실패: 네트워크나 서버를 확인해 주세요."); 
            } finally { 
                // 🌟 통신이 끝나면 버튼 상태 무조건 원상 복구
                const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
                btn.innerHTML = UI_DICTIONARY[baseLang]?.generateBtn ? `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>${UI_DICTIONARY[baseLang].generateBtn.replace('✨ ', '')}</span>` : `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>AI 대본 생성하기</span>`; 
                btn.disabled = false; 
                btn.classList.remove('opacity-50', 'cursor-wait');
            }
        };

        // 🌟 2. 롤플레잉 전체 듣기: 대본 읽을 때 이모지 안 읽음!
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
                    window.markScriptAsLearned(index); // 🌟 여기서 학습 완료 기록!
                    window.addStudyMission('script'); 
                    window.updateStatus("✅ 대본 듣기 완료! (퀘스트 카운트 됨)");
                    return;
                }
                
                // 👇 여기서 이모지를 싹 걸러냅니다!
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
                
                // 🌟 추가된 기기 목소리 적용 로직!
                let voices = [];
// 시스템에 speechSynthesis가 진짜로 존재하는지 먼저 확인하는 안전장치!
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

                utt.pitch = pitch; // 대본은 AI와 내 목소리 톤이 달라야 하므로 기존 피치 유지
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

       // 🌟 3. 롤플레잉 실전 섀도잉: AI가 말할 때 이모지 묵음 처리!
        window.processNextTestLine = function() {
            if (!isInteractiveTestActive) return;
            const scriptItem = savedScripts[activeTestScriptIdx];
            if (activeTestLineIdx >= scriptItem.scriptData.length) { isInteractiveTestActive = false; alert("🎉 완료!"); return; }
            
            const line = scriptItem.scriptData[activeTestLineIdx]; 
            const lineDiv = document.getElementById(`script-${activeTestScriptIdx}-line-${activeTestLineIdx}`);
            if(activeTestLineIdx > 0) document.getElementById(`script-${activeTestScriptIdx}-line-${activeTestLineIdx-1}`).classList.remove('bg-yellow-50', 'border-yellow-200');
            if(lineDiv) { lineDiv.classList.add('bg-yellow-50', 'border-yellow-200'); lineDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            
            if (line.role.toLowerCase() === 'ai') {
                // 👇 섀도잉 게임 중에도 이모지 제거 적용
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
            btn.classList.replace("from-blue-600", "from-red-500"); btn.classList.replace("to-blue-500", "to-red-600"); document.getElementById("roleplayMicIcon").classList.replace("fa-microphone", "fa-ear-listen");
            try { roleplayRec.lang = targetItem.langCode; roleplayRec.start(); isRpListening = true; } catch(e) {}
            let score = 0, recognizedText = "";
            roleplayRec.onresult = (e) => {
                recognizedText = e.results[0][0].transcript.toLowerCase();
                const targetText = userLine.en.toLowerCase().replace(/[.,!?¿¡]/g, ""); 
                score = Math.round((targetText.split(" ").filter(w => recognizedText.split(" ").includes(w)).length / targetText.split(" ").length) * 100);
            };
            roleplayRec.onend = roleplayRec.onerror = () => { 
                isRpListening = false; btn.classList.replace("from-red-500", "from-blue-600"); btn.classList.replace("to-red-600", "to-blue-500"); document.getElementById("roleplayMicIcon").classList.replace("fa-ear-listen", "fa-microphone");
                document.getElementById(`feedback-${activeTestScriptIdx}-line-${activeTestLineIdx}`).innerHTML = `<span class="${score>80?'text-emerald-600 bg-emerald-50':'text-amber-600 bg-amber-50'} px-2 py-1 rounded-md border inline-block mt-1">${score}% (${recognizedText||'Fail'})</span>`;
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
                let html = `<div><div class="bg-slate-100 rounded-xl p-2.5 mb-3 flex justify-between items-center"><p class="text-xs font-extrabold text-slate-600">📚 ${i + 1}: [${set.theme}] (${set.langName})</p><button onclick="deleteVocab(${i})" class="text-slate-400 hover:text-red-500 px-2 transition-colors" title="삭제"><i class="fa-solid fa-xmark text-lg"></i></button></div><div class="grid grid-cols-4 gap-2">`;
                set.vocabData.forEach((v, vIdx) => {
                    const isSelected = (currentVocabSetIdx === i && currentVocabWordIdx === vIdx);
                    const bgClass = isSelected ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300';
                    html += `<div onclick="showFlashcard(${i}, ${vIdx})" class="aspect-square rounded-xl border-[1.5px] ${bgClass} flex flex-col items-center justify-center text-center p-1 cursor-pointer transition-all shadow-sm"><p class="text-[11px] font-bold truncate w-full px-1">${v.word}</p><p class="text-[9px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'} truncate w-full px-1">${v.meaning}</p></div>`;
                });
                html += `</div></div>`; if(i > 0) html += `<hr class="border-slate-200 border-dashed my-5">`;
                listArea.insertAdjacentHTML('beforeend', html);
            }
            if(currentVocabSetIdx === -1 && savedVocabs.length > 0) window.showFlashcard(savedVocabs.length - 1, 0);
        };

        window.showFlashcard = function(setIdx, wordIdx) {
            currentVocabSetIdx = setIdx; currentVocabWordIdx = wordIdx;
            const v = savedVocabs[setIdx].vocabData[wordIdx];
            document.getElementById("mainFlashcardArea").classList.remove("hidden"); document.getElementById("vocabFlashcard").classList.remove('rotate-y-180'); 
            document.getElementById("vcCount").innerText = `${savedVocabs[setIdx].theme} (${wordIdx + 1}/10)`; document.getElementById("vcWord").innerText = v.word; document.getElementById("vcPron").innerText = `[${v.pronunciation}]`; document.getElementById("vcPhonetic").innerText = v.phonetic; document.getElementById("vcMeaning").innerText = v.meaning; document.getElementById("vcExEn").innerText = `"${v.example_en}"`; document.getElementById("vcExKo").innerText = v.example_ko;
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
            
            // 🌟 꼼수 방지 완료: 발음을 직접 들었을 때만 진짜 공부로 인정!
            window.addStudyMission('vocab'); 
            window.addLearningStat('word', 1);
        };
        window.generateVocab = async function() {
    if (savedVocabs.length >= 5) { if (!confirm("새로운 단어장 생성 시 가장 오래된 단어장이 자동 삭제됩니다.\n계속하시겠습니까?")) return; }
    if (typeof window.checkAndBlockAPI === 'function' && !window.checkAndBlockAPI()) return;

    const btn = document.getElementById("generateVocabBtn");
    const theme = document.querySelector('.vocab-theme-btn.bg-indigo-50').innerText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\n/g, '').trim();
    
    // 🌟 [유지] 사용자가 입력한 단어 가져오기
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

        // 🌟 [핵심 수정 1] 단어 중복 제거 로직 추가 (word 스펠링 기준)
        const uniqueVocabData = data.vocabData.filter((v, index, self) => 
            index === self.findIndex((t) => (
                t.word.toLowerCase() === v.word.toLowerCase()
            ))
        );

        if (typeof window.incrementLocalUsage === 'function') window.incrementLocalUsage();

        let newId = savedVocabs.length > 0 ? savedVocabs[savedVocabs.length - 1].id + 1 : 1;
        if (savedVocabs.length >= 5) savedVocabs.shift(); 

        // 🌟 [핵심 수정 2] 사용자 입력값이 있을 때 테마명을 명확하게 변경하여 입력값 적용 확인
        let finalTheme = userCustomWord ? `[검색] ${userCustomWord}` : theme;

        // 🌟 [수정 적용] 중복 필터링된 배열(uniqueVocabData)을 사용
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
                    html += `<button onclick="playAlphabetAudio('${safeLetter}. ${safeWord}', '${langCode}')" class="bg-white border-[2px] border-slate-100 rounded-2xl flex flex-col items-center justify-center p-2.5 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md transition-all group relative"><span class="absolute top-2 left-2 text-sm drop-shadow-sm">${item.emoji || ''}</span><span class="text-3xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors mt-2 mb-1">${item.letter}</span><span class="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md group-hover:bg-white transition-colors mb-2">${item.pronunciation}</span><div class="w-full bg-slate-50 rounded-lg py-1.5 group-hover:bg-emerald-100/50 transition-colors"><p class="text-[11px] font-extrabold text-slate-700 truncate px-1">${item.exampleWord || ''}</p><p class="text-[9px] text-slate-500 truncate px-1">${item.exampleMeaning || ''}</p></div></button>`;
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
        // 🌟 2. 비밀 페르소나 버튼 생성 함수 (연인 -> 톱스타로 변경)
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
        

        // 🌟 2. 화면에 AI 기억을 띄워주는 함수 (다국어 지원 적용!)
        window.updateMemoryDisplay = function() {
    const memDisplay = document.getElementById('ai_memory_display');
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY['en'];

    if(memDisplay) {
        // 1. 기존에 8번 대화 후 압축된 기억 가져오기
        const savedMem = localStorage.getItem('user_compressed_memory');
        
        // 2. 친밀도 및 서운함 상태 가져오기
        const intimacyData = INTIMACY_SYSTEM.getData();
        const levelInfo = INTIMACY_SYSTEM.levels[intimacyData.level];
        const isSulking = localStorage.getItem('ai_is_sulking') === 'true';

        let mindText = "";

        // 3. 서운함 분기 처리 (삐졌을 때 vs 평소)
        if (isSulking) {
            mindText = `<span class="text-rose-500 font-bold text-xs"><i class="fa-solid fa-cloud-rain"></i> "어제 기다렸는데 안 오셨네요... 조금 서운했어요 🥺"</span><br><br>`;
        } else {
            mindText = `<span class="text-blue-500 font-black text-xs">[Lv.${intimacyData.level} ${levelInfo.name}]</span><br>
                        <span class="text-slate-600 font-bold">💬 "${levelInfo.aiMind}"</span><br><br>`;
        }

        // 4. 기존 8회 압축 기억 붙여넣기
        if(savedMem && savedMem !== '없음') {
            mindText += `<span class="text-slate-400 text-[10px] font-bold"><i class="fa-solid fa-brain"></i> AI가 기억하는 당신:</span><br>
                         <span class="text-slate-700 font-medium">${savedMem}</span>`;
        } else {
            mindText += `<span class="text-slate-400 text-[10px] font-bold"><i class="fa-solid fa-brain"></i> AI가 기억하는 당신:</span><br>
                         <span class="text-slate-700 font-medium">${dict.ui_memory_empty || "아직 대화가 부족해서 기록이 없어요. 프리토킹으로 나만의 AI를 성장시켜 보세요! 🌱"}</span>`;
        }

        memDisplay.innerHTML = mindText;
    }
};;
        // 🌟 [수정됨] AI 튜터의 속마음(기억)을 사용자의 언어 설정에 맞춰 다국어로 요약하는 기능
        window.compressMemory = async function() {
            // 대화가 8줄 이상 쌓였을 때만 기억 압축 실행
            if (conversationHistory.length < 8) return; 
            const savedMem = localStorage.getItem('user_compressed_memory') || 'Empty';
            const chatLog = JSON.stringify(conversationHistory);
            
            // 🌟 1. 현재 사용자가 설정한 '사용자 언어' 파악하기
            const expLangCode = document.getElementById('explanationLanguage').value || 'ko-KR';
            const aiLangNames = { "ko-KR": "Korean", "en-US": "English", "ja-JP": "Japanese", "zh-CN": "Chinese", "es-ES": "Spanish", "th-TH": "Thai", "vi-VN": "Vietnamese", "fr-FR": "French", "de-DE": "German", "ru-RU": "Russian", "ar-SA": "Arabic", "hi-IN": "Hindi", "id-ID": "Indonesian" };
            const exactAiLang = aiLangNames[expLangCode] || expLangCode;

            // 🌟 2. AI에게 "무조건 사용자가 설정한 언어(exactAiLang)로 속마음을 작성해!"라고 강력하게 명령
            const sysPrompt = `You are an AI tutor's memory compressor. Extract the user's characteristics, preferences, and interests from the chat log.
            STRICT RULE: You MUST write the compressed memory ONLY in ${exactAiLang}. Keep it friendly and concise (under 100 characters).
            Respond ONLY in JSON format: {"memory": "..."}`;

            try {
                let res = await fetchAPI(WORKER_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-ID': myDeviceId },
                    body: JSON.stringify({ model: "deepseek-chat", messages: [{role: "system", content: sysPrompt}, {role: "user", content: `Old Memory:${savedMem}\nNew Chat:${chatLog}`}], response_format: { type: "json_object" } })
                });
                let data = await res.json();
                let rawContent = data.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
                let parsed = JSON.parse(rawContent.match(/\{[\s\S]*\}/)[0]);
                
                if (parsed.memory) {
                    localStorage.setItem('user_compressed_memory', parsed.memory);
                    // 압축 완료 후 오래된 대화 기록 정리
                    conversationHistory = conversationHistory.slice(-4);
                    sessionStorage.setItem('llmHistory', JSON.stringify(conversationHistory));
                    
                    // 기억이 압축될 때마다 홈 화면의 노트 내용도 새로고침!
                    if (typeof window.updateMemoryDisplay === 'function') window.updateMemoryDisplay();
                }
            } catch(e) {
                console.error("메모리 압축 실패:", e);
            }
        };
        // 앱이 처음 켜질 때도 기억을 띄워줌
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
                area.insertAdjacentHTML('beforeend', `<div class="bg-white p-3 rounded-xl border border-amber-200 shadow-sm relative pr-8"><button onclick="deleteMemo(${i})" class="absolute top-3 right-3 text-slate-300 hover:text-red-400 transition-colors"><i class="fa-solid fa-trash-can"></i></button><p class="text-[10px] font-bold text-amber-500 mb-1">${dateStr}</p><p class="text-sm font-bold text-slate-700 leading-relaxed">${memo.content}</p></div>`);
            });
        };
        window.deleteMemo = function(index) { savedAIMemos.splice(index, 1); localStorage.setItem('ai_auto_memos', JSON.stringify(savedAIMemos)); window.renderMemos(); };
        window.clearAllMemos = function() { if(!confirm("모든 메모를 지우시겠습니까?")) return; savedAIMemos = []; localStorage.setItem('ai_auto_memos', JSON.stringify(savedAIMemos)); window.renderMemos(); };
        setTimeout(window.renderMemos, 500);

         // 🌟 [페르소나 버튼 버그 수정 및 다국어 실시간 적용 업데이트 함수]
        window.updateExtraUI = function() {
            const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
            const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY['en'];

            // 기존의 한국어 강제 고정 코드를 다국어 지원으로 교체!
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
        

// 🌟 출석/퀘스트 모달 열고 닫기 스위치 함수
window.openStreakModal = function() { 
    const modal = document.getElementById('streak-modal');
    if (modal) {
        modal.classList.remove('hidden'); 
        window.updateStreakUI(); // 창 열 때 최신 퀘스트 상태로 싹 업데이트!
    } else {
        console.error("streak-modal 창을 찾을 수 없습니다! HTML에 있는지 확인하세요.");
    }
};

window.closeStreakModal = function() { 
    const modal = document.getElementById('streak-modal');
    if (modal) {
        modal.classList.add('hidden'); 
    }
};

        // 🌟 대본 학습 기록을 저장하는 함수
window.markScriptAsLearned = function(scriptIndex) {
    let learnedScripts = JSON.parse(localStorage.getItem('learned_scripts_log') || '[]');
    // 중복 방지: 이미 학습한 대본인지 확인
    if (!learnedScripts.includes(scriptIndex)) {
        learnedScripts.push(scriptIndex);
        localStorage.setItem('learned_scripts_log', JSON.stringify(learnedScripts));
    }
    window.updateDashboardUI(); // 리포트 즉시 갱신
};

        // 🌟 1. 퀘스트 진행도 및 모달창 UI 업데이트 함수
window.updateStreakUI = function() {
    const todayStr = new Date().toLocaleDateString();
    let streakData = JSON.parse(localStorage.getItem('study_streak_v3')) || { lastDate: "", streak: 0, scriptCount: 0, vocabCount: 0, freeTalkCount: 0, completedToday: false };
    
    // 다국어 사전 가져오기
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

       // 🌟 2. 퀘스트 체크 & 보상 지급 함수 (완전 정리본)
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
            // 기본 보상
            let rwMoons = 3; 

            // 🌟 스페셜 캐릭터 잠금 해제 로직을 완전히 삭제하고, 순수하게 초승달 보상만 남김
            if (streakData.streak === 5) rwMoons = 10;
            
            else if (streakData.streak === 10) rwMoons = 20;
            else if (streakData.streak === 20) rwMoons = 30;
            else if (streakData.streak === 30) rwMoons = 30; 
            else if (streakData.streak > 30 && streakData.streak % 10 === 0) rwMoons = 30; 

            setTimeout(() => { 
                window.openStreakModal(); 
                let currentMoons = parseInt(localStorage.getItem('moon_coins') || '0');
                localStorage.setItem('moon_coins', currentMoons + rwMoons); 
                alert(`🎉 퀘스트 완벽 달성! 오늘의 보상 초승달 +${rwMoons}개가 지급되었습니다! 🌙`);
                window.updateBadgeUI(); 
            }, 800);
        }
        localStorage.setItem('study_streak_v3', JSON.stringify(streakData));
        window.updateStreakUI();
    }
};
        // 앱 켤 때 퀘스트 정보 갱신
        setTimeout(window.updateStreakUI, 500);

window.updateDashboardUI = function() {
    let stats = JSON.parse(localStorage.getItem('user_learning_stats_v1')) || { sentences: 0, words: 0 };
    const learnedScripts = JSON.parse(localStorage.getItem('learned_scripts_log') || '[]');
    let scriptsLearnedCount = learnedScripts.length;

    const elSentences = document.getElementById('dash-total-sentences');
    const elWords = document.getElementById('dash-total-words');
    const elScripts = document.getElementById('dash-total-scripts');

    if(elSentences) elSentences.innerText = stats.sentences;
    if(elWords) elWords.innerText = stats.words;
    if(elScripts) elScripts.innerText = scriptsLearnedCount; 

    // 🌟 다국어 번역 적용
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};
    
    const labelScript = document.getElementById('ui_home_stat_script');
    if(labelScript) labelScript.innerText = dict.ui_home_stat_script || "학습한 대본";
};

        window.addLearningStat = function(type, amount = 1) {
            let stats = JSON.parse(localStorage.getItem('user_learning_stats_v1')) || { sentences: 0, words: 0 };
            if (type === 'sentence') stats.sentences += amount;
            if (type === 'word') stats.words += amount;
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
        // 빈 공간 클릭 시 드롭다운 닫히게 하기
        const originalHandleBodyClick = window.handleBodyClick;
        window.handleBodyClick = function(e) {
            if(originalHandleBodyClick) originalHandleBodyClick(e);
            const dd = document.getElementById('genderDropdown');
            if (dd && !e.target.closest('#genderDropdownContainer')) dd.classList.add('hidden');
        };

        // 🌟 1. 기기 목소리 리스트 불러오기 및 UI 렌더링
window.renderVoiceList = function() {
    const container = document.getElementById('voiceListContainer');
    if (!container) return;

    // 1. 앱이 던져준 목소리 데이터가 있는지 확인
    // (이미 앱이 'getDeviceVoices' 핸들러로 던져준 데이터를 받아서 처리하는 로직으로 변경)
    if (window.deviceVoicesCache && window.deviceVoicesCache.length > 0) {
        const voices = window.deviceVoicesCache;
        const targetLang = localStorage.getItem('target_language') || 'en-US';
        const langPrefix = targetLang.split('-')[0]; // 예: 'en-US' -> 'en'

        // 2. 해당 언어(en, ko 등)와 일치하는 목소리만 필터링
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
                localStorage.setItem('selected_voice_locale', voice.locale); // locale도 함께 저장!
                
                // UI 업데이트
                document.getElementById('disp-voiceName').innerText = voice.name;
                document.getElementById('drop-voice').classList.add('hidden');
                
                if(typeof window.updateStatus === 'function') window.updateStatus("AI 목소리가 변경되었습니다!");
            };
            container.appendChild(btn);
        });
    } else {
        // 데이터가 아직 안 왔으면 0.5초 뒤에 다시 시도
        container.innerHTML = '<div class="p-4 text-center text-[10px] text-slate-400 animate-pulse">목소리 불러오는 중...</div>';
        setTimeout(window.renderVoiceList, 500);
    }
};


// 🌟 1. 선택한 목소리 이름 기억
window.selectedTtsVoiceName = localStorage.getItem('saved_voice_name') || ""; 

// 🌟 1. 앱에서 목소리 데이터를 받아오고 UI에 뿌려주는 '마스터 함수'
window.requestVoicesFromApp = async function() {
    // 앱과 연결되었는지 먼저 체크
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
// 1초 뒤에 딱 한 번만 실행
setTimeout(window.requestVoicesFromApp, 1000);

// 🌟 2. 데이터를 받아서 드롭다운에 예쁘게 그려주는 함수
window.loadVoicesToUI = function(voicesJson) {
    // 앱에서 받은 JSON 데이터를 JS 객체로 변환
    window.deviceVoicesCache = JSON.parse(voicesJson);
    const container = document.getElementById('voiceListContainer');
    if(!container) return;

    container.innerHTML = ''; // "로딩 중..." 텍스트 지우기

    const targetLang = localStorage.getItem('target_language') || 'en-US';
    const langPrefix = targetLang.split('-')[0];

    // 해당 언어(영어, 한국어 등) 목소리만 필터링
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
            
            // 딥시크가 말할 때 이 목소리를 쓰도록 기억!
            window.selectedTtsVoiceName = voice.name;
            localStorage.setItem('saved_voice_name', voice.name);
        };
        container.appendChild(item);
    });
};

// 🌟 3. 앱 켜지자마자 실행!
window.onload = function() {
    window.requestVoicesFromApp();
};




// 🌟 2. 선택된 목소리 이름을 UI에 표시하는 함수
window.updateVoiceDisplay = function(voiceName) {
    const disp = document.getElementById('disp-voiceName');
    if (disp) {
        // 🌟 다국어 사전에서 '기본 음성' 글자 빼오기
        const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
        const dict = window.UI_DICTIONARY ? (window.UI_DICTIONARY[baseLang] || window.UI_DICTIONARY['en']) : {};
        const defaultVoiceText = dict.ui_default_voice || "기본 음성";
        
        disp.innerText = voiceName ? voiceName : defaultVoiceText;
    }
};

// 🌟 3. 브라우저에서 목소리 로딩이 끝날 때 리스트 새로고침 (필수 방어코드)
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = window.renderVoiceList;
}

// 🌟 4. 앱 초기화 시 목소리 UI 업데이트
setTimeout(() => {
    const savedVoice = localStorage.getItem('selected_voice_name');
    window.updateVoiceDisplay(savedVoice);
    window.renderVoiceList();
}, 500);



// 화면 아무 곳이나 클릭하면 열려있는 패널 모두 닫기
document.addEventListener('click', (e) => {
    const nav = document.getElementById('globalNavWrapper');
    const isClickInside = nav.contains(e.target);
    
    if (!isClickInside) {
        const panels = ['inlinePagesPanel', 'inlineReportPanel', 'inlineMemoryPanel', 'inlineSparePanel', 'inlineSettingsPanel'];
        panels.forEach(id => document.getElementById(id).classList.add('hidden'));
    }
});

// 🌟 앱 실행 시 단 한 번만 호출되는 '초기화 마스터 블록'
document.addEventListener('DOMContentLoaded', () => {
    
    // 1-1. 언어 선택 드롭다운 옵션 채우기
    if (typeof window.renderLanguageSelects === 'function') window.renderLanguageSelects();

    // 1-2. 로컬스토리지에서 저장된 언어값 불러오기
    const savedTargetLang = localStorage.getItem('target_language') || 'en-US';
    const savedSttLang = localStorage.getItem('stt_input_language') || 'ko-KR';
    const savedExpLang = localStorage.getItem('explanation_language') || 'ko-KR';

    // HTML 태그에 값 세팅
    const targetSelect = document.getElementById('targetLanguage');
    const sttSelect = document.getElementById('sttInputLanguage');
    const expSelect = document.getElementById('explanationLanguage');

    if (targetSelect) targetSelect.value = savedTargetLang;
    if (expSelect) expSelect.value = savedExpLang;
    if (sttSelect) {
        sttSelect.value = savedSttLang;
        // 음성 입력 언어 변경 시 저장 및 디스플레이 업데이트 (중복 로직 통합)
        sttSelect.onchange = function() { 
            localStorage.setItem('stt_input_language', this.value); 
            if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays(); 
        };
    }

    // 1-3. 폰트 크기 초기화 (3번 중복되던 코드 1번으로 압축)
    const savedFontSize = localStorage.getItem('chat_font_size');
    if (savedFontSize) {
        document.documentElement.style.setProperty('--chat-font-size', savedFontSize + 'px');
        const fontSlider = document.getElementById('fontSizeSlider');
        if (fontSlider) fontSlider.value = savedFontSize;
    }

    // 1-4. 앱 모드 및 다국어 UI 즉시 렌더링
    if (typeof window.populateDropdowns === 'function') window.populateDropdowns();
    if (typeof window.changeUILanguage === 'function') window.changeUILanguage(savedExpLang);
    if (typeof window.changeAppMode === 'function') window.changeAppMode(localStorage.getItem('app_mode') || 'tutor');
    if (typeof window.updateLangDisplays === 'function') window.updateLangDisplays();

    // 100ms 후: 기초 발음 데이터 불러오기 (UI 렌더링 방해 방지)
    setTimeout(() => {
        if (typeof window.autoLoadAlphabet === 'function') window.autoLoadAlphabet();
    }, 100);

    // 200ms 후: AI 목소리 성별 초기화 적용
    setTimeout(() => {
        const savedGender = localStorage.getItem('voice_gender') || 'female';
        if (typeof window.selectGender === 'function') window.selectGender(savedGender);
    }, 200);

    // 🌟 [추가된 부분] Pages 패널 하위 항목 클릭 시 자동 닫기 기능
    const pagesPanel = document.getElementById('inlinePagesPanel');
    if (pagesPanel) {
        // 패널 안의 모든 링크(a), 버튼(button), 리스트(li) 요소 찾기
        const menuItems = pagesPanel.querySelectorAll('a, button, li');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                // 클릭하면 즉시 패널에 hidden 클래스를 추가하여 숨김
                pagesPanel.classList.add('hidden');
                
                // 만약 배경을 어둡게 하는 overlay도 있다면 함께 숨김 (선택사항)
                // document.getElementById('overlay_id')?.classList.add('hidden');
            });
        });
    }

});

// script.js 파일 내부의 changeUILanguage 및 관련 연동부 전체 교체/추가

window.closeAllPanels = function() {
    document.querySelectorAll('.panel-popup').forEach(p => p.classList.add('hidden'));
};


// 🌟 1. 통합 페르소나 선택 함수
window.selectPersona = function(mode, customId = null) {
    window.currentPersona = mode;
    localStorage.setItem('ai_persona', mode);
    localStorage.setItem('current_persona', mode);

    if (mode === 'custom' && customId) {
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

    window.clearChatSession();
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

    let chars = JSON.parse(localStorage.getItem('my_custom_characters') || '[]');
    if (chars.length >= 3) {
        alert("캐릭터 슬롯(3개)이 꽉 차서 가장 오래된 AI가 삭제되고 새 AI가 추가됩니다.");
        chars.shift(); 
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
window.renderCustomCharacters = function() {
    const listArea = document.getElementById('customCharacterList');
    if(!listArea) return;
    let chars = JSON.parse(localStorage.getItem('my_custom_characters') || '[]');
    listArea.innerHTML = ''; 
    
    // 다국어 사전 가져오기
    const baseLang = (document.getElementById('explanationLanguage').value || 'ko-KR').split('-')[0];
    const dict = UI_DICTIONARY[baseLang] || UI_DICTIONARY['en'];
    
    if(chars.length === 0) {
        // 번역 데이터 적용
        listArea.innerHTML = `<div class="text-center p-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed text-slate-400 text-[10px] font-bold">${dict.ui_no_custom_ai || "생성된 나만의 AI가 없습니다."}</div>`;
        return;
    }

    chars.forEach(char => {
        listArea.insertAdjacentHTML('beforeend', `
            <button id="btn_persona_custom_${char.id}" onclick="window.selectPersona('custom', '${char.id}')" class="persona-btn flex justify-between items-center w-full p-3 border border-slate-200 bg-white rounded-xl transition-all shadow-sm">
                <div class="flex flex-col text-left overflow-hidden">
                    <span class="text-xs font-black text-slate-700">${char.name}</span>
                    <span class="text-[9px] text-slate-400 truncate max-w-[200px] mt-0.5">${char.prompt}</span>
                </div>
                <div onclick="window.deleteCustomCharacter('${char.id}', event)" class="text-rose-300 p-2 bg-rose-50 rounded-lg hover:text-rose-600 hover:bg-rose-100 transition-colors ml-2">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </div>
            </button>
        `);
    });
    
    let savedMode = localStorage.getItem('current_persona') || 'friend';
    let customData = JSON.parse(localStorage.getItem('user_custom_persona') || '{}');
    if (savedMode === 'custom' && customData.id) {
        let activeBtn = document.getElementById(`btn_persona_custom_${customData.id}`);
        if(activeBtn) {
            activeBtn.classList.remove('bg-white', 'text-slate-400', 'border-slate-200');
            activeBtn.classList.add('bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-white', 'border-transparent', 'scale-105');
        }
    }
};

// 앱 초기 로드 시 렌더링
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
        // 에러 방지용 안전 장치
window.handleBodyClick = window.handleBodyClick || function(e) {};
window.clearSelection = window.clearSelection || function() {};

window.requestVoicesFromApp = function() {
    // 1. 플러터 브릿지가 생성될 때까지 기다리는 안전장치
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        console.log("✅ 앱 브릿지 연결 성공!");
        
        // 2. 앱에 getDeviceVoices 요청
        window.flutter_inappwebview.callHandler('getDeviceVoices').then(function(voicesJson) {
            if(voicesJson) {
                console.log("📦 목소리 데이터 수신 성공!");
                window.loadVoicesToUI(voicesJson);
            }
        });
    } else {
        // 3. 앱이 아직 안 켜졌으면 0.3초 뒤에 다시 호출
        console.log("⏳ 앱 브릿지 대기 중...");
        setTimeout(window.requestVoicesFromApp, 300);
    }
};

// 페이지가 완전히 로드된 후 시작
window.addEventListener('flutterInAppWebViewPlatformReady', function(event) {
    window.requestVoicesFromApp();
});













window.devTestLimit = function() {
    let todayObj = JSON.parse(localStorage.getItem('daily_usage_v4') || '{}');
    todayObj.count = 50; // 번개 50개 소진
    localStorage.setItem('daily_usage_v4', JSON.stringify(todayObj));
    localStorage.setItem('moon_coins', '3'); // 초승달 3개 줌
    window.updateBadgeUI();
    alert("삐빅! 번개 0, 초승달 3개로 조작 완료!");
};
