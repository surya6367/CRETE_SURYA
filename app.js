// www/app.js

// Admin Email (Hardcoded requirement)
const ADMIN_EMAIL = 'sf636785@gmail.com';

// Global State
let isAdmin = false;
let currentMode = '';
let currentMatchId = '';
let matchIntervals = {};
let currentUser = null;
let currentMatchData = null; 

// 1. SOUND FIX: Try .wav files first for better reliability, then fallback to .mp3.
// NOTE: Ensure your files are named click.wav, warning.wav, beep.wav (or .mp3) in the 'www/sounds' folder.
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
        // Attempting to play, catching the error if the browser blocks autoplay
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
        case 'BR48': return 48;
        default: return 0;
    }
}

// Helper for UI messages
function displayMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
    setTimeout(() => { element.classList.add('hidden'); }, 5000);
}

// --- Page Navigation and Click Sound ---
const app = {
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
            displayMessage(messageDiv, 'Please fill all match details.', 'error');
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
            displayMessage(messageDiv, 'New match created successfully!', 'success');
            document.getElementById('adminRoomId').value = '';
            document.getElementById('adminRoomPass').value = '';
            document.getElementById('adminMatchStartTime').value = '';
        } catch (error) {
            displayMessage(messageDiv, `Error creating match: ${error.message}`, 'error');
        }
    },
    
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

    // Delete function modified to handle both admin manual delete (with confirm) and auto-delete (without confirm)
    deleteMatch: async (mode, matchId, isManual = false) => {
        playClickSound(); 
        if (!isAdmin && isManual) return; // Non-admin cannot manually delete

        if (isManual && !confirm('Are you sure you want to delete this match?')) return;
        
        try {
            if (matchIntervals[matchId]) {
                 clearInterval(matchIntervals[matchId]);
                 delete matchIntervals[matchId];
            }
            await db.ref(`matches/${mode}/${matchId}`).remove();
            console.log(`Match ${matchId} deleted.`);
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
        // Auto-Delete is 40 seconds after start time
        const deleteTime = startTime + 40000; 
        
        const timeDiffSeconds = Math.floor((startTime - now) / 1000);
        const timeToDeleteSeconds = Math.floor((deleteTime - now) / 1000); 

        
        const timerSpan = document.querySelector(`[data-match-timer-id="${matchId}"]`);
        const statusSpan = document.querySelector(`[data-match-status-id="${matchId}"]`);
        
        if (!timerSpan || !statusSpan) return;

        const isCurrentlyViewing = (matchId === currentMatchId && document.getElementById('slotPage').classList.contains('active'));
        const matchContainer = document.getElementById('mainContainer');
        const matchDetailsElement = document.getElementById('currentMatchDetails');
        const slotTimerElement = document.getElementById('slotPageTimer'); // New element for slot page timer

        if (timeDiffSeconds > 0) {
            // Upcoming Match
            const days = Math.floor(timeDiffSeconds / 86400);
            const hours = Math.floor((timeDiffSeconds % 86400) / 3600);
            const minutes = Math.floor((timeDiffSeconds % 3600) / 60);
            const seconds = timeDiffSeconds % 60;
            
            const timeString = `${days > 0 ? days + 'd ' : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            timerSpan.textContent = timeString;
            // 2. FIX: Update slot page timer display
            if (isCurrentlyViewing && slotTimerElement) slotTimerElement.textContent = timeString;

            statusSpan.textContent = 'Upcoming';
            statusSpan.className = 'status upcoming';

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

                // 1 Second Warning (Critical Sound and Screen Shake)
                if (timeDiffSeconds === 1) {
                    playCriticalSound(); 
                    matchDetailsElement.classList.add('critical-warning'); 
                    matchContainer.classList.add('screen-shake'); 
                }
            }


        } else if (timeToDeleteSeconds > 0) {
            // Live Match (Ends after 30 seconds, deletes after 40 seconds)
            const liveTime = 30 + timeDiffSeconds; 
            
            let timeText;
            if (liveTime > 0) {
                // First 30 seconds: LIVE, countdown to slot clear
                timeText = `LIVE - ${liveTime}s to Clear`;
            } else {
                 // Next 10 seconds: ENDED, countdown to match deletion
                timeText = `ENDED - Deleting in ${timeToDeleteSeconds}s`;
            }
            
            timerSpan.textContent = timeText;
             // 2. FIX: Update slot page timer display
            if (isCurrentlyViewing && slotTimerElement) slotTimerElement.textContent = timeText;

            statusSpan.textContent = 'LIVE';
            statusSpan.className = 'status live';
            
            // Room Reveal
            if(isCurrentlyViewing) {
                 app.revealRoomInfo(matchData.roomId, matchData.roomPass);

                 if (timeDiffSeconds === 0) {
                     const msg = document.createElement('div');
                     msg.className = 'match-starting-message';
                     msg.textContent = 'MATCH STARTING NOW!';
                     document.body.appendChild(msg);
                     setTimeout(() => msg.remove(), 2000);
                 }
                 // Remove all warnings once match starts
                 matchDetailsElement.classList.remove('warning-animation', 'critical-warning');
                 matchContainer.classList.remove('screen-shake');
            }

            if (liveTime === 0) {
                // Slot Clear Logic (executed at t = +30s)
                db.ref(`matches/${mode}/${matchId}/slots`).set({});
                console.log(`Match ${matchId} slots auto-cleared.`);
            }


        } else {
            // Match Ended (and timeToDeleteSeconds <= 0) - AUTO-DELETE
            app.deleteMatch(mode, matchId); // Auto-delete without prompt
            
            timerSpan.textContent = 'DELETED';
            statusSpan.textContent = 'DELETED';
            statusSpan.className = 'status ended';
            
            if(matchIntervals[matchId]) {
                clearInterval(matchIntervals[matchId]);
                delete matchIntervals[matchId];
            }
        }
    },
    
    // Slot Flow Fix: Correctly return to Match List
    backToMatchList: () => {
        playClickSound();
        if (currentMatchId && currentMode) {
             db.ref(`matches/${currentMode}/${currentMatchId}`).off(); // Stop listening to the match
        }
        app.showPage('matchListPage'); 
        
        // Reset warnings and room info
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
            currentUser.ffUid = snapshot.val(); // Load saved UID
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

            const slots = currentMatchData.slots || {};
            const maxSlots = currentMatchData.maxSlots;
            const slotsContainer = document.getElementById('slotsContainer');
            slotsContainer.innerHTML = '';

            document.getElementById('slotPageMatchTitle').textContent = currentMatchData.name;
            document.getElementById('currentMatchName').textContent = currentMatchData.name;
            document.getElementById('currentMatchStartTime').textContent = new Date(currentMatchData.startTime).toLocaleString();
            document.getElementById('maxSlots').textContent = maxSlots;
            document.getElementById('slotsCount').textContent = Object.keys(slots).length;
            
            // Update match timer display
            app.updateMatchTimer(matchId, currentMatchData, mode); 
            
            const userInMatch = Object.values(slots).some(s => s.uid === currentUser.uid);
            const timeDiffSeconds = Math.floor((currentMatchData.startTime - Date.now()) / 1000);
            const isMatchStarted = (timeDiffSeconds <= 0);

            const ffUidInputSection = document.getElementById('ffUidInputSection');
            const ffUidInput = document.getElementById('ffUidInput');
            ffUidInput.value = currentUser.ffUid || ''; // Pre-fill saved UID if exists
            
            // 3. FF UID Flexibility: Show input if not in match AND not started
            if (!userInMatch && !isMatchStarted) {
                ffUidInputSection.classList.remove('hidden');
            } else {
                ffUidInputSection.classList.add('hidden');
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
                         // User has to fill UID above to enable join buttons
                         button.textContent = 'Fill UID Above';
                         button.disabled = true;
                    } else {
                         // Join using the currently filled UID (saved or temporary)
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
    
    // Join Slot with Confirmation (Uses the UID passed from the button)
    promptAndJoinSlot: (mode, matchId, slotKey, uidToUse) => {
        playClickSound();
        const confirmJoin = confirm(`Are you sure you want to join ${slotKey} with FF UID ${uidToUse}?`);
        
        if (confirmJoin) {
            app.joinSlot(mode, matchId, slotKey, uidToUse);
        } else {
            displayMessage(document.getElementById('slotPageMessage'), 'Slot joining cancelled.', 'error');
        }
    },

    // Join Slot (Uses the UID passed)
    joinSlot: async (mode, matchId, slotKey, uidToUse) => {
        playClickSound();
        const messageDiv = document.getElementById('slotPageMessage');
        messageDiv.classList.add('hidden');
        
        const slotRef = db.ref(`matches/${mode}/${matchId}/slots/${slotKey}`);
        
        try {
            const result = await slotRef.transaction(currentData => {
                if (currentData === null) {
                    if (currentMatchData && Object.values(currentMatchData.slots || {}).some(s => s.uid === currentUser.uid)) {
                        return undefined; // Already joined another slot
                    }
                    
                    // Automatically save the new UID if it's different and valid
                    if (uidToUse && uidToUse !== currentUser.ffUid) {
                        db.ref(`users/${currentUser.uid}/ffUid`).set(uidToUse);
                        currentUser.ffUid = uidToUse; // Update global state
                        document.getElementById('ffUidInput').value = uidToUse; // Keep the input updated
                    }
                    
                    return { 
                        uid: currentUser.uid, 
                        email: currentUser.email, 
                        ffUid: uidToUse // Use the dynamic UID
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
        // Timer interval set globally for continuous updates
        matchIntervals[match.id] = setInterval(() => {
            app.updateMatchTimer(match.id, match, match.mode);
        }, 1000);
        
        app.updateMatchTimer(match.id, match, match.mode);
    }
};

// --- Firebase Auth State Listener ---
auth.onAuthStateChanged(user => {
    const loadingPage = document.getElementById('loadingPage');
    const mainContainer = document.getElementById('mainContainer');
    loadingPage.classList.add('hidden'); 
    mainContainer.classList.remove('hidden'); 

    if (user) {
        currentUser = user;
        isAdmin = (user.email === ADMIN_EMAIL);
        document.getElementById('welcomeUser').textContent = `Welcome, ${user.email.split('@')[0]}!`;
        
        // Load saved FF UID on login
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

window.app = app;
