// --- 1. FIREBASE CONFIGURATION (Moved inside app.init to fix loading error) ---
// नोट: यह Firebase कॉन्फ़िगरेशन आपके प्रोजेक्ट के अनुसार है।
const firebaseConfig = {
    apiKey: "AIzaSyBQM0KrwvcsUckhJArkvAhPMD1_n_ytuoM",
    authDomain: "freefiretournament-5d4f5.firebaseapp.com",
    projectId: "freefiretournament-5d4f5",
    storageBucket: "freefiretournament-5d4f5.firebasestorage.app",
    messagingSenderId: "80370183123",
    appId: "1:80370183123:web:6e56e89b67b7ff87551d26",
    databaseURL: "https://freefiretournament-5d4f5-default-rtdb.firebaseio.com"
};

// Firebase ऑब्जेक्ट्स को ग्लोबल स्कोप में रखें लेकिन उन्हें app.init में असाइन करें
let auth = null;
let db = null;
let appInstance = null;


// --- 2. GLOBAL STATE AND CONSTANTS ---
// एडमिन ईमेल (मैच बनाने/हटाने और परिणाम सबमिट करने के लिए)
const ADMIN_EMAIL = 'sf636785@gmail.com';

// ग्लोबल स्टेट वैरियेबल्स
let isAdmin = false;
let currentMode = '';
let currentMatchId = '';
let matchIntervals = {};
let currentUser = null;
let currentMatchData = null; 

// स्कोर कॉन्फ़िगरेशन (लीडरबोर्ड के लिए)
const POINTS_PER_WIN = 10;
const POINTS_PER_KILL = 1;

// साउंड सेटअप (सुनिश्चित करें कि 'sounds' फ़ोल्डर में आवश्यक फ़ाइलें हैं)
const clickSound = new Audio('sounds/click.wav'); 
const warningSound = new Audio('sounds/warning.wav');
const criticalSound = new Audio('sounds/beep.wav'); 

// ऑडियो फ़ाइलों के लिए फ़ॉलबैक लॉजिक
clickSound.onerror = () => { 
    if(clickSound.src.includes('.wav')) {
        clickSound.src = 'sounds/click.mp3'; 
        console.log("Using click.mp3 fallback."); 
        clickSound.onerror = () => console.error("FATAL: click.mp3 also failed to load.");
    }
};
warningSound.onerror = () => { 
    if(warningSound.src.includes('.wav')) {
        warningSound.src = 'sounds/warning.mp3'; 
        console.log("Using warning.mp3 fallback."); 
        clickSound.onerror = () => console.error("FATAL: warning.mp3 also failed to load.");
    }
};
criticalSound.onerror = () => { 
    if(criticalSound.src.includes('.wav')) {
        criticalSound.src = 'sounds/beep.mp3'; 
        console.log("Using beep.mp3 fallback."); 
        criticalSound.onerror = () => console.error("FATAL: beep.mp3 also failed to load.");
    }
};

function playSound(audioElement) {
    if (audioElement && (audioElement.src.includes('sounds/'))) {
        audioElement.currentTime = 0;
        // ब्राउज़र ऑटोप्ले नीतियों के कारण त्रुटियों को पकड़ते हुए ऑडियो चलाने का प्रयास
        audioElement.play().catch(e => {
             console.error(`Audio play failed for ${audioElement.src.split('/').pop()}: Browser Autoplay Policy blocked it.`, e.message);
        });
    }
}

function playClickSound() {
    playSound(clickSound);
}

function playWarningSound() {
    playSound(warningSound);
}

function playCriticalSound() {
    playSound(criticalSound);
}


function getSlotLimit(mode) {
    switch (mode) {
        case '1v1': return 2;
        case '2v2': return 4;
        case '3v3': return 6;
        case '4v4': return 8;
        default: return 0;
    }
}

// UI संदेशों के लिए सहायक फ़ंक्शन
function displayMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
    const duration = type === 'click-feedback' ? 500 : 5000;
    setTimeout(() => { element.classList.add('hidden'); }, duration);
}

