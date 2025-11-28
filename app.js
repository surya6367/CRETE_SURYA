// --- 1. FIREBASE CONFIGURATION & Initialization Fix ---
const firebaseConfig = {
    apiKey: "AIzaSyBQM0KrwvcsUckhJArkvAhPMD1_n_ytuoM",
    authDomain: "freefiretournament-5d4f5.firebaseapp.com",
    projectId: "freefiretournament-5d4f5",
    storageBucket: "freefiretournament-5d4f5.firebasestorage.app",
    messagingSenderId: "80370183123",
    appId: "1:80370183123:web:6e56e89b67b7ff87551d26",
    databaseURL: "https://freefiretournament-5d4f5-default-rtdb.firebaseio.com"
};

// Firebase objects set to null initially
let auth = null;
let db = null;
let appInstance = null;

// The function that initializes Firebase and handles the loading screen
const initFirebase = () => {
    // Check if Firebase SDK is loaded (The main FIX for "Loading...")
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
         console.error("FATAL ERROR: Firebase SDK not loaded. Check script tags in index.html.");
         document.getElementById('loadingPage').innerHTML = '<h2>Error: Firebase library not loaded. Check index.html.</h2>';
         return;
    }
    try {
        appInstance = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.database();
        console.log("Firebase initialized successfully.");

        // Start Auth State Listener after initialization
        auth.onAuthStateChanged(user => {
            const loadingPage = document.getElementById('loadingPage');
            const mainContainer = document.getElementById('mainContainer');
            
            // This is the line that makes the website advance past the loading screen
            loadingPage.classList.add('hidden'); 
            mainContainer.classList.remove('hidden'); 
            
            if (user) {
                currentUser = user;
                isAdmin = (user.email === ADMIN_EMAIL);
                document.getElementById('welcomeUser').textContent = `Welcome, ${user.email.split('@')[0]}!`;
                
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
        document.getElementById('loadingPage').innerHTML = '<h2>Error: Firebase Initialization Failed. Check Console.</h2>';
    }
};

// --- 2. GLOBAL STATE AND CONSTANTS ---
const ADMIN_EMAIL = 'sf636785@gmail.com';
let isAdmin = false;
let currentMode = '';
let currentMatchId = '';
let matchIntervals = {};
let currentUser = null;
let currentMatchData = null; 

// Score Configuration (Assumed from previous context)
const POINTS_PER_WIN = 10;
const POINTS_PER_KILL = 1;

// Sound Setup
const clickSound = new Audio('sounds/click.wav'); 
const warningSound = new Audio('sounds/warning.wav');
const criticalSound = new Audio('sounds/beep.wav'); 

// Fallback logic if .wav files fail to load
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
        warningSound.onerror = () => console.error("FATAL: warning.mp3 also failed to load.");
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
        audioElement.play().catch(e => {
             console.error(`Audio play failed for ${audioElement.src.split('/').pop()}: Browser Autoplay Policy blocked it.`, e.message);
        });
    }
}

function playClickSound() { playSound(clickSound); }
function playWarningSound() { playSound(warningSound); }
function playCriticalSound() { playSound(criticalSound); }


function getSlotLimit(mode) {
    switch (mode) {
        case '1v1': return 2;
        case '2v2': return 4;
        case '3v3': return 6;
        case '4v4': return 8;
        case 'BR48': return 48;
        default: return 0;
    }
}

// Helper for UI messages
function displayMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
    // Using a shorter duration for click feedback messages
    const duration = type === 'click-feedback' ? 500 : 5000;
    setTimeout(() => { element.classList.add('hidden'); }, duration);
}