// --- 3. APPLICATION LOGIC ---
const app = {
    // Firebase और Auth को इनिशियलाइज़ करने के लिए नया फ़ंक्शन
    init: () => {
        try {
            // Firebase को इनिशियलाइज़ करें
            appInstance = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.database();
            
            console.log("Firebase initialized successfully.");

            // Auth State Listener को यहाँ से शुरू करें
            auth.onAuthStateChanged(user => {
                const loadingPage = document.getElementById('loadingPage');
                const mainContainer = document.getElementById('mainContainer');
                
                // लोडिंग पेज हटाएँ और मेन कंटेनर दिखाएँ
                loadingPage.classList.add('hidden'); 
                mainContainer.classList.remove('hidden'); 

                if (user) {
                    currentUser = user;
                    isAdmin = (user.email === ADMIN_EMAIL);
                    document.getElementById('welcomeUser').textContent = `स्वागत है, ${user.email.split('@')[0]}!`;
                    
                    db.ref(`users/${user.uid}/ffUid`).once('value', (snapshot) => {
                        currentUser.ffUid = snapshot.val();
                        app.showPage('dashboardPage');
                    });

                } else {
                    currentUser = null;
                    isAdmin = false;
                    app.showPage('welcomePage');
                }
            });

        } catch (error) {
            console.error("FATAL ERROR: Firebase Initialization Failed.", error);
            document.getElementById('loadingPage').innerHTML = '<h2>त्रुटि: Firebase शुरू करने में विफल रहा। कंसोल देखें।</h2>';
        }
        
    },

    showPage: (pageId) => {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
            page.classList.add('hidden');
        });
        document.getElementById(pageId).classList.add('active');
        document.getElementById(pageId).classList.remove('hidden');
        
        if (pageId === 'dashboardPage') {
            app.updateAdminPanelVisibility();
            app.renderAdminMatches();
            app.renderAdminResultSelect(); 
        } else if (pageId === 'leaderboardPage') {
            app.renderLeaderboard();
        }
    },

    // --- Auth Handlers ---
    signupUser: async () => { 
        playClickSound();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const messageDiv = document.getElementById('signupMessage');
        messageDiv.classList.add('hidden');

        if (!email || password.length < 6) {
            displayMessage(messageDiv, 'मान्य ईमेल और पासवर्ड (न्यूनतम 6 वर्ण) दर्ज करें।', 'error');
            return;
        }

        try {
            await auth.createUserWithEmailAndPassword(email, password);
            displayMessage(messageDiv, 'अकाउंट सफलतापूर्वक बनाया गया! लॉग इन हो रहा है...', 'success');
        } catch (error) {
            displayMessage(messageDiv, `त्रुटि: ${error.message}`, 'error');
        }
    },
    loginUser: async () => { 
        playClickSound();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageDiv = document.getElementById('loginMessage');
        messageDiv.classList.add('hidden');

        try {
            await auth.signInWithEmailAndPassword(email, password);
            displayMessage(messageDiv, 'सफलतापूर्वक लॉग इन किया गया!', 'success');
        } catch (error) {
            displayMessage(messageDiv, `त्रुटि: ${error.message}`, 'error');
        }
    },
    logoutUser: async () => { 
        playClickSound();
        try {
            await auth.signOut();
            Object.values(matchIntervals).forEach(clearInterval);
            matchIntervals = {};
        } catch (error) {
            console.error("Logout error:", error);
        }
    },
    resetPassword: async () => { 
        playClickSound();
        const email = document.getElementById('loginEmail').value;
        const messageDiv = document.getElementById('loginMessage');
        messageDiv.classList.add('hidden');

        if (!email) {
            displayMessage(messageDiv, 'पहले लॉगिन फ़ील्ड में अपना ईमेल दर्ज करें।', 'error');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            displayMessage(messageDiv, `पासवर्ड रीसेट लिंक ${email} पर भेजा गया। अपना इनबॉक्स जांचें।`, 'success');
        } catch (error) {
            displayMessage(messageDiv, `त्रुटि: ${error.message}`, 'error');
        }
    },

    // FF UID को सहेजने का फ़ंक्शन
    saveFFUid: async () => {
        playClickSound();
        const ffUidInput = document.getElementById('ffUidInput');
        const uidToSave = ffUidInput.value.trim();
        const messageDiv = document.getElementById('ffUidMessage');
        messageDiv.classList.add('hidden');

        if (!uidToSave || uidToSave.length < 5 || isNaN(uidToSave)) { 
             displayMessage(messageDiv, 'कृपया एक मान्य Free Fire UID (केवल अंक) दर्ज करें।', 'error');
             return;
        }
        
        try {
             await db.ref(`users/${currentUser.uid}/ffUid`).set(uidToSave);
             currentUser.ffUid = uidToSave; 
             displayMessage(messageDiv, 'Free Fire UID सफलतापूर्वक सहेजा गया!', 'success');
             
             if (document.getElementById('slotPage').classList.contains('active')) {
                 app.listenForSlots(currentMode, currentMatchId);
             }

        } catch (error) {
             displayMessage(messageDiv, `UID सहेजने में त्रुटि: ${error.message}`, 'error');
             console.error("UID save error:", error);
        }
    },
    
    // --- Admin Functions ---
    updateAdminPanelVisibility: () => {
        const adminPanel = document.getElementById('adminPanel');
        if (isAdmin) {
            adminPanel.classList.remove('hidden');
        } else {
            adminPanel.classList.add('hidden');
        }
    },

    createMatch: async () => {
        playClickSound(); 
        if (!isAdmin) return; 

        const mode = document.getElementById('adminMatchMode').value;
        const roomId = document.getElementById('adminRoomId').value;
        const roomPass = document.getElementById('adminRoomPass').value;
        const startTimeStr = document.getElementById('adminMatchStartTime').value;
        const messageDiv = document.getElementById('adminMatchMessage');
        messageDiv.classList.add('hidden');

        if (!mode || !roomId || !roomPass || !startTimeStr) {
            displayMessage(messageDiv, 'कृपया मैच के सभी विवरण भरें।', 'error');
            return;
        }

        const maxSlots = getSlotLimit(mode);
        const startTime = new Date(startTimeStr).getTime(); 

        try {
            const newMatchRef = db.ref(`matches/${mode}`).push();
            await newMatchRef.set({
                name: `${mode.toUpperCase()} • Match #${new Date().toLocaleTimeString().split(' ')[0]}`,
                startTime: startTime,
                roomId: roomId,
                roomPass: roomPass,
                maxSlots: maxSlots,
                slots: {}
            });
            displayMessage(messageDiv, 'नया मैच सफलतापूर्वक बनाया गया!', 'success');
            document.getElementById('adminRoomId').value = '';
            document.getElementById('adminRoomPass').value = '';
            document.getElementById('adminMatchStartTime').value = '';
            app.renderAdminResultSelect(); 
        } catch (error) {
            displayMessage(messageDiv, `मैच बनाने में त्रुटि: ${error.message}`, 'error');
        }
    },
    
    // एडमिन के लिए सक्रिय मैचों को रिजल्ट सबमिशन ड्रॉपडाउन में रेंडर करें
    renderAdminResultSelect: () => {
        if (!isAdmin) return;
        
        const selectElement = document.getElementById('adminResultMatchSelect');
        selectElement.innerHTML = '<option value="">-- परिणाम दर्ज करने के लिए मैच चुनें --</option>';

        db.ref('matches').once('value', (snapshot) => {
            snapshot.forEach(modeSnap => {
                const mode = modeSnap.key;
                modeSnap.forEach(matchSnap => {
                    const match = matchSnap.val();
                    const matchId = matchSnap.key;
                    if (!match.result) { 
                        const option = document.createElement('option');
                        option.value = `${mode}|${matchId}`; 
                        option.textContent = `${match.name} (${mode.toUpperCase()}) - ${new Date(match.startTime).toLocaleTimeString()}`;
                        selectElement.appendChild(option);
                    }
                });
            });
        });
    },

    // मैच परिणाम सबमिट करने का फ़ंक्शन
    submitMatchResult: async () => {
        playClickSound();
        if (!isAdmin) return;
        
        const selectValue = document.getElementById('adminResultMatchSelect').value;
        const winnerUid = document.getElementById('resultWinnerUid').value.trim();
        const killsInput = document.getElementById('resultWinnerKills').value;
        const messageDiv = document.getElementById('adminResultMessage');
        messageDiv.classList.add('hidden');

        if (!selectValue || !winnerUid || killsInput === "") {
            displayMessage(messageDiv, 'कृपया मैच चुनें, विजेता UID और किल्स दर्ज करें।', 'error');
            return;
        }
        
        const [mode, matchId] = selectValue.split('|');
        const kills = parseInt(killsInput);
        
        if (isNaN(kills) || kills < 0) {
            displayMessage(messageDiv, 'किल्स एक गैर-नकारात्मक संख्या होनी चाहिए।', 'error');
            return;
        }

        try {
            // 1. मैच ऑब्जेक्ट में परिणाम सहेजें
            await db.ref(`matches/${mode}/${matchId}/result`).set({
                winnerUid: winnerUid,
                kills: kills,
                points: POINTS_PER_WIN + (kills * POINTS_PER_KILL),
                submittedAt: Date.now(),
                submittedBy: currentUser.email.split('@')[0]
            });
            
            // 2. लीडरबोर्ड को अपडेट करें
            await app.updateLeaderboard(winnerUid, kills);
            
            displayMessage(messageDiv, `परिणाम सफलतापूर्वक सबमिट किए गए और लीडरबोर्ड अपडेट हुआ!`, 'success');
            
            // इनपुट साफ़ करें और ड्रॉपडाउन रीफ़्रेश करें
            document.getElementById('adminResultMatchSelect').value = '';
            document.getElementById('resultWinnerUid').value = '';
            document.getElementById('resultWinnerKills').value = '';
            app.renderAdminResultSelect(); 
            
        } catch (error) {
            displayMessage(messageDiv, `परिणाम सबमिट करने में त्रुटि: ${error.message}`, 'error');
            console.error("Result submission error:", error);
        }
    },

    // लीडरबोर्ड डेटा को अपडेट/इंक्रीमेंट करें
    updateLeaderboard: async (winnerUid, kills) => {
        const leaderboardRef = db.ref(`leaderboard/${winnerUid}`);
        const pointsEarned = POINTS_PER_WIN + (kills * POINTS_PER_KILL);

        try {
             await leaderboardRef.transaction(currentStats => {
                 if (currentStats === null) {
                     return {
                         ffUid: winnerUid,
                         wins: 1,
                         totalKills: kills,
                         totalPoints: pointsEarned,
                     };
                 } else {
                     currentStats.wins = (currentStats.wins || 0) + 1;
                     currentStats.totalKills = (currentStats.totalKills || 0) + kills;
                     currentStats.totalPoints = (currentStats.totalPoints || 0) + pointsEarned;
                     return currentStats;
                 }
             });
        } catch (error) {
            console.error("Leaderboard transaction failed:", error);
        }
    },

    // एडमिन के लिए सक्रिय मैचों को रेंडर करें
    renderAdminMatches: () => {
        if (!isAdmin) return;

        db.ref('matches').on('value', (snapshot) => {
            const matchesContainer = document.getElementById('adminMatchList');
            matchesContainer.innerHTML = '';
            const allMatches = [];

            snapshot.forEach(modeSnap => {
                const mode = modeSnap.key;
                modeSnap.forEach(matchSnap => {
                    allMatches.push({ id: matchSnap.key, mode: mode, ...matchSnap.val() });
                });
            });

            allMatches.sort((a, b) => a.startTime - b.startTime).forEach(match => {
                const matchTime = new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const hasResult = !!match.result;
                const resultText = hasResult ? ` (विजेता: ${match.result.winnerUid})` : '';

                const div = document.createElement('div');
                div.className = 'admin-match-item';
                div.innerHTML = `
                    <span>${match.mode} • ${match.name} (${matchTime}) ${resultText}</span>
                    <div>
                        <button class="admin-details-btn" onclick="app.viewAdminSlotDetails('${match.mode}', '${match.id}');">विवरण देखें</button>
                        <button onclick="app.deleteMatch('${match.mode}', '${match.id}', true);">हटाएँ</button>
                        <button onclick="app.clearSlots('${match.mode}', '${match.id}');">स्लॉट्स खाली करें</button>
                    </div>
                `;
                matchesContainer.appendChild(div);
            });
        });
    },

    viewAdminSlotDetails: (mode, matchId) => {
        playClickSound(); 
        if (!isAdmin) return;
        
        const matchRef = db.ref(`matches/${mode}/${matchId}`);
        matchRef.once('value', (snapshot) => {
            const match = snapshot.val();
            if (!match) return;

            const slots = match.slots || {};
            let detailsHtml = `<h3>${match.name} - रूम जानकारी</h3>`;
            detailsHtml += `<p><strong>ID:</strong> ${match.roomId}</p>`;
            detailsHtml += `<p><strong>Pass:</strong> ${match.roomPass}</p>`;
            detailsHtml += `<h3>स्लॉट्स (${Object.keys(slots).length}/${match.maxSlots})</h3>`;
            
            db.ref('users').once('value', (userSnap) => {
                let userDetailsHtml = '<ul style="list-style: none; padding: 0;">';
                for (let i = 1; i <= match.maxSlots; i++) {
                    const slotKey = `slot${i}`;
                    const slotData = slots[slotKey];
                    
                    if (slotData) {
                        const ffUid = slotData.ffUid || 'N/A'; 

                        userDetailsHtml += `<li style="padding: 5px; border-bottom: 1px dotted var(--neon-purple); text-align: left;">
                            <strong>स्लॉट ${i}:</strong> ${slotData.email.split('@')[0]}
                            <br>
                            <span style="color: var(--success-green); font-size: 0.9em; margin-left: 10px;">FF UID: ${ffUid}</span>
                        </li>`;
                    } else {
                         userDetailsHtml += `<li style="padding: 5px; border-bottom: 1px dotted var(--neon-purple); text-align: left;">
                            <strong>स्लॉट ${i}:</strong> खाली
                        </li>`;
                    }
                }
                userDetailsHtml += '</ul>';

                alert(`एडमिन मैच विवरण:\n\nमैच: ${match.name}\nरूम ID: ${match.roomId}\nरूम Pass: ${match.roomPass}\n\nSLOTS:\n${userDetailsHtml.replace(/<[^>]*>?/gm, '\n').replace(/&nbsp;/g, ' ').trim()}`);
            });
        });
    },

    deleteMatch: async (mode, matchId, isManual = false) => {
        playClickSound(); 
        if (!isAdmin && isManual) return; 

        if (isManual && !confirm('क्या आप वाकई इस मैच को हटाना चाहते हैं?')) return;
        
        try {
            if (matchIntervals[matchId]) {
                 clearInterval(matchIntervals[matchId]);
                 delete matchIntervals[matchId];
            }
            await db.ref(`matches/${mode}/${matchId}`).remove();
            console.log(`Match ${matchId} deleted.`);
            app.renderAdminResultSelect(); 
        } catch (error) {
            console.error("Deletion error:", error);
        }
    },

    clearSlots: async (mode, matchId) => {
         playClickSound(); 
         if (!isAdmin || !confirm('क्या आप वाकई इस मैच के सभी स्लॉट्स खाली करना चाहते हैं?')) return;
         try {
             await db.ref(`matches/${mode}/${matchId}/slots`).set({});
             console.log(`Slots for match ${matchId} cleared manually.`);
         } catch (error) {
             console.error("Clear slots error:", error);
         }
     },

    // --- User Match & Slot System ---
    selectMode: (mode) => {
        playClickSound();
        currentMode = mode;
        document.getElementById('matchListTitle').textContent = `मैच ${mode.toUpperCase()} के लिए`;
        app.showPage('matchListPage');
        app.listenForMatches(mode);
    },
    
    // मैच टाइमर और साउंड लॉजिक
    updateMatchTimer: (matchId, matchData, mode) => {
        const now = Date.now();
        const startTime = matchData.startTime;
        const deleteTime = startTime + 40000; 
        
        const timeDiffSeconds = Math.floor((startTime - now) / 1000);
        const timeToDeleteSeconds = Math.floor((deleteTime - now) / 1000); 

        
        const timerSpan = document.querySelector(`[data-match-timer-id="${matchId}"]`);
        const statusSpan = document.querySelector(`[data-match-status-id="${matchId}"]`);
        
        if (!timerSpan || !statusSpan) return;

        const isCurrentlyViewing = (matchId === currentMatchId && document.getElementById('slotPage').classList.contains('active'));
        const matchContainer = document.getElementById('mainContainer');
        const matchDetailsElement = document.getElementById('currentMatchDetails');
        const slotTimerElement = document.getElementById('slotPageTimer'); 

        let timeString;
        let isMatchStarted = (timeDiffSeconds <= 0);

        if (timeDiffSeconds > 0) {
            // आगामी मैच
            const days = Math.floor(timeDiffSeconds / 86400);
            const hours = Math.floor((timeDiffSeconds % 86400) / 3600);
            const minutes = Math.floor((timeDiffSeconds % 3600) / 60);
            const seconds = timeDiffSeconds % 60;
            
            timeString = `${days > 0 ? days + 'd ' : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            timerSpan.textContent = timeString;
            if (isCurrentlyViewing && slotTimerElement) slotTimerElement.textContent = timeString;

            statusSpan.textContent = 'आगामी';
            statusSpan.className = 'status upcoming';

            // 59 सेकंड से 2 सेकंड तक काउंटडाउन साउंड
            if (isCurrentlyViewing) {
                if (timeDiffSeconds === 60) {
                    playWarningSound(); 
                    matchDetailsElement.classList.add('warning-animation'); 
                } else if (timeDiffSeconds > 60) {
                    matchDetailsElement.classList.remove('warning-animation');
                    matchDetailsElement.classList.remove('critical-warning'); 
                    matchContainer.classList.remove('screen-shake');
                }
                
                // 59 सेकंड से 2 सेकंड तक हर सेकंड साउंड
                if (timeDiffSeconds <= 59 && timeDiffSeconds >= 2) {
                    playWarningSound();
                }

                // 1 सेकंड पर क्रिटिकल साउंड
                if (timeDiffSeconds === 1) {
                    playCriticalSound(); 
                    matchDetailsElement.classList.add('critical-warning'); 
                    matchContainer.classList.add('screen-shake'); 
                }
            }


        } else if (timeToDeleteSeconds > 0) {
            // लाइव मैच
            const liveTime = 30 + timeDiffSeconds; 
            
            
            if (liveTime > 0) {
                timeString = `लाइव - खाली होने में ${liveTime} सेकंड`;
            } else {
                timeString = `समाप्त - ${timeToDeleteSeconds} सेकंड में हटाया जा रहा है`;
            }
            
            timerSpan.textContent = timeString;
            if (isCurrentlyViewing && slotTimerElement) slotTimerElement.textContent = timeString;

            statusSpan.textContent = 'लाइव';
            statusSpan.className = 'status live';
            
            if(isCurrentlyViewing) {
                 if (timeDiffSeconds === 0) {
                     playCriticalSound(); // रूम ID रिवील होने पर क्रिटिकल साउंड
                     const msg = document.createElement('div');
                     msg.className = 'match-starting-message';
                     msg.textContent = 'मैच अभी शुरू हो रहा है!';
                     document.body.appendChild(msg);
                     setTimeout(() => msg.remove(), 2000);
                 }
                 matchDetailsElement.classList.remove('warning-animation', 'critical-warning');
                 matchContainer.classList.remove('screen-shake');
            }

            if (liveTime === 0) {
                // 30 सेकंड बाद स्लॉट्स खाली करें
                db.ref(`matches/${mode}/${matchId}/slots`).set({});
                console.log(`Match ${matchId} slots auto-cleared.`);
            }


        } else {
            // मैच समाप्त - ऑटो-डिलीट
            app.deleteMatch(mode, matchId); 
            
            timerSpan.textContent = 'हटाया गया';
            statusSpan.textContent = 'हटाया गया';
            statusSpan.className = 'status ended';
            
            if(matchIntervals[matchId]) {
                clearInterval(matchIntervals[matchId]);
                delete matchIntervals[matchId];
            }
        }
    },
    
    backToMatchList: () => {
        playClickSound();
        if (currentMatchId && currentMode) {
             db.ref(`matches/${currentMode}/${currentMatchId}`).off(); 
        }
        app.showPage('matchListPage'); 
        
        app.revealRoomInfo('********', '********');
        document.getElementById('currentMatchDetails').classList.remove('warning-animation', 'critical-warning');
        document.getElementById('mainContainer').classList.remove('screen-shake');
    },

    revealRoomInfo: (roomId, roomPass) => {
        document.getElementById('revealedRoomId').textContent = roomId;
        document.getElementById('revealedRoomPass').textContent = roomPass;
    },

    joinMatch: (matchId, mode) => {
        playClickSound();
        currentMatchId = matchId;
        currentMode = mode;
        
        db.ref(`users/${currentUser.uid}/ffUid`).once('value', (snapshot) => {
            currentUser.ffUid = snapshot.val(); 
            app.showPage('slotPage');
            app.listenForSlots(mode, matchId); 
            app.revealRoomInfo('********', '********');
        });
    },

    // रूम ID रिवील फिक्स और UID प्रोटेक्शन यहीं होता है
    listenForSlots: (mode, matchId) => {
        const matchRef = db.ref(`matches/${mode}/${matchId}`);
        matchRef.on('value', (snapshot) => {
            currentMatchData = snapshot.val(); 
            if (!currentMatchData) {
                alert('यह मैच एडमिन द्वारा हटा दिया गया है।');
                app.backToMatchList(); 
                return;
            }

            const slots = currentMatchData.slots || {};
            const maxSlots = currentMatchData.maxSlots;
            const slotsContainer = document.getElementById('slotsContainer');
            slotsContainer.innerHTML = '';

            document.getElementById('slotPageMatchTitle').textContent = currentMatchData.name;
            document.getElementById('currentMatchName').textContent = currentMatchData.name;
            document.getElementById('currentMatchStartTime').textContent = new Date(currentMatchData.startTime).toLocaleString();
            document.getElementById('maxSlots').textContent = maxSlots;
            document.getElementById('slotsCount').textContent = Object.keys(slots).length;
            
            app.updateMatchTimer(matchId, currentMatchData, mode); 
            
            const userInMatch = Object.values(slots).some(s => s.uid === currentUser.uid);
            const timeDiffSeconds = Math.floor((currentMatchData.startTime - Date.now()) / 1000);
            const isMatchStarted = (timeDiffSeconds <= 0);

            const ffUidInputSection = document.getElementById('ffUidInputSection');
            const ffUidInput = document.getElementById('ffUidInput');
            ffUidInput.value = currentUser.ffUid || ''; 
            
            // UID इनपुट दिखाएँ/छिपाएँ
            if (!userInMatch && !isMatchStarted) {
                ffUidInputSection.classList.remove('hidden');
            } else {
                ffUidInputSection.classList.add('hidden');
            }
            
            // रूम ID/पासवर्ड रिवील लॉजिक (फिक्स किया गया)
            if (userInMatch && isMatchStarted) {
                 app.revealRoomInfo(currentMatchData.roomId, currentMatchData.roomPass);
            } else {
                 app.revealRoomInfo('********', '********');
            }


            // स्लॉट्स को रेंडर करें
            for (let i = 1; i <= maxSlots; i++) {
                const slotKey = `slot${i}`;
                const slotData = slots[slotKey];
                
                const div = document.createElement('div');
                div.className = 'slot-item';

                let button;
                if (slotData) {
                    div.classList.add('occupied');
                    div.innerHTML = `<span class="slot-name">स्लॉट ${i}: ${slotData.ffUid} (${slotData.email.split('@')[0]})</span>`;
                    
                    if (slotData.uid === currentUser.uid) {
                        button = document.createElement('button');
                        button.textContent = 'स्लॉट छोड़ें';
                        button.onclick = () => app.leaveSlot(mode, matchId, slotKey);
                        button.style.backgroundColor = 'var(--warning-red)';
                    } else {
                        button = document.createElement('button');
                        button.textContent = 'भरा हुआ';
                        button.disabled = true;
                    }
                } else {
                    div.innerHTML = `<span class="slot-name">स्लॉट ${i}: खाली</span>`;
                    
                    button = document.createElement('button');
                    
                    const currentUidInInput = ffUidInput.value;

                    if (isMatchStarted) {
                        button.textContent = 'मैच शुरू';
                        button.disabled = true;
                        button.style.backgroundColor = 'var(--warning-red)';
                    } else if (userInMatch) {
                         button.textContent = 'पहले से जुड़े हुए';
                         button.disabled = true;
                    } else if (!currentUidInInput) {
                         button.textContent = 'ऊपर UID भरें';
                         button.disabled = true;
                    } else {
                         button.textContent = `स्लॉट से जुड़ें`;
                         button.disabled = false;
                         button.onclick = () => app.promptAndJoinSlot(mode, matchId, slotKey, currentUidInInput);
                    }
                }

                div.appendChild(button);
                slotsContainer.appendChild(div);
            }
        });
    },
    
    promptAndJoinSlot: (mode, matchId, slotKey, uidToUse) => {
        playClickSound();
        const confirmJoin = confirm(`क्या आप FF UID ${uidToUse} के साथ स्लॉट ${slotKey} से जुड़ना चाहते हैं?`);
        
        if (confirmJoin) {
            app.joinSlot(mode, matchId, slotKey, uidToUse);
        } else {
            displayMessage(document.getElementById('slotPageMessage'), 'स्लॉट में शामिल होना रद्द किया गया।', 'error');
        }
    },

    joinSlot: async (mode, matchId, slotKey, uidToUse) => {
        playClickSound();
        const messageDiv = document.getElementById('slotPageMessage');
        messageDiv.classList.add('hidden');
        
        const slotRef = db.ref(`matches/${mode}/${matchId}/slots/${slotKey}`);
        
        try {
            // UID Protection Check: checks if user is already in ANY slot of this match
            const isUserAlreadyInSlot = currentMatchData && Object.values(currentMatchData.slots || {}).some(s => s.uid === currentUser.uid);
            
            if (isUserAlreadyInSlot) {
                 displayMessage(messageDiv, 'आप पहले से ही इस मैच के एक स्लॉट से जुड़े हुए हैं।', 'error');
                 return; 
            }
            
            const result = await slotRef.transaction(currentData => {
                if (currentData === null) {
                    
                    // UID को सहेजें
                    if (uidToUse && uidToUse !== currentUser.ffUid) {
                        db.ref(`users/${currentUser.uid}/ffUid`).set(uidToUse);
                        currentUser.ffUid = uidToUse; 
                        document.getElementById('ffUidInput').value = uidToUse; 
                    }
                    
                    return { 
                        uid: currentUser.uid, 
                        email: currentUser.email, 
                        ffUid: uidToUse 
                    };
                } else {
                    return undefined; 
                }
            });

            if (result.committed) {
                displayMessage(messageDiv, `स्लॉट ${slotKey} से सफलतापूर्वक जुड़े!`, 'success');
            } else if (result.snapshot.val() !== null) {
                displayMessage(messageDiv, 'यह स्लॉट अभी-अभी लिया गया। कृपया कोई अन्य स्लॉट आज़माएँ।', 'error');
            } else {
                 displayMessage(messageDiv, 'कोई अज्ञात त्रुटि हुई या आप पहले से ही एक स्लॉट में हैं।', 'error');
            }
        } catch (error) {
            displayMessage(messageDiv, `स्लॉट से जुड़ने में त्रुटि: ${error.message}`, 'error');
            console.error(error);
        }
    },

    leaveSlot: async (mode, matchId, slotKey) => {
        playClickSound();
        const messageDiv = document.getElementById('slotPageMessage');
        messageDiv.classList.add('hidden');
        
        try {
            await db.ref(`matches/${mode}/${matchId}/slots/${slotKey}`).remove();
            displayMessage(messageDiv, 'सफलतापूर्वक स्लॉट छोड़ा।', 'success');
        } catch (error) {
            displayMessage(messageDiv, `स्लॉट छोड़ने में त्रुटि: ${error.message}`, 'error');
        }
    },

    renderLeaderboard: () => {
        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = '<tr><td colspan="5">लीडरबोर्ड लोड हो रहा है...</td></tr>';
        
        db.ref('leaderboard').once('value', (snapshot) => {
            const stats = [];
            snapshot.forEach(childSnap => {
                stats.push(childSnap.val());
            });

            stats.sort((a, b) => {
                if (b.totalPoints !== a.totalPoints) {
                    return b.totalPoints - a.totalPoints;
                }
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                return b.totalKills - a.totalKills;
            });

            leaderboardBody.innerHTML = '';
            
            if (stats.length === 0) {
                 leaderboardBody.innerHTML = '<tr><td colspan="5">अभी तक कोई मैच परिणाम सबमिट नहीं किया गया है।</td></tr>';
                 return;
            }

            stats.forEach((player, index) => {
                const rank = index + 1;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>#${rank}</td>
                    <td>${player.ffUid}</td>
                    <td>${player.wins}</td>
                    <td>${player.totalKills}</td>
                    <td>${player.totalPoints}</td>
                `;
                leaderboardBody.appendChild(row);
            });
        });
    },

    showLeaderboard: () => {
        playClickSound();
        app.showPage('leaderboardPage');
    },

    listenForMatches: (mode) => {
        Object.values(matchIntervals).forEach(clearInterval);
        matchIntervals = {};
        db.ref(`matches/${mode}`).off();

        db.ref(`matches/${mode}`).on('value', (snapshot) => {
            const matchesContainer = document.getElementById('matchesContainer');
            matchesContainer.innerHTML = '';
            const matches = [];

            snapshot.forEach(snap => {
                matches.push({ id: snap.key, mode: mode, ...snap.val() });
            });

            matches.sort((a, b) => a.startTime - b.startTime);

            matches.forEach(match => {
                app.renderMatchCard(match, matchesContainer);
            });
        });
    },

    renderMatchCard: (match, container) => {
        const div = document.createElement('div');
        div.className = 'match-item';

        const resultStatus = match.result ? `<span style="color: var(--admin-color); font-weight: bold;">(परिणाम: ${match.result.winnerUid})</span>` : '';

        div.innerHTML = `
            <h4>${match.name} ${resultStatus}</h4>
            <div class="match-details">
                <span><strong>मोड:</strong> ${match.mode.toUpperCase()}</span>
                <span><strong>शुरू:</strong> ${new Date(match.startTime).toLocaleString()}</span>
                <span><strong>स्लॉट्स:</strong> ${Object.keys(match.slots || {}).length}/${match.maxSlots}</span>
                <span><strong>स्थिति:</strong> <span data-match-status-id="${match.id}" class="status">आगामी</span></span>
                <span><strong>टाइमर:</strong> <span data-match-timer-id="${match.id}">--:--:--</span></span>
            </div>
            <button onclick="app.joinMatch('${match.id}', '${match.mode}');" style="margin-top: 10px;">देखें और जुड़ें</button>
        `;
        container.appendChild(div);

        if (matchIntervals[match.id]) {
            clearInterval(matchIntervals[match.id]);
        }
        
        matchIntervals[match.id] = setInterval(() => {
            app.updateMatchTimer(match.id, match, match.mode);
        }, 1000);
        
        app.updateMatchTimer(match.id, match, match.mode);
    }
};

// --- 4. INITIALIZATION ---

// बटन क्लिक पर साउंड अटैच करें
document.addEventListener('DOMContentLoaded', () => {
    // app.init को DOMContentLoaded के बाद चलाएँ ताकि Firebase लाइब्रेरी लोड हो जाए
    app.init(); 

    document.querySelectorAll('button:not([onclick^="app.showPage"]), a[onclick], button[onclick]').forEach(element => {
        const originalOnClick = element.getAttribute('onclick');
        if (originalOnClick && !originalOnClick.startsWith('playClickSound()') && !originalOnClick.startsWith('app.showPage')) {
            element.setAttribute('onclick', `playClickSound(); ${originalOnClick}`);
        } else if (element.tagName === 'BUTTON' && !originalOnClick) {
            element.addEventListener('click', playClickSound);
        }
    });
    document.querySelectorAll('[onclick^="app.showPage"]').forEach(element => {
        const pageId = element.getAttribute('onclick').match(/'([^']+)'/)[1];
        element.setAttribute('onclick', `playClickSound(); app.showPage('${pageId}');`);
    });
});


window.app = app;