// --- 3. APPLICATION LOGIC ---
const app = {
    init: initFirebase, 
    showPage: (pageId) => {
        playClickSound(); 
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
            page.classList.add('hidden');
        });
        document.getElementById(pageId).classList.add('active');
        document.getElementById(pageId).classList.remove('hidden');
        
        if (pageId === 'dashboardPage') {
            app.updateAdminPanelVisibility();
            app.renderAdminMatches();
            // Assuming renderAdminResultSelect is a necessary function for Admin panel
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
            displayMessage(messageDiv, 'Enter valid email and password (min 6 chars).', 'error');
            return;
        }

        try {
            await auth.createUserWithEmailAndPassword(email, password);
            displayMessage(messageDiv, 'Account created successfully! Logging in...', 'success');
        } catch (error) {
            displayMessage(messageDiv, `Error: ${error.message}`, 'error');
        }
    },
    loginUser: async () => { 
        playClickSound();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageDiv = document.getElementById('loginMessage');
        messageDiv.classList.add('hidden');
        
        if (!email || password.length < 6) {
            displayMessage(messageDiv, 'Enter valid email and password (min 6 chars).', 'error');
            return;
        }

        try {
            await auth.signInWithEmailAndPassword(email, password);
            displayMessage(messageDiv, 'Logged in successfully!', 'success');
        } catch (error) {
            displayMessage(messageDiv, `Error: ${error.message}`, 'error');
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
            displayMessage(messageDiv, 'Enter your email in the login field first.', 'error');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            displayMessage(messageDiv, `Password reset link sent to ${email}. Check your inbox.`, 'success');
        } catch (error) {
            displayMessage(messageDiv, `Error: ${error.message}`, 'error');
        }
    },

    // Save FF UID Function
    saveFFUid: async () => {
        playClickSound();
        const ffUidInput = document.getElementById('ffUidInput');
        const uidToSave = ffUidInput.value.trim();
        const messageDiv = document.getElementById('ffUidMessage');
        messageDiv.classList.add('hidden');
        if (!uidToSave || uidToSave.length < 5 || isNaN(uidToSave)) { 
             displayMessage(messageDiv, 'Please enter a valid Free Fire UID (digits only).', 'error');
             return;
        }
        
        try {
             await db.ref(`users/${currentUser.uid}/ffUid`).set(uidToSave);
             currentUser.ffUid = uidToSave; 
             displayMessage(messageDiv, 'Free Fire UID saved successfully!', 'success');
             
             if (document.getElementById('slotPage').classList.contains('active')) {
                 app.listenForSlots(currentMode, currentMatchId);
             }
        } catch (error) {
             displayMessage(messageDiv, `Error saving UID: ${error.message}`, 'error');
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
        const name = document.getElementById('adminMatchName').value.trim();
        const roomId = document.getElementById('adminRoomId').value.trim();
        const roomPass = document.getElementById('adminRoomPass').value.trim();
        const startTimeStr = document.getElementById('adminMatchStartTime').value;
        const messageDiv = document.getElementById('adminCreateMessage');
        messageDiv.classList.add('hidden');

        if (!mode || !roomId || !roomPass || !startTimeStr || !name) {
            displayMessage(messageDiv, 'Please fill all match details.', 'error');
            return;
        }

        const maxSlots = getSlotLimit(mode);
        const startTime = new Date(startTimeStr).getTime(); 

        try {
            const newMatchRef = db.ref(`matches/${mode}`).push();
            const matchId = newMatchRef.key;
            
            await newMatchRef.set({
                id: matchId, 
                name: name,
                mode: mode,
                startTime: startTime,
                roomId: roomId,
                roomPass: roomPass,
                maxSlots: maxSlots,
                slots: {}
            });
            displayMessage(messageDiv, 'New match created successfully!', 'success');
            document.getElementById('adminRoomId').value = '';
            document.getElementById('adminRoomPass').value = '';
            document.getElementById('adminMatchName').value = '';
            document.getElementById('adminMatchStartTime').value = '';
            app.renderAdminResultSelect(); // Refresh result dropdown
        } catch (error) {
            displayMessage(messageDiv, `Error creating match: ${error.message}`, 'error');
        }
    },
    
    // Admin Result Select functionality (Needed for index.html)
    renderAdminResultSelect: () => {
        if (!isAdmin) return;
        
        const selectElement = document.getElementById('adminResultMatchSelect');
        selectElement.innerHTML = '<option value="">-- Select Match to Enter Result --</option>';
        db.ref('matches').once('value', (snapshot) => {
            snapshot.forEach(modeSnap => {
                const mode = modeSnap.key;
                modeSnap.forEach(matchSnap => {
                    const match = matchSnap.val();
                    const matchId = matchSnap.key;
                    // Only show matches without results
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

    // Submit Match Result Function (Needed for index.html)
    submitMatchResult: async () => {
        playClickSound();
        if (!isAdmin) return;
        
        const selectValue = document.getElementById('adminResultMatchSelect').value;
        const winnerUid = document.getElementById('resultWinnerUid').value.trim();
        const killsInput = document.getElementById('resultWinnerKills').value;
        const messageDiv = document.getElementById('adminResultMessage');
        messageDiv.classList.add('hidden');
        
        if (!selectValue || !winnerUid || killsInput === "") {
            displayMessage(messageDiv, 'Please select match, enter winner UID and kills.', 'error');
            return;
        }
        
        const [mode, matchId] = selectValue.split('|');
        const kills = parseInt(killsInput);
        
        if (isNaN(kills) || kills < 0) {
            displayMessage(messageDiv, 'Kills must be a non-negative number.', 'error');
            return;
        }
        
        const pointsEarned = POINTS_PER_WIN + (kills * POINTS_PER_KILL);
        
        try {
            // 1. Save result in the match object
            await db.ref(`matches/${mode}/${matchId}/result`).set({
                winnerUid: winnerUid,
                kills: kills,
                points: pointsEarned,
                submittedAt: Date.now(),
                submittedBy: currentUser.email.split('@')[0]
            });
            
            // 2. Update the Leaderboard
            await app.updateLeaderboard(winnerUid, kills, pointsEarned);
            
            displayMessage(messageDiv, `Results submitted successfully and leaderboard updated!`, 'success');
            
            // Clear inputs and refresh dropdown
            document.getElementById('adminResultMatchSelect').value = '';
            document.getElementById('resultWinnerUid').value = '';
            document.getElementById('resultWinnerKills').value = '';
            app.renderAdminResultSelect(); 
            
        } catch (error) {
            displayMessage(messageDiv, `Error submitting result: ${error.message}`, 'error');
            console.error("Result submission error:", error);
        }
    },
    
    // Update/Increment Leaderboard Data
    updateLeaderboard: async (winnerUid, kills, pointsEarned) => {
        const leaderboardRef = db.ref(`leaderboard/${winnerUid}`);
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
                     // Ensure fields exist before incrementing
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
    
    // Render Leaderboard (Needed for index.html)
    renderLeaderboard: () => {
        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = '<tr><td colspan="5">Loading Leaderboard...</td></tr>';
        
        db.ref('leaderboard').once('value', (snapshot) => {
            const stats = [];
            snapshot.forEach(childSnap => {
                stats.push(childSnap.val());
            });
            
            // Sort: Points (desc), Wins (desc), Kills (desc)
            stats.sort((a, b) => {
                if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.totalKills - a.totalKills;
            });
            
            leaderboardBody.innerHTML = '';
            
            if (stats.length === 0) {
                 leaderboardBody.innerHTML = '<tr><td colspan="5">No match results submitted yet.</td></tr>';
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


    renderAdminMatches: () => {
        if (!isAdmin) return;

        db.ref('matches').on('value', (snapshot) => {
            const matchesContainer = document.getElementById('adminActiveMatches');
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
                const div = document.createElement('div');
                div.className = 'admin-match-item';
                div.innerHTML = `
                    <span>${match.mode} • ${match.name} (${matchTime})</span>
                    <div>
                        <button class="admin-details-btn" onclick="app.viewAdminSlotDetails('${match.mode}', '${match.id}');">View Details</button>
                        <button onclick="app.deleteMatch('${match.mode}', '${match.id}', true);">Delete</button>
                        <button onclick="app.clearSlots('${match.mode}', '${match.id}');">Clear Slots</button>
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
            let detailsHtml = `<h3>${match.name} - Room Info</h3>`;
            detailsHtml += `<p><strong>ID:</strong> ${match.roomId}</p>`;
            detailsHtml += `<p><strong>Pass:</strong> ${match.roomPass}</p>`;
            detailsHtml += `<h3>Slots (${Object.keys(slots).length}/${match.maxSlots})</h3>`;
            
            db.ref('users').once('value', (userSnap) => {
                let userDetailsHtml = '<ul style="list-style: none; padding: 0;">';
                for (let i = 1; i <= match.maxSlots; i++) {
                    const slotKey = `slot${i}`;
                    const slotData = slots[slotKey];
                    
                    if (slotData) {
                        const ffUid = slotData.ffUid || 'N/A'; 

                        userDetailsHtml += `<li style="padding: 5px; border-bottom: 1px dotted var(--neon-purple); text-align: left;">
                            <strong>Slot ${i}:</strong> ${slotData.email.split('@')[0]}
                            <br>
                            <span style="color: var(--success-green); font-size: 0.9em; margin-left: 10px;">FF UID: ${ffUid}</span>
                        </li>`;
                    } else {
                         userDetailsHtml += `<li style="padding: 5px; border-bottom: 1px dotted var(--neon-purple); text-align: left;">
                            <strong>Slot ${i}:</strong> FREE
                        </li>`;
                    }
                }
                userDetailsHtml += '</ul>';

                alert(`Admin Match Details:\n\nMatch: ${match.name}\nRoom ID: ${match.roomId}\nRoom Pass: ${match.roomPass}\n\nSLOTS:\n${userDetailsHtml.replace(/<[^>]*>?/gm, '\n').replace(/&nbsp;/g, ' ').trim()}`);
            });
        });
    },

    deleteMatch: async (mode, matchId, isManual = false) => {
        playClickSound(); 
        if (!isAdmin && isManual) return; 

        if (isManual && !confirm('Are you sure you want to delete this match?')) return;
        
        try {
            // Clear interval if it exists
            if (matchIntervals[matchId]) {
                 clearInterval(matchIntervals[matchId]);
                 delete matchIntervals[matchId];
            }
            await db.ref(`matches/${mode}/${matchId}`).remove();
            console.log(`Match ${matchId} deleted.`);
            app.renderAdminResultSelect(); // Refresh admin list/dropdown
        } catch (error) {
            console.error("Deletion error:", error);
        }
    },

    clearSlots: async (mode, matchId) => {
           playClickSound(); 
           if (!isAdmin || !confirm('Are you sure you want to clear ALL slots for this match?')) return;
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
        document.getElementById('matchListTitle').textContent = `Matches for ${mode.toUpperCase()}`;
        app.showPage('matchListPage');
        app.listenForMatches(mode);
    },
    
    // Timer Update & Auto-Delete Logic
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
        const userInMatch = currentMatchData && Object.values(currentMatchData.slots || {}).some(s => s.uid === currentUser.uid);

        if (timeDiffSeconds > 0) {
            // Upcoming Match
            const days = Math.floor(timeDiffSeconds / 86400);
            const hours = Math.floor((timeDiffSeconds % 86400) / 3600);
            const minutes = Math.floor((timeDiffSeconds % 3600) / 60);
            const seconds = timeDiffSeconds % 60;
            
            const timeString = `${days > 0 ? days + 'd ' : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            timerSpan.textContent = timeString;
            if (isCurrentlyViewing && slotTimerElement) slotTimerElement.textContent = timeString;

            statusSpan.textContent = 'Upcoming';
            statusSpan.className = 'status upcoming';
            
            if (isCurrentlyViewing) {
                 app.revealRoomInfo('********', '********');
            }

            // 1 Minute Warning (60 seconds)
            if (isCurrentlyViewing) {
                if (timeDiffSeconds === 60) {
                    playWarningSound(); 
                    matchDetailsElement.classList.add('warning-animation'); 
                } else if (timeDiffSeconds > 60) {
                    matchDetailsElement.classList.remove('warning-animation');
                    matchDetailsElement.classList.remove('critical-warning'); 
                    matchContainer.classList.remove('screen-shake');
                }

                if (timeDiffSeconds === 1) {
                    playCriticalSound(); 
                    matchDetailsElement.classList.add('critical-warning'); 
                    matchContainer.classList.add('screen-shake'); 
                }
            }


        } else if (timeToDeleteSeconds > 0) {
            // Live Match
            const liveTime = 30 + timeDiffSeconds; 
            
            let timeText;
            if (liveTime > 0) {
                timeText = `LIVE - ${liveTime}s to Clear`;
            } else {
                timeText = `ENDED - Deleting in ${timeToDeleteSeconds}s`;
            }
            
            timerSpan.textContent = timeText;
            if (isCurrentlyViewing && slotTimerElement) slotTimerElement.textContent = timeText;

            statusSpan.textContent = 'LIVE';
            statusSpan.className = 'status live';
            
            // Room Reveal - Only if user is in match
            if(isCurrentlyViewing) {
                if (userInMatch) {
                   app.revealRoomInfo(matchData.roomId, matchData.roomPass);
                } else {
                   app.revealRoomInfo('********', '********');
                }

                 if (timeDiffSeconds === 0) {
                     const msg = document.createElement('div');
                     msg.className = 'match-starting-message';
                     msg.textContent = 'MATCH STARTING NOW!';
                     document.body.appendChild(msg);
                     setTimeout(() => msg.remove(), 2000);
                 }
                 matchDetailsElement.classList.remove('warning-animation', 'critical-warning');
                 matchContainer.classList.remove('screen-shake');
            }

            if (liveTime === 0 && timeDiffSeconds === -30) {
                db.ref(`matches/${mode}/${matchId}/slots`).set({});
                console.log(`Match ${matchId} slots auto-cleared.`);
            }


        } else {
            // Match Ended - AUTO-DELETE
            app.deleteMatch(mode, matchId); 
            
            timerSpan.textContent = 'DELETED';
            statusSpan.textContent = 'DELETED';
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
        document.getElementById('roomIdDisplay').textContent = roomId;
        document.getElementById('roomPassDisplay').textContent = roomPass;
    },

    joinMatch: (matchId, mode) => {
        playClickSound();
        currentMatchId = matchId;
        currentMode = mode;
        
        db.ref(`users/${currentUser.uid}/ffUid`).once('value', (snapshot) => {
            currentUser.ffUid = snapshot.val(); 
            app.showPage('slotPage');
            app.listenForSlots(mode, matchId); 
        });
    },

    listenForSlots: (mode, matchId) => {
        const matchRef = db.ref(`matches/${mode}/${matchId}`);
        matchRef.on('value', (snapshot) => {
            currentMatchData = snapshot.val(); 
            if (!currentMatchData) {
                alert('This match has been deleted by the admin.');
                app.backToMatchList(); 
                return;
            }

            document.getElementById('slotPageMatchTitle').textContent = currentMatchData.name;
            document.getElementById('matchNameDisplay').textContent = currentMatchData.name;
            document.getElementById('matchModeDisplay').textContent = currentMatchData.mode.toUpperCase();
            
            const slots = currentMatchData.slots || {};
            const maxSlots = currentMatchData.maxSlots;
            const slotsContainer = document.getElementById('slotsContainer');
            slotsContainer.innerHTML = '';
            
            document.getElementById('maxSlots').textContent = maxSlots;
            document.getElementById('slotsCount').textContent = Object.keys(slots).length;
            
            app.updateMatchTimer(matchId, currentMatchData, mode); 
            
            const userInMatch = Object.values(slots).some(s => s.uid === currentUser.uid);
            const isMatchStarted = (currentMatchData.startTime - Date.now() <= 0);

            const ffUidInputSection = document.getElementById('ffUidInputSection');
            const ffUidInput = document.getElementById('ffUidInput');
            ffUidInput.value = currentUser.ffUid || ''; 
            
            if (!userInMatch && !isMatchStarted) {
                ffUidInputSection.classList.remove('hidden');
            } else {
                ffUidInputSection.classList.add('hidden');
            }
            
            if (userInMatch && isMatchStarted) {
                app.revealRoomInfo(currentMatchData.roomId, currentMatchData.roomPass);
            } else {
                app.revealRoomInfo('********', '********');
            }


            // Render Slots
            for (let i = 1; i <= maxSlots; i++) {
                const slotKey = `slot${i}`;
                const slotData = slots[slotKey];
                
                const div = document.createElement('div');
                div.className = 'slot-item';

                let button;
                if (slotData) {
                    div.classList.add('occupied');
                    div.innerHTML = `<span class="slot-name">Slot ${i}: ${slotData.ffUid} (${slotData.email.split('@')[0]})</span>`;
                    
                    if (slotData.uid === currentUser.uid) {
                        button = document.createElement('button');
                        button.textContent = 'Leave Slot';
                        button.onclick = () => app.leaveSlot(mode, matchId, slotKey);
                        button.style.backgroundColor = 'var(--warning-red)';
                    } else {
                        button = document.createElement('button');
                        button.textContent = 'Occupied';
                        button.disabled = true;
                    }
                } else {
                    div.innerHTML = `<span class="slot-name">Slot ${i}: FREE</span>`;
                    
                    button = document.createElement('button');
                    const currentUidInInput = ffUidInput.value;

                    if (isMatchStarted) {
                        button.textContent = 'Match Started';
                        button.disabled = true;
                        button.style.backgroundColor = 'var(--warning-red)';
                    } else if (userInMatch) {
                         button.textContent = 'Already Joined';
                         button.disabled = true;
                    } else if (!currentUidInInput) {
                         button.textContent = 'Fill UID Above';
                         button.disabled = true;
                    } else {
                         button.textContent = `Join Slot`;
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
        const confirmJoin = confirm(`Are you sure you want to join ${slotKey} with FF UID ${uidToUse}?`);
        
        if (confirmJoin) {
            app.joinSlot(mode, matchId, slotKey, uidToUse);
        } else {
            displayMessage(document.getElementById('slotPageMessage'), 'Slot joining cancelled.', 'error');
        }
    },

    joinSlot: async (mode, matchId, slotKey, uidToUse) => {
        playClickSound();
        const messageDiv = document.getElementById('slotPageMessage');
        messageDiv.classList.add('hidden');
        
        const slotRef = db.ref(`matches/${mode}/${matchId}/slots/${slotKey}`);
        
        try {
            const result = await slotRef.transaction(currentData => {
                if (currentData === null) {
                    if (currentMatchData && Object.values(currentMatchData.slots || {}).some(s => s.uid === currentUser.uid)) {
                        return undefined; 
                    }
                    
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
                displayMessage(messageDiv, `Successfully joined ${slotKey}!`, 'success');
            } else if (result.snapshot.val() !== null) {
                displayMessage(messageDiv, 'This slot was just taken. Please try another one.', 'error');
            } else {
                 displayMessage(messageDiv, 'You have already joined a slot in this match.', 'error');
            }
        } catch (error) {
            displayMessage(messageDiv, `Error joining slot: ${error.message}`, 'error');
            console.error(error);
        }
    },

    leaveSlot: async (mode, matchId, slotKey) => {
        playClickSound();
        const messageDiv = document.getElementById('slotPageMessage');
        messageDiv.classList.add('hidden');
        
        try {
            await db.ref(`matches/${mode}/${matchId}/slots/${slotKey}`).remove();
            displayMessage(messageDiv, 'Successfully left the slot.', 'success');
        } catch (error) {
            displayMessage(messageDiv, `Error leaving slot: ${error.message}`, 'error');
        }
    },

    showLeaderboard: () => {
        playClickSound();
        app.showPage('leaderboardPage');
    },

    displayMessage: displayMessage,

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
            
            if (matches.length === 0) {
                matchesContainer.innerHTML = '<h4>No matches scheduled for this mode.</h4>';
            }

            matches.sort((a, b) => a.startTime - b.startTime);

            matches.forEach(match => {
                app.renderMatchCard(match, matchesContainer);
            });
        });
    },

    renderMatchCard: (match, container) => {
        const div = document.createElement('div');
        div.className = 'match-item';
        div.innerHTML = `
            <h4>${match.name}</h4>
            <div class="match-details">
                <span><strong>Mode:</strong> ${match.mode.toUpperCase()}</span>
                <span><strong>Start:</strong> ${new Date(match.startTime).toLocaleString()}</span>
                <span><strong>Slots:</strong> ${Object.keys(match.slots || {}).length}/${match.maxSlots}</span>
                <span><strong>Status:</strong> <span data-match-status-id="${match.id}" class="status">Upcoming</span></span>
                <span><strong>Timer:</strong> <span data-match-timer-id="${match.id}">--:--:--</span></span>
            </div>
            <button onclick="app.joinMatch('${match.id}', '${match.mode}');" style="margin-top: 10px;">View & Join</button>
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

document.addEventListener('DOMContentLoaded', () => {
    // Start Firebase Initialization and Auth Listening
    app.init(); 
    
    // Attach sound to buttons globally (after app.init loads everything)
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
