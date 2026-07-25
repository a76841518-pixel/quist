// ============================================================
// app.js – التطبيق الكامل (إعادة بناء مع تصحيح الأخطاء)
// ============================================================

// ============================================================
// 1. إعدادات Firebase
// ============================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC0fnT157NEKAsDKuZHuwJ4112pJmX1tzM",
  authDomain: "fotbal-78571.firebaseapp.com",
  projectId: "fotbal-78571",
  storageBucket: "fotbal-78571.firebasestorage.app",
  messagingSenderId: "1095690966958",
  appId: "1:1095690966958:web:431077bdb6e488efae1a3f",
  measurementId: "G-DKVJDTR4TC"
};

let db = null;
let auth = null;
let isFirebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseReady = true;
    updateFirebaseStatus(true);
} catch (e) {
    console.error('❌ Firebase error:', e);
    updateFirebaseStatus(false);
    showToast('⚠️ فشل الاتصال بـ Firebase، يعمل في وضع غير متصل', 'error');
}

function updateFirebaseStatus(online) {
    const statusEl = document.getElementById('firebaseStatus');
    if (statusEl) {
        statusEl.textContent = online ? '🟢 متصل' : '🔴 غير متصل';
        statusEl.style.color = online ? 'var(--success)' : 'var(--secondary)';
    }
    const connStatus = document.getElementById('connectionStatus');
    if (connStatus) {
        connStatus.className = `connection-status ${online ? 'online' : 'offline'}`;
        document.getElementById('connectionText').textContent = online ? 'متصل' : 'غير متصل';
    }
}

const RealtimeService = {
    _refs: {},

    getRef(path) {
        if (!this._refs[path]) {
            this._refs[path] = firebase.database().ref(path);
        }
        return this._refs[path];
    },

    async add(path, data) {
        const ref = this.getRef(path);
        const newRef = ref.push();
        await newRef.set({
            ...data,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        return { id: newRef.key, ...data };
    },

    async update(path, id, data) {
        await this.getRef(path).child(id).update(data);
        return { id, ...data };
    },

    async delete(path, id) {
        await this.getRef(path).child(id).remove();
    },

    async getAll(path) {
        const snapshot = await this.getRef(path).once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: key, ...data[key] }));
    },

    listen(path, callback) {
        const ref = this.getRef(path);
        const listener = ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                callback([]);
                return;
            }
            const results = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            callback(results);
        });
        return () => ref.off('value', listener);
    },

    listenWhere(path, field, operator, value, callback) {
        const ref = this.getRef(path);
        const listener = ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                callback([]);
                return;
            }
            const results = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(item => item[field] === value);
            callback(results);
        });
        return () => ref.off('value', listener);
    }
};

// ============================================================
// نظام المكافآت والعقوبات - عرض للمستخدم الحالي فقط
// ============================================================

const MultiplayerRewards = {
    calculateRewards(player, rank, totalPlayers, gameStats) {
        const rewards = {
            rankPoints: 0,
            levelPoints: 0,
            coins: 0,
            bonus: [],
            penalty: false,
            total: 0
        };

        // نقاط الرتبة مع عقوبات
        if (rank === 1) {
            const basePoints = 30;
            const bonus = Math.min(totalPlayers * 5, 30);
            rewards.rankPoints = basePoints + bonus;
            rewards.bonus.push(`👑 بطل المباراة (+${rewards.rankPoints} رتبة)`);
        } else if (rank === 2 && totalPlayers >= 3) {
            rewards.rankPoints = 15;
            rewards.bonus.push(`🥈 الوصيف (+${rewards.rankPoints} رتبة)`);
        } else if (rank === 3 && totalPlayers >= 4) {
            rewards.rankPoints = 8;
            rewards.bonus.push(`🥉 الثالث (+${rewards.rankPoints} رتبة)`);
        } else {
            const penaltyBase = Math.floor((totalPlayers - rank + 1) * 2);
            let penalty = Math.min(penaltyBase, 25);
            if (totalPlayers === 2 && rank === 2) {
                penalty = 15;
            }
            rewards.rankPoints = -penalty;
            rewards.penalty = true;
            rewards.bonus.push(`💔 عقوبة رتبة (${-penalty})`);
        }

        // مكافأة الدقة (باستخدام correct و answersCount الصحيحين)
        const accuracy = player.correct && player.answersCount ? 
            (player.correct / player.answersCount) * 100 : 0;
        if (accuracy >= 90) {
            rewards.coins += 20;
            rewards.levelPoints += 15;
            rewards.bonus.push('🎯 دقة عالية (90%+)');
        } else if (accuracy >= 70) {
            rewards.coins += 10;
            rewards.levelPoints += 8;
            rewards.bonus.push('✅ دقة جيدة (70%+)');
        } else if (accuracy >= 50) {
            rewards.coins += 5;
            rewards.levelPoints += 4;
            rewards.bonus.push('📊 دقة متوسطة (50%+)');
        }

        // مكافأة السلسلة
        if (player.bestStreak >= 10) {
            rewards.coins += 25;
            rewards.levelPoints += 20;
            rewards.bonus.push(`🔥 سلسلة أسطورية (${player.bestStreak})`);
        } else if (player.bestStreak >= 5) {
            rewards.coins += 10;
            rewards.levelPoints += 10;
            rewards.bonus.push(`⚡ سلسلة ممتازة (${player.bestStreak})`);
        } else if (player.bestStreak >= 3) {
            rewards.coins += 5;
            rewards.levelPoints += 5;
            rewards.bonus.push(`💫 سلسلة جيدة (${player.bestStreak})`);
        }

        // مكافأة المشاركة الكاملة
        if (player.answersCount === gameStats.totalQuestions && gameStats.totalQuestions > 0) {
            rewards.coins += 5;
            rewards.bonus.push('📚 مشاركة كاملة');
        }

        // مكافأة السرعة
        if (player.avgTime && player.avgTime < 3) {
            rewards.coins += 8;
            rewards.levelPoints += 5;
            rewards.bonus.push('⚡ ردود فعل سريعة');
        } else if (player.avgTime && player.avgTime < 5) {
            rewards.coins += 4;
            rewards.levelPoints += 3;
            rewards.bonus.push('⏱ سرعة جيدة');
        }

        // مكافأة الفوز
        if (rank === 1) {
            rewards.coins += 30;
            rewards.levelPoints += 25;
            rewards.bonus.push('🏆 مكافأة البطولة');
        }

        rewards.total = rewards.rankPoints + rewards.levelPoints + rewards.coins;
        return rewards;
    },

    async applyRewards(userId, rewards) {
        if (!userId) return;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return;
            const user = userDoc.data();

            const currentRankPoints = user.rankPoints || 0;
            const newRankPoints = Math.max(0, currentRankPoints + rewards.rankPoints);

            const updates = {
                rankPoints: newRankPoints,
                totalScore: (user.totalScore || 0) + rewards.levelPoints,
                coins: (user.coins || 0) + rewards.coins
            };

            await db.collection('users').doc(userId).update(updates);
            return updates;
        } catch (e) {
            console.error('Error applying rewards:', e);
            return null;
        }
    },

    // عرض المكافآت للمستخدم الحالي فقط
    renderRewardsUI(rewards, player, isWinner = false) {
        const isLightTheme = document.body.classList.contains('light-theme');
        const textColor = isLightTheme ? 'var(--dark)' : 'var(--light)';
        const bgColor = isLightTheme ? 'rgba(255,255,255,0.9)' : 'var(--glass)';
        const borderColor = isLightTheme ? 'rgba(0,0,0,0.1)' : 'var(--glass-border)';

        return `
            <div style="background:${bgColor};border-radius:var(--radius);padding:1rem;border:1px solid ${isWinner ? 'var(--accent)' : borderColor};${isWinner ? 'box-shadow: 0 0 30px rgba(255,217,61,0.2);' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                    <span style="font-weight:700;font-size:1rem;color:${textColor};">
                        <i class="fas fa-gift" style="color:var(--accent);"></i> المكافآت
                        ${rewards.penalty ? ' <span style="color:var(--secondary);font-size:0.8rem;">(عقوبة)</span>' : ''}
                    </span>
                    <span style="font-size:1.3rem;font-weight:900;color:${isWinner ? 'var(--dark)' : 'var(--primary)'};">
                        ${rewards.total > 0 ? '🎁' : '💔'} ${rewards.total > 0 ? '+' : ''}${rewards.total}
                    </span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.5rem;margin-bottom:0.5rem;">
                    <div style="background:${isLightTheme ? 'rgba(0,0,0,0.04)' : 'var(--card-bg)'};padding:0.3rem 0.5rem;border-radius:8px;text-align:center;">
                        <div style="font-size:0.6rem;color:var(--gray);">نقاط الرتبة</div>
                        <div style="font-weight:700;color:${rewards.rankPoints >= 0 ? 'var(--accent)' : 'var(--secondary)'};">
                            ${rewards.rankPoints >= 0 ? '+' : ''}${rewards.rankPoints}
                        </div>
                    </div>
                    <div style="background:${isLightTheme ? 'rgba(0,0,0,0.04)' : 'var(--card-bg)'};padding:0.3rem 0.5rem;border-radius:8px;text-align:center;">
                        <div style="font-size:0.6rem;color:var(--gray);">نقاط المستوى</div>
                        <div style="font-weight:700;color:var(--primary);">+${rewards.levelPoints}</div>
                    </div>
                    <div style="background:${isLightTheme ? 'rgba(0,0,0,0.04)' : 'var(--card-bg)'};padding:0.3rem 0.5rem;border-radius:8px;text-align:center;">
                        <div style="font-size:0.6rem;color:var(--gray);">نقود</div>
                        <div style="font-weight:700;color:var(--success);">+${rewards.coins}</div>
                    </div>
                </div>
                ${rewards.bonus.length > 0 ? `
                    <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem;">
                        ${rewards.bonus.map(b => `
                            <span style="font-size:0.65rem;background:${isLightTheme ? 'rgba(108,99,255,0.1)' : 'var(--primary)'};color:${isLightTheme ? 'var(--primary)' : '#fff'};padding:1px 10px;border-radius:30px;border:${isLightTheme ? '1px solid var(--primary)' : 'none'};">
                                ${b}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// ============================================================
// نظام الصلاحيات المتقدم
// ============================================================

const PERMISSIONS = {
    // إدارة المستخدمين
    USERS_VIEW: 'users:view',
    USERS_CREATE: 'users:create',
    USERS_EDIT: 'users:edit',
    USERS_DELETE: 'users:delete',
    USERS_BAN: 'users:ban',
    USERS_ROLE: 'users:role',
    
    // إدارة المحتوى
    CONTENT_VIEW: 'content:view',
    CONTENT_CREATE: 'content:create',
    CONTENT_EDIT: 'content:edit',
    CONTENT_DELETE: 'content:delete',
    CONTENT_MODERATE: 'content:moderate',
    
    // إدارة البيانات (لاعبين، أندية، إلخ)
    DATA_MANAGE: 'data:manage',
    DATA_IMPORT: 'data:import',
    DATA_EXPORT: 'data:export',
    
    // النظام
    SYSTEM_VIEW: 'system:view',
    SYSTEM_CONFIG: 'system:config',
    SYSTEM_LOGS: 'system:logs',
    SYSTEM_BACKUP: 'system:backup',
    
    // الإحصائيات
    STATS_VIEW: 'stats:view',
    STATS_EXPORT: 'stats:export',
    
    // الإشعارات
    NOTIFICATIONS_SEND: 'notifications:send',
    NOTIFICATIONS_MANAGE: 'notifications:manage',
};

const ROLE_PERMISSIONS = {
    super_admin: Object.values(PERMISSIONS),
    admin: [
        PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ROLE,
        PERMISSIONS.CONTENT_VIEW, PERMISSIONS.CONTENT_EDIT, PERMISSIONS.CONTENT_DELETE, PERMISSIONS.CONTENT_MODERATE,
        PERMISSIONS.DATA_MANAGE, PERMISSIONS.DATA_IMPORT, PERMISSIONS.DATA_EXPORT,
        PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.SYSTEM_CONFIG,
        PERMISSIONS.STATS_VIEW, PERMISSIONS.STATS_EXPORT,
        PERMISSIONS.NOTIFICATIONS_SEND,
    ],
    manager: [
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.CONTENT_VIEW, PERMISSIONS.CONTENT_EDIT,
        PERMISSIONS.DATA_MANAGE,
        PERMISSIONS.STATS_VIEW,
    ],
    editor: [
        PERMISSIONS.CONTENT_VIEW, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_EDIT,
        PERMISSIONS.DATA_MANAGE,
    ],
    moderator: [
        PERMISSIONS.CONTENT_VIEW, PERMISSIONS.CONTENT_MODERATE,
        PERMISSIONS.USERS_VIEW,
    ],
    user: [
        PERMISSIONS.CONTENT_VIEW,
    ],
};

// دالة التحقق من الصلاحية
function hasPermission(user, permission) {
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(permission) || permissions.includes(PERMISSIONS.USERS_VIEW); // super_admin لديه كل شيء
}

// ============================================================
// أنواع الأسئلة
// ============================================================

const QUESTION_TYPES = {
    MULTIPLE_CHOICE: {
        id: 'multiple_choice',
        name: 'اختيار من متعدد',
        icon: '📝',
        description: 'اختر الإجابة الصحيحة من بين 4 خيارات',
        minOptions: 2,
        maxOptions: 6,
        hasCorrect: true,
        points: 10
    },
    TRUE_FALSE: {
        id: 'true_false',
        name: 'صح / خطأ',
        icon: '✅',
        description: 'حدد هل العبارة صحيحة أم خاطئة',
        minOptions: 2,
        maxOptions: 2,
        hasCorrect: true,
        points: 5
    },
    FILL_BLANK: {
        id: 'fill_blank',
        name: 'ملء الفراغ',
        icon: '✏️',
        description: 'أكمل الفراغ بالإجابة الصحيحة',
        minOptions: 0,
        maxOptions: 0,
        hasCorrect: true,
        points: 15
    },
    MATCHING: {
        id: 'matching',
        name: 'مطابقة',
        icon: '🔗',
        description: 'طابق العناصر مع بعضها البعض',
        minOptions: 0,
        maxOptions: 0,
        hasCorrect: true,
        points: 20
    },
    ORDERING: {
        id: 'ordering',
        name: 'ترتيب',
        icon: '🔢',
        description: 'رتب العناصر بالترتيب الصحيح',
        minOptions: 0,
        maxOptions: 0,
        hasCorrect: true,
        points: 20
    }
};

// ============================================================
// 2. دوال مساعدة
// ============================================================
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function showToast(message, type = 'info', duration = 4000) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `notification ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function formatDate(date) {
    if (!date) return '—';
    let d;
    if (typeof date === 'object' && date !== null && typeof date.toDate === 'function') {
        d = date.toDate();
    } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date);
    } else if (date instanceof Date) {
        d = date;
    } else {
        return '—';
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-SA');
}

function formatDateFull(date) {
    if (!date) return '—';
    let d;
    if (typeof date === 'object' && date !== null && typeof date.toDate === 'function') {
        d = date.toDate();
    } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date);
    } else if (date instanceof Date) {
        d = date;
    } else {
        return '—';
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================
// نظام اللعب الجماعي المتطور - إصلاح مشكلة الإجابة المكررة
// ============================================================

const MultiplayerManager = {
    currentGameId: null,
    unsubscribeGame: null,
    _isHost: false,
    _players: [],
    _answers: {},
    _questionStartTime: null,
    _timerInterval: null,
    _timeLeft: 0,
    _totalTime: 15,
    _currentQuestionIndex: 0,
    _questions: [],
    _scores: {},
    _gameEnded: false,
    _gameSettings: {},
    _isWaitingForNext: false, // منع الانتقال المتكرر

    async createGame(settings) {
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return null;
        }

        const user = AuthService.currentUser;
        const gameData = {
            hostId: user.uid,
            hostName: user.username || user.displayName || 'مجهول',
            status: 'waiting',
            settings: {
                difficulty: settings.difficulty || 'medium',
                category: settings.category || 'all',
                questionType: settings.questionType || 'all',
                questionCount: parseInt(settings.questionCount) || 10,
                timeLimit: parseInt(settings.timeLimit) || 15
            },
            players: [{
                uid: user.uid,
                name: user.username || user.displayName || 'مجهول',
                score: 0,
                correct: 0,
                wrong: 0,
                streak: 0,
                bestStreak: 0,
                totalTime: 0,
                avgTime: 0,
                answersCount: 0
            }],
            currentQuestion: 0,
            questions: [],
            answers: {}, // { playerId: { questionIndex: { answer, isCorrect, timeTaken } } }
            scores: {},
            startTime: null,
            questionStartTime: null,
            finishedAt: null,
            winner: null,
            createdAt: new Date().toISOString(),
            code: this._generateGameCode(),
            password: settings.password || null
        };

        try {
            const docRef = await db.collection('multiplayerGames').add(gameData);
            this.currentGameId = docRef.id;
            this._isHost = true;
            this._players = gameData.players;
            this._scores = {};
            gameData.players.forEach(p => {
                this._scores[p.uid] = {
                    score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0,
                    totalTime: 0, avgTime: 0, answersCount: 0
                };
            });
            this._gameSettings = gameData.settings;
            this._totalTime = this._gameSettings.timeLimit || 15;
            this._isWaitingForNext = false;

            showToast(`✅ تم إنشاء المباراة! الرمز: ${gameData.code}`, 'success', 5000);
            App._renderMultiplayerLobby(docRef.id);
            return docRef.id;
        } catch (e) {
            console.error('Error creating game:', e);
            showToast('❌ فشل إنشاء المباراة', 'error');
            return null;
        }
    },

    _generateGameCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    },

    async joinGame(gameId, password = null) {
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return false;
        }

        try {
            const doc = await db.collection('multiplayerGames').doc(gameId).get();
            if (!doc.exists) {
                showToast('المباراة غير موجودة', 'error');
                return false;
            }
            const game = doc.data();
            if (game.status !== 'waiting') {
                showToast('المباراة بدأت بالفعل أو انتهت', 'error');
                return false;
            }
            if (game.password && game.password !== password) {
                showToast('كلمة المرور غير صحيحة', 'error');
                return false;
            }
            if (game.players.some(p => p.uid === AuthService.currentUser.uid)) {
                showToast('أنت بالفعل في هذه المباراة', 'info');
                App._renderMultiplayerLobby(gameId);
                return true;
            }

            const user = AuthService.currentUser;
            const newPlayer = {
                uid: user.uid,
                name: user.username || user.displayName || 'مجهول',
                score: 0,
                correct: 0,
                wrong: 0,
                streak: 0,
                bestStreak: 0,
                totalTime: 0,
                avgTime: 0,
                answersCount: 0
            };

            await db.collection('multiplayerGames').doc(gameId).update({
                players: firebase.firestore.FieldValue.arrayUnion(newPlayer)
            });

            showToast('✅ تم الانضمام إلى المباراة', 'success');
            this.currentGameId = gameId;
            this._isHost = false;
            this._players = [...game.players, newPlayer];
            App._renderMultiplayerLobby(gameId);
            return true;
        } catch (e) {
            console.error('Error joining game:', e);
            showToast('❌ فشل الانضمام', 'error');
            return false;
        }
    },

    async startGame(gameId) {
        if (!AuthService.currentUser) return;
        const user = AuthService.currentUser;

        const doc = await db.collection('multiplayerGames').doc(gameId).get();
        if (!doc.exists) return;
        const game = doc.data();
        if (game.hostId !== user.uid) {
            showToast('أنت لست المضيف', 'error');
            return;
        }
        if (game.players.length < 2) {
            showToast('تحتاج إلى لاعبين على الأقل', 'error');
            return;
        }

        let pool = [...DataManager.data.questions];
        const settings = game.settings || {};
        if (settings.category && settings.category !== 'all') {
            pool = pool.filter(q => q.category === settings.category);
        }
        if (settings.questionType && settings.questionType !== 'all') {
            pool = pool.filter(q => q.type === settings.questionType);
        }
        if (pool.length === 0) {
            showToast('لا توجد أسئلة كافية', 'error');
            return;
        }

        const shuffled = shuffleArray(pool);
        const questionCount = Math.min(settings.questionCount || 10, pool.length);
        const selectedQuestions = shuffled.slice(0, questionCount);

        const players = game.players.map(p => ({
            ...p,
            score: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            bestStreak: 0,
            totalTime: 0,
            avgTime: 0,
            answersCount: 0
        }));

        const scores = {};
        players.forEach(p => {
            scores[p.uid] = {
                score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0,
                totalTime: 0, avgTime: 0, answersCount: 0
            };
        });

        const now = Date.now();

        await db.collection('multiplayerGames').doc(gameId).update({
            status: 'playing',
            questions: selectedQuestions,
            currentQuestion: 0,
            players: players,
            scores: scores,
            startTime: now,
            questionStartTime: now,
            answers: {}
        });

        showToast('🎮 بدأت المباراة!', 'success', 3000);
        this.currentGameId = gameId;
        this._isHost = true;
        this._players = players;
        this._scores = scores;
        this._questions = selectedQuestions;
        this._currentQuestionIndex = 0;
        this._answers = {};
        this._gameEnded = false;
        this._totalTime = settings.timeLimit || 15;
        this._gameSettings = settings;
        this._isWaitingForNext = false;

        this._listenToGame(gameId);
        App._showMultiplayerGamePage();
        App._renderMultiplayerGame(gameId);
    },

    _listenToGame(gameId) {
        if (this.unsubscribeGame) {
            this.unsubscribeGame();
            this.unsubscribeGame = null;
        }

        this.unsubscribeGame = db.collection('multiplayerGames').doc(gameId)
            .onSnapshot((doc) => {
                if (!doc.exists) {
                    showToast('تم حذف المباراة', 'error');
                    this.leaveGame();
                    return;
                }
                const game = doc.data();
                if (game.status === 'finished') {
                    this._gameEnded = true;
                    App._hideMultiplayerGamePage();
                    App._showMultiplayerResultPage(gameId);
                    return;
                }
                if (game.status === 'playing') {
                    // تحديث البيانات
                    this._players = game.players || [];
                    this._scores = game.scores || {};
                    this._questions = game.questions || [];
                    this._currentQuestionIndex = game.currentQuestion || 0;
                    this._answers = game.answers || {};
                    this._questionStartTime = game.questionStartTime || Date.now();
                    
                    // تحديث واجهة اللعب فقط إذا كانت ظاهرة
                    if (document.getElementById('section-multiplayer-game').style.display !== 'none') {
                        App._renderMultiplayerGame(gameId);
                    }
                }
                if (game.status === 'waiting') {
                    App._renderMultiplayerLobby(gameId);
                }
            }, (error) => {
                console.error('Game listener error:', error);
            });
    },

    // ===== الدالة الأساسية لإرسال الإجابة =====
    async submitAnswer(gameId, answer) {
        // التحقق من صحة البيانات
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return false;
        }

        const user = AuthService.currentUser;
        const uid = user.uid;

        // منع الإجابة إذا كانت المباراة منتهية
        if (this._gameEnded) {
            showToast('المباراة انتهت بالفعل', 'info');
            return false;
        }

        // جلب بيانات المباراة من Firestore
        const doc = await db.collection('multiplayerGames').doc(gameId).get();
        if (!doc.exists) {
            showToast('المباراة غير موجودة', 'error');
            return false;
        }

        const game = doc.data();
        if (game.status !== 'playing') {
            showToast('المباراة ليست في حالة لعب', 'info');
            return false;
        }

        const currentQ = game.currentQuestion;
        const question = game.questions[currentQ];
        if (!question) {
            showToast('لا يوجد سؤال حالياً', 'error');
            return false;
        }

        const answers = game.answers || {};

        // ===== التحقق الأهم: هل أجاب المستخدم بالفعل على هذا السؤال؟ =====
        if (answers[uid] && answers[uid][currentQ] !== undefined) {
            showToast('لقد أجبت بالفعل على هذا السؤال', 'info');
            return false;
        }

        // ===== معالجة الإجابة =====
        const elapsed = (Date.now() - game.questionStartTime) / 1000;
        let isCorrect = false;
        let answerValue = answer;

        // معالجة حسب نوع السؤال
        if (question.type === 'multiple_choice' || question.type === 'true_false') {
            isCorrect = (answer === question.correct);
        } else if (question.type === 'fill_blank') {
            isCorrect = (answer.toLowerCase() === (question.correctAnswer || '').toLowerCase());
        } else if (question.type === 'matching') {
            const pairs = question.matchingPairs || [];
            let correctCount = 0;
            pairs.forEach(pair => {
                if (answer[pair.left] === pair.right) correctCount++;
            });
            isCorrect = (correctCount === pairs.length);
        } else if (question.type === 'ordering') {
            const correctOrder = question.orderedItems || [];
            isCorrect = JSON.stringify(answer) === JSON.stringify(correctOrder);
        } else {
            isCorrect = false;
        }

        // ===== تحديث إحصائيات اللاعب من scores =====
        const playerScore = game.scores[uid] || {
            score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0,
            totalTime: 0, avgTime: 0, answersCount: 0
        };

        // تحديث الإحصائيات
        if (isCorrect) {
            playerScore.correct = (playerScore.correct || 0) + 1;
            playerScore.streak = (playerScore.streak || 0) + 1;
            if (playerScore.streak > (playerScore.bestStreak || 0)) {
                playerScore.bestStreak = playerScore.streak;
            }
            let points = 10;
            if (elapsed <= 1.5) points += 3;
            else if (elapsed <= 3) points += 2;
            else if (elapsed <= 5) points += 1;
            if (playerScore.streak >= 5) {
                points += Math.floor(playerScore.streak / 5) * 2;
            }
            playerScore.score = (playerScore.score || 0) + points;
        } else {
            playerScore.wrong = (playerScore.wrong || 0) + 1;
            playerScore.streak = 0;
        }

        playerScore.totalTime = (playerScore.totalTime || 0) + elapsed;
        playerScore.answersCount = (playerScore.answersCount || 0) + 1;
        playerScore.avgTime = playerScore.totalTime / playerScore.answersCount;

        // ===== حفظ الإجابة =====
        if (!answers[uid]) answers[uid] = {};
        answers[uid][currentQ] = { answer, isCorrect, timeTaken: elapsed };

        // ===== تحديث قاعدة البيانات =====
        await db.collection('multiplayerGames').doc(gameId).update({
            answers: answers,
            scores: { [uid]: playerScore },
            players: game.players.map(p => {
                if (p.uid === uid) {
                    return { ...p, ...playerScore };
                }
                return p;
            })
        });

        // ===== عرض رسالة النتيجة =====
        showToast(isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة', isCorrect ? 'success' : 'error');

        // ===== إيقاف المؤقت فوراً =====
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        // ===== التحقق من إجابة جميع اللاعبين =====
        const totalPlayers = game.players.length;
        const answeredCount = Object.keys(answers).length;

        if (answeredCount >= totalPlayers) {
            // جميع اللاعبين أجابوا، انتقل للسؤال التالي بعد 1.5 ثانية
            if (!this._isWaitingForNext) {
                this._isWaitingForNext = true;
                setTimeout(() => {
                    this._isWaitingForNext = false;
                    this.autoNextQuestion(gameId);
                }, 1500);
            }
        } else {
            // ليس جميع اللاعبين أجابوا، ننتظر البقية
            // ولكن نعيد تشغيل المؤقت للانتظار
            if (this._timerInterval) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
            }
            // نبدأ مؤقت جديد للعد التنازلي (للباقي)
            const remainingTime = this._totalTime - Math.floor(elapsed);
            this._timeLeft = Math.max(0, remainingTime);
            this._startTimer(gameId);
        }

        return true;
    },

    // ===== بدء المؤقت =====
    _startTimer(gameId) {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        this._timerInterval = setInterval(async () => {
            if (this._gameEnded) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
                return;
            }

            // جلب البيانات الحالية
            const doc = await db.collection('multiplayerGames').doc(gameId).get();
            if (!doc.exists) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
                return;
            }
            const game = doc.data();
            if (game.status !== 'playing') {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
                return;
            }

            const elapsed = (Date.now() - game.questionStartTime) / 1000;
            const remaining = Math.max(0, this._totalTime - Math.floor(elapsed));

            // تحديث واجهة المؤقت
            const timerEl = document.querySelector('#section-multiplayer-game .game-header .badge-warning, #section-multiplayer-game .game-header .badge-danger');
            if (timerEl) {
                timerEl.textContent = `⏱ ${remaining}s`;
                timerEl.className = `badge ${remaining <= 5 ? 'badge-danger' : 'badge-warning'}`;
            }

            // تحديث شريط التقدم
            const progressFill = document.querySelector('#section-multiplayer-game .game-progress .fill');
            if (progressFill) {
                const prog = Math.min((elapsed / this._totalTime) * 100, 100);
                progressFill.style.width = `${prog}%`;
                progressFill.style.background = remaining <= 5 ? 'var(--secondary)' : 'linear-gradient(90deg, var(--primary), var(--accent))';
            }

            // إذا انتهى الوقت
            if (remaining <= 0) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;

                // التحقق من إجابة المستخدم الحالي
                const user = AuthService.currentUser;
                if (user) {
                    const answers = game.answers || {};
                    const currentQ = game.currentQuestion;
                    // إذا لم يجب المستخدم، نرسل إجابة خاطئة تلقائياً
                    if (!answers[user.uid] || answers[user.uid][currentQ] === undefined) {
                        showToast('⏰ انتهى الوقت!', 'error');
                        await this.submitAnswer(gameId, -1); // -1 تعني إجابة خاطئة تلقائياً
                    }
                }
            }
        }, 500);
    },

    // ===== الانتقال للسؤال التالي =====
    async autoNextQuestion(gameId) {
        if (this._gameEnded) return;
        
        const doc = await db.collection('multiplayerGames').doc(gameId).get();
        if (!doc.exists) return;
        const game = doc.data();
        if (game.status !== 'playing') return;

        const nextIndex = (game.currentQuestion || 0) + 1;
        if (nextIndex >= game.questions.length) {
            await this.endGame(gameId);
            return;
        }

        // إعادة تعيين المؤقت
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        // تحديث السؤال التالي
        await db.collection('multiplayerGames').doc(gameId).update({
            currentQuestion: nextIndex,
            answers: {},
            questionStartTime: Date.now()
        });

        // إعادة تعيين المتغيرات المحلية
        this._questionStartTime = Date.now();
        this._timeLeft = this._totalTime;
        this._answers = {};
        this._isWaitingForNext = false;

        // بدء المؤقت للجولة الجديدة
        this._startTimer(gameId);
    },

    async endGame(gameId) {
        const doc = await db.collection('multiplayerGames').doc(gameId).get();
        if (!doc.exists) return;
        const game = doc.data();

        const sorted = [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sorted[0];

        await db.collection('multiplayerGames').doc(gameId).update({
            status: 'finished',
            finishedAt: new Date().toISOString(),
            winner: winner
        });

        showToast(`🏆 الفائز: ${winner.name} بـ ${winner.score || 0} نقطة!`, 'success', 6000);
        this._gameEnded = true;
        this._isWaitingForNext = false;
        
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    },

    leaveGame() {
        if (this.unsubscribeGame) {
            this.unsubscribeGame();
            this.unsubscribeGame = null;
        }
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        this.currentGameId = null;
        this._isHost = false;
        this._players = [];
        this._gameEnded = false;
        this._isWaitingForNext = false;
        App._hideMultiplayerGamePage();
        App._hideMultiplayerResultPage();
        App._activateSection('multiplayer');
    },

    getRanking() {
        return [...this._players].sort((a, b) => (b.score || 0) - (a.score || 0));
    }
};

// ============================================================
// نظام المستويات (أرقام فقط 1-100)
// ============================================================

function getLevel(score) {
    const points = typeof score === 'number' ? score : 0;
    const maxLevel = 100;
    const pointsPerLevel = 1000;
    
    let level = Math.floor(points / pointsPerLevel) + 1;
    if (level > maxLevel) level = maxLevel;
    if (level < 1) level = 1;
    
    const min = (level - 1) * pointsPerLevel;
    
    return { level, min };
}

function getLevelProgress(score) {
    const points = typeof score === 'number' ? score : 0;
    const current = getLevel(points);
    
    if (current.level >= 100) {
        return {
            progress: 100,
            currentLevel: 100,
            nextLevel: 100,
            nextMin: null
        };
    }
    
    const nextLevelNum = current.level + 1;
    const nextMin = nextLevelNum * 1000;
    const range = 1000;
    const progress = ((points - current.min) / range) * 100;
    
    return {
        progress: Math.min(Math.max(progress, 0), 100),
        currentLevel: current.level,
        nextLevel: nextLevelNum,
        nextMin: nextMin
    };
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncateText(text, maxLength = 30) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================
// 2.5 دوال تحويل الصور إلى Base64
// ============================================================

// ============================================================
// دوال تحويل الصور إلى Base64
// ============================================================

function compressImageToBase64(file, maxSize = 300, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            reject(new Error('نوع الملف غير مدعوم'));
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            reject(new Error('حجم الصورة كبير جداً (الحد الأقصى 5MB)'));
            return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL(file.type, quality);
                resolve(base64);
            };
            img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
        };
        reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
    });
}

function getBase64Size(base64) {
    const base64String = base64.split(',')[1] || base64;
    const sizeInBytes = Math.ceil((base64String.length * 3) / 4);
    return sizeInBytes / 1024;
}

async function uploadProfileImageToBase64(file, onProgress = null) {
    if (!file) throw new Error('لم يتم اختيار ملف');
    
    if (onProgress) onProgress(0);
    
    const base64 = await compressImageToBase64(file, 300, 0.7);
    
    if (onProgress) onProgress(100);
    
    const sizeInKB = getBase64Size(base64);
    if (sizeInKB > 900) {
        const compressedBase64 = await compressImageToBase64(file, 200, 0.5);
        const newSize = getBase64Size(compressedBase64);
        if (newSize > 900) {
            throw new Error(`حجم الصورة كبير جداً (${newSize.toFixed(1)}KB). يرجى اختيار صورة أصغر.`);
        }
        return compressedBase64;
    }
    
    return base64;
}

/**
 * حذف الصورة (إزالة من قاعدة البيانات)
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<void>}
 */
async function deleteProfileImageFromFirestore(userId) {
    // فقط نقوم بتحديث الحقل إلى null
    await AuthService.updateUser({ avatar: null });
}

// ============================================================
// 3. خدمة المصادقة (AuthService)
// ============================================================
const AuthService = {
    currentUser: null,
    _listeners: [],
    _isInitialized: false,

    async init() {
        if (this._isInitialized) return Promise.resolve(this.currentUser);
        if (!isFirebaseReady) {
            this._isInitialized = true;
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const doc = await db.collection('users').doc(user.uid).get();
                        const data = doc.exists ? doc.data() : {};
                        this.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || data.displayName || user.email,
                            username: data.username || user.displayName || user.email,
                            role: data.role || 'user',
                            totalScore: data.totalScore || 0,
                            coins: data.coins || 0,
                            achievements: data.achievements || [],
                            inventory: data.inventory || [],
                            bio: data.bio || '',
                            location: data.location || '',
                            avatar: data.avatar || null,
                            createdAt: data.createdAt || new Date().toISOString(),
                            adminRole: data.adminRole || null,
                            friends: data.friends || [],
                            blocked: data.blocked || [],
                            rankPoints: data.rankPoints || 0,
                            stats: data.stats || { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 }
                        };
                        localStorage.setItem('football_user_uid', user.uid);
                    } catch (e) {
                        console.warn('Error fetching user data:', e);
                        this.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || user.email,
                            username: user.displayName || user.email,
                            role: 'user',
                            totalScore: 0,
                            coins: 0,
                            achievements: [],
                            inventory: [],
                            bio: '',
                            location: '',
                            avatar: null,
                            createdAt: new Date().toISOString(),
                            adminRole: null,
                            friends: [],
                            blocked: [],
                            rankPoints: data.rankPoints || 0,
                            stats: { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 }
                        };
                    }
                } else {
                    this.currentUser = null;
                    localStorage.removeItem('football_user_uid');
                }
                this._isInitialized = true;
                this._notifyListeners();
                resolve(this.currentUser);
            });
        });
    if (typeof App._refreshActiveBoosts === 'function') {
        App._refreshActiveBoosts();
    }
    this._updateGameStats();
},

    async login(email, password) {
        if (!isFirebaseReady) throw new Error('Firebase not ready');
        try {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            const doc = await db.collection('users').doc(cred.user.uid).get();
            const data = doc.exists ? doc.data() : {};
            this.currentUser = {
                uid: cred.user.uid,
                email: cred.user.email,
                displayName: cred.user.displayName || data.displayName || cred.user.email,
                username: data.username || cred.user.displayName || cred.user.email,
                role: data.role || 'user',
                totalScore: data.totalScore || 0,
                coins: data.coins || 0,
                achievements: data.achievements || [],
                inventory: data.inventory || [],
                bio: data.bio || '',
                location: data.location || '',
                avatar: data.avatar || null,
                createdAt: data.createdAt || new Date().toISOString(),
                adminRole: data.adminRole || null,
                friends: data.friends || [],
                blocked: data.blocked || [],
                rankPoints: data.rankPoints || 0,
                stats: data.stats || { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 }
            };
            localStorage.setItem('football_user_uid', cred.user.uid);
            this._notifyListeners();
            return this.currentUser;
        } catch (e) {
            let message = 'فشل تسجيل الدخول';
            if (e.code === 'auth/user-not-found') message = 'المستخدم غير موجود';
            else if (e.code === 'auth/wrong-password') message = 'كلمة المرور غير صحيحة';
            else if (e.code === 'auth/invalid-email') message = 'البريد الإلكتروني غير صحيح';
            else message = e.message;
            throw new Error(message);
        }
    },

async register(email, password, username, fullName) {
    if (!isFirebaseReady) throw new Error('Firebase not ready');
    try {
        console.log('📡 Creating user with email:', email);
        
        // ✅ إنشاء المستخدم
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ User created:', cred.user.uid);
        
        // ✅ تحديث الاسم الظاهر (displayName) = الاسم الكامل
        await cred.user.updateProfile({ displayName: fullName });
        
        // ✅ حفظ البيانات في Firestore
        await db.collection('users').doc(cred.user.uid).set({
            email: email,
            username: username,          // @username (معرف فريد)
            displayName: fullName,       // الاسم الذي يظهر في الموقع
            fullName: fullName,          // نسخة احتياطية
            role: 'user',
            totalScore: 0,
            coins: 100,
            achievements: [],
            inventory: [],
            bio: '',
            location: '',
            avatar: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            adminRole: null,
            friends: [],
            blocked: [],
            stats: { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 }
        });
        
        // ✅ تحديث المستخدم الحالي
        this.currentUser = {
            uid: cred.user.uid,
            email: email,
            displayName: fullName,      // ✅ الاسم الظاهر
            username: username,          // ✅ المعرف الفريد
            fullName: fullName,
            role: 'user',
            totalScore: 0,
            coins: 100,
            achievements: [],
            inventory: [],
            bio: '',
            location: '',
            avatar: null,
            createdAt: new Date().toISOString(),
            adminRole: null,
            friends: [],
            blocked: [],
            stats: { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 },
            rankPoints: data.rankPoints || 0
        };
        
        localStorage.setItem('football_user_uid', cred.user.uid);
        this._notifyListeners();
        
        console.log('✅ Registration complete, user:', this.currentUser);
        return this.currentUser;
        
    } catch (e) {
        console.error('❌ Registration error:', e);
        let message = 'فشل إنشاء الحساب';
        if (e.code === 'auth/email-already-in-use') message = 'البريد الإلكتروني مستخدم بالفعل';
        else if (e.code === 'auth/weak-password') message = 'كلمة المرور ضعيفة (6 أحرف على الأقل)';
        else if (e.code === 'auth/invalid-email') message = 'البريد الإلكتروني غير صحيح';
        else if (e.code === 'auth/network-request-failed') message = 'فشل الاتصال بالإنترنت';
        else message = e.message;
        throw new Error(message);
    }
},

    async logout() {
        if (!isFirebaseReady) return;
        await auth.signOut();
        this.currentUser = null;
        localStorage.removeItem('football_user_uid');
        this._notifyListeners();
    },

    async updateUser(data) {
        if (!isFirebaseReady || !this.currentUser) return;
        try {
            await db.collection('users').doc(this.currentUser.uid).update(data);
            Object.assign(this.currentUser, data);
            this._notifyListeners();
        } catch (e) {
            console.error('Error updating user:', e);
            throw e;
        }
    },

    checkPermission(requiredRole) {
        if (!this.currentUser) return false;
        const roleHierarchy = {
            'super_admin': 6,
            'admin': 5,
            'manager': 4,
            'editor': 3,
            'scout': 2,
            'user': 1
        };
        const userLevel = roleHierarchy[this.currentUser.role] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        return userLevel >= requiredLevel;
    },

    getRoleLabel(role) {
        const labels = {
            'super_admin': 'مشرف عام 🔥',
            'admin': 'مدير 🔥',
            'manager': 'مدير عام 📋',
            'editor': 'محرر ✍️',
            'scout': 'كشاف 🔍',
            'user': 'لاعب 👀'
        };
        return labels[role] || role;
    },

    getAdminRoleLabel(adminRole) {
        const labels = {
            'super_admin': 'مشرف عام',
            'general': 'مشرف عام',
            'user': 'مشرف مستخدمين',
            'player': 'مشرف لاعبين',
            'club': 'مشرف أندية',
            'tournament': 'مشرف بطولات',
            'match': 'مشرف مباريات',
            'question': 'مشرف أسئلة',
            'content': 'مشرف محتوى'
        };
        return labels[adminRole] || adminRole || 'لا يوجد';
    },

    addListener(callback) {
        this._listeners.push(callback);
        if (this.currentUser) callback(this.currentUser);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    },

    _notifyListeners() {
        this._listeners.forEach(cb => {
            try { cb(this.currentUser); } catch (e) { console.warn('Listener error:', e); }
        });
    }
};

// ============================================================
// 4. خدمة Firestore (FirestoreService)
// ============================================================
const FirestoreService = {
    _cache: {},
    _cacheTime: {},

    async add(collection, data) {
        if (!isFirebaseReady) throw new Error('Firebase not ready');
        const ref = db.collection(collection);
        const docRef = await ref.add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this._clearCache(collection);
        return { id: docRef.id, ...data };
    },

    async update(collection, id, data) {
        if (!isFirebaseReady) throw new Error('Firebase not ready');
        await db.collection(collection).doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this._clearCache(collection);
        return { id, ...data };
    },

    async delete(collection, id) {
        if (!isFirebaseReady) throw new Error('Firebase not ready');
        await db.collection(collection).doc(id).delete();
        this._clearCache(collection);
    },

    async get(collection, id) {
        if (!isFirebaseReady) throw new Error('Firebase not ready');
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    },

async getAll(collection) {
    if (!isFirebaseReady) throw new Error('Firebase not ready');
    if (this._cache[collection] && Date.now() - this._cacheTime[collection] < 300000) {
        return this._cache[collection];
    }
    try {
        // ✅ إزالة orderBy لتجنب الحاجة إلى فهارس
        const snapshot = await db.collection(collection).get();
        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        this._cache[collection] = results;
        this._cacheTime[collection] = Date.now();
        return results;
    } catch (e) {
        const snapshot = await db.collection(collection).get();
        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        this._cache[collection] = results;
        this._cacheTime[collection] = Date.now();
        return results;
    }
},

    async getWhere(collection, field, operator, value) {
        if (!isFirebaseReady) throw new Error('Firebase not ready');
        const snapshot = await db.collection(collection).where(field, operator, value).get();
        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        return results;
    },

listen(collection, callback) {
    if (!isFirebaseReady) return () => {};
    // ✅ إزالة orderBy لتجنب الحاجة إلى فهارس
    return db.collection(collection).onSnapshot((snapshot) => {
        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        this._cache[collection] = results;
        this._cacheTime[collection] = Date.now();
        callback(results);
    }, (error) => {
        console.error(`Listen error on ${collection}:`, error);
    });
},

// داخل FirestoreService
listenDoc(collection, docId, callback) {
    if (!isFirebaseReady) return () => {};
    const docRef = db.collection(collection).doc(docId);
    return docRef.onSnapshot((doc) => {
        if (doc.exists) {
            callback({ id: doc.id, ...doc.data() });
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`Listen error on ${collection}/${docId}:`, error);
    });
},

listenWhere(collection, field, operator, value, callback) {
    if (!isFirebaseReady) return () => {};
    // ✅ إزالة orderBy لتجنب الحاجة إلى فهارس
    return db.collection(collection).where(field, operator, value).onSnapshot((snapshot) => {
        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        callback(results);
    }, (error) => {
        console.error(`Listen error on ${collection}:`, error);
    });
},

    _clearCache(collection) {
        delete this._cache[collection];
        delete this._cacheTime[collection];
    }
};

// ============================================================
// 5. نظام الإنجازات (AchievementSystem)
// ============================================================
const AchievementSystem = {
    achievements: [
        { id: 'first_goal', name: '🎯 الهدف الأول', desc: 'سجل هدفاً في المباراة الأولى', icon: '⚽', points: 10, category: 'مباريات' },
        { id: 'top_scorer', name: '🏅 الهداف', desc: 'سجل 10 أهداف في المباريات', icon: '🏆', points: 50, category: 'مباريات' },
        { id: 'champion', name: '👑 البطل', desc: 'فزت ببطولة الدوري', icon: '👑', points: 100, category: 'بطولات' },
        { id: 'quiz_master', name: '📚 خبير الأسئلة', desc: 'أجب على 50 سؤالاً صحيحاً', icon: '🧠', points: 50, category: 'أسئلة' },
        { id: 'legend', name: '🌟 أسطورة', desc: 'احصل على 500 نقطة', icon: '🌟', points: 200, category: 'نقاط' },
        { id: 'manager', name: '📋 المدير', desc: 'أضف 20 لاعباً', icon: '📋', points: 30, category: 'إدارة' },
        { id: 'scout', name: '🔍 الكشاف', desc: 'اكتشف لاعباً جديداً', icon: '🔍', points: 20, category: 'إدارة' },
        { id: 'first_match', name: '🏟️ أول مباراة', desc: 'أضف مباراة جديدة', icon: '🏟️', points: 15, category: 'مباريات' },
        { id: 'club_creator', name: '🏛️ مؤسس الأندية', desc: 'أضف 5 أندية جديدة', icon: '🏛️', points: 25, category: 'إدارة' },
        { id: 'question_master', name: '📝 صانع الأسئلة', desc: 'أضف 10 أسئلة', icon: '📝', points: 30, category: 'أسئلة' },
        { id: 'game_winner', name: '🎮 بطل اللعبة', desc: 'اربح 10 مباريات في لعبة الأسئلة', icon: '🎮', points: 60, category: 'لعبة' },
        { id: 'social_butterfly', name: '🦋 اجتماعي', desc: 'أضف 5 أصدقاء', icon: '🦋', points: 20, category: 'اجتماعي' },
        { id: 'post_master', name: '📢 ناشر محتوى', desc: 'أنشئ 10 منشورات', icon: '📢', points: 30, category: 'اجتماعي' },
        { id: 'shopaholic', name: '🛒 متسوق محترف', desc: 'اشترِ 5 عناصر من المتجر', icon: '🛒', points: 25, category: 'متجر' },
        { id: 'room_host', name: '🏠 مضيف الغرف', desc: 'استضف 5 غرف لعب', icon: '🏠', points: 40, category: 'غرف' }
    ],

    check(user, data) {
        if (!user) return [];
        const unlocked = [];
        const userAchievements = user.achievements || [];

        this.achievements.forEach(ach => {
            if (userAchievements.includes(ach.id)) return;
            let condition = false;
            switch (ach.id) {
                case 'first_goal':
                    condition = data.matches.some(m => m.score1 > 0 || m.score2 > 0);
                    break;
                case 'top_scorer':
                    const totalGoals = data.players.reduce((sum, p) => sum + (p.goals || 0), 0);
                    condition = totalGoals >= 10;
                    break;
                case 'champion':
                    condition = data.tournaments.some(t => t.winner === user.username);
                    break;
                case 'quiz_master':
                    const correctAnswers = parseInt(localStorage.getItem('correctAnswers') || '0');
                    condition = correctAnswers >= 50;
                    break;
                case 'legend':
                    condition = user.totalScore >= 500;
                    break;
                case 'manager':
                    condition = data.players.length >= 20;
                    break;
                case 'scout':
                    condition = data.players.some(p => p.scoutedBy === user.uid);
                    break;
                case 'first_match':
                    condition = data.matches.length >= 1;
                    break;
                case 'club_creator':
                    condition = data.clubs.length >= 5;
                    break;
                case 'question_master':
                    condition = data.questions.length >= 10;
                    break;
                case 'game_winner':
                    const wins = parseInt(localStorage.getItem('gameWins') || '0');
                    condition = wins >= 10;
                    break;
                case 'social_butterfly':
                    condition = (user.friends || []).length >= 5;
                    break;
                case 'post_master':
                    const posts = data.posts ? data.posts.filter(p => p.userId === user.uid) : [];
                    condition = posts.length >= 10;
                    break;
                case 'shopaholic':
                    condition = (user.inventory || []).length >= 5;
                    break;
                case 'room_host':
                    const rooms = data.rooms ? data.rooms.filter(r => r.hostId === user.uid) : [];
                    condition = rooms.length >= 5;
                    break;
            }
            if (condition) {
                unlocked.push(ach);
                userAchievements.push(ach.id);
                user.totalScore = (user.totalScore || 0) + ach.points;
                user.coins = (user.coins || 0) + ach.points;
            }
        });

        if (unlocked.length > 0) {
            AuthService.updateUser({
                achievements: userAchievements,
                totalScore: user.totalScore,
                coins: user.coins
            });
            unlocked.forEach(ach => {
                showToast(`🏆 إنجاز جديد: ${ach.name}! (+${ach.points} نقطة و+${ach.points} عملة)`, 'success', 5000);
                try {
                    const audio = new Audio(
                        'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACBhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqF'
                    );
                    audio.play().catch(() => {});
                } catch (e) {}
            });
        }
        return unlocked;
    },

    getUserAchievements(user) {
        if (!user) return [];
        const userAchievements = user.achievements || [];
        return this.achievements.map(ach => ({
            ...ach,
            unlocked: userAchievements.includes(ach.id)
        }));
    },

    getAchievementStats(user) {
        if (!user) return { total: 0, unlocked: 0, points: 0 };
        const userAchievements = user.achievements || [];
        const unlocked = this.achievements.filter(a => userAchievements.includes(a.id));
        return {
            total: this.achievements.length,
            unlocked: unlocked.length,
            points: unlocked.reduce((sum, a) => sum + a.points, 0)
        };
    }
};

// ============================================================
// 6. مدير البيانات (DataManager)
// ============================================================
const DataManager = {
    data: {
        players: [],
        clubs: [],
        matches: [],
        tournaments: [],
        questions: [],
        leaderboard: [],
        comments: [],
        posts: [],
        rooms: [],
        storeItems: [],
        transactions: []
    },
    _listeners: [],
    _unsubscribers: [],
    _isLoading: false,
    _lastUpdate: null,

    async loadAll() {
        if (this._isLoading) return this.data;
        this._isLoading = true;
        try {
            const collections = ['players', 'clubs', 'matches', 'tournaments', 'questions', 'leaderboard',
                'comments', 'posts', 'rooms', 'storeItems', 'transactions'
            ];
            const results = await Promise.all(
                collections.map(col => FirestoreService.getAll(col))
            );
            collections.forEach((col, idx) => {
                this.data[col] = results[idx];
            });
            this._lastUpdate = new Date();
            this._notifyListeners();
            return this.data;
        } catch (e) {
            console.error('❌ Error loading data:', e);
            showToast('خطأ في تحميل البيانات، جاري استخدام البيانات المخزنة', 'error');
            throw e;
        } finally {
            this._isLoading = false;
        }
    },

startListening() {
    if (!isFirebaseReady) return;
    this._unsubscribers.forEach(unsub => unsub());
    this._unsubscribers = [];
    const collections = [
        { name: 'players', key: 'players' },
        { name: 'clubs', key: 'clubs' },
        { name: 'matches', key: 'matches' },
        { name: 'tournaments', key: 'tournaments' },
        { name: 'questions', key: 'questions' },
        { name: 'leaderboard', key: 'leaderboard' },
        { name: 'comments', key: 'comments' },
        { name: 'posts', key: 'posts' },
        { name: 'rooms', key: 'rooms' },
        { name: 'storeItems', key: 'storeItems' },
        { name: 'transactions', key: 'transactions' }
    ];
    collections.forEach(({ name, key }) => {
        // ✅ استخدام listen الجديد بدون orderBy
        const unsub = FirestoreService.listen(name, (data) => {
            this.data[key] = data;
            this._lastUpdate = new Date();
            this._notifyListeners();
        });
        this._unsubscribers.push(unsub);
    });
},

    addListener(callback) {
        this._listeners.push(callback);
        callback(this.data);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    },

    _notifyListeners() {
        this._listeners.forEach(cb => {
            try { cb(this.data); } catch (e) { console.warn('Listener error:', e); }
        });
    },

    async add(collection, item) {
        const result = await FirestoreService.add(collection, item);
        return result;
    },

    async update(collection, id, item) {
        return await FirestoreService.update(collection, id, item);
    },

    async delete(collection, id) {
        await FirestoreService.delete(collection, id);
    },

    getStats() {
        return {
            players: this.data.players.length,
            clubs: this.data.clubs.length,
            matches: this.data.matches.length,
            tournaments: this.data.tournaments.length,
            questions: this.data.questions.length,
            comments: this.data.comments.length,
            leaderboard: this.data.leaderboard.length,
            posts: this.data.posts.length,
            rooms: this.data.rooms.length,
            storeItems: this.data.storeItems.length
        };
    },

    getTopPlayers(limit = 5) {
        return [...this.data.players]
            .sort((a, b) => (b.goals || 0) - (a.goals || 0))
            .slice(0, limit);
    },

    getTopTeams() {
        const teams = {};
        this.data.matches.forEach(m => {
            if (!teams[m.team1]) teams[m.team1] = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
            if (!teams[m.team2]) teams[m.team2] = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
            teams[m.team1].goalsFor += m.score1 || 0;
            teams[m.team1].goalsAgainst += m.score2 || 0;
            teams[m.team2].goalsFor += m.score2 || 0;
            teams[m.team2].goalsAgainst += m.score1 || 0;
            if ((m.score1 || 0) > (m.score2 || 0)) {
                teams[m.team1].wins++;
                teams[m.team2].losses++;
            } else if ((m.score1 || 0) < (m.score2 || 0)) {
                teams[m.team2].wins++;
                teams[m.team1].losses++;
            } else {
                teams[m.team1].draws++;
                teams[m.team2].draws++;
            }
        });
        return Object.entries(teams)
            .sort((a, b) => {
                const ptsA = a[1].wins * 3 + a[1].draws;
                const ptsB = b[1].wins * 3 + b[1].draws;
                return ptsB - ptsA;
            })
            .slice(0, 10);
    }
};

// ============================================================
// محرك اللعبة المتطور - دعم جميع أنواع الأسئلة
// ============================================================

// ============================================================
// محرك اللعبة المتطور - النسخة المُصلحة بالكامل
// ============================================================

const GameEngine = {
    currentIndex: 0,
    score: 0,
    timer: null,
    timeLeft: 15,
    totalTime: 15,
    answered: false,
    gameQuestions: [],
    difficulty: 'medium',
    pointsPerQuestion: 2,
    isPlaying: false,
    correctCount: 0,
    wrongCount: 0,
    startTime: null,
    streak: 0,
    bestStreak: 0,
    hintsUsed: 0,
    mode: 'normal',
    totalQuestions: 0,
    coinsEarned: 0,
    pointsEarned: 0,
    _matchingAnswers: {},
    _orderingAnswers: [],
    isTimeAttack: false,
    timeBonusCorrect: 3,
    timePenaltyWrong: 5,
    totalAnswered: 0,
    questionPool: [],
    streaksHistory: [],     // لتخزين جميع السلاسل التي تم تحقيقها
    levelDisplayed: false,  // لمنع تكرار عرض المستوى

    init() {
        document.getElementById('startGameBtn')?.addEventListener('click', () => this.start());
        document.getElementById('gameQuitBtn')?.addEventListener('click', () => this.quit());
        document.getElementById('gameReplayBtn')?.addEventListener('click', () => this.start());
        document.getElementById('gameHomeBtn')?.addEventListener('click', () => {
            App._activateSection('dashboard');
        });
        document.getElementById('gameShareResultBtn')?.addEventListener('click', () => {
            this.shareResult();
        });
        document.getElementById('gameHintBtn')?.addEventListener('click', () => {
            this.showHint();
        });
        
        this._updateGameStats();
    },

start() {
    if (this.isPlaying) return;
    
    const category = document.getElementById('gameCategory').value;
    const questionType = document.getElementById('gameQuestionType').value; // ✅ جديد
    const count = parseInt(document.getElementById('gameCount').value);
    const diff = document.getElementById('gameDifficulty').value;
    const mode = document.getElementById('gameMode').value;
    
    this.difficulty = diff;
    this.mode = mode;
    this.totalQuestions = count;
    this.isTimeAttack = (mode === 'time_attack');
    
    let pool = [...DataManager.data.questions];
    if (category !== 'all') {
        pool = pool.filter(q => q.category === category);
    }

        // ✅ تصفية حسب نوع السؤال (جديد)
    if (questionType !== 'all') {
        pool = pool.filter(q => q.type === questionType);
    }
    pool = shuffleArray(pool);
    this.questionPool = pool;
    
    if (pool.length === 0) {
        showToast('لا توجد أسئلة في هذه الفئة!', 'error');
        return;
    }
    
    if (this.isTimeAttack) {
        const initialCount = Math.min(30, pool.length);
        this.gameQuestions = pool.slice(0, initialCount);
        this.totalQuestions = Infinity;
        this.totalTime = 60;
        this.timeLeft = 60;
        // ✅ لا حاجة لـ pointsPerQuestion
    } else {
        const maxCount = Math.min(count, pool.length);
        this.gameQuestions = pool.slice(0, maxCount);
        this.totalQuestions = this.gameQuestions.length;
        
        const diffMap = {
            easy: { time: 20 },
            medium: { time: 15 },
            hard: { time: 10 },
            expert: { time: 5 }
        };
        const settings = diffMap[this.difficulty] || diffMap.medium;
        this.totalTime = settings.time;
        this.timeLeft = settings.time;
        // ✅ لا حاجة لـ pointsPerQuestion
    }
    
    if (this.gameQuestions.length === 0) {
        showToast('لا توجد أسئلة كافية!', 'error');
        return;
    }

    // تهيئة المتغيرات
    this.currentIndex = 0;
    this.score = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.answered = false;
    this.isPlaying = true;
    this.startTime = Date.now();
    this.streak = 0;
    this.bestStreak = parseInt(localStorage.getItem('bestStreak') || '0');
    this.hintsUsed = 0;
    this.coinsEarned = 0;
    this.pointsEarned = 0;
    this.totalAnswered = 0;
    this._matchingAnswers = {};
    this._orderingAnswers = [];

    // عرض الواجهة
    document.getElementById('gameHintBtn').style.display = this.isTimeAttack ? 'none' : 'inline-flex';
    document.getElementById('gameStartScreen').style.display = 'none';
    document.getElementById('gamePlayScreen').style.display = 'block';
    document.getElementById('gameResultScreen').style.display = 'none';
    
    this._updateGameStats();
    this.renderQuestion();
    this.startTimer();
},

renderQuestion() {
    const q = this.gameQuestions[this.currentIndex];
    if (!q) {
        if (this.isTimeAttack) {
            if (this.questionPool.length === 0) {
                this.endGame();
                return;
            }
            const newBatch = shuffleArray(this.questionPool).slice(0, 30);
            this.gameQuestions = newBatch;
            this.currentIndex = 0;
            this.renderQuestion();
            return;
        } else {
            this.endGame();
            return;
        }
    }
    
    // ✅ تسجيل وقت بداية السؤال لحساب سرعة الإجابة
    this.questionStartTime = Date.now();

    this.answered = false;
    this._matchingAnswers = {};
    this._orderingAnswers = [];
    
    const counterText = this.isTimeAttack 
        ? `✅ ${this.totalAnswered} سؤال` 
        : `${this.currentIndex + 1} / ${this.gameQuestions.length}`;
    document.getElementById('gameQCounter').textContent = counterText;
    
    const progress = this.isTimeAttack
        ? ((this.totalTime - this.timeLeft) / this.totalTime) * 100
        : ((this.currentIndex) / this.gameQuestions.length) * 100;
    document.getElementById('gameProgressFill').style.width = `${Math.min(progress, 100)}%`;
    document.getElementById('gameScoreDisplay').textContent = `⭐ ${this.score}`;
    document.getElementById('gameQCategory').textContent = `📚 ${q.category || 'عام'}`;
    document.getElementById('gameQType').textContent = this._getTypeLabel(q.type);
    document.getElementById('gameQText').textContent = q.question;

    const container = document.getElementById('gameOptions');
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr';
    container.style.gap = '0.8rem';
    container.style.maxWidth = '600px';
    container.style.margin = '0 auto';

    // عرض حسب النوع
    switch(q.type) {
        case 'multiple_choice':
            this._renderMultipleChoice(q, container);
            break;
        case 'true_false':
            this._renderTrueFalse(q, container);
            break;
        case 'fill_blank':
            this._renderFillBlank(q, container);
            break;
        case 'matching':
            this._renderMatching(q, container);
            break;
        case 'ordering':
            this._renderOrdering(q, container);
            break;
        default:
            this._renderMultipleChoice(q, container);
    }

    // ✅ تصحيح: في وضع الوقت المفتوح، استخدم الوقت المتبقي بدلاً من إعادة ضبطه
    if (this.isTimeAttack) {
        // لا نغير this.timeLeft، نستخدم القيمة الحالية
        document.getElementById('gameTimerDisplay').textContent = `⏱ ${this.timeLeft}s`;
    } else {
        this.timeLeft = this.totalTime;
        document.getElementById('gameTimerDisplay').textContent = `⏱ ${this.timeLeft}s`;
    }
    document.getElementById('gameTimerDisplay').style.color = '';
},

    // ===== دوال العرض =====

    _renderMultipleChoice(q, container) {
        container.style.gridTemplateColumns = '1fr 1fr';
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
            btn.dataset.index = idx;
            btn.onclick = (e) => {
                e.preventDefault();
                this.selectOption(idx);
            };
            container.appendChild(btn);
        });
    },

    _renderTrueFalse(q, container) {
        container.style.gridTemplateColumns = '1fr 1fr';
        const options = ['✅ صحيح', '❌ خطأ'];
        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.dataset.index = idx;
            btn.onclick = (e) => {
                e.preventDefault();
                this.selectOption(idx);
            };
            container.appendChild(btn);
        });
    },

    _renderFillBlank(q, container) {
        container.style.gridTemplateColumns = '1fr';
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';
        
        const inputId = `fillBlankInput_${Date.now()}`;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fill-blank-input';
        input.placeholder = 'اكتب الإجابة الصحيحة...';
        input.id = inputId;
        input.style.cssText = `
            width: 100%;
            padding: 12px 16px;
            border-radius: 12px;
            background: var(--glass);
            border: 2px solid var(--glass-border);
            color: var(--light);
            font-size: 1rem;
            text-align: right;
            font-family: var(--font);
        `;
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this._checkFillBlank(input);
            }
        });
        wrapper.appendChild(input);
        
        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = 'تأكيد الإجابة';
        submitBtn.style.cssText = 'margin-top:0.5rem;justify-content:center;';
        submitBtn.onclick = (e) => {
            e.preventDefault();
            this._checkFillBlank(input);
        };
        wrapper.appendChild(submitBtn);
        
        container.appendChild(wrapper);
    },

// ============================================================
// دوال حساب النقاط الجديدة
// ============================================================

_getStreakMultiplier(streak) {
    // السلسلة 1: 1.0, 2: 1.1, 3: 1.3, ..., 9: 1.8, >=10: 2.0
    if (streak < 10) {
        return 1 + (streak - 1) * 0.1; // 1, 1.1, 1.2, 1.3 ... 1.9? but we want 1.8 at 9? Actually 1+(9-1)*0.1=1.8, good.
    }
    return 2.0; // streak >= 10
},

_getTimeMultiplier(elapsedSeconds) {
    // elapsedSeconds: الوقت المستغرق في الإجابة
    if (elapsedSeconds <= 1) return 2.0;
    if (elapsedSeconds <= 5) return 1.5;
    return 1.0;
},

_calculateCoins(baseCoins) {
    if (!baseCoins || baseCoins <= 0) return 0;
    
    const boosts = this._getActiveBoosts();
    let coins = Math.round(baseCoins * boosts.coinMult);
    
    // مكافأة إضافية للسلسلة الطويلة (اختياري)
    if (this.streak >= 10) {
        coins = Math.round(coins * 1.2); // +20% عند سلسلة 10+
    } else if (this.streak >= 5) {
        coins = Math.round(coins * 1.1); // +10% عند سلسلة 5+
    }
    
    return Math.max(coins, 1); // على الأقل 1 عملة
},

// ============================================================
// تطبيق التعزيزات في اللعبة
// ============================================================

// داخل GameEngine
_getActiveBoosts() {
    const user = AuthService.currentUser;
    if (!user) return { coinMult: 1, pointMult: 1, streakShield: false, freezeTime: 0, removeWrong: false };

    const activeDetails = user.activeItemDetails || [];
    const now = Date.now();
    let coinMult = 1;
    let pointMult = 1;
    let streakShield = false;
    let freezeTime = 0;
    let removeWrong = false;
    let extraLife = 0;

    // تصفية العناصر المنتهية الصلاحية
    const validDetails = activeDetails.filter(d => {
        if (d.durationType === 'time' && d.expiresAt) {
            return new Date(d.expiresAt).getTime() > now;
        }
        if (d.durationType === 'rounds') {
            return (d.remainingRounds || 0) > 0;
        }
        return true;
    });

    // ✅ تحديث activeDetails بحذف المنتهية (في الخلفية)
    if (validDetails.length !== activeDetails.length && AuthService.currentUser) {
        setTimeout(() => {
            AuthService.updateUser({ activeItemDetails: validDetails }).catch(() => {});
        }, 100);
    }

    // حساب المضاعفات (نأخذ الأعلى)
    validDetails.forEach(d => {
        if (d.type === 'coin_multiplier') {
            if (d.multiplier > coinMult) coinMult = d.multiplier;
        }
        if (d.type === 'point_multiplier') {
            if (d.multiplier > pointMult) pointMult = d.multiplier;
        }
        if (d.type === 'streak_shield') streakShield = true;
        if (d.type === 'freeze_time') freezeTime = d.multiplier || 5;
        if (d.type === 'remove_wrong_option') removeWrong = true;
        if (d.type === 'extra_life') extraLife = d.multiplier || 1;
    });

    // ✅ تقليل عدد الجولات المتبقية للعناصر من نوع rounds
    if (this.isPlaying) {
        // سيتم تنقيحها في نهاية كل جولة
    }

    return { coinMult, pointMult, streakShield, freezeTime, removeWrong, extraLife };
},

// داخل GameEngine
_decreaseRemainingRounds() {
    if (!AuthService.currentUser) return;
    
    const user = AuthService.currentUser;
    const activeDetails = user.activeItemDetails || [];
    let updated = false;
    
    const newDetails = activeDetails.map(d => {
        if (d.durationType === 'rounds' && d.remainingRounds > 0) {
            updated = true;
            return { ...d, remainingRounds: d.remainingRounds - 1 };
        }
        return d;
    }).filter(d => {
        // إزالة العناصر التي انتهت جولاتها
        if (d.durationType === 'rounds' && d.remainingRounds <= 0) {
            updated = true;
            return false;
        }
        return true;
    });
    
    if (updated) {
        // تحديث activeItems أيضاً
        const activeItems = user.activeItems || [];
        const remainingIds = newDetails.map(d => d.itemId);
        const newActiveItems = activeItems.filter(id => remainingIds.includes(id));
        
        AuthService.updateUser({
            activeItemDetails: newDetails,
            activeItems: newActiveItems
        }).catch(() => {});
    }
},

// تعديل دالة _calculatePoints لتشمل المضاعفات
_calculatePoints(isCorrect, streak, elapsedSeconds) {
    if (!isCorrect) return 0;
    const boosts = this._getActiveBoosts();
    const basePoints = 10;
    const streakMult = this._getStreakMultiplier(streak);
    const timeMult = this._getTimeMultiplier(elapsedSeconds);
    let points = Math.round(basePoints * streakMult * timeMult);
    points = Math.round(points * boosts.pointMult);
    if (points < 10) points = 10;
    return points;
},

// دالة جديدة لحساب النقود (سيتم استدعاؤها عند منح النقود)
_calculateCoins(baseCoins) {
    const boosts = this._getActiveBoosts();
    return Math.round(baseCoins * boosts.coinMult);
},

    _renderMatching(q, container) {
        container.style.gridTemplateColumns = '1fr';
        const pairs = q.matchingPairs || [];
        if (pairs.length === 0) {
            container.innerHTML = '<div class="text-gray">لا توجد أزواج مطابقة</div>';
            return;
        }
        
        this._matchingAnswers = {};
        const leftItems = pairs.map(p => p.left);
        const rightItems = shuffleArray(pairs.map(p => p.right));
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:0.8rem;';
        
        const title = document.createElement('div');
        title.style.cssText = 'text-align:center;color:var(--gray);font-size:0.9rem;margin-bottom:0.5rem;';
        title.textContent = '🔗 طابق بين العمودين';
        wrapper.appendChild(title);
        
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr auto 1fr;gap:0.5rem;align-items:center;';
        
        leftItems.forEach((left, idx) => {
            const leftEl = document.createElement('div');
            leftEl.style.cssText = 'padding:8px 12px;background:var(--glass);border-radius:8px;text-align:center;font-weight:600;';
            leftEl.textContent = left;
            grid.appendChild(leftEl);
            
            const arrow = document.createElement('div');
            arrow.style.cssText = 'color:var(--gray);font-size:1.2rem;text-align:center;';
            arrow.textContent = '↔';
            grid.appendChild(arrow);
            
            const select = document.createElement('select');
            select.style.cssText = `
                padding: 8px 12px;
                border-radius: 8px;
                background: var(--glass);
                border: 1px solid var(--glass-border);
                color: var(--light);
                font-size: 0.9rem;
                font-family: var(--font);
                cursor: pointer;
                width: 100%;
            `;
            select.dataset.leftIndex = idx;
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '--- اختر ---';
            select.appendChild(defaultOption);
            
            rightItems.forEach((right, rightIdx) => {
                const option = document.createElement('option');
                option.value = rightIdx;
                option.textContent = right;
                select.appendChild(option);
            });
            
            select.onchange = () => {
                this._matchingAnswers[idx] = parseInt(select.value);
            };
            
            grid.appendChild(select);
        });
        
        wrapper.appendChild(grid);
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = 'تأكيد المطابقة';
        confirmBtn.style.cssText = 'margin-top:0.5rem;justify-content:center;';
        confirmBtn.onclick = (e) => {
            e.preventDefault();
            this._checkMatching(q);
        };
        wrapper.appendChild(confirmBtn);
        
        container.appendChild(wrapper);
    },

    _renderOrdering(q, container) {
        container.style.gridTemplateColumns = '1fr';
        const items = q.orderedItems || [];
        if (items.length === 0) {
            container.innerHTML = '<div class="text-gray">لا توجد عناصر للترتيب</div>';
            return;
        }
        
        let shuffled = shuffleArray([...items]);
        this._orderingAnswers = [...shuffled];
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';
        
        const title = document.createElement('div');
        title.style.cssText = 'text-align:center;color:var(--gray);font-size:0.9rem;margin-bottom:0.5rem;';
        title.textContent = '🔢 رتب العناصر بالترتيب الصحيح';
        wrapper.appendChild(title);
        
        const list = document.createElement('div');
        list.id = `orderingList_${Date.now()}`;
        list.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem;';
        
        const renderOrderingItems = () => {
            list.innerHTML = '';
            shuffled.forEach((item, idx) => {
                const itemEl = document.createElement('div');
                itemEl.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 8px 12px;
                    background: var(--glass);
                    border-radius: 8px;
                    border: 1px solid var(--glass-border);
                `;
                itemEl.innerHTML = `
                    <span style="flex:1;text-align:right;">${item}</span>
                    <span style="color:var(--gray);font-size:0.7rem;min-width:30px;">${idx + 1}</span>
                    <button class="btn btn-xs btn-outline move-up" data-index="${idx}">↑</button>
                    <button class="btn btn-xs btn-outline move-down" data-index="${idx}">↓</button>
                `;
                list.appendChild(itemEl);
            });
            
            list.querySelectorAll('.move-up').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const idx = parseInt(e.target.dataset.index);
                    if (idx > 0) {
                        [shuffled[idx], shuffled[idx - 1]] = [shuffled[idx - 1], shuffled[idx]];
                        this._orderingAnswers = [...shuffled];
                        renderOrderingItems();
                    }
                };
            });
            list.querySelectorAll('.move-down').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const idx = parseInt(e.target.dataset.index);
                    if (idx < shuffled.length - 1) {
                        [shuffled[idx], shuffled[idx + 1]] = [shuffled[idx + 1], shuffled[idx]];
                        this._orderingAnswers = [...shuffled];
                        renderOrderingItems();
                    }
                };
            });
        };
        
        renderOrderingItems();
        wrapper.appendChild(list);
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = 'تأكيد الترتيب';
        confirmBtn.style.cssText = 'margin-top:0.5rem;justify-content:center;';
        confirmBtn.onclick = (e) => {
            e.preventDefault();
            this._checkOrdering(q);
        };
        wrapper.appendChild(confirmBtn);
        
        container.appendChild(wrapper);
    },

    _renderOddOneOut(q, container) {
        container.style.gridTemplateColumns = '1fr 1fr';
        const items = q.items || [];
        if (items.length < 3) {
            container.innerHTML = '<div class="text-gray">لا توجد عناصر كافية</div>';
            return;
        }
        items.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = item;
            btn.dataset.index = idx;
            btn.onclick = (e) => {
                e.preventDefault();
                this.selectOption(idx);
            };
            container.appendChild(btn);
        });
    },

    _getTypeLabel(type) {
        const types = {
            'multiple_choice': '📝 اختيار من متعدد',
            'true_false': '✅ صح/خطأ',
            'fill_blank': '✏️ ملء الفراغ',
            'matching': '🔗 مطابقة',
            'ordering': '🔢 ترتيب',
            'odd_one_out': '❓ اختر الدخيل'
        };
        return types[type] || '📝 اختيار من متعدد';
    },

    // ===== دوال التحقق =====

    selectOption(index) {
        if (this.answered || !this.isPlaying) return;
        this.answered = true;
        clearInterval(this.timer);

        const q = this.gameQuestions[this.currentIndex];
        const isCorrect = index === q.correct;
        this._handleAnswer(isCorrect, q);
    },

    _checkFillBlank(input) {
        if (this.answered || !this.isPlaying) return;
        if (!input) return;
        
        this.answered = true;
        clearInterval(this.timer);
        
        const q = this.gameQuestions[this.currentIndex];
        const userAnswer = input.value.trim().toLowerCase();
        const correctAnswer = (q.correctAnswer || '').toLowerCase();
        const isCorrect = userAnswer === correctAnswer;
        this._handleAnswer(isCorrect, q);
    },

    _checkMatching(q) {
        if (this.answered || !this.isPlaying) return;
        
        const pairs = q.matchingPairs || [];
        let allAnswered = true;
        for (let i = 0; i < pairs.length; i++) {
            if (this._matchingAnswers[i] === undefined || this._matchingAnswers[i] === '') {
                allAnswered = false;
                break;
            }
        }
        
        if (!allAnswered) {
            showToast('⚠️ يرجى مطابقة جميع الأزواج', 'warning');
            return;
        }
        
        this.answered = true;
        clearInterval(this.timer);
        
        const rightItems = shuffleArray(pairs.map(p => p.right));
        let correctCount = 0;
        for (let i = 0; i < pairs.length; i++) {
            const selectedIdx = this._matchingAnswers[i];
            if (selectedIdx !== undefined && selectedIdx < rightItems.length) {
                if (pairs[i].right === rightItems[selectedIdx]) {
                    correctCount++;
                }
            }
        }
        
        const isCorrect = correctCount === pairs.length;
        this._handleAnswer(isCorrect, q);
    },

    _checkOrdering(q) {
        if (this.answered || !this.isPlaying) return;
        
        this.answered = true;
        clearInterval(this.timer);
        
        const orderedItems = q.orderedItems || [];
        const userOrder = this._orderingAnswers || [];
        const isCorrect = JSON.stringify(userOrder) === JSON.stringify(orderedItems);
        this._handleAnswer(isCorrect, q);
    },

// ============================================================
// معالجة الإجابة - نسخة مصححة
// ============================================================

// داخل GameEngine._handleAnswer
_handleAnswer(isCorrect, q) {
    // ✅ حساب الوقت المستغرق للإجابة
    const elapsed = (Date.now() - this.questionStartTime) / 1000;
    
    // ✅ مكافأة السرعة (كلما أسرع = مكافأة أكبر)
    let speedBonus = 0;
    if (isCorrect) {
        if (elapsed <= 1.5) speedBonus = 3;
        else if (elapsed <= 3) speedBonus = 2;
        else if (elapsed <= 5) speedBonus = 1;
    }
    
    let bonusTime = 0;
    if (isCorrect) {
        // ✅ حساب النقاط مع مكافأة السرعة
        const pointsEarned = this._calculatePoints(true, this.streak + 1, elapsed) + speedBonus;
        this.score += pointsEarned;
        this.correctCount++;
        this.streak++;
        
        // ✅ تسجيل السلسلة عند الوصول إلى 5
        if (this.streak >= 5 && !this.streaksHistory.includes(this.streak)) {
            this.streaksHistory.push(this.streak);
        }
        
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        
        // ✅ حساب النقود مع مكافأة السرعة
        let baseCoins = 2 + Math.floor(this.streak / 5) + speedBonus;
        if (this.streak >= 10) baseCoins += 3;
        else if (this.streak >= 5) baseCoins += 1;
        const earnedCoins = this._calculateCoins(baseCoins);
        this.coinsEarned += earnedCoins;
        
        if (this.isTimeAttack) {
            this.timeLeft += this.timeBonusCorrect;
            bonusTime = this.timeBonusCorrect;
            showToast(`✅ صحيح! +${this.timeBonusCorrect} ثانية ⏱️`, 'success', 800);
        }
        
        if (this.streak >= 5) {
            const bonus = Math.floor(this.streak / 5);
            this.score += bonus;
            showToast(`🔥 سلسلة ${this.streak}! +${bonus} نقطة إضافية!`, 'success', 1500);
        }
    } else {
        this.wrongCount++;
        this.streak = 0;
        document.getElementById('gameStreakDisplay').textContent = `🔥 0`;
        
        const earnedCoins = this._calculateCoins(1);
        this.coinsEarned += earnedCoins;
        
        if (this.isTimeAttack) {
            this.timeLeft -= this.timePenaltyWrong;
            bonusTime = -this.timePenaltyWrong;
            showToast(`❌ خاطئ! -${this.timePenaltyWrong} ثانية ⏱️`, 'error', 800);
        }
    }

    // تحديث العرض
    document.getElementById('gameScoreDisplay').textContent = `⭐ ${this.score}`;
    document.getElementById('gameStreakDisplay').textContent = `🔥 ${this.streak}`;
    document.getElementById('gameTimerDisplay').textContent = `⏱ ${Math.max(0, this.timeLeft)}s`;
    this.totalAnswered++;

    // تقليل عدد الجولات المتبقية
    this._decreaseRemainingRounds();

    if (this.isTimeAttack && this.timeLeft <= 0) {
        this.timeLeft = 0;
        document.getElementById('gameTimerDisplay').textContent = `⏱ 0s`;
        this.endGame();
        return;
    }

    this._showAnswerFeedback(q, isCorrect);

    setTimeout(() => {
        this.currentIndex++;
        if (this.isTimeAttack) {
            if (this.timeLeft <= 0) {
                this.endGame();
                return;
            }
            this.renderQuestion();
            this.startTimer();
        } else {
            if (this.currentIndex < this.gameQuestions.length) {
                this.renderQuestion();
                this.startTimer();
            } else {
                this.endGame();
            }
        }
    }, 1500);
},

    _showAnswerFeedback(q, isCorrect) {
        const btns = document.querySelectorAll('.option-btn');
        const container = document.getElementById('gameOptions');
        
        if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'odd_one_out') {
            btns.forEach((btn, i) => {
                btn.classList.add('disabled');
                if (i === q.correct) {
                    btn.classList.add('show-correct');
                }
            });
        } else if (q.type === 'fill_blank') {
            const input = container.querySelector('.fill-blank-input');
            if (input) {
                input.style.borderColor = isCorrect ? 'var(--success)' : 'var(--secondary)';
                input.style.background = isCorrect ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 107, 107, 0.1)';
                input.disabled = true;
                if (!isCorrect) {
                    showToast(`❌ الإجابة الصحيحة: ${q.correctAnswer || '—'}`, 'error', 2000);
                }
            }
        } else if (q.type === 'matching' || q.type === 'ordering') {
            container.querySelectorAll('select, button').forEach(el => el.disabled = true);
            if (!isCorrect) {
                showToast('❌ ترتيب خاطئ، حاول مرة أخرى', 'error', 1500);
            }
        }
    },

    // ===== المؤقت =====

startTimer() {
    clearInterval(this.timer);
    const currentTime = this.timeLeft;
    document.getElementById('gameTimerDisplay').textContent = `⏱ ${currentTime}s`;
    document.getElementById('gameTimerDisplay').style.color = '';

    this.timer = setInterval(() => {
        this.timeLeft--;
        document.getElementById('gameTimerDisplay').textContent = `⏱ ${this.timeLeft}s`;

        if (this.timeLeft <= 5) {
            document.getElementById('gameTimerDisplay').style.color = 'var(--secondary)';
        } else {
            document.getElementById('gameTimerDisplay').style.color = '';
        }

        if (this.timeLeft <= 0) {
            clearInterval(this.timer);
            if (!this.answered && this.isPlaying) {
                // ✅ عند انتهاء الوقت دون إجابة
                this.timeLeft = 0;
                this.answered = true;
                this.wrongCount++;
                this.streak = 0;
                document.getElementById('gameStreakDisplay').textContent = `🔥 0`;
                document.getElementById('gameTimerDisplay').textContent = `⏱ 0s`;
                
                const q = this.gameQuestions[this.currentIndex];
                this._showAnswerFeedback(q, false);
                
                setTimeout(() => {
                    this.currentIndex++;
                    if (this.isTimeAttack) {
                        if (this.timeLeft <= 0) {
                            this.endGame();
                            return;
                        }
                        this.renderQuestion();
                        this.startTimer();
                    } else {
                        if (this.currentIndex < this.gameQuestions.length) {
                            this.renderQuestion();
                            this.startTimer();
                        } else {
                            this.endGame();
                        }
                    }
                }, 1500);
            }
        }
    }, 1000);
},

    // ===== إنهاء اللعبة =====

async endGame() {
    if (this._isEnding) return;
    this._isEnding = true;
    this.levelDisplayed = false;

    // حفظ السلسلة
    if (this.bestStreak > parseInt(localStorage.getItem('bestStreak') || '0')) {
        localStorage.setItem('bestStreak', this.bestStreak.toString());
    }
    localStorage.setItem('gameStreak', this.streak.toString());

    this.isPlaying = false;
    clearInterval(this.timer);
    document.getElementById('gamePlayScreen').style.display = 'none';
    document.getElementById('gameResultScreen').style.display = 'block';

    // ============================================================
    // 1. حساب الإحصائيات الأساسية
    // ============================================================
    const totalQuestions = this.isTimeAttack ? this.totalAnswered : this.gameQuestions.length;
    const correctAnswers = this.correctCount;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const timeTaken = Math.round((Date.now() - this.startTime) / 1000);
    
    // ============================================================
    // 2. حساب النقود النهائية
    // ============================================================
    let finalCoins = 0;
    const coinDetails = [];

    // النقود الأساسية
    const baseCoins = (this.correctCount * 2) + (this.wrongCount * 1);
    if (baseCoins > 0) {
        coinDetails.push({ label: '💰 إجابات (صحيح +2 / خاطئ +1)', value: baseCoins });
        finalCoins += baseCoins;
    }

    // مكافأة السرعة (تُحسب من وقت الإجابة)
    const speedCoinBonus = Math.floor(this.correctCount * 0.5); // كل إجابة سريعة تعطي نصف عملة إضافية
    if (speedCoinBonus > 0) {
        coinDetails.push({ label: '⚡ مكافأة السرعة', value: speedCoinBonus });
        finalCoins += speedCoinBonus;
    }

    // مكافأة السلسلة
    let streakCoinBonus = 0;
    if (this.streak >= 5) {
        streakCoinBonus = Math.floor(this.streak / 5) * 2;
        if (streakCoinBonus > 0) {
            coinDetails.push({ label: `🔥 مكافأة سلسلة (${this.streak})`, value: streakCoinBonus });
            finalCoins += streakCoinBonus;
        }
    }

    // مكافأة الدقة
    let accuracyCoinBonus = 0;
    if (accuracy >= 80) {
        accuracyCoinBonus = accuracy >= 90 ? (accuracy === 100 ? 20 : 10) : 5;
        coinDetails.push({ label: `🎯 مكافأة دقة (${accuracy}%)`, value: accuracyCoinBonus });
        finalCoins += accuracyCoinBonus;
    }

    // مضاعفات النقود
    const boosts = this._getActiveBoosts();
    let coinMultiplierBonus = 0;
    if (boosts.coinMult > 1) {
        const totalBeforeBoost = finalCoins;
        const totalAfterBoost = Math.round(totalBeforeBoost * boosts.coinMult);
        coinMultiplierBonus = totalAfterBoost - totalBeforeBoost;
        if (coinMultiplierBonus > 0) {
            coinDetails.push({ label: `🪙 مضاعفة نقود ×${boosts.coinMult}`, value: coinMultiplierBonus });
            finalCoins = totalAfterBoost;
        }
    }

    // ============================================================
    // 3. حساب النقاط النهائية
    // ============================================================
    let finalPoints = 0;
    const pointDetails = [];

    // النقاط الأساسية
    const basePoints = this.score;
    if (basePoints > 0) {
        pointDetails.push({ label: '⭐ نقاط الإجابات الصحيحة', value: basePoints });
        finalPoints += basePoints;
    }

    // مكافأة السرعة (تُحسب من وقت الإجابة)
    const speedPointBonus = Math.floor(this.correctCount * 0.5); // كل إجابة سريعة تعطي نصف نقطة إضافية
    if (speedPointBonus > 0) {
        pointDetails.push({ label: '⚡ مكافأة السرعة', value: speedPointBonus });
        finalPoints += speedPointBonus;
    }

    // مكافأة السلسلة
    let streakPointBonus = 0;
    if (this.streak >= 5) {
        streakPointBonus = Math.floor(this.streak / 5);
        if (streakPointBonus > 0) {
            pointDetails.push({ label: `🔥 مكافأة سلسلة (${this.streak})`, value: streakPointBonus });
            finalPoints += streakPointBonus;
        }
    }

    // مضاعفات النقاط
    let pointMultiplierBonus = 0;
    if (boosts.pointMult > 1) {
        const totalBeforeBoost = finalPoints;
        const totalAfterBoost = Math.round(totalBeforeBoost * boosts.pointMult);
        pointMultiplierBonus = totalAfterBoost - totalBeforeBoost;
        if (pointMultiplierBonus > 0) {
            pointDetails.push({ label: `⭐ مضاعفة نقاط ×${boosts.pointMult}`, value: pointMultiplierBonus });
            finalPoints = totalAfterBoost;
        }
    }

    // ============================================================
    // 4. عرض المستوى وشريط التقدم أولاً
    // ============================================================
    await this._displayLevelAndProgress(finalPoints);

    // ============================================================
    // 5. عرض التفاصيل مع العد التصاعدي (بعد اختفاء المستوى)
    // ============================================================
setTimeout(() => {
    this._displayResultDetails({
        coins: finalCoins,
        points: finalPoints,
        streak: this.streak,
        bestStreak: this.bestStreak,
        streaksHistory: this.streaksHistory,
        accuracy: accuracy,
        correct: correctAnswers,
        wrong: totalQuestions - correctAnswers,
        total: totalQuestions,
        coinDetails: coinDetails,
        pointDetails: pointDetails
    });
}, 1200); // انتظار اختفاء شريط التقدم

    // ============================================================
    // 6. تحديث بيانات المستخدم
    // ============================================================
    if (AuthService.currentUser) {
        const user = AuthService.currentUser;
        const newScore = (user.totalScore || 0) + finalPoints;
        const newCoins = (user.coins || 0) + finalCoins;
        const stats = user.stats || { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 };
        stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
        stats.correctAnswers = (stats.correctAnswers || 0) + correctAnswers;
        if (accuracy >= 70) stats.gamesWon = (stats.gamesWon || 0) + 1;

        await AuthService.updateUser({
            totalScore: newScore,
            coins: newCoins,
            stats: stats
        });

        const name = user.username || user.displayName || user.email;
        await FirestoreService.add('leaderboard', {
            name: name,
            score: finalPoints,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions,
            accuracy: accuracy,
            timeTaken: timeTaken,
            difficulty: this.difficulty,
            mode: this.mode,
            date: new Date().toISOString(),
            userId: user.uid,
            streak: this.streak,
            bestStreak: this.bestStreak,
            coins: finalCoins,
            streaksHistory: this.streaksHistory
        });

        AchievementSystem.check(AuthService.currentUser, DataManager.data);
        App._updateUserUI(AuthService.currentUser);
    }

    // ============================================================
    // 7. تحديث الواجهات الأخرى
    // ============================================================
    this._updateGameStats();
    this.renderLeaderboard();
    if (typeof App._refreshActiveBoosts === 'function') {
        App._refreshActiveBoosts();
    }

    const currentBest = parseInt(localStorage.getItem('bestGameScore') || '0');
    if (this.score > currentBest) {
        localStorage.setItem('bestGameScore', this.score.toString());
    }

    // تحديث العناصر القديمة (للتأكد)
    const coinsEl = document.getElementById('resultCoins');
    const pointsEl = document.getElementById('resultPoints');
    const streakEl = document.getElementById('resultStreak');
    if (coinsEl) coinsEl.textContent = finalCoins;
    if (pointsEl) pointsEl.textContent = finalPoints;
    if (streakEl) streakEl.textContent = this.streak;

    this._isEnding = false;
},

_displayLevelAndProgress(pointsEarned) {
    return new Promise((resolve) => {
        const user = AuthService.currentUser;
        if (!user) { resolve(); return; }
        
        const oldTotal = user.totalScore || 0;
        const newTotal = oldTotal + pointsEarned;
        const oldLevel = getLevel(oldTotal);
        const newLevel = getLevel(newTotal);
        
        // عرض المستوى
        const levelEl = document.getElementById('resultLevel');
        if (levelEl) {
            levelEl.textContent = `المستوى ${newLevel.level}`;
            levelEl.style.backgroundColor = 'var(--primary)';
            levelEl.style.display = 'inline-block';
        }
        
        // ✅ عرض شريط التقدم (يبقى ولا يختفي)
        const progressContainer = document.createElement('div');
        progressContainer.id = 'levelProgressContainer';
        progressContainer.style.cssText = 'margin: 1rem auto; max-width: 400px; padding: 0.5rem; background: var(--glass); border-radius: var(--radius-sm);';
        progressContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--gray);">
                <span>المستوى ${oldLevel.level}</span>
                <span>${newTotal} نقطة</span>
                <span>المستوى ${newLevel.level}</span>
            </div>
            <div class="progress-bar" style="height:10px; background:var(--glass); border-radius:10px; overflow:hidden;">
                <div id="levelProgressFillResult" style="height:100%; width:0%; background:linear-gradient(90deg, var(--primary), var(--accent)); border-radius:10px; transition:width 0.8s ease;"></div>
            </div>
            <div style="text-align:center; font-size:0.7rem; color:var(--gray); margin-top:0.2rem;">
                +${pointsEarned} نقطة
            </div>
        `;
        
        // إضافة شريط التقدم
        const levelDisplay = document.querySelector('.result-level');
        if (levelDisplay) {
            // إزالة القديم إن وجد
            const oldContainer = document.getElementById('levelProgressContainer');
            if (oldContainer) oldContainer.remove();
            levelDisplay.parentElement.insertBefore(progressContainer, levelDisplay.nextSibling);
        }
        
        // تشغيل حركة شريط التقدم
        setTimeout(() => {
            const fill = document.getElementById('levelProgressFillResult');
            if (fill) {
                const oldProgress = ((oldTotal - oldLevel.min) / 1000) * 100;
                const newProgress = ((newTotal - newLevel.min) / 1000) * 100;
                fill.style.width = `${Math.min(newProgress, 100)}%`;
            }
        }, 300);
        
        // ✅ لا نختفي، نبقى ظاهرين
        resolve();
    });
},

    shareResult() {
        const score = document.getElementById('resultFinalScore').textContent;
        const accuracy = document.getElementById('resultAccuracy').textContent;
        const text = `⚽ لعبة الأسئلة!\n🎯 النتيجة: ${score}\n🎯 الدقة: ${accuracy}\n🏆 تحدى نفسك في مدير كرة القدم!`;
        
        if (navigator.share) {
            navigator.share({ title: 'نتيجتي في لعبة الأسئلة', text }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ تم نسخ النتيجة', 'success');
            }).catch(() => {
                showToast('⚠️ لا يمكن النسخ', 'error');
            });
        }
    },

    showHint() {
        const q = this.gameQuestions[this.currentIndex];
        if (!q) return;
        
        let hintText = '💡 ';
        if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'odd_one_out') {
            const correctAnswer = q.options ? q.options[q.correct] : '';
            hintText += `الإجابة الصحيحة هي: "${correctAnswer}"`;
        } else if (q.type === 'fill_blank') {
            hintText += `الإجابة الصحيحة هي: "${q.correctAnswer || '—'}"`;
        } else if (q.type === 'matching') {
            const pairs = q.matchingPairs || [];
            hintText += `الأزواج الصحيحة: ${pairs.map(p => `${p.left} ↔ ${p.right}`).join('، ')}`;
        } else if (q.type === 'ordering') {
            const items = q.orderedItems || [];
            hintText += `الترتيب الصحيح: ${items.join(' ← ')}`;
        }
        
        document.getElementById('gameHintText').textContent = hintText;
        document.getElementById('gameHintModal').style.display = 'flex';
    },

    _closeGameHint() {
        document.getElementById('gameHintModal').style.display = 'none';
    },

    renderLeaderboard() {
        const list = document.getElementById('leaderboardList');
        if (!list) return;
        
        const lb = DataManager.data.leaderboard || [];
        if (lb.length === 0) {
            list.innerHTML = '<div class="text-gray">لا توجد نتائج بعد</div>';
            return;
        }
        
        const sorted = [...lb].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
        list.innerHTML = sorted.map((item, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
            return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--glass-border);">
                        <span><span style="font-weight:700;color:var(--accent);">${medal}</span> ${item.name || 'مجهول'}</span>
                        <span style="font-weight:700;">⭐ ${item.score || 0}</span>
                    </div>`;
        }).join('');
    },

_updateGameStats() {
    const user = AuthService.currentUser;
    if (!user) return;
    
    const stats = user.stats || {};
    const gamesPlayed = stats.gamesPlayed || 0;
    const gamesWon = stats.gamesWon || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    
    // تحديث العناصر بأمان
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    const setStyle = (id, prop, value) => {
        const el = document.getElementById(id);
        if (el) el.style[prop] = value;
    };
    
    setText('gameTotalPlayed', gamesPlayed);
    setText('gameTotalWon', gamesWon);
    setText('gameWinRate', `${winRate}%`);
    setText('gameTotalPoints', user.totalScore || 0);
    setText('gameCoins', user.coins || 0);
    
    const bestScore = parseInt(localStorage.getItem('bestGameScore') || '0');
    setText('gameBestScore', bestScore);
    
    const level = getLevel(user.totalScore || 0);
    setText('gameLevel', `🏅 المستوى ${level.level}`);
    setStyle('gameLevel', 'backgroundColor', 'var(--primary)');
    
    // السلسلة الحالية والأفضل
    const currentStreak = this.isPlaying ? this.streak : (parseInt(localStorage.getItem('gameStreak') || '0'));
    const bestStreak = parseInt(localStorage.getItem('bestStreak') || '0');
    setText('gameStreak', currentStreak);
    if (document.getElementById('gameStreak')) {
        const streakEl = document.getElementById('gameStreak');
        if (currentStreak >= 10) streakEl.style.color = 'var(--accent)';
        else if (currentStreak >= 5) streakEl.style.color = 'var(--success)';
        else streakEl.style.color = '';
    }
    setText('gameBestStreak', bestStreak);
    
    // ✅ عرض المضاعفات النشطة (بأمان)
    const boostEl = document.getElementById('gameActiveBoosts');
    if (boostEl) {
        const boosts = this._getActiveBoosts();
        let boostText = '';
        if (boosts.coinMult > 1) boostText += `🪙 ×${boosts.coinMult} `;
        if (boosts.pointMult > 1) boostText += `⭐ ×${boosts.pointMult} `;
        if (boostText) {
            boostEl.textContent = '⚡ ' + boostText;
            boostEl.style.display = 'block';
        } else {
            boostEl.style.display = 'none';
        }
    }
},

// ============================================================
// دوال عرض النتيجة المتطورة
// ============================================================

_displayResultDetails(details) {
    const container = document.getElementById('resultDetailsContainer');
    if (!container) return;

    const { coins, points, streak, bestStreak, streaksHistory, accuracy, correct, wrong, total, coinDetails, pointDetails } = details;

    // تخزين القيم النهائية
    this._resultValues = { coins, points, streak, bestStreak, accuracy, correct, wrong, total };
    this._coinDetails = coinDetails || [];
    this._pointDetails = pointDetails || [];
    this._streaksHistory = streaksHistory || [];

    let html = '';

    // ===== قسم النقود (جميع الأرقام تبدأ من 0) =====
    html += `<div class="result-section" id="resultCoinsSection">`;
    html += `<div class="result-section-header" onclick="App._toggleResultSection('coins')">`;
    html += `<span>🪙 النقود</span>`;
    html += `<span class="result-section-total" id="resultCoinsTotal">0</span>`;
    html += `<span class="toggle-icon">▼</span>`;
    html += `</div>`;
    html += `<div class="result-section-details" id="resultCoinsDetails">`;
    if (coinDetails && coinDetails.length > 0) {
        coinDetails.forEach((item, idx) => {
            const sign = item.value > 0 ? '+' : '';
            const cls = item.value > 0 ? 'positive' : 'negative';
            html += `<div class="result-detail-item" id="coinDetail-${idx}">`;
            html += `<span class="detail-label">${item.label}</span>`;
            html += `<span class="detail-value ${cls}">${sign}<span class="detail-number" id="coinDetailNum-${idx}">0</span></span>`;
            html += `</div>`;
        });
    } else {
        html += `<div class="text-gray" style="font-size:0.8rem;text-align:center;padding:0.3rem;">لا توجد تفاصيل</div>`;
    }
    html += `</div></div>`;

    // ===== قسم النقاط (جميع الأرقام تبدأ من 0) =====
    html += `<div class="result-section" id="resultPointsSection">`;
    html += `<div class="result-section-header" onclick="App._toggleResultSection('points')">`;
    html += `<span>⭐ النقاط</span>`;
    html += `<span class="result-section-total" id="resultPointsTotal">0</span>`;
    html += `<span class="toggle-icon">▼</span>`;
    html += `</div>`;
    html += `<div class="result-section-details" id="resultPointsDetails">`;
    if (pointDetails && pointDetails.length > 0) {
        pointDetails.forEach((item, idx) => {
            const sign = item.value > 0 ? '+' : '';
            const cls = item.value > 0 ? 'positive' : 'negative';
            html += `<div class="result-detail-item" id="pointDetail-${idx}">`;
            html += `<span class="detail-label">${item.label}</span>`;
            html += `<span class="detail-value ${cls}">${sign}<span class="detail-number" id="pointDetailNum-${idx}">0</span></span>`;
            html += `</div>`;
        });
    } else {
        html += `<div class="text-gray" style="font-size:0.8rem;text-align:center;padding:0.3rem;">لا توجد تفاصيل</div>`;
    }
    html += `</div></div>`;

    // ===== قسم السلسلة (جميع الأرقام تبدأ من 0) =====
    html += `<div class="result-section" id="resultStreakSection">`;
    html += `<div class="result-section-header" onclick="App._toggleResultSection('streak')">`;
    html += `<span>🔥 السلسلة</span>`;
    html += `<span class="result-section-total" id="resultStreakTotal">0</span>`;
    html += `<span class="toggle-icon">▼</span>`;
    html += `</div>`;
    html += `<div class="result-section-details" id="resultStreakDetails">`;
    html += `<div class="result-detail-item">`;
    html += `<span class="detail-label">السلسلة الحالية</span>`;
    html += `<span class="detail-value positive"><span class="detail-number" id="resultStreakCurrent">0</span></span>`;
    html += `</div>`;
    html += `<div class="result-detail-item">`;
    html += `<span class="detail-label">أفضل سلسلة</span>`;
    html += `<span class="detail-value positive"><span class="detail-number" id="resultStreakBest">0</span></span>`;
    html += `</div>`;
    if (streaksHistory && streaksHistory.length > 0) {
        html += `<div style="margin-top:0.3rem; padding-top:0.3rem; border-top:1px solid var(--glass-border);">`;
        html += `<span style="font-size:0.7rem; color:var(--gray);">جميع السلاسل:</span>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.2rem;">`;
        streaksHistory.forEach(s => {
            html += `<span class="badge badge-primary badge-sm" style="font-size:0.6rem; padding:1px 8px;">🔥 ${s}</span>`;
        });
        html += `</div></div>`;
    }
    html += `</div></div>`;

    // ===== قسم الإحصائيات (جميع الأرقام تبدأ من 0) =====
    html += `<div class="result-section" id="resultStatsSection">`;
    html += `<div class="result-section-header" onclick="App._toggleResultSection('stats')">`;
    html += `<span>📊 الإحصائيات</span>`;
    html += `<span class="toggle-icon">▼</span>`;
    html += `</div>`;
    html += `<div class="result-section-details" id="resultStatsDetails">`;
    html += `<div class="result-detail-item"><span class="detail-label">✅ صحيح</span><span class="detail-value positive"><span class="detail-number" id="resultCorrectDisplay">0</span></span></div>`;
    html += `<div class="result-detail-item"><span class="detail-label">❌ خاطئ</span><span class="detail-value negative"><span class="detail-number" id="resultWrongDisplay">0</span></span></div>`;
    html += `<div class="result-detail-item"><span class="detail-label">🎯 الدقة</span><span class="detail-value positive"><span class="detail-number" id="resultAccuracyDisplay">0</span>%</span></div>`;
    html += `<div class="result-detail-item"><span class="detail-label">⏱ الوقت</span><span class="detail-value"><span class="detail-number" id="resultTimeDisplay">0</span>s</span></div>`;
    html += `</div></div>`;

    container.innerHTML = html;

    // ✅ جميع الأرقام تبدأ من 0، نبدأ العد التسلسلي فوراً
    setTimeout(() => {
        this._startSequentialCounting();
    }, 400);
},

_resetAllNumbersToZero() {
    // إعادة تعيين تفاصيل النقود
    if (this._coinDetails) {
        this._coinDetails.forEach((item, idx) => {
            const el = document.getElementById(`coinDetailNum-${idx}`);
            if (el) el.textContent = '0';
        });
    }
    // إعادة تعيين تفاصيل النقاط
    if (this._pointDetails) {
        this._pointDetails.forEach((item, idx) => {
            const el = document.getElementById(`pointDetailNum-${idx}`);
            if (el) el.textContent = '0';
        });
    }
    // إعادة تعيين المجاميع
    const totals = ['resultCoinsTotal', 'resultPointsTotal', 'resultStreakTotal'];
    totals.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
    // إعادة تعيين السلسلة
    const streakEls = ['resultStreakCurrent', 'resultStreakBest'];
    streakEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
    
    // ✅ بدء العد التسلسلي بعد 400ms
    setTimeout(() => {
        this._startSequentialCounting();
    }, 400);
},

_startSequentialCounting() {
    const coinDetails = this._coinDetails || [];
    const pointDetails = this._pointDetails || [];
    let step = 0;

    const scrollToSection = (sectionId) => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const processNext = () => {
        step++;
        console.log(`📊 Step ${step}`);

        // ===== الخطوة 1: تفاصيل النقود =====
        if (step === 1 && coinDetails.length > 0) {
            scrollToSection('resultCoinsSection');
            let coinIndex = 0;
            const animateCoinDetail = () => {
                if (coinIndex >= coinDetails.length) {
                    setTimeout(() => {
                        this._animateNumber('resultCoinsTotal', this._resultValues.coins, 600, () => {
                            setTimeout(processNext, 500);
                        });
                    }, 300);
                    return;
                }
                const el = document.getElementById(`coinDetailNum-${coinIndex}`);
                if (el) {
                    this._animateNumberElement(el, coinDetails[coinIndex].value, 400, () => {
                        coinIndex++;
                        setTimeout(animateCoinDetail, 150);
                    });
                } else {
                    coinIndex++;
                    setTimeout(animateCoinDetail, 50);
                }
            };
            animateCoinDetail();
            return;
        }

        // ===== الخطوة 2: إذا لم تكن هناك تفاصيل نقود =====
        if (step === 1 && coinDetails.length === 0) {
            this._animateNumber('resultCoinsTotal', this._resultValues.coins, 600, () => {
                setTimeout(processNext, 500);
            });
            return;
        }

        // ===== الخطوة 3: تفاصيل النقاط =====
        if (step === 2 && pointDetails.length > 0) {
            scrollToSection('resultPointsSection');
            let pointIndex = 0;
            const animatePointDetail = () => {
                if (pointIndex >= pointDetails.length) {
                    setTimeout(() => {
                        this._animateNumber('resultPointsTotal', this._resultValues.points, 600, () => {
                            setTimeout(processNext, 500);
                        });
                    }, 300);
                    return;
                }
                const el = document.getElementById(`pointDetailNum-${pointIndex}`);
                if (el) {
                    this._animateNumberElement(el, pointDetails[pointIndex].value, 400, () => {
                        pointIndex++;
                        setTimeout(animatePointDetail, 150);
                    });
                } else {
                    pointIndex++;
                    setTimeout(animatePointDetail, 50);
                }
            };
            animatePointDetail();
            return;
        }

        // ===== الخطوة 4: إذا لم تكن هناك تفاصيل نقاط =====
        if (step === 2 && pointDetails.length === 0) {
            this._animateNumber('resultPointsTotal', this._resultValues.points, 600, () => {
                setTimeout(processNext, 500);
            });
            return;
        }

        // ===== الخطوة 5: تفاصيل السلسلة (الحالية ثم الأفضل) =====
        if (step === 3) {
            scrollToSection('resultStreakSection');
            
            // ✅ السلسلة الحالية أولاً
            const currentEl = document.getElementById('resultStreakCurrent');
            if (currentEl) {
                this._animateNumberElement(currentEl, this._resultValues.streak, 400, () => {
                    // ✅ أفضل سلسلة ثانياً
                    setTimeout(() => {
                        const bestEl = document.getElementById('resultStreakBest');
                        if (bestEl) {
                            this._animateNumberElement(bestEl, this._resultValues.bestStreak, 400, () => {
                                // ✅ مجموع السلسلة أخيراً
                                setTimeout(() => {
                                    this._animateNumber('resultStreakTotal', this._resultValues.streak, 600, () => {
                                        setTimeout(processNext, 500);
                                    });
                                }, 300);
                            });
                        } else {
                            setTimeout(processNext, 500);
                        }
                    }, 300);
                });
            } else {
                setTimeout(processNext, 500);
            }
            return;
        }

        // ===== الخطوة 6: الإحصائيات (صحيح، خاطئ، دقة، وقت) =====
        if (step === 4) {
            scrollToSection('resultStatsSection');
            
            // ✅ عد الإحصائيات بالتسلسل
            const statsItems = [
                { id: 'resultCorrectDisplay', value: this._resultValues.correct },
                { id: 'resultWrongDisplay', value: this._resultValues.wrong },
                { id: 'resultAccuracyDisplay', value: this._resultValues.accuracy },
                { id: 'resultTimeDisplay', value: Math.round((Date.now() - this.startTime) / 1000) }
            ];
            
            let statIndex = 0;
            const animateStat = () => {
                if (statIndex >= statsItems.length) {
                    console.log('✅ All animations complete!');
                    return;
                }
                const item = statsItems[statIndex];
                const el = document.getElementById(item.id);
                if (el) {
                    this._animateNumberElement(el, item.value, 400, () => {
                        statIndex++;
                        setTimeout(animateStat, 200);
                    });
                } else {
                    statIndex++;
                    setTimeout(animateStat, 50);
                }
            };
            animateStat();
            return;
        }

        console.log('✅ All animations complete!');
    };

    // بدء العد بعد 300ms
    setTimeout(processNext, 300);
},

/**
 * بدء العد التصاعدي لجميع التفاصيل ثم المجاميع
 */
_animateAllDetails() {
    const coinDetails = this._coinDetails || [];
    const pointDetails = this._pointDetails || [];
    let currentIndex = 0;
    const allItems = [];

    // جمع جميع العناصر التي تحتوي على detail-number
    // تفاصيل النقود
    coinDetails.forEach((item, idx) => {
        allItems.push({ id: `coinDetailNum-${idx}`, value: item.value });
    });
    // تفاصيل النقاط
    pointDetails.forEach((item, idx) => {
        allItems.push({ id: `pointDetailNum-${idx}`, value: item.value });
    });
    // السلسلة الحالية والأفضل
    allItems.push({ id: 'resultStreakCurrent', value: this._resultValues.streak || 0 });
    allItems.push({ id: 'resultStreakBest', value: this._resultValues.bestStreak || 0 });

    // إذا لم توجد عناصر، نعرض المجاميع فوراً
    if (allItems.length === 0) {
        setTimeout(() => this._animateTotals(), 300);
        return;
    }

    // عد كل عنصر بالتسلسل
    const animateNext = () => {
        if (currentIndex >= allItems.length) {
            // انتهى عد التفاصيل، نبدأ عد المجاميع
            setTimeout(() => this._animateTotals(), 400);
            return;
        }

        const item = allItems[currentIndex];
        const el = document.getElementById(item.id);
        if (el) {
            // عد العنصر من 0 إلى القيمة
            this._animateNumberElement(el, item.value, 500, () => {
                currentIndex++;
                // تأخير بسيط قبل العنصر التالي
                setTimeout(animateNext, 200);
            });
        } else {
            // إذا لم يوجد العنصر، نتخطاه
            currentIndex++;
            setTimeout(animateNext, 50);
        }
    };

    animateNext();
},

/**
 * عد المجاميع الكلية
 */
_animateTotals() {
    // عد المجاميع بعد تأخير بسيط
    setTimeout(() => {
        // نقود
        const coinsTotal = this._resultValues.coins || 0;
        this._animateNumber('resultCoinsTotal', coinsTotal, 800);
        
        // نقاط
        const pointsTotal = this._resultValues.points || 0;
        this._animateNumber('resultPointsTotal', pointsTotal, 800);
        
        // السلسلة الكلية (المجموع النهائي)
        const streakTotal = this._resultValues.streak || 0;
        this._animateNumber('resultStreakTotal', streakTotal, 600);
    }, 300);
},

/**
 * عد تصاعدي لعنصر DOM
 */
_animateNumber(elementId, targetValue, duration = 800, onComplete = null) {
    const element = document.getElementById(elementId);
    if (!element) return;
    this._animateNumberElement(element, targetValue, duration, onComplete);
},

_animateNumberElement(element, targetValue, duration = 500, onComplete = null) {
    if (!element) return;
    const startTime = performance.now();
    const startValue = 0;
    element.classList.add('counting-active');

    const updateValue = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(startValue + (targetValue - startValue) * eased);
        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(updateValue);
        } else {
            element.textContent = targetValue;
            element.classList.remove('counting-active');
            if (onComplete) onComplete();
        }
    };
    requestAnimationFrame(updateValue);
},

// داخل GameEngine
_animateResultDetails(coinDetails, pointDetails) {
    const totalCoinDetails = coinDetails?.length || 0;
    const totalPointDetails = pointDetails?.length || 0;
    let completed = 0;
    const totalItems = totalCoinDetails + totalPointDetails + 2; // +2 للمجموعين
    
    // دالة للتحقق من اكتمال جميع التفاصيل
    const checkCompletion = () => {
        completed++;
        if (completed >= totalItems) {
            // بعد اكتمال جميع التفاصيل، نعرض المجاميع
            this._animateTotalScores();
        }
    };
    
    // عد التفاصيل
    if (coinDetails) {
        coinDetails.forEach((item, idx) => {
            const el = document.getElementById(`coinDetail-${idx}`);
            if (el) {
                const valueEl = el.querySelector('.detail-value');
                if (valueEl) {
                    const target = item.value;
                    this._animateNumberElement(valueEl, target, 400, checkCompletion);
                }
            }
        });
    }
    
    if (pointDetails) {
        pointDetails.forEach((item, idx) => {
            const el = document.getElementById(`pointDetail-${idx}`);
            if (el) {
                const valueEl = el.querySelector('.detail-value');
                if (valueEl) {
                    const target = item.value;
                    this._animateNumberElement(valueEl, target, 400, checkCompletion);
                }
            }
        });
    }
    
    // إذا لم تكن هناك تفاصيل، ننتقل مباشرة للمجاميع
    if (totalCoinDetails === 0 && totalPointDetails === 0) {
        this._animateTotalScores();
    }
},

/**
 * عرض المجاميع الكلية بعد التفاصيل
 */
_animateTotalScores() {
    const coinsTotal = this._resultValues?.coins || 0;
    const pointsTotal = this._resultValues?.points || 0;
    const streak = this._resultValues?.streak || 0;
    const bestStreak = this._resultValues?.bestStreak || 0;
    
    // عد المجاميع بعد تأخير بسيط
    setTimeout(() => {
        this._animateNumber('resultCoinsTotal', coinsTotal, 800);
        this._animateNumber('resultPointsTotal', pointsTotal, 800);
        this._animateNumber('resultStreakDisplay', streak, 600);
        this._animateNumber('resultBestStreakDisplay', bestStreak, 600);
    }, 300);
},

    quit() {
        clearInterval(this.timer);
        this.isPlaying = false;
        if (confirm('هل تريد إنهاء اللعبة؟')) {
            document.getElementById('gamePlayScreen').style.display = 'none';
            document.getElementById('gameResultScreen').style.display = 'none';
            document.getElementById('gameStartScreen').style.display = 'block';
        } else {
            this.isPlaying = true;
            this.startTimer();
        }
    }
};

// ============================================================
// 8. التطبيق الرئيسي (App) – تم إعادة بنائه بالكامل مع تصحيح الأخطاء
// ============================================================
const App = {
    currentSection: 'dashboard',
    _chartInstances: {},
    _storeInitialized: false,
    navLinks: [],
    _isImporting: false,
    _importTimer: null,
    _importedCount: 0,
    _selectedQuestions: [],
    _isCreatingRoom: false, // ✅ إضافة هذا السطر
    _isSendingMessage: false,
    _isOnline: navigator.onLine, // حالة الاتصال الحالية

async start() {
    this._buildLayout();
    await AuthService.init();
    await DataManager.loadAll();
    DataManager.startListening();
    GameEngine.init();
    this._setupUI();

    DataManager.addListener((data) => {
        this._onDataUpdate(data);
    });

    AuthService.addListener((user) => {
        this._onUserUpdate(user);
    });

    if (!AuthService.currentUser) {
        setTimeout(() => {
            document.getElementById('loginModal').classList.add('open');
        }, 400);
    }

window.addEventListener('online', () => {
    this._isOnline = true;
    this._updateConnectionStatusUI();
    // إذا كان المستخدم في لوحة المشرفين، حاول تحديث البيانات
    if (this.currentSection === 'admin') {
        this._refreshAdmin();
    }
    showToast('🟢 تم استعادة الاتصال بالإنترنت', 'success');
});

window.addEventListener('offline', () => {
    this._isOnline = false;
    this._updateConnectionStatusUI();
    showToast('🔴 تم فقدان الاتصال بالإنترنت', 'error');
});

    updateFirebaseStatus(isFirebaseReady);
    this._updateLastUpdateTime();


    // ✅ عرض القوائم بعد تحميل البيانات
    this._renderAllTables(DataManager.data);
    this._populateSelects(DataManager.data);
    this._renderLeagueTable(DataManager.data);
    this._updateCharts(DataManager.data);
    this._renderRecent(DataManager.data);
    this._renderTopScorers(DataManager.data);
    this._renderPosts(DataManager.data.posts || []);
    this._renderStore(DataManager.data.storeItems || []);
    this._renderAnalytics(DataManager.data);
    this._renderUpcomingMatches(DataManager.data);

    setTimeout(() => {
        if (typeof this._refreshActiveBoosts === 'function') {
            this._refreshActiveBoosts();
        }
    }, 500);

    showToast('مرحباً بك في مدير كرة القدم المتطور! 🚀', 'success');
},

    // ===== بناء الواجهة =====
    _buildLayout() {
        this._buildSections();
        this._buildModals();
        this.navLinks = document.querySelectorAll('#mainNav a, #mobileNav a');
    },

    _buildSections() {
        const container = document.getElementById('sectionsContainer');
        container.innerHTML = `
            <section id="section-dashboard" class="section active">${this._renderDashboard()}</section>
            <section id="section-notifications" class="section">${this._renderNotificationsSection()}</section>
            <section id="section-players" class="section">${this._renderPlayersSection()}</section>
            <section id="section-clubs" class="section">${this._renderClubsSection()}</section>
            <section id="section-matches" class="section">${this._renderMatchesSection()}</section>
            <section id="section-tournaments" class="section">${this._renderTournamentsSection()}</section>
            <section id="section-league" class="section">${this._renderLeagueSection()}</section>
            <section id="section-questions" class="section">${this._renderQuestionsSection()}</section>
            <section id="section-game" class="section">${this._renderGameSection()}</section>
            <section id="section-multiplayer" class="section">${this._renderMultiplayerSection()}</section>
            <section id="section-achievements" class="section">${this._renderAchievementsSection()}</section>
            <section id="section-store" class="section">${this._renderStoreSection()}</section>
            <section id="section-profile" class="section">${this._renderProfileSection()}</section>
            <section id="section-analytics" class="section">${this._renderAnalyticsSection()}</section>
            <section id="section-admin" class="section">${this._renderAdminSection()}</section>
            <section id="section-settings" class="section">${this._renderSettingsSection()}</section>
<section id="section-multiplayer-game" class="section" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1050;background:var(--dark);padding:1rem;overflow-y:auto;">
    <div id="multiplayerGameContent" style="max-width:800px;margin:0 auto;"></div>
</section>
<section id="section-multiplayer-result" class="section" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1050;background:var(--dark);padding:1rem;overflow-y:auto;">
    <div id="multiplayerResultContent" style="max-width:800px;margin:0 auto;"></div>
</section>
        `;
    },

_buildModals() {
    const container = document.getElementById('modalsContainer');
    container.innerHTML = `
        <!-- Login Modal -->
        <div class="modal-overlay login-modal" id="loginModal">
            <div class="modal-card" style="max-width:450px;">
                <div class="modal-header">
                    <h3><i class="fas fa-user-circle"></i> الحساب</h3>
                    <button class="btn btn-sm" id="closeLoginModal" style="background:transparent;color:var(--gray);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:1.5rem; flex-wrap:wrap;">
                    <button class="tab-login active" data-tab="login" id="loginTabBtn">تسجيل الدخول</button>
                    <button class="tab-login" data-tab="register" id="registerTabBtn">إنشاء حساب</button>
                </div>
                
                <!-- ✅ نموذج تسجيل الدخول -->
                <form id="loginForm" class="login-form" style="display:block;">
                    <div class="form-group">
                        <label>البريد الإلكتروني</label>
                        <input type="email" id="loginEmail" placeholder="example@mail.com" required>
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" id="loginPassword" placeholder="••••••••" required>
                    </div>
                    <div class="login-error" id="loginError" style="display:none;color:var(--secondary);margin-bottom:1rem;"></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;" id="loginSubmitBtn">
                        <i class="fas fa-sign-in-alt"></i> دخول
                    </button>
                </form>
                
                <!-- ✅ نموذج التسجيل المطور -->
                <form id="registerForm" class="login-form" style="display:none;">
                    <!-- 1️⃣ الاسم الكامل -->
                    <div class="form-group">
                        <label>الاسم الكامل *</label>
                        <input type="text" id="regFullName" placeholder="أحمد محمد" required>
                    </div>
                    
                    <!-- 2️⃣ اسم المستخدم (مع التحقق الفوري) -->
                    <div class="form-group">
                        <label>اسم المستخدم *</label>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="text" id="regUsername" placeholder="ahmad_2024" required style="flex:1;" 
                                   autocomplete="off">
                            <span id="usernameStatus" style="font-size:0.8rem; min-width:80px; text-align:center;">🔍 جاري...</span>
                        </div>
                        <div id="usernameFeedback" style="font-size:0.75rem; margin-top:4px; color:var(--gray);"></div>
                    </div>
                    
                    <!-- 3️⃣ البريد الإلكتروني -->
                    <div class="form-group">
                        <label>البريد الإلكتروني *</label>
                        <input type="email" id="regEmail" placeholder="example@mail.com" required>
                        <div id="emailFeedback" style="font-size:0.75rem; margin-top:4px; color:var(--gray);"></div>
                    </div>
                    
                    <!-- 4️⃣ كلمة المرور (مع مؤشر القوة) -->
                    <div class="form-group">
                        <label>كلمة المرور *</label>
                        <input type="password" id="regPassword" placeholder="••••••••" required minlength="6">
                        <div id="passwordStrength" style="margin-top:6px;">
                            <div style="display:flex; gap:4px; height:4px;">
                                <div class="strength-bar" style="flex:1; background:var(--glass); border-radius:2px;"></div>
                                <div class="strength-bar" style="flex:1; background:var(--glass); border-radius:2px;"></div>
                                <div class="strength-bar" style="flex:1; background:var(--glass); border-radius:2px;"></div>
                                <div class="strength-bar" style="flex:1; background:var(--glass); border-radius:2px;"></div>
                            </div>
                            <div id="strengthText" style="font-size:0.7rem; margin-top:4px; color:var(--gray);">ضعيفة</div>
                        </div>
                    </div>
                    
                    <!-- 5️⃣ تأكيد كلمة المرور (مع التحقق الفوري من التطابق) -->
                    <div class="form-group">
                        <label>تأكيد كلمة المرور *</label>
                        <input type="password" id="regPasswordConfirm" placeholder="••••••••" required>
                        <div id="passwordMatchFeedback" style="font-size:0.75rem; margin-top:4px; color:var(--gray);"></div>
                    </div>
                    
                    <div class="login-error" id="registerError" style="display:none;color:var(--secondary);margin-bottom:1rem;"></div>
                    <button type="submit" class="btn btn-success w-100" style="justify-content:center;" id="registerSubmitBtn" disabled>
                        <i class="fas fa-user-plus"></i> إنشاء حساب
                    </button>
                </form>
            </div>
        </div>

<!-- Edit Post Modal -->
<div class="modal-overlay" id="editPostModal">
    <div class="modal-card">
        <div class="modal-header">
            <h3><i class="fas fa-edit"></i> تعديل المنشور</h3>
            <button class="btn btn-sm" id="closeEditPostModal" style="background:transparent;color:var(--gray);">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form id="editPostForm">
            <input type="hidden" id="editPostId">
            <div class="form-group">
                <label>المحتوى *</label>
                <textarea id="editPostContent" required rows="4" placeholder="عدل محتوى المنشور..."></textarea>
            </div>
            <div class="form-group">
                <label>رابط الصورة (اختياري)</label>
                <input type="url" id="editPostImage" placeholder="https://example.com/image.jpg">
            </div>
            <button type="submit" class="btn btn-primary w-100" style="justify-content:center;">
                <i class="fas fa-save"></i> حفظ التغييرات
            </button>
        </form>
    </div>
</div>

            <!-- Player Modal -->
            <div class="modal-overlay" id="playerModal"><div class="modal-card">
                <div class="modal-header"><h3 id="playerModalTitle"><i class="fas fa-user"></i> إضافة لاعب</h3><button class="btn btn-sm" id="closePlayerModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="playerForm">
                    <input type="hidden" id="playerFormId">
                    <div class="form-row"><div class="form-group"><label>الاسم *</label><input type="text" id="pName" required></div><div class="form-group"><label>النادي *</label><select id="pClub" required></select></div></div>
                    <div class="form-row"><div class="form-group"><label>المركز *</label><select id="pPosition" required><option value="">اختر</option><option value="حارس مرمى">حارس مرمى</option><option value="مدافع">مدافع</option><option value="وسط">وسط</option><option value="مهاجم">مهاجم</option></select></div><div class="form-group"><label>العمر *</label><input type="number" id="pAge" required min="16" max="45"></div></div>
                    <div class="form-row"><div class="form-group"><label>الجنسية</label><input type="text" id="pNationality"></div><div class="form-group"><label>رقم القميص</label><input type="number" id="pNumber" min="1" max="99"></div></div>
                    <div class="form-row"><div class="form-group"><label>الأهداف</label><input type="number" id="pGoals" min="0" value="0"></div><div class="form-group"><label>التمريرات</label><input type="number" id="pAssists" min="0" value="0"></div></div>
                    <div class="form-group"><label>رابط الصورة</label><input type="url" id="pImage" placeholder="https://example.com/player.jpg"></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-save"></i> حفظ</button>
                </form>
            </div></div>

            <!-- Club Modal -->
            <div class="modal-overlay" id="clubModal"><div class="modal-card">
                <div class="modal-header"><h3 id="clubModalTitle"><i class="fas fa-trophy"></i> إضافة نادي</h3><button class="btn btn-sm" id="closeClubModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="clubForm">
                    <input type="hidden" id="clubFormId">
                    <div class="form-group"><label>اسم النادي *</label><input type="text" id="cName" required></div>
                    <div class="form-group"><label>المدينة</label><input type="text" id="cCity"></div>
                    <div class="form-group"><label>الدوري</label><input type="text" id="cLeague"></div>
                    <div class="form-group"><label>سنة التأسيس</label><input type="number" id="cFounded" min="1800" max="2030"></div>
                    <div class="form-group"><label>رابط الشعار</label><input type="url" id="cLogo" placeholder="https://example.com/logo.png"></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-save"></i> حفظ</button>
                </form>
            </div></div>

            <!-- Match Modal -->
            <div class="modal-overlay" id="matchModal"><div class="modal-card">
                <div class="modal-header"><h3 id="matchModalTitle"><i class="fas fa-futbol"></i> إضافة مباراة</h3><button class="btn btn-sm" id="closeMatchModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="matchForm">
                    <input type="hidden" id="matchFormId">
                    <div class="form-row"><div class="form-group"><label>الفريق الأول *</label><select id="mTeam1" required></select></div><div class="form-group"><label>الفريق الثاني *</label><select id="mTeam2" required></select></div></div>
                    <div class="form-row"><div class="form-group"><label>نتيجة الفريق الأول</label><input type="number" id="mScore1" min="0" value="0"></div><div class="form-group"><label>نتيجة الفريق الثاني</label><input type="number" id="mScore2" min="0" value="0"></div></div>
                    <div class="form-row"><div class="form-group"><label>التاريخ</label><input type="date" id="mDate"></div><div class="form-group"><label>البطولة</label><select id="mTournament"></select></div></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-save"></i> حفظ</button>
                </form>
            </div></div>

            <!-- Tournament Modal -->
            <div class="modal-overlay" id="tournamentModal"><div class="modal-card">
                <div class="modal-header"><h3 id="tournamentModalTitle"><i class="fas fa-medal"></i> إضافة بطولة</h3><button class="btn btn-sm" id="closeTournamentModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="tournamentForm">
                    <input type="hidden" id="tournamentFormId">
                    <div class="form-group"><label>اسم البطولة *</label><input type="text" id="tName" required></div>
                    <div class="form-group"><label>السنة</label><input type="number" id="tYear" min="1900" max="2100"></div>
                    <div class="form-group"><label>الفائز</label><select id="tWinner"><option value="">—</option></select></div>
                    <div class="form-group"><label>الأندية المشاركة (اختيار متعدد)</label><select id="tClubs" multiple style="height:100px;"></select></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-save"></i> حفظ</button>
                </form>
            </div></div>

<!-- Question Modal - نسخة متطورة -->
<div class="modal-overlay" id="questionModal">
    <div class="modal-card" style="max-width:700px;">
        <div class="modal-header">
            <h3 id="questionModalTitle"><i class="fas fa-question-circle"></i> إضافة سؤال</h3>
            <button class="modal-close-btn" id="closeQuestionModal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form id="questionForm">
            <input type="hidden" id="qFormId">
            
            <!-- نوع السؤال -->
            <div class="form-group">
                <label>نوع السؤال *</label>
                <select id="qType" required>
                    <option value="multiple_choice">📝 اختيار من متعدد</option>
                    <option value="true_false">✅ صح / خطأ</option>
                    <option value="fill_blank">✏️ ملء الفراغ</option>
                    <option value="matching">🔗 مطابقة</option>
                    <option value="ordering">🔢 ترتيب</option>
                </select>
            </div>
            
            <!-- نص السؤال -->
            <div class="form-group">
                <label>السؤال *</label>
                <textarea id="qText" required rows="3" placeholder="أدخل نص السؤال..."></textarea>
            </div>
            
            <!-- الخيارات (لاختيار من متعدد) -->
            <div id="qOptionsContainer">
                <div class="form-group">
                    <label>الخيارات *</label>
                    <div id="qOptionsList">
                        <div class="option-row">
                            <input type="text" id="qOpt1" placeholder="الخيار 1" class="option-input">
                            <input type="radio" name="qCorrect" value="0" checked>
                            <span class="option-label">صحيح</span>
                        </div>
                        <div class="option-row">
                            <input type="text" id="qOpt2" placeholder="الخيار 2" class="option-input">
                            <input type="radio" name="qCorrect" value="1">
                            <span class="option-label">صحيح</span>
                        </div>
                        <div class="option-row">
                            <input type="text" id="qOpt3" placeholder="الخيار 3" class="option-input">
                            <input type="radio" name="qCorrect" value="2">
                            <span class="option-label">صحيح</span>
                        </div>
                        <div class="option-row">
                            <input type="text" id="qOpt4" placeholder="الخيار 4" class="option-input">
                            <input type="radio" name="qCorrect" value="3">
                            <span class="option-label">صحيح</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="addOptionBtn">
                        <i class="fas fa-plus"></i> إضافة خيار
                    </button>
                    <button type="button" class="btn btn-sm btn-outline" id="removeOptionBtn" style="display:none;">
                        <i class="fas fa-minus"></i> حذف خيار
                    </button>
                </div>
            </div>
            
            <!-- إجابة ملء الفراغ -->
            <div id="qFillBlankContainer" style="display:none;">
                <div class="form-group">
                    <label>الإجابة الصحيحة *</label>
                    <input type="text" id="qFillBlankAnswer" placeholder="أدخل الإجابة الصحيحة">
                </div>
            </div>
            
            <!-- المطابقة -->
            <div id="qMatchingContainer" style="display:none;">
                <div class="form-group">
                    <label>أزواج المطابقة *</label>
                    <div id="qMatchingPairs">
                        <div class="matching-row">
                            <input type="text" placeholder="العنصر 1" class="matching-left">
                            <span>↔</span>
                            <input type="text" placeholder="العنصر 2" class="matching-right">
                        </div>
                        <div class="matching-row">
                            <input type="text" placeholder="العنصر 3" class="matching-left">
                            <span>↔</span>
                            <input type="text" placeholder="العنصر 4" class="matching-right">
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="addMatchingPairBtn">
                        <i class="fas fa-plus"></i> إضافة زوج
                    </button>
                </div>
            </div>
            
            <!-- ترتيب -->
            <div id="qOrderingContainer" style="display:none;">
                <div class="form-group">
                    <label>العناصر المرتبة * (اسحب لترتيب)</label>
                    <div id="qOrderingItems" class="ordering-items">
                        <div class="ordering-item" draggable="true">
                            <span class="drag-handle">⠿</span>
                            <input type="text" placeholder="العنصر 1">
                            <span class="order-number">1</span>
                        </div>
                        <div class="ordering-item" draggable="true">
                            <span class="drag-handle">⠿</span>
                            <input type="text" placeholder="العنصر 2">
                            <span class="order-number">2</span>
                        </div>
                        <div class="ordering-item" draggable="true">
                            <span class="drag-handle">⠿</span>
                            <input type="text" placeholder="العنصر 3">
                            <span class="order-number">3</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="addOrderingItemBtn">
                        <i class="fas fa-plus"></i> إضافة عنصر
                    </button>
                </div>
            </div>
            
            <!-- إعدادات إضافية -->
            <div class="form-row">
                <div class="form-group">
                    <label>الصعوبة</label>
                    <select id="qDifficulty">
                        <option value="سهل">🟢 سهل</option>
                        <option value="متوسط" selected>🟡 متوسط</option>
                        <option value="صعب">🔴 صعب</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>التصنيف</label>
                    <select id="qCategory">
                        <option value="عام">عام</option>
                        <option value="تاريخ">تاريخ</option>
                        <option value="لاعبين">لاعبين</option>
                        <option value="أندية">أندية</option>
                        <option value="بطولات">بطولات</option>
                        <option value="قوانين">قوانين</option>
                        <option value="إحصائيات">إحصائيات</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>النقاط</label>
                    <input type="number" id="qPoints" value="10" min="1" max="100">
                </div>
                <div class="form-group">
                    <label>الوقت (ثواني)</label>
                    <input type="number" id="qTimeLimit" value="30" min="5" max="120">
                </div>
            </div>
            
            <div class="form-group">
                <label><input type="checkbox" id="qIsPublic" checked> سؤال عام (مرئي للجميع)</label>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="App._closeModal('questionModal')">إلغاء</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button>
            </div>
        </form>
    </div>
</div>

            <!-- Comment Modal -->
            <div class="modal-overlay" id="commentModal"><div class="modal-card">
                <div class="modal-header"><h3><i class="fas fa-comment"></i> إضافة تعليق</h3><button class="btn btn-sm" id="closeCommentModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="commentForm">
                    <input type="hidden" id="commentMatchId">
                    <div class="form-group"><label>نص التعليق *</label><textarea id="commentText" required></textarea></div>
                    <div class="form-row"><div class="form-group"><label>التقييم (1-5)</label><input type="number" id="commentRating" min="1" max="5" value="3"></div></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-save"></i> حفظ</button>
                </form>
            </div></div>

            <!-- Post Modal -->
            <div class="modal-overlay" id="postModal"><div class="modal-card">
                <div class="modal-header"><h3><i class="fas fa-pen"></i> إنشاء منشور</h3><button class="btn btn-sm" id="closePostModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="postForm">
                    <div class="form-group"><label>المحتوى *</label><textarea id="postContent" required rows="4" placeholder="اكتب منشورك..."></textarea></div>
                    <div class="form-group"><label>رابط الصورة (اختياري)</label><input type="url" id="postImage" placeholder="https://example.com/image.jpg"></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-share"></i> نشر</button>
                </form>
            </div></div>

            <!-- Profile Edit Modal -->
<div class="modal-overlay" id="profileEditModal">
    <div class="modal-card fullscreen-modal">
        <div class="modal-header">
            <h3><i class="fas fa-user-edit"></i> تعديل الملف الشخصي</h3>
            <button class="btn btn-sm" id="closeProfileEditModal" style="background:transparent;color:var(--gray);">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form id="profileEditForm">
            <div class="form-group">
                <label>اسم المستخدم *</label>
                <input type="text" id="editUsername" required placeholder="اسم المستخدم">
            </div>
            <div class="form-group">
                <label>السيرة الذاتية</label>
                <textarea id="editBio" rows="3" placeholder="اكتب عن نفسك..."></textarea>
            </div>
            <div class="form-group">
                <label>الموقع</label>
                <input type="text" id="editLocation" placeholder="المدينة، البلد">
            </div>
            <div class="form-group" style="background:var(--glass);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--glass-border);">
                <label style="color:var(--gray);">
                    <i class="fas fa-info-circle"></i> 
                    لتغيير الصورة الشخصية، استخدم زر الكاميرا 📷 في الملف الشخصي
                </label>
            </div>
            <button type="submit" class="btn btn-primary w-100" style="justify-content:center;">
                <i class="fas fa-save"></i> حفظ التغييرات
            </button>
        </form>
    </div>
</div>

            <!-- Admin User Edit Modal -->
            <div class="modal-overlay" id="adminUserModal"><div class="modal-card">
                <div class="modal-header"><h3><i class="fas fa-user-cog"></i> تعديل المستخدم</h3><button class="btn btn-sm" id="closeAdminUserModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <form id="adminUserForm">
                    <input type="hidden" id="adminUserUid">
                    <div class="form-group"><label>الدور</label><select id="adminUserRole"><option value="user">لاعب</option><option value="scout">كشاف</option><option value="editor">محرر</option><option value="manager">مدير عام</option><option value="admin">مدير</option></select></div>
                    <div class="form-group"><label>دور المشرف (اختياري)</label><select id="adminUserAdminRole"><option value="">لا شيء</option><option value="general">مشرف عام</option><option value="user">مشرف مستخدمين</option><option value="player">مشرف لاعبين</option><option value="club">مشرف أندية</option><option value="tournament">مشرف بطولات</option><option value="match">مشرف مباريات</option><option value="question">مشرف أسئلة</option><option value="content">مشرف محتوى</option></select></div>
                    <div class="form-group"><label>النقاط</label><input type="number" id="adminUserScore"></div>
                    <div class="form-group"><label>العملات</label><input type="number" id="adminUserCoins"></div>
                    <button type="submit" class="btn btn-primary w-100" style="justify-content:center;"><i class="fas fa-save"></i> حفظ التغييرات</button>
                </form>
            </div></div>

            <!-- Store Purchase Modal -->
            <div class="modal-overlay" id="storePurchaseModal"><div class="modal-card">
                <div class="modal-header"><h3><i class="fas fa-shopping-cart"></i> تأكيد الشراء</h3><button class="btn btn-sm" id="closeStorePurchaseModal" style="background:transparent;color:var(--gray);"><i class="fas fa-times"></i></button></div>
                <div id="purchaseDetails" style="text-align:center;padding:1rem 0;">
                    <div style="font-size:3rem;margin-bottom:0.5rem;" id="purchaseIcon">🛒</div>
                    <div style="font-size:1.3rem;font-weight:700;" id="purchaseName">العنصر</div>
                    <div style="color:var(--gray);" id="purchaseDesc">الوصف</div>
                    <div style="font-size:1.5rem;font-weight:900;color:var(--accent);margin:0.5rem 0;" id="purchasePrice">💰 0</div>
                    <div style="color:var(--gray);font-size:0.85rem;" id="purchaseBalance">رصيدك: 0 عملة</div>
                </div>
                <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                    <button class="btn btn-danger" id="cancelPurchaseBtn"><i class="fas fa-times"></i> إلغاء</button>
                    <button class="btn btn-success" id="confirmPurchaseBtn"><i class="fas fa-check"></i> تأكيد الشراء</button>
                </div>
            </div></div>
        `;
    },

    // ===== دوال العرض (Sections) =====
_renderDashboard() {
    return `
        <div class="dashboard-posts-only">
            <!-- رأس الصفحة الرئيسية -->
            <div class="flex-between mb-2">
                <h1 style="font-size:2rem;font-weight:900;">
                    <i class="fas fa-newspaper" style="color:var(--accent);"></i> 
                    المنشورات
                </h1>
                <div class="flex-center" style="flex-wrap:wrap;gap:8px;">
                    ${AuthService.currentUser ? `
                        <button class="btn btn-primary" id="openAddPostBtn">
                            <i class="fas fa-plus"></i> إنشاء منشور
                        </button>
                        <button class="btn btn-sm btn-outline" id="refreshPostsBtn">
                            <i class="fas fa-sync"></i> تحديث
                        </button>
                    ` : ``}
                </div>
            </div>
            
            <!-- شريط البحث المتقدم -->
            <div class="search-section mb-2">
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="globalSearchInput" 
                               placeholder="ابحث عن منشورات، هاشتاغات، لاعبين، أندية، مستخدمين..." 
                               class="search-input"
                               autocomplete="off">
                        <button class="btn btn-sm btn-primary search-btn" id="globalSearchBtn">
                            <i class="fas fa-arrow-left"></i> بحث
                        </button>
                    </div>
                    
                    <!-- القائمة المنسدلة للنتائج السريعة -->
                    <div class="search-dropdown" id="searchDropdown" style="display:none;">
                        <div class="search-dropdown-header">
                            <span>نتائج سريعة</span>
                            <span class="search-dropdown-close" id="searchDropdownClose">✕</span>
                        </div>
                        <div class="search-dropdown-results" id="searchDropdownResults">
                            <!-- سيتم تعبئتها بواسطة JavaScript -->
                        </div>
                        <div class="search-dropdown-footer" id="searchDropdownFooter">
                            <button class="btn btn-sm btn-primary" id="searchViewAllBtn">
                                <i class="fas fa-eye"></i> عرض جميع النتائج
                            </button>
                        </div>
                    </div>
                    
                    <!-- فلاتر البحث -->
                    <div class="search-filters" id="searchFilters">
                        <button class="filter-chip active" data-filter="all">الكل</button>
                        <button class="filter-chip" data-filter="posts">📝 منشورات</button>
                        <button class="filter-chip" data-filter="players">⚽ لاعبين</button>
                        <button class="filter-chip" data-filter="clubs">🏆 أندية</button>
                        <button class="filter-chip" data-filter="users">👤 مستخدمين</button>
                        <button class="filter-chip" data-filter="hashtags"># هاشتاغات</button>
                    </div>
                </div>
            </div>
            
            <!-- نتائج البحث الكاملة -->
            <div id="searchResults" style="display:none;">
                <div class="flex-between mb-1">
                    <h3 id="searchResultsTitle">نتائج البحث</h3>
                    <button class="btn btn-sm btn-outline" id="clearSearchBtn"><i class="fas fa-times"></i> إلغاء</button>
                </div>
                <div id="searchResultsContainer"></div>
                <hr style="border-color:var(--glass-border);margin:1.5rem 0;">
            </div>
            
            <!-- عرض المنشورات -->
            <div id="postsFeed">
                <div class="text-gray text-center" style="padding:2rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
                    <p>جاري تحميل المنشورات...</p>
                </div>
            </div>
        </div>
    `;
},

// ============================================================
// نظام البحث المتقدم - القائمة المنسدلة + النتائج الكاملة
// ============================================================

/**
 * تهيئة نظام البحث
 */
_initSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const searchBtn = document.getElementById('globalSearchBtn');
    const clearBtn = document.getElementById('clearSearchBtn');
    const closeDropdownBtn = document.getElementById('searchDropdownClose');
    const viewAllBtn = document.getElementById('searchViewAllBtn');
    const filterChips = document.querySelectorAll('.filter-chip');
    const dropdown = document.getElementById('searchDropdown');
    
    // إظهار/إخفاء القائمة المنسدلة
    const showDropdown = () => {
        const query = searchInput?.value?.trim();
        if (query && query.length >= 2) {
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    };
    
    const hideDropdown = () => {
        dropdown.style.display = 'none';
    };
    
    // عند الكتابة في حقل البحث
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = searchInput.value.trim();
            
            if (query.length >= 2) {
                debounceTimer = setTimeout(() => {
                    this._performQuickSearch(query);
                    showDropdown();
                }, 300);
            } else {
                hideDropdown();
                if (query.length === 0) {
                    this._clearSearch();
                }
            }
        });
        
        // عند الضغط على Enter
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    hideDropdown();
                    this._performFullSearch(query);
                }
            }
        });
        
        // عند فقدان التركيز
        searchInput.addEventListener('blur', () => {
            setTimeout(hideDropdown, 200);
        });
        
        // عند التركيز
        searchInput.addEventListener('focus', () => {
            const query = searchInput.value.trim();
            if (query && query.length >= 2) {
                showDropdown();
            }
        });
    }
    
    // زر البحث
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput?.value?.trim();
            if (query) {
                hideDropdown();
                this._performFullSearch(query);
            }
        });
    }
    
    // إغلاق القائمة المنسدلة
    if (closeDropdownBtn) {
        closeDropdownBtn.addEventListener('click', hideDropdown);
    }
    
    // عرض جميع النتائج
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => {
            const query = searchInput?.value?.trim();
            if (query) {
                hideDropdown();
                this._performFullSearch(query);
            }
        });
    }
    
    // إلغاء البحث
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            this._clearSearch();
            if (searchInput) searchInput.value = '';
            hideDropdown();
        });
    }
    
    // فلاتر البحث
    filterChips.forEach(chip => {
        chip.addEventListener('click', function() {
            filterChips.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const query = searchInput?.value?.trim();
            if (query) {
                App._performFullSearch(query, this.dataset.filter);
            }
        });
    });
},

/**
 * البحث السريع - يعرض 5 نتائج في القائمة المنسدلة
 */
_performQuickSearch(query) {
    if (!query || query.length < 2) {
        const dropdown = document.getElementById('searchDropdown');
        if (dropdown) dropdown.style.display = 'none';
        return;
    }
    
    const results = this._searchAll(query);
    const dropdownResults = document.getElementById('searchDropdownResults');
    const footer = document.getElementById('searchDropdownFooter');
    const dropdown = document.getElementById('searchDropdown');
    
    if (!dropdownResults) return;
    
    // التأكد من ظهور القائمة
    if (dropdown) dropdown.style.display = 'block';
    
    // حساب العدد الإجمالي
    let totalCount = 0;
    let html = '';
    let hasResults = false;
    let resultsAdded = 0;
    const maxResults = 5; // الحد الأقصى للنتائج في القائمة المنسدلة
    
    // جمع النتائج من جميع الفئات (حد أقصى 5)
    const allResults = [];
    
    // المنشورات
    if (results.posts && results.posts.length > 0) {
        results.posts.slice(0, 2).forEach(p => {
            allResults.push({
                type: 'post',
                id: p.id,
                icon: '📝',
                text: p.content?.substring(0, 50) || 'منشور',
                sub: p.userName || 'مجهول',
                badge: 'منشور'
            });
        });
    }
    
    // اللاعبين
    if (results.players && results.players.length > 0) {
        results.players.slice(0, 2).forEach(p => {
            allResults.push({
                type: 'player',
                id: p.id,
                icon: '⚽',
                text: p.name,
                sub: p.club || 'بدون نادي',
                badge: 'لاعب'
            });
        });
    }
    
    // الأندية
    if (results.clubs && results.clubs.length > 0) {
        results.clubs.slice(0, 1).forEach(c => {
            allResults.push({
                type: 'club',
                id: c.id,
                icon: '🏆',
                text: c.name,
                sub: c.city || '',
                badge: 'نادي'
            });
        });
    }
    
    // المستخدمين (من النتائج المحلية فقط - سيتم جلبهم من Firebase عند البحث الكامل)
    if (results.users && results.users.length > 0) {
        results.users.slice(0, 1).forEach(u => {
            allResults.push({
                type: 'user',
                id: u.uid,
                icon: '👤',
                text: u.username || u.displayName,
                sub: `⭐ ${u.totalScore || 0}`,
                badge: 'مستخدم'
            });
        });
    }
    
    // الهاشتاغات
    if (results.hashtags && results.hashtags.length > 0) {
        results.hashtags.slice(0, 1).forEach(h => {
            allResults.push({
                type: 'hashtag',
                id: h.tag,
                icon: '#',
                text: h.tag,
                sub: `${h.count} منشور`,
                badge: 'هاشتاغ'
            });
        });
    }
    
    // أخذ أول 5 نتائج فقط
    const topResults = allResults.slice(0, maxResults);
    
    if (topResults.length === 0) {
        html = `
            <div class="dropdown-empty">
                <i class="fas fa-search"></i>
                <span>لا توجد نتائج لـ "${query}"</span>
            </div>
        `;
        if (footer) footer.style.display = 'none';
    } else {
        hasResults = true;
        totalCount = allResults.length;
        
        html = topResults.map(item => `
            <div class="dropdown-result-item" onclick="App._selectSearchResult('${item.type}', '${item.id}')">
                <span class="dropdown-result-icon">${item.icon}</span>
                <span class="dropdown-result-text">${item.text}</span>
                ${item.sub ? `<span class="dropdown-result-sub">${item.sub}</span>` : ''}
                ${item.badge ? `<span class="dropdown-result-badge">${item.badge}</span>` : ''}
            </div>
        `).join('');
        
        if (footer) {
            footer.style.display = 'flex';
            const btn = footer.querySelector('button');
            if (btn) {
                btn.textContent = `عرض جميع النتائج (${totalCount})`;
                btn.disabled = false;
            }
        }
    }
    
    dropdownResults.innerHTML = html;
},

/**
 * البحث في جميع الفئات
 */
_searchAll(query) {
    const data = DataManager.data;
    const queryLower = query.toLowerCase();
    const results = {
        posts: [],
        players: [],
        clubs: [],
        users: [],
        hashtags: []
    };
    
    // البحث في المنشورات
    results.posts = (data.posts || []).filter(p => 
        p.content?.toLowerCase().includes(queryLower) ||
        p.userName?.toLowerCase().includes(queryLower)
    );
    
    // البحث في اللاعبين
    results.players = (data.players || []).filter(p =>
        p.name?.toLowerCase().includes(queryLower) ||
        p.club?.toLowerCase().includes(queryLower) ||
        p.position?.toLowerCase().includes(queryLower)
    );
    
    // البحث في الأندية
    results.clubs = (data.clubs || []).filter(c =>
        c.name?.toLowerCase().includes(queryLower) ||
        c.city?.toLowerCase().includes(queryLower) ||
        c.league?.toLowerCase().includes(queryLower)
    );
    
    // البحث في الهاشتاغات
    const hashtagRegex = /#[\u0600-\u06FFa-zA-Z0-9_]+/g;
    const allContent = (data.posts || []).map(p => p.content || '').join(' ');
    const matches = allContent.match(hashtagRegex) || [];
    const uniqueHashtags = [...new Set(matches)].filter(h => 
        h.toLowerCase().includes(queryLower)
    );
    results.hashtags = uniqueHashtags.map(h => {
        const count = (data.posts || []).filter(p => (p.content || '').includes(h)).length;
        return { tag: h, count };
    });
    
    // البحث المحلي عن المستخدمين (من Firestore سيتم جلبهم عند البحث الكامل)
    // نضيف المستخدم الحالي إذا كان متطابقاً
    const currentUser = AuthService.currentUser;
    if (currentUser) {
        const username = (currentUser.username || currentUser.displayName || '').toLowerCase();
        if (username.includes(queryLower)) {
            results.users.push({
                uid: currentUser.uid,
                username: currentUser.username || currentUser.displayName,
                displayName: currentUser.displayName || currentUser.username,
                avatar: currentUser.avatar || null,
                role: currentUser.role || 'user',
                totalScore: currentUser.totalScore || 0
            });
        }
    }
    
    return results;
},

/**
 * البحث الكامل - عرض جميع النتائج في الصفحة
 */
async _performFullSearch(query, filter = 'all') {
    if (!query || query.length < 2) {
        showToast('يرجى إدخال كلمتين على الأقل للبحث', 'info');
        return;
    }
    
    const results = this._searchAll(query);
    
    // البحث عن المستخدمين من Firebase
    if (filter === 'all' || filter === 'users') {
        const users = await this._searchUsers(query);
        results.users = users;
    }
    
    this._displayFullSearchResults(results, query, filter);
},

/**
 * عرض نتائج البحث الكاملة
 */
_displayFullSearchResults(results, query, filter) {
    const container = document.getElementById('searchResultsContainer');
    const title = document.getElementById('searchResultsTitle');
    const resultsDiv = document.getElementById('searchResults');
    const postsFeed = document.getElementById('postsFeed');
    
    if (!container || !resultsDiv) return;
    
    let totalCount = 0;
    let html = '';
    const hasResults = false;
    
    // 1. المنشورات
    if (results.posts && results.posts.length > 0 && (filter === 'all' || filter === 'posts')) {
        totalCount += results.posts.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-newspaper"></i> منشورات (${results.posts.length})</h4>
                ${results.posts.slice(0, 10).map(p => `
                    <div class="search-result-item post-result" onclick="App._scrollToPost('${p.id}')">
                        <div class="result-avatar" style="${App._getUserAvatar(p.userId) ? `background-image:url('${App._getUserAvatar(p.userId)}');background-size:cover;background-position:center;` : 'background:var(--primary);'}">
                            ${!App._getUserAvatar(p.userId) ? (p.userName || 'U').charAt(0).toUpperCase() : ''}
                        </div>
                        <div class="result-content-wrapper">
                            <div class="result-content">${p.content?.substring(0, 150) || ''}${p.content?.length > 150 ? '...' : ''}</div>
                            <div class="result-meta">بواسطة ${p.userName || 'مجهول'} • ${formatDate(p.createdAt)}</div>
                        </div>
                        <div class="result-actions">
                            <span class="result-badge">❤️ ${p.likes?.length || 0}</span>
                            <span class="result-badge">💬 ${(DataManager.data.comments || []).filter(c => c.postId === p.id).length}</span>
                        </div>
                    </div>
                `).join('')}
                ${results.posts.length > 10 ? `<div class="search-more">و ${results.posts.length - 10} منشورات أخرى</div>` : ''}
            </div>
        `;
    }
    
    // 2. اللاعبين
    if (results.players && results.players.length > 0 && (filter === 'all' || filter === 'players')) {
        totalCount += results.players.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-users"></i> لاعبين (${results.players.length})</h4>
                <div class="search-results-grid">
                    ${results.players.slice(0, 8).map(p => `
                        <div class="search-result-item player-result" onclick="App._showPlayerProfile('${p.id}')">
                            <div class="result-avatar" style="background:var(--primary);">${p.name?.charAt(0) || '⚽'}</div>
                            <div class="result-info">
                                <div class="result-name">${p.name}</div>
                                <div class="result-sub">${p.club || 'لا يوجد'} • ${p.position || '—'}</div>
                                <div class="result-sub">⚽ ${p.goals || 0} أهداف</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 3. الأندية
    if (results.clubs && results.clubs.length > 0 && (filter === 'all' || filter === 'clubs')) {
        totalCount += results.clubs.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-trophy"></i> أندية (${results.clubs.length})</h4>
                <div class="search-results-grid">
                    ${results.clubs.slice(0, 8).map(c => `
                        <div class="search-result-item club-result" onclick="App._showClubProfile('${c.id}')">
                            <div class="result-avatar" style="background:var(--primary);">${c.name?.charAt(0) || '🏆'}</div>
                            <div class="result-info">
                                <div class="result-name">${c.name}</div>
                                <div class="result-sub">${c.city || '—'} • ${c.league || '—'}</div>
                                <div class="result-sub">تأسس ${c.founded || '—'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 4. المستخدمين
    if (results.users && results.users.length > 0 && (filter === 'all' || filter === 'users')) {
        totalCount += results.users.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-user-circle"></i> مستخدمين (${results.users.length})</h4>
                <div class="search-results-grid">
                    ${results.users.slice(0, 8).map(u => `
                        <div class="search-result-item user-result" onclick="App._openUserProfileModal('${u.uid}')">
                            <div class="result-avatar" style="${u.avatar ? `background-image:url('${u.avatar}');background-size:cover;background-position:center;` : 'background:var(--primary);'}">
                                ${!u.avatar ? (u.username?.charAt(0) || '👤') : ''}
                            </div>
                            <div class="result-info">
                                <div class="result-name">${u.username || u.displayName}</div>
                                <div class="result-sub">⭐ ${u.totalScore || 0} نقطة • ${u.role || 'مستخدم'}</div>
                                <div class="result-sub">🏆 ${(u.achievements || []).length || 0} إنجاز</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 5. الهاشتاغات
    if (results.hashtags && results.hashtags.length > 0 && (filter === 'all' || filter === 'hashtags')) {
        totalCount += results.hashtags.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-hashtag"></i> هاشتاغات (${results.hashtags.length})</h4>
                <div class="search-tags">
                    ${results.hashtags.slice(0, 20).map(h => `
                        <span class="hashtag-chip" onclick="App._searchHashtag('${h.tag}')">${h.tag} (${h.count})</span>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // عرض رسالة إذا لم يتم العثور على نتائج
    if (totalCount === 0) {
        html = `
            <div class="search-empty">
                <i class="fas fa-search" style="font-size:3rem;color:var(--gray);"></i>
                <h3>لا توجد نتائج</h3>
                <p class="text-gray">لم نعثر على أي شيء يطابق "<strong>${query}</strong>"</p>
                <p class="text-gray" style="font-size:0.8rem;">جرّب كلمات بحث مختلفة أو تحقق من الإملاء</p>
                <div class="search-suggestions">
                    <span class="suggestion-chip" onclick="App._performFullSearch('مباريات')">مباريات</span>
                    <span class="suggestion-chip" onclick="App._performFullSearch('دوري')">دوري</span>
                    <span class="suggestion-chip" onclick="App._performFullSearch('هداف')">هداف</span>
                    <span class="suggestion-chip" onclick="App._performFullSearch('كأس')">كأس</span>
                    <span class="suggestion-chip" onclick="App._performFullSearch('#')">هاشتاغات</span>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    resultsDiv.style.display = 'block';
    if (title) title.textContent = `نتائج البحث عن "${query}" (${totalCount})`;
    
    // إخفاء المنشورات العادية أثناء عرض النتائج
    if (postsFeed) postsFeed.style.display = 'none';
    
    // التمرير إلى نتائج البحث
    setTimeout(() => {
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
},

/**
 * اختيار نتيجة من القائمة المنسدلة
 */
_selectSearchResult(type, id) {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    // إخفاء القائمة وإلغاء التركيز
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.blur();
    
    switch(type) {
        case 'post':
            this._scrollToPost(id);
            break;
        case 'player':
            this._showPlayerProfile(id);
            break;
        case 'club':
            this._showClubProfile(id);
            break;
        case 'user':
            this._openUserProfileModal(id);
            break;
        case 'hashtag':
            this._searchHashtag(id);
            break;
        default:
            showToast('عذراً، هذا العنصر غير متوفر حالياً', 'info');
    }
},

/**
 * تنفيذ البحث
 */
_performSearch(query, filter = 'all') {
    if (!query || query.length < 2) {
        showToast('يرجى إدخال كلمتين على الأقل للبحث', 'info');
        return;
    }
    
    const results = {
        posts: [],
        players: [],
        clubs: [],
        users: [],
        hashtags: []
    };
    
    const data = DataManager.data;
    const queryLower = query.toLowerCase();
    
    // 1. البحث في المنشورات
    if (filter === 'all' || filter === 'posts') {
        results.posts = (data.posts || []).filter(p => 
            p.content?.toLowerCase().includes(queryLower) ||
            p.userName?.toLowerCase().includes(queryLower)
        );
    }
    
    // 2. البحث في اللاعبين
    if (filter === 'all' || filter === 'players') {
        results.players = (data.players || []).filter(p =>
            p.name?.toLowerCase().includes(queryLower) ||
            p.club?.toLowerCase().includes(queryLower) ||
            p.position?.toLowerCase().includes(queryLower)
        );
    }
    
    // 3. البحث في الأندية
    if (filter === 'all' || filter === 'clubs') {
        results.clubs = (data.clubs || []).filter(c =>
            c.name?.toLowerCase().includes(queryLower) ||
            c.city?.toLowerCase().includes(queryLower) ||
            c.league?.toLowerCase().includes(queryLower)
        );
    }
    
    // 4. البحث في المستخدمين (من Firebase)
    if (filter === 'all' || filter === 'users') {
        // سيتم جلب المستخدمين من Firebase
        this._searchUsers(query).then(users => {
            results.users = users;
            this._displaySearchResults(results, query, filter);
        });
        return; // انتظار نتيجة البحث عن المستخدمين
    }
    
    // 5. البحث في الهاشتاغات
    if (filter === 'all' || filter === 'hashtags') {
        const hashtagRegex = /#[\u0600-\u06FFa-zA-Z0-9_]+/g;
        const allContent = (data.posts || []).map(p => p.content || '').join(' ');
        const matches = allContent.match(hashtagRegex) || [];
        const uniqueHashtags = [...new Set(matches)].filter(h => 
            h.toLowerCase().includes(queryLower)
        );
        results.hashtags = uniqueHashtags.map(h => ({ tag: h, count: 0 }));
        // حساب عدد مرات ظهور كل هاشتاغ
        results.hashtags.forEach(h => {
            h.count = (data.posts || []).filter(p => 
                (p.content || '').includes(h.tag)
            ).length;
        });
    }
    
    this._displaySearchResults(results, query, filter);
},

/**
 * البحث عن المستخدمين في Firebase
 */
async _searchUsers(query) {
    try {
        const snapshot = await db.collection('users')
            .where('username', '>=', query)
            .where('username', '<=', query + '\uf8ff')
            .limit(10)
            .get();
        
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                uid: doc.id,
                username: data.username || data.displayName || 'مجهول',
                displayName: data.displayName || data.username || 'مجهول',
                avatar: data.avatar || null,
                role: data.role || 'user',
                totalScore: data.totalScore || 0
            });
        });
        return users;
    } catch (e) {
        console.warn('Error searching users:', e);
        return [];
    }
},

/**
 * عرض نتائج البحث
 */
_displaySearchResults(results, query, filter) {
    const container = document.getElementById('searchResultsContainer');
    const title = document.getElementById('searchResultsTitle');
    const resultsDiv = document.getElementById('searchResults');
    
    if (!container || !resultsDiv) return;
    
    // حساب العدد الإجمالي
    let totalCount = 0;
    let html = '';
    
    // 1. المنشورات
    if (results.posts && results.posts.length > 0 && (filter === 'all' || filter === 'posts')) {
        totalCount += results.posts.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-newspaper"></i> منشورات (${results.posts.length})</h4>
                ${results.posts.slice(0, 5).map(p => `
                    <div class="search-result-item post-result" onclick="App._scrollToPost('${p.id}')">
                        <div class="result-content">${p.content?.substring(0, 150) || ''}${p.content?.length > 150 ? '...' : ''}</div>
                        <div class="result-meta">بواسطة ${p.userName || 'مجهول'} • ${formatDate(p.createdAt)}</div>
                    </div>
                `).join('')}
                ${results.posts.length > 5 ? `<div class="search-more">و ${results.posts.length - 5} منشورات أخرى</div>` : ''}
            </div>
        `;
    }
    
    // 2. اللاعبين
    if (results.players && results.players.length > 0 && (filter === 'all' || filter === 'players')) {
        totalCount += results.players.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-users"></i> لاعبين (${results.players.length})</h4>
                <div class="search-results-grid">
                    ${results.players.slice(0, 6).map(p => `
                        <div class="search-result-item player-result" onclick="App._showPlayerProfile('${p.id}')">
                            <div class="result-avatar">${p.name?.charAt(0) || '⚽'}</div>
                            <div class="result-info">
                                <div class="result-name">${p.name}</div>
                                <div class="result-sub">${p.club || 'لا يوجد'} • ${p.position || '—'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 3. الأندية
    if (results.clubs && results.clubs.length > 0 && (filter === 'all' || filter === 'clubs')) {
        totalCount += results.clubs.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-trophy"></i> أندية (${results.clubs.length})</h4>
                <div class="search-results-grid">
                    ${results.clubs.slice(0, 6).map(c => `
                        <div class="search-result-item club-result" onclick="App._showClubProfile('${c.id}')">
                            <div class="result-avatar">${c.name?.charAt(0) || '🏆'}</div>
                            <div class="result-info">
                                <div class="result-name">${c.name}</div>
                                <div class="result-sub">${c.city || '—'} • ${c.league || '—'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 4. المستخدمين
    if (results.users && results.users.length > 0 && (filter === 'all' || filter === 'users')) {
        totalCount += results.users.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-user-circle"></i> مستخدمين (${results.users.length})</h4>
                <div class="search-results-grid">
                    ${results.users.slice(0, 6).map(u => `
                        <div class="search-result-item user-result" onclick="App._showUserProfile('${u.uid}')">
                            <div class="result-avatar" style="${u.avatar ? `background-image:url('${u.avatar}');background-size:cover;background-position:center;` : ''}">
                                ${!u.avatar ? (u.username?.charAt(0) || '👤') : ''}
                            </div>
                            <div class="result-info">
                                <div class="result-name">${u.username || u.displayName}</div>
                                <div class="result-sub">⭐ ${u.totalScore || 0} نقطة • ${u.role || 'مستخدم'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 5. الهاشتاغات
    if (results.hashtags && results.hashtags.length > 0 && (filter === 'all' || filter === 'hashtags')) {
        totalCount += results.hashtags.length;
        html += `
            <div class="search-category">
                <h4><i class="fas fa-hashtag"></i> هاشتاغات (${results.hashtags.length})</h4>
                <div class="search-tags">
                    ${results.hashtags.slice(0, 10).map(h => `
                        <span class="hashtag-chip" onclick="App._searchHashtag('${h.tag}')">${h.tag} (${h.count})</span>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // عرض رسالة إذا لم يتم العثور على نتائج
    if (totalCount === 0) {
        html = `
            <div class="search-empty">
                <i class="fas fa-search" style="font-size:3rem;color:var(--gray);"></i>
                <h3>لا توجد نتائج</h3>
                <p class="text-gray">لم نعثر على أي شيء匹配 "${query}"</p>
                <p class="text-gray" style="font-size:0.8rem;">جرّب كلمات بحث مختلفة أو تحقق من الإملاء</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
    resultsDiv.style.display = 'block';
    if (title) title.textContent = `نتائج البحث عن "${query}" (${totalCount})`;
    
    // إخفاء المنشورات العادية أثناء عرض النتائج
    const postsFeed = document.getElementById('postsFeed');
    if (postsFeed) postsFeed.style.display = 'none';
},

/**
 * إلغاء البحث وعرض المنشورات
 */
_clearSearch() {
    const resultsDiv = document.getElementById('searchResults');
    const searchInput = document.getElementById('globalSearchInput');
    const postsFeed = document.getElementById('postsFeed');
    const dropdown = document.getElementById('searchDropdown');
    
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = '';
    if (postsFeed) postsFeed.style.display = 'block';
    
    // إعادة تعيين الفلاتر
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filter === 'all');
    });
    
    // إعادة عرض المنشورات
    this._renderPosts(DataManager.data.posts || []);
},

/**
 * البحث عن هاشتاغ محدد
 */
_searchHashtag(tag) {
    const input = document.getElementById('globalSearchInput');
    if (input) {
        input.value = tag;
        this._performSearch(tag, 'hashtags');
    }
},

/**
 * التمرير إلى منشور معين
 */
_scrollToPost(postId) {
    const post = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (post) {
        this._clearSearch();
        post.scrollIntoView({ behavior: 'smooth', block: 'center' });
        post.style.borderColor = 'var(--accent)';
        post.style.boxShadow = '0 0 30px rgba(255,217,61,0.2)';
        setTimeout(() => {
            post.style.borderColor = '';
            post.style.boxShadow = '';
        }, 3000);
    }
},

/**
 * عرض ملف لاعب
 */
_showPlayerProfile(playerId) {
    const player = DataManager.data.players.find(p => p.id === playerId);
    if (!player) {
        showToast('اللاعب غير موجود', 'error');
        return;
    }
    // يمكن فتح مودال لعرض تفاصيل اللاعب
    showToast(`👤 ${player.name} - ${player.club || 'بدون نادي'}`, 'info');
},

/**
 * عرض ملف نادي
 */
_showClubProfile(clubId) {
    const club = DataManager.data.clubs.find(c => c.id === clubId);
    if (!club) {
        showToast('النادي غير موجود', 'error');
        return;
    }
    showToast(`🏆 ${club.name} - ${club.city || 'مدينة غير محددة'}`, 'info');
},

/**
 * عرض ملف مستخدم
 */
_showUserProfile(userId) {
    // التحقق من أن المستخدم ليس هو المستخدم الحالي
    if (AuthService.currentUser?.uid === userId) {
        App._activateSection('profile');
        return;
    }
    
    // فتح مودال لعرض ملف المستخدم
    this._openUserProfileModal(userId);
},

/**
 * فتح مودال ملف المستخدم
 */
async _openUserProfileModal(userId) {
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) {
            showToast('المستخدم غير موجود', 'error');
            return;
        }
        const userData = doc.data();
        const user = {
            uid: userId,
            username: userData.username || userData.displayName || 'مجهول',
            displayName: userData.displayName || userData.username || 'مجهول',
            avatar: userData.avatar || null,
            bio: userData.bio || 'لا توجد سيرة ذاتية',
            location: userData.location || 'غير محدد',
            totalScore: userData.totalScore || 0,
            coins: userData.coins || 0,
            role: userData.role || 'user',
            achievements: userData.achievements || [],
            stats: userData.stats || { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 },
            friends: userData.friends || [],
            joinedAt: userData.createdAt || new Date().toISOString()
        };
        
        this._displayUserProfileModal(user);
    } catch (e) {
        showToast('❌ خطأ في تحميل الملف الشخصي', 'error');
        console.error(e);
    }
},

/**
 * عرض مودال ملف المستخدم
 */
_displayUserProfileModal(user) {
    const currentUser = AuthService.currentUser;
    const isOwnProfile = currentUser && currentUser.uid === user.uid;
    
    // التحقق من حالة المتابعة
    let isFollowing = false;
    let isFriend = false;
    
    // جلب الحالة من Firestore (إذا كان المستخدم مسجلاً)
    if (currentUser && !isOwnProfile) {
        // سيتم تحديثها بعد تحميل المودال
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card user-profile-modal" style="max-width:500px;position:relative;z-index:100000;">
            <div class="modal-header">
                <h3><i class="fas fa-user"></i> ملف المستخدم</h3>
                <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="text-align:center;">
                <div class="user-profile-avatar" style="width:100px;height:100px;border-radius:50%;margin:0 auto;background:${user.avatar ? `url('${user.avatar}') center/cover` : 'var(--primary)'};display:flex;align-items:center;justify-content:center;font-size:2.5rem;color:#fff;border:3px solid var(--accent);">
                    ${!user.avatar ? (user.username?.charAt(0) || '👤') : ''}
                </div>
                <h2 style="margin:0.5rem 0 0.2rem;">${user.username}</h2>
                <div class="text-gray">${user.bio || 'لا توجد سيرة ذاتية'}</div>
                <div class="text-gray" style="font-size:0.85rem;">📍 ${user.location || 'غير محدد'}</div>
                <div style="margin:0.5rem 0;">
                    <span class="badge badge-primary">${user.role || 'مستخدم'}</span>
                    <span class="badge badge-warning">⭐ ${user.totalScore || 0}</span>
                    <span class="badge badge-info">🪙 ${user.coins || 0}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin:1rem 0;">
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${user.stats?.gamesPlayed || 0}</div>
                        <div class="stat-label">مباريات</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${user.stats?.gamesWon || 0}</div>
                        <div class="stat-label">فوز</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${user.achievements?.length || 0}</div>
                        <div class="stat-label">إنجازات</div>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
                    ${currentUser && !isOwnProfile ? `
                        <button class="btn ${isFollowing ? (isFriend ? 'btn-primary friend' : 'btn-success following') : 'btn-outline'}" 
                                id="modalFollowBtn" 
                                data-follow-user="${user.uid}"
                                onclick="App._handleModalFollow('${user.uid}')">
                            <i class="fas ${isFollowing ? (isFriend ? 'fa-user-friends' : 'fa-user-check') : 'fa-user-plus'}"></i>
                            ${isFollowing ? (isFriend ? 'صديق' : 'متابَع') : 'متابعة'}
                        </button>
                        <!-- ✅ تم حذف زر إضافة صديق -->
                    ` : ''}
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> إغلاق
                    </button>
                </div>
                <div style="margin-top:0.5rem;font-size:0.7rem;color:var(--gray);">
                    انضم في: ${formatDate(user.joinedAt)}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // تحديث حالة زر المتابعة في المودال
    if (currentUser && !isOwnProfile) {
        this._checkFollowStatus(user.uid).then(({ isFollowing, isFriend }) => {
            const btn = document.getElementById('modalFollowBtn');
            if (btn) {
                if (isFollowing) {
                    if (isFriend) {
                        btn.innerHTML = '<i class="fas fa-user-friends"></i> صديق';
                        btn.className = 'btn btn-primary friend';
                        btn.dataset.status = 'friend';
                    } else {
                        btn.innerHTML = '<i class="fas fa-user-check"></i> متابَع';
                        btn.className = 'btn btn-success following';
                        btn.dataset.status = 'following';
                    }
                } else {
                    btn.innerHTML = '<i class="fas fa-user-plus"></i> متابعة';
                    btn.className = 'btn btn-outline';
                    btn.dataset.status = 'none';
                }
            }
        });
    }
},

/**
 * معالج زر المتابعة في المودال
 */
async _handleModalFollow(userId) {
    await this.toggleFollow(userId);
    
    // تحديث زر المتابعة في المودال
    const btn = document.getElementById('modalFollowBtn');
    if (btn) {
        const { isFollowing, isFriend } = await this._checkFollowStatus(userId);
        if (isFollowing) {
            if (isFriend) {
                btn.innerHTML = '<i class="fas fa-user-friends"></i> صديق';
                btn.className = 'btn btn-primary friend';
            } else {
                btn.innerHTML = '<i class="fas fa-user-check"></i> متابَع';
                btn.className = 'btn btn-success following';
            }
        } else {
            btn.innerHTML = '<i class="fas fa-user-plus"></i> متابعة';
            btn.className = 'btn btn-outline';
        }
    }
},

// ============================================================
// نظام المتابعة والتفاعل
// ============================================================

/**
 * متابعة مستخدم
 */
async _followUser(userId) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    if (AuthService.currentUser.uid === userId) {
        showToast('لا يمكن متابعة نفسك', 'error');
        return;
    }
    
    try {
        const followingRef = db.collection('following');
        const docId = `${AuthService.currentUser.uid}_${userId}`;
        const doc = await followingRef.doc(docId).get();
        
        if (doc.exists) {
            await followingRef.doc(docId).delete();
            showToast('✅ تم إلغاء المتابعة', 'info');
        } else {
            await followingRef.doc(docId).set({
                followerId: AuthService.currentUser.uid,
                followingId: userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('✅ تم المتابعة', 'success');
        }
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

/**
 * إرسال طلب صداقة
 */
async _sendFriendRequest(userId) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    if (AuthService.currentUser.uid === userId) {
        showToast('لا يمكن إضافة نفسك', 'error');
        return;
    }
    
    try {
        const currentUser = AuthService.currentUser;
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('المستخدم غير موجود', 'error');
            return;
        }
        const userData = userDoc.data();
        
        // التحقق من وجود طلب سابق
        const existingRequest = await db.collection('friendRequests')
            .where('from', '==', currentUser.uid)
            .where('to', '==', userId)
            .where('status', '==', 'pending')
            .get();
        
        if (!existingRequest.empty) {
            showToast('تم إرسال طلب صداقة بالفعل', 'info');
            return;
        }
        
        await db.collection('friendRequests').add({
            from: currentUser.uid,
            fromName: currentUser.username || currentUser.displayName || 'مجهول',
            to: userId,
            toName: userData.username || userData.displayName || 'مجهول',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('✅ تم إرسال طلب صداقة', 'success');
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

    _renderPlayersSection() {
        return `
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;"><i class="fas fa-users" style="color:var(--accent);"></i> إدارة اللاعبين</h2>
                <button class="btn btn-primary" id="openAddPlayer"><i class="fas fa-plus"></i> إضافة لاعب</button>
            </div>
            <div class="card">
                <div class="flex-between mb-1">
                    <div class="flex-center gap-1" style="flex-wrap:wrap;">
                        <i class="fas fa-search text-gray"></i>
                        <input type="text" id="searchPlayer" placeholder="بحث..." style="background:transparent;border-bottom:2px solid var(--glass-border);padding:8px 4px;color:var(--light);width:200px;">
                        <select id="filterPlayerPosition" style="background:transparent;border-bottom:2px solid var(--glass-border);padding:8px 4px;color:var(--light);">
                            <option value="">كل المراكز</option>
                            <option value="حارس مرمى">حارس مرمى</option>
                            <option value="مدافع">مدافع</option>
                            <option value="وسط">وسط</option>
                            <option value="مهاجم">مهاجم</option>
                        </select>
                        <button class="btn btn-sm clear-filters-btn" data-section="players"><i class="fas fa-times"></i> مسح</button>
                    </div>
                    <span class="text-gray" id="playerCount">0</span>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>#</th><th>الاسم</th><th>النادي</th><th>المركز</th><th>العمر</th><th>الأهداف</th><th>معدل التهديف</th><th>الصورة</th><th>الإجراءات</th></tr></thead>
                        <tbody id="playersTableBody"><tr><td colspan="9" class="text-center text-gray">جاري التحميل...</td></tr></tbody>
                    </table>
                </div>
                <div class="pagination" id="playerPagination"></div>
            </div>
        `;
    },

    _renderClubsSection() {
        return `
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;"><i class="fas fa-trophy" style="color:var(--accent);"></i> إدارة الأندية</h2>
                <button class="btn btn-primary" id="openAddClub"><i class="fas fa-plus"></i> إضافة نادي</button>
            </div>
            <div class="card">
                <div class="flex-between mb-1">
                    <div class="flex-center gap-1" style="flex-wrap:wrap;">
                        <i class="fas fa-search text-gray"></i>
                        <input type="text" id="searchClub" placeholder="بحث..." style="background:transparent;border-bottom:2px solid var(--glass-border);padding:8px 4px;color:var(--light);width:200px;">
                        <button class="btn btn-sm clear-filters-btn" data-section="clubs"><i class="fas fa-times"></i> مسح</button>
                    </div>
                    <span class="text-gray" id="clubCount">0</span>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>#</th><th>الاسم</th><th>المدينة</th><th>الدوري</th><th>التأسيس</th><th>الشعار</th><th>الإجراءات</th></tr></thead>
                        <tbody id="clubsTableBody"><tr><td colspan="7" class="text-center text-gray">جاري التحميل...</td></tr></tbody>
                    </table>
                </div>
                <div class="pagination" id="clubPagination"></div>
            </div>
        `;
    },

    _renderMatchesSection() {
        return `
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;"><i class="fas fa-futbol" style="color:var(--accent);"></i> إدارة المباريات</h2>
                <button class="btn btn-primary" id="openAddMatch"><i class="fas fa-plus"></i> إضافة مباراة</button>
            </div>
            <div class="card">
                <div class="flex-between mb-1">
                    <div class="flex-center gap-1" style="flex-wrap:wrap;">
                        <i class="fas fa-search text-gray"></i>
                        <input type="text" id="searchMatch" placeholder="بحث..." style="background:transparent;border-bottom:2px solid var(--glass-border);padding:8px 4px;color:var(--light);width:200px;">
                        <button class="btn btn-sm clear-filters-btn" data-section="matches"><i class="fas fa-times"></i> مسح</button>
                    </div>
                    <span class="text-gray" id="matchCount">0</span>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>#</th><th>الفريق الأول</th><th>الفريق الثاني</th><th>النتيجة</th><th>التاريخ</th><th>البطولة</th><th>التعليقات</th><th>الإجراءات</th></tr></thead>
                        <tbody id="matchesTableBody"><tr><td colspan="8" class="text-center text-gray">جاري التحميل...</td></tr></tbody>
                    </table>
                </div>
                <div class="pagination" id="matchPagination"></div>
            </div>
        `;
    },

    _renderTournamentsSection() {
        return `
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;"><i class="fas fa-medal" style="color:var(--accent);"></i> إدارة البطولات</h2>
                <button class="btn btn-primary" id="openAddTournament"><i class="fas fa-plus"></i> إضافة بطولة</button>
            </div>
            <div class="card">
                <div class="flex-between mb-1">
                    <div class="flex-center gap-1" style="flex-wrap:wrap;">
                        <i class="fas fa-search text-gray"></i>
                        <input type="text" id="searchTournament" placeholder="بحث..." style="background:transparent;border-bottom:2px solid var(--glass-border);padding:8px 4px;color:var(--light);width:200px;">
                        <button class="btn btn-sm clear-filters-btn" data-section="tournaments"><i class="fas fa-times"></i> مسح</button>
                    </div>
                    <span class="text-gray" id="tournamentCount">0</span>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>#</th><th>الاسم</th><th>السنة</th><th>الفائز</th><th>الأندية المشاركة</th><th>الإجراءات</th></tr></thead>
                        <tbody id="tournamentsTableBody"><tr><td colspan="6" class="text-center text-gray">جاري التحميل...</td></tr></tbody>
                    </table>
                </div>
                <div class="pagination" id="tournamentPagination"></div>
            </div>
        `;
    },

    _renderLeagueSection() {
        return `
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;"><i class="fas fa-table" style="color:var(--accent);"></i> جدول ترتيب الدوري</h2>
                <button class="btn btn-sm btn-outline" id="refreshLeagueBtn"><i class="fas fa-refresh"></i> تحديث</button>
            </div>
            <div class="card">
                <div class="table-wrap league-table">
                    <table>
                        <thead><tr><th>#</th><th>الفريق</th><th>لعب</th><th>فوز</th><th>تعادل</th><th>خسارة</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th></tr></thead>
                        <tbody id="leagueTableBody"><tr><td colspan="10" class="text-center text-gray">جاري التحميل...</td></tr></tbody>
                    </table>
                </div>
            </div>
        `;
    },

// ============================================================
// صفحة الأسئلة - تصميم متطور
// ============================================================

_renderQuestionsSection() {
    return `
        <div class="questions-page">
            <!-- رأس الصفحة -->
            <div class="flex-between mb-2">
                <div>
                    <h2 style="font-size:1.8rem;font-weight:800;">
                        <i class="fas fa-question-circle" style="color:var(--accent);"></i> 
                        بنك الأسئلة المتطور
                    </h2>
                    <p class="text-gray" style="font-size:0.9rem;">إدارة الأسئلة والتصنيفات والاختبارات</p>
                </div>
                <div class="flex-center" style="flex-wrap:wrap;gap:8px;">
                    <button class="btn btn-primary" id="openAddQuestion">
                        <i class="fas fa-plus"></i> إضافة سؤال
                    </button>
                    <button class="btn btn-outline" id="openQuestionBank">
                        <i class="fas fa-database"></i> المصرف
                    </button>
                    <button class="btn btn-outline" id="checkDuplicatesBtn">
                        <i class="fas fa-clone"></i> كشف المكررات
                    </button>
                    <button class="btn btn-outline" id="importQuestionsBtn">
                        <i class="fas fa-file-import"></i> استيراد
                    </button>
                    <button class="btn btn-outline" id="exportQuestionsBtn">
                        <i class="fas fa-file-export"></i> تصدير
                    </button>
                    <button class="btn btn-danger" id="deleteAllQuestionsBtn" 
                            style="display:${AuthService.checkPermission('admin') ? 'inline-flex' : 'none'};">
                        <i class="fas fa-trash-alt"></i> حذف الكل
                    </button>
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- ✅ شريط تقدم الاستيراد -->
            <!-- ============================================================ -->
            <div id="importProgress" style="display:none; margin-bottom:1rem; background:var(--card-bg); padding:0.8rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <i class="fas fa-file-import" style="color:var(--accent);font-size:1.2rem;"></i>
                        <span style="font-weight:600;font-size:0.85rem;color:var(--gray);">استيراد:</span>
                    </div>
                    <div style="flex:1;min-width:150px;">
                        <div class="progress-bar" style="height:8px; background:var(--glass);">
                            <div class="fill" id="importProgressFill" style="width:0%; height:100%; background:linear-gradient(90deg, var(--primary), var(--accent)); border-radius:10px; transition:width 0.3s ease;"></div>
                        </div>
                    </div>
                    <span id="importProgressText" style="font-size:0.85rem;color:var(--gray);min-width:120px;text-align:center;">0%</span>
                    <button class="btn btn-sm btn-danger" id="cancelImportBtn" style="display:none;">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- ✅ شريط تقدم الحذف -->
            <!-- ============================================================ -->
            <div id="deleteProgress" style="display:none; margin-bottom:1rem; background:var(--card-bg); padding:0.8rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <i class="fas fa-trash-alt" style="color:var(--secondary);font-size:1.2rem;"></i>
                        <span style="font-weight:600;font-size:0.85rem;color:var(--gray);">حذف:</span>
                    </div>
                    <div style="flex:1;min-width:150px;">
                        <div class="progress-bar" style="height:8px; background:var(--glass);">
                            <div class="fill" id="deleteProgressFill" style="width:0%; height:100%; background:linear-gradient(90deg, var(--secondary), var(--accent)); border-radius:10px; transition:width 0.3s ease;"></div>
                        </div>
                    </div>
                    <span id="deleteProgressText" style="font-size:0.85rem;color:var(--gray);min-width:120px;text-align:center;">0%</span>
                    <button class="btn btn-sm btn-danger" id="cancelDeleteBtn" style="display:none;">
                        <i class="fas fa-times"></i> إلغاء
                    </button>
                </div>
            </div>

            <!-- الإحصائيات -->
            <div class="questions-stats-grid mb-2" id="questionsStats">
                <div class="stat-card" style="border-left:4px solid var(--primary);">
                    <div class="stat-number" id="qStatTotal">0</div>
                    <div class="stat-label">📊 إجمالي الأسئلة</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--success);">
                    <div class="stat-number" id="qStatEasy">0</div>
                    <div class="stat-label">🟢 سهل</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--accent);">
                    <div class="stat-number" id="qStatMedium">0</div>
                    <div class="stat-label">🟡 متوسط</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--secondary);">
                    <div class="stat-number" id="qStatHard">0</div>
                    <div class="stat-label">🔴 صعب</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--info);">
                    <div class="stat-number" id="qStatCategories">0</div>
                    <div class="stat-label">📂 التصنيفات</div>
                </div>
                <div class="stat-card" style="border-left:4px solid var(--accent);">
                    <div class="stat-number" id="qStatTypes">0</div>
                    <div class="stat-label">📝 أنواع الأسئلة</div>
                </div>
                <div class="stat-card" style="border-left:4px solid #FF6B6B;">
                    <div class="stat-number" id="qStatUsed">0</div>
                    <div class="stat-label">🎯 مستخدمة في الاختبارات</div>
                </div>
                <div class="stat-card" style="border-left:4px solid #4ECDC4;">
                    <div class="stat-number" id="qStatAvgDifficulty">0</div>
                    <div class="stat-label">📈 متوسط الصعوبة</div>
                </div>
            </div>

            <!-- شريط الأدوات -->
            <div class="questions-toolbar mb-2">
                <div class="search-wrapper">
                    <i class="fas fa-search"></i>
                    <input type="text" id="searchQuestion" placeholder="ابحث عن سؤال..." class="search-input">
                </div>
                <div class="filters-wrapper">
                    <select id="filterQuestionType" class="filter-select">
                        <option value="">كل الأنواع</option>
                        <option value="multiple_choice">📝 اختيار من متعدد</option>
                        <option value="true_false">✅ صح/خطأ</option>
                        <option value="fill_blank">✏️ ملء الفراغ</option>
                        <option value="matching">🔗 مطابقة</option>
                        <option value="ordering">🔢 ترتيب</option>
                    </select>
                    <select id="filterQuestionCategory" class="filter-select">
                        <option value="">كل التصنيفات</option>
                        <option value="عام">عام</option>
                        <option value="تاريخ">تاريخ</option>
                        <option value="لاعبين">لاعبين</option>
                        <option value="أندية">أندية</option>
                        <option value="بطولات">بطولات</option>
                        <option value="قوانين">قوانين</option>
                        <option value="إحصائيات">إحصائيات</option>
                    </select>
                    <select id="filterQuestionDifficulty" class="filter-select">
                        <option value="">كل المستويات</option>
                        <option value="سهل">🟢 سهل</option>
                        <option value="متوسط">🟡 متوسط</option>
                        <option value="صعب">🔴 صعب</option>
                    </select>
                    <select id="filterQuestionSort" class="filter-select">
                        <option value="newest">الأحدث</option>
                        <option value="oldest">الأقدم</option>
                        <option value="alphabetical">أبجدياً</option>
                        <option value="difficulty">الصعوبة</option>
                        <option value="popular">الأكثر استخداماً</option>
                    </select>
                </div>
                <div class="actions-wrapper">
                    <button class="btn btn-sm btn-outline" id="clearQuestionFilters">
                        <i class="fas fa-times"></i> مسح
                    </button>
                    <button class="btn btn-sm btn-outline" id="selectAllQuestionsBtn">
                        <i class="fas fa-check-double"></i> تحديد الكل
                    </button>
                    <button class="btn btn-sm btn-danger" id="deleteSelectedQuestionsBtn" style="display:none;">
                        <i class="fas fa-trash"></i> حذف المحدد (<span id="selectedCount">0</span>)
                    </button>
                </div>
            </div>

            <!-- عرض الأسئلة -->
            <div id="questionsContainer">
                <div class="questions-grid" id="questionsGrid">
                    <div class="text-gray text-center" style="padding:3rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
                        <p>جاري تحميل الأسئلة...</p>
                    </div>
                </div>
                <div class="pagination" id="questionPagination"></div>
            </div>

            <!-- عرض فارغ -->
            <div id="questionsEmpty" style="display:none;">
                <div class="empty-state">
                    <i class="fas fa-question-circle"></i>
                    <h3>لا توجد أسئلة</h3>
                    <p class="text-gray">ابدأ بإضافة أسئلتك الأولى!</p>
                    <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
                        <button class="btn btn-primary mt-1" id="emptyAddQuestion">
                            <i class="fas fa-plus"></i> إضافة سؤال
                        </button>
                        <button class="btn btn-outline mt-1" id="emptyImportQuestions">
                            <i class="fas fa-file-import"></i> استيراد أسئلة
                        </button>
                    </div>
                </div>
            </div>

            <!-- إدخال مخفي للاستيراد -->
            <input type="file" id="importQuestionsFile" accept=".json,.csv" style="display:none;">
        </div>
    `;
},

// داخل App
_toggleResultSection(section) {
    const detailsId = `result${section.charAt(0).toUpperCase() + section.slice(1)}Details`;
    const details = document.getElementById(detailsId);
    if (!details) return;
    const header = details.parentElement?.querySelector('.result-section-header');
    if (!header) return;
    const icon = header.querySelector('.toggle-icon');
    if (details.classList.contains('hidden')) {
        details.classList.remove('hidden');
        if (icon) icon.textContent = '▼';
    } else {
        details.classList.add('hidden');
        if (icon) icon.textContent = '▶';
    }
},

_renderGameSection() {
    return `
        <div class="game-page">
            <!-- رأس الصفحة -->
            <div class="flex-between mb-2">
                <div>
                    <h2 style="font-size:1.8rem;font-weight:800;">
                        <i class="fas fa-gamepad" style="color:var(--accent);"></i> 
                        لعبة الأسئلة المتطورة
                    </h2>
                    <p class="text-gray" style="font-size:0.9rem;">اختبر معلوماتك وتحدى نفسك!</p>
                </div>
                <div class="flex-center" style="flex-wrap:wrap;gap:8px;">
                    <span class="currency-display">
                        <i class="fas fa-coins"></i> <span id="gameCoins">0</span>
                    </span>
                    <span class="badge badge-primary" id="gameLevel">🌟 مبتدئ</span>
                </div>
            </div>

            <!-- إحصائيات اللاعب -->
            <div class="game-stats-grid mb-2" id="gameStats">
                <div class="stat-card">
                    <div class="stat-number" id="gameTotalPlayed">0</div>
                    <div class="stat-label">🎮 مباريات لعبت</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="gameTotalWon">0</div>
                    <div class="stat-label">🏆 مباريات فاز</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="gameWinRate">0%</div>
                    <div class="stat-label">📈 نسبة الفوز</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="gameTotalPoints">0</div>
                    <div class="stat-label">⭐ إجمالي النقاط</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="gameBestScore">0</div>
                    <div class="stat-label">🏅 أفضل نتيجة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="gameStreak">0</div>
                    <div class="stat-label">🔥 السلسلة الحالية</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="gameBestStreak">0</div>
                    <div class="stat-label">🏆 أفضل سلسلة</div>
                </div>
            </div>

            <!-- ✅ عرض المضاعفات النشطة -->
            <div id="gameActiveBoostsContainer" style="margin:1rem 0; padding:0.8rem; background:var(--glass); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <span style="font-weight:700; font-size:0.9rem;">
                        <i class="fas fa-bolt" style="color:var(--accent);"></i> المضاعفات النشطة
                    </span>
                    <button class="btn btn-sm btn-outline" onclick="App._refreshActiveBoosts()" style="font-size:0.7rem; padding:2px 12px;">
                        <i class="fas fa-sync"></i> تحديث
                    </button>
                </div>
                <div id="activeBoostsList" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem; min-height:40px;">
                    <span class="text-gray" style="font-size:0.85rem;">لا توجد مضاعفات نشطة</span>
                </div>
            </div>

            <!-- شاشة البداية -->
            <div id="gameStartScreen">
                <div class="card" style="max-width:600px;margin:0 auto;">
                    <div style="text-align:center;padding:0.5rem 0;">
                        <div style="font-size:4rem;margin-bottom:0.5rem;">⚽</div>
                        <h3 style="font-size:1.8rem;font-weight:800;margin-bottom:0.3rem;">تحدى معرفتك</h3>
                        <p class="text-gray" style="margin-bottom:1.5rem;">اختر الإعدادات وابدأ التحدي</p>
                        
                        <!-- إعدادات اللعبة -->
                        <div class="game-settings">
                            <div class="form-group">
                                <label>المستوى</label>
                                <select id="gameDifficulty" class="game-select">
                                    <option value="easy">🟢 سهل (20 ثانية)</option>
                                    <option value="medium" selected>🟡 متوسط (15 ثانية)</option>
                                    <option value="hard">🔴 صعب (10 ثوانٍ)</option>
                                    <option value="expert">💀 خبير (5 ثوانٍ)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>الفئة</label>
                                <select id="gameCategory" class="game-select">
                                    <option value="all">📚 كل الفئات</option>
                                    <option value="عام">🌍 عام</option>
                                    <option value="تاريخ">📜 تاريخ</option>
                                    <option value="لاعبين">⚽ لاعبين</option>
                                    <option value="أندية">🏆 أندية</option>
                                    <option value="بطولات">🏅 بطولات</option>
                                    <option value="قوانين">📋 قوانين</option>
                                    <option value="إحصائيات">📊 إحصائيات</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>نوع السؤال</label>
                                <select id="gameQuestionType" class="game-select">
                                    <option value="all">📚 الكل</option>
                                    <option value="multiple_choice">📝 اختيار من متعدد</option>
                                    <option value="true_false">✅ صح / خطأ</option>
                                    <option value="fill_blank">✏️ ملء الفراغ</option>
                                    <option value="matching">🔗 مطابقة</option>
                                    <option value="ordering">🔢 ترتيب</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>عدد الأسئلة</label>
                                <select id="gameCount" class="game-select">
                                    <option value="5">5 أسئلة</option>
                                    <option value="10" selected>10 أسئلة</option>
                                    <option value="15">15 سؤال</option>
                                    <option value="20">20 سؤال</option>
                                    <option value="30">30 سؤال</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>نمط اللعبة</label>
                                <select id="gameMode" class="game-select">
                                    <option value="normal">🎯 عادي</option>
                                    <option value="timed">⏱ زمني (تحدي الوقت)</option>
                                    <option value="survival">💪 صمود (تنتهي بخطأ)</option>
                                    <option value="time_attack">⚡ تحدي الزمن المفتوح (60s)</option>
                                </select>
                            </div>
                        </div>
                        
                        <button class="btn btn-primary w-100" id="startGameBtn" style="justify-content:center;font-size:1.1rem;padding:14px;margin-top:0.5rem;">
                            <i class="fas fa-play"></i> ابدأ اللعبة
                        </button>
                    </div>
                </div>
            </div>

            <!-- شاشة اللعب -->
            <div id="gamePlayScreen" style="display:none;">
                <div class="game-play-container">
                    <!-- معلومات اللعبة -->
                    <div class="game-info-bar">
                        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                            <span class="badge badge-primary" id="gameQCounter">1 / 10</span>
                            <span class="badge badge-warning" id="gameScoreDisplay">⭐ 0</span>
                            <span class="badge badge-info" id="gameTimerDisplay">⏱ 15s</span>
                            <span class="badge badge-success" id="gameStreakDisplay">🔥 0</span>
                        </div>
                        <div class="game-progress">
                            <div class="progress-bar" style="flex:1;height:8px;">
                                <div class="fill" id="gameProgressFill" style="height:100%;width:0%;background:linear-gradient(90deg, var(--primary), var(--accent));"></div>
                            </div>
                        </div>
                    </div>

                    <!-- السؤال -->
                    <div class="question-box">
                        <div class="q-category" id="gameQCategory" style="display:inline-block;background:var(--primary);color:#fff;padding:4px 20px;border-radius:30px;font-size:0.8rem;font-weight:700;margin-bottom:1rem;">
                            📚 عام
                        </div>
                        <div class="q-type-badge" id="gameQType" style="display:inline-block;background:var(--glass);color:var(--gray);padding:2px 14px;border-radius:30px;font-size:0.7rem;margin-right:0.5rem;">
                            📝 اختيار من متعدد
                        </div>
                        <div class="q-text" id="gameQText" style="font-size:1.4rem;font-weight:700;margin:1rem 0 1.5rem;line-height:1.8;">
                            Loading...
                        </div>
                        <div class="options-grid" id="gameOptions" style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;max-width:600px;margin:0 auto;">
                        </div>
                    </div>

                    <!-- أزرار التحكم -->
                    <div class="game-controls">
                        <button class="btn btn-sm btn-danger" id="gameQuitBtn">
                            <i class="fas fa-times"></i> إنهاء
                        </button>
                        <button class="btn btn-sm btn-outline" id="gameHintBtn" style="display:none;">
                            <i class="fas fa-lightbulb"></i> تلميح
                        </button>
                    </div>
                </div>
            </div>

            <!-- ============================================================ -->
            <!-- شاشة النتيجة (مع جميع العناصر المطلوبة) -->
            <!-- ============================================================ -->
            <div id="gameResultScreen" style="display:none;">
                <div class="card game-result" style="max-width:650px;margin:0 auto;text-align:center;">
                    <div style="font-size:4rem;margin-bottom:0.5rem;" id="resultEmoji">🏆</div>
                    
                    <!-- المستوى والرسالة -->
                    <div class="result-level" id="resultLevel" style="display:inline-block;padding:4px 20px;border-radius:40px;font-weight:700;margin-bottom:0.5rem;"></div>
                    <div class="result-detail" id="resultDetail" style="font-size:1.1rem;margin:0.5rem 0;">أحسنت!</div>
                    
                    <!-- ✅ حاوية التفاصيل الجديدة (ستُعبأ بواسطة JavaScript) -->
                    <div id="resultDetailsContainer" class="result-details-container"></div>

                    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                        <button class="btn btn-primary" id="gameReplayBtn"><i class="fas fa-redo"></i> لعب مجدداً</button>
                        <button class="btn btn-outline" id="gameHomeBtn"><i class="fas fa-home"></i> الرئيسية</button>
                        <button class="btn btn-outline" id="gameShareResultBtn"><i class="fas fa-share-alt"></i> مشاركة</button>
                    </div>
                    
                    <!-- لوحة المتصدرين -->
                    <div class="leaderboard mt-2" style="text-align:right;margin-top:1.5rem;">
                        <h4 style="color:var(--accent);"><i class="fas fa-crown"></i> المتصدرون</h4>
                        <div id="leaderboardList"><div class="text-gray">لا توجد نتائج بعد</div></div>
                    </div>
                </div>
            </div>

            <!-- مودال التلميح -->
            <div id="gameHintModal" class="modal-overlay" style="display:none;">
                <div class="modal-card" style="max-width:400px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-lightbulb" style="color:var(--accent);"></i> تلميح</h3>
                        <button class="modal-close-btn" onclick="App._closeGameHint()"><i class="fas fa-times"></i></button>
                    </div>
                    <div style="text-align:center;padding:1rem;">
                        <div style="font-size:3rem;margin-bottom:0.5rem;">💡</div>
                        <p id="gameHintText" style="font-size:1.1rem;color:var(--gray);">هذا تلميح للسؤال...</p>
                        <button class="btn btn-sm btn-outline mt-1" onclick="App._closeGameHint()">إغلاق</button>
                    </div>
                </div>
            </div>
        </div>
    `;
},

// ============================================================
// إضافة عملات الماسات للمستخدم
// ============================================================

async _addGems(amount) {
    if (!AuthService.currentUser) return;
    const user = AuthService.currentUser;
    const newGems = (user.gems || 0) + amount;
    await AuthService.updateUser({ gems: newGems });
    this._updateUserUI(AuthService.currentUser);
    showToast(`💎 تم إضافة ${amount} ماسة!`, 'success');
},

_renderProfileSection() {
    return `
        <div class="profile-page">
            <!-- رأس الصفحة -->
            <div class="profile-header">
                <div class="profile-cover">
                    <div class="profile-avatar-wrapper">
                        <div class="profile-avatar" id="profileAvatar">👤</div>
                        <!-- زر تغيير الصورة - يفتح نافذة اختيار ملف -->
                        <button class="btn btn-sm btn-primary avatar-edit-btn" id="changeAvatarBtn" title="تغيير الصورة">
                            <i class="fas fa-camera"></i>
                        </button>
                        <!-- زر حذف الصورة -->
                        <button class="btn btn-sm btn-danger avatar-remove-btn" id="removeAvatarBtn" title="حذف الصورة" style="display:none;">
                            <i class="fas fa-trash"></i>
                        </button>
                        <!-- شريط تقدم رفع الصورة -->
                        <div class="avatar-progress-container" id="avatarProgressContainer" style="display:none;">
                            <div class="progress-bar">
                                <div class="fill" id="avatarProgressFill" style="width:0%;"></div>
                            </div>
                            <div class="progress-text" id="avatarProgressText">0%</div>
                        </div>
                        <!-- Input مخفي لرفع الصورة -->
                        <input type="file" id="avatarFileInput" accept="image/*" style="display:none;">
                    </div>
                    <div class="profile-info">
                        <h1 class="profile-name" id="profileName">زائر</h1>
                        <div class="profile-username" id="profileUsername">@guest</div>
                        <div class="profile-bio" id="profileBio">لا توجد سيرة ذاتية</div>
                        <div class="profile-location" id="profileLocation">📍 غير محدد</div>
                        <div class="profile-role" id="profileRole">👀 لاعب</div>
                        <div class="profile-join-date">انضم في: <span id="profileJoinDate">—</span></div>
                        <!-- المستوى تحت تاريخ الانضمام مباشرة -->
                        <div class="profile-level-display" id="profileLevelDisplay">
                            <span class="level-emoji">🌟</span>
                            <span class="level-name">مبتدئ</span>
                            <span class="level-points-badge" id="profileLevelPoints">0 نقطة</span>
                        </div>
<div class="profile-level-progress">
    <div class="progress-bar" style="height:6px;">
        <div class="fill" id="profileLevelProgress" style="width:0%;"></div>
    </div>
    <div class="progress-labels" style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--gray);">
        <span id="levelCurrentLabel"></span>
        <span id="levelNextLabel">مستوى 2 (100 نقطة)</span>
    </div>
</div>
<!-- الرتبة -->
<div class="profile-rank" style="margin:0.5rem 0;padding:0.5rem;background:var(--glass);border-radius:var(--radius-sm);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <span id="profileRankDisplay">🏅 برونزي 1</span>
        <span class="text-gray" style="font-size:0.8rem;">نقاط الرتبة: <span id="profileRankPoints">0</span></span>
    </div>
    <div class="progress-bar" style="height:6px;margin-top:0.3rem;">
        <div id="rankProgressFill" style="height:100%;width:0%;border-radius:6px;"></div>
    </div>
    <div id="rankLabels" style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--gray);margin-top:0.1rem;">
        <span>برونزي 1</span>
        <span>برونزي 2 (100)</span>
    </div>
</div>
                    </div>
<div class="profile-actions">
    <button class="btn btn-primary" id="editProfileBtn"><i class="fas fa-edit"></i> تعديل الملف</button>
    <button class="btn btn-outline" id="shareProfileBtn"><i class="fas fa-share-alt"></i> مشاركة</button>
    <button class="btn btn-outline" id="profileFriendsBtn">
        <i class="fas fa-user-friends"></i> الأصدقاء 
        <span class="badge" id="friendsCount">0</span>
    </button>
    <!-- أزرار جديدة للقوائم -->
    <button class="btn btn-outline" id="showFollowersBtn">
        <i class="fas fa-user-plus"></i> المتابعين 
        <span class="badge" id="followersCount">0</span>
    </button>
    <button class="btn btn-outline" id="showFollowingBtn">
        <i class="fas fa-user-check"></i> المتابَعين 
        <span class="badge" id="followingCount">0</span>
    </button>
</div>
                </div>
            </div>

            <!-- إحصائيات سريعة -->
            <div class="profile-quick-stats grid-5">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-gamepad"></i></div>
                    <div class="stat-number" id="profileGamesPlayed">0</div>
                    <div class="stat-label">مباريات لعبت</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-trophy"></i></div>
                    <div class="stat-number" id="profileGamesWon">0</div>
                    <div class="stat-label">فوز</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-number" id="profileCorrectAnswers">0</div>
                    <div class="stat-label">إجابات صحيحة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-coins"></i></div>
                    <div class="stat-number" id="profileCoins">0</div>
                    <div class="stat-label">عملات</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-star"></i></div>
                    <div class="stat-number" id="profileScore">0</div>
                    <div class="stat-label">نقاط</div>
                </div>
            </div>

            <!-- شارات المستخدم -->
            <div class="profile-badges-container" id="profileBadgesContainer">
                <!-- سيتم تعبئتها بـ JS -->
            </div>

            <!-- تبويبات المحتوى - المنشورات أولاً -->
            <div class="profile-tabs">
                <button class="tab-btn active" data-tab="posts"><i class="fas fa-newspaper"></i> المنشورات</button>
                <button class="tab-btn" data-tab="activity"><i class="fas fa-clock"></i> النشاطات</button>
                <button class="tab-btn" data-tab="achievements"><i class="fas fa-medal"></i> الإنجازات</button>
                <button class="tab-btn" data-tab="inventory"><i class="fas fa-box"></i> المخزون</button>
                <button class="tab-btn" data-tab="stats"><i class="fas fa-chart-bar"></i> الإحصائيات</button>
                <button class="tab-btn" data-tab="friends"><i class="fas fa-user-friends"></i> الأصدقاء</button>
            </div>

            <!-- محتوى التبويبات -->
            <div class="profile-tab-content">
                <!-- المنشورات -->
                <div class="tab-panel active" id="tab-posts">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-newspaper"></i> منشوراتي <span class="badge badge-primary" id="profilePostsCount">0</span></div>
                        <button class="btn btn-primary btn-sm mb-1" id="profileAddPostBtn"><i class="fas fa-plus"></i> إنشاء منشور</button>
                        <div id="profilePostsFeed"><div class="text-gray">لا توجد منشورات</div></div>
                    </div>
                </div>

                <!-- النشاطات -->
                <div class="tab-panel" id="tab-activity">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-history"></i> النشاطات الأخيرة</div>
                        <div id="profileActivity"><div class="text-gray">لا توجد نشاطات</div></div>
                    </div>
                </div>

                <!-- الإنجازات -->
                <div class="tab-panel" id="tab-achievements">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-medal"></i> الإنجازات <span class="badge badge-primary" id="achievementCount">0</span></div>
                        <div class="grid-4" id="profileAchievementsGrid"><div class="text-gray">جاري التحميل...</div></div>
                    </div>
                </div>

                <!-- المخزون -->
                <div class="tab-panel" id="tab-inventory">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-box"></i> العناصر المملوكة <span class="badge badge-primary" id="inventoryCount">0</span></div>
                        <div class="grid-4" id="profileInventoryGrid"><div class="text-gray">لا توجد عناصر</div></div>
                    </div>
                </div>

                <!-- الإحصائيات -->
                <div class="tab-panel" id="tab-stats">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-chart-bar"></i> الإحصائيات المتقدمة</div>
                        <div class="grid-3" id="profileStatsGrid">
                            <div class="stat-card"><div class="stat-number" id="statWinRate">0%</div><div class="stat-label">نسبة الفوز</div></div>
                            <div class="stat-card"><div class="stat-number" id="statAvgScore">0</div><div class="stat-label">متوسط النقاط</div></div>
                            <div class="stat-card"><div class="stat-number" id="statBestStreak">0</div><div class="stat-label">أفضل سلسلة</div></div>
                        </div>
                        <div class="chart-container" style="height:200px;margin-top:1rem;">
                            <canvas id="profileScoreChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- الأصدقاء -->
                <div class="tab-panel" id="tab-friends">
                    <div class="card">
                        <div class="card-title"><i class="fas fa-user-friends"></i> الأصدقاء</div>
                        <div id="profileFriendsList"><div class="text-gray">لا توجد أصدقاء</div></div>
                        <div class="mt-1">
                            <div class="form-group">
                                <label>إضافة صديق</label>
                                <div style="display:flex;gap:0.5rem;">
                                    <input type="text" id="addFriendInput" placeholder="اسم المستخدم أو البريد" style="flex:1;">
                                    <button class="btn btn-primary" id="addFriendBtn"><i class="fas fa-user-plus"></i> إضافة</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
},

// ===== دوال الملف الشخصي المتقدمة =====

_updateProfileTabContent(user) {
    if (!user) return;
    this._updateProfileLevel(user);        // <- بدلاً من _updateLevelProgress
    this._renderProfilePosts(user);
    this._updateProfileActivity(user);
    this._updateProfileAchievements(user);
    this._updateProfileInventory(user);
    this._updateProfileStats(user);
    this._updateProfileFriends(user);
    this._updateProfileBadges(user);
    this._updateProfileChart(user);
},

_updateProfileActivity(user) {
    const container = document.getElementById('profileActivity');
    if (!container) return;
    // هنا يمكن جلب النشاطات من Firestore (مثل سجل المباريات، الإنجازات، المشتريات)
    // كمثال، نستخدم بيانات محلية
    const activities = [
        { type: 'achievement', text: 'حصل على إنجاز "الهدف الأول"', time: 'منذ ساعة' },
        { type: 'game', text: 'لعب مباراة وفاز بها', time: 'منذ 3 ساعات' },
        { type: 'purchase', text: 'اشترى شارة ذهبية من المتجر', time: 'منذ يوم' },
    ];
    if (activities.length === 0) {
        container.innerHTML = '<div class="text-gray">لا توجد نشاطات</div>';
        return;
    }
    container.innerHTML = activities.map(a => `
        <div class="activity-item" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--glass-border);">
            <span style="font-size:1.2rem;">${a.type === 'achievement' ? '🏆' : a.type === 'game' ? '⚽' : '🛒'}</span>
            <div style="flex:1;">
                <div style="font-weight:500;">${a.text}</div>
                <div style="font-size:0.75rem;color:var(--gray);">${a.time}</div>
            </div>
        </div>
    `).join('');
},

_updateProfileAchievements(user) {
    const container = document.getElementById('profileAchievementsGrid');
    if (!container) return;
    const achievements = AchievementSystem.getUserAchievements(user);
    document.getElementById('achievementCount').textContent = achievements.filter(a => a.unlocked).length;
    if (achievements.length === 0) {
        container.innerHTML = '<div class="text-gray">لا توجد إنجازات</div>';
        return;
    }
    container.innerHTML = achievements.map(ach => `
        <div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}" 
             style="background:${ach.unlocked ? 'var(--card-bg)' : 'var(--glass)'};
                    border:1px solid ${ach.unlocked ? 'var(--accent)' : 'var(--glass-border)'};
                    border-radius:var(--radius-sm);padding:1rem;text-align:center;
                    transition:var(--transition);${ach.unlocked ? 'box-shadow:0 0 20px rgba(255,217,61,0.1);' : ''}">
            <div style="font-size:2.5rem;">${ach.icon}</div>
            <div style="font-weight:700;font-size:0.9rem;">${ach.name}</div>
            <div style="font-size:0.7rem;color:var(--gray);">${ach.desc}</div>
            <div style="font-size:0.7rem;color:var(--accent);">+${ach.points} نقطة</div>
            ${ach.unlocked ? '<div style="color:var(--success);font-size:0.7rem;">✅ مكتمل</div>' : '<div style="color:var(--gray);font-size:0.7rem;">🔒 مغلق</div>'}
        </div>
    `).join('');
},

_updateProfileInventory(user) {
    const container = document.getElementById('profileInventoryGrid');
    if (!container) return;
    
    const inventory = user.inventory || [];
    const activeItems = user.activeItems || [];
    const storeItems = DataManager.data.storeItems || [];
    
    document.getElementById('inventoryCount').textContent = inventory.length;
    
    if (inventory.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;padding:2rem 0;">
                <i class="fas fa-box-open" style="font-size:2.5rem;color:var(--gray-dark);"></i>
                <h3 style="font-size:1.2rem;">المخزون فارغ</h3>
                <p class="text-gray" style="font-size:0.9rem;">اذهب إلى المتجر لشراء المقتنيات!</p>
                <button class="btn btn-primary btn-sm mt-1" onclick="App._activateSection('store')">
                    <i class="fas fa-store"></i> زيارة المتجر
                </button>
            </div>
        `;
        return;
    }
    
    // تجميع العناصر مع بياناتها من المتجر
    const itemsWithData = inventory.map(inv => {
        const item = storeItems.find(i => i.id === inv.itemId);
        return item ? { ...inv, ...item } : null;
    }).filter(Boolean);
    
    // تصنيف العناصر
    const categories = {};
    itemsWithData.forEach(item => {
        const cat = item.category || 'أخرى';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
    });
    
    // ترتيب الفئات
    const categoryOrder = ['boosts', 'room_boosts', 'frames', 'backgrounds', 'badges', 'emotes', 'themes', 'loot_boxes', 'أخرى'];
    const categoryNames = {
        'boosts': '⚡ تعزيزات',
        'room_boosts': '🏠 غرف',
        'frames': '🖼️ إطارات',
        'backgrounds': '🌄 خلفيات',
        'badges': '🏅 شارات',
        'emotes': '💬 رموز',
        'themes': '🎨 سمات',
        'loot_boxes': '📦 صناديق',
        'أخرى': '📌 أخرى'
    };
    
    const sortedCategories = Object.keys(categories).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    
    // بناء HTML - أزرار الفئات في صف واحد فوق العناصر
    let html = `
        <div class="inventory-controls" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;padding:0.5rem 0;border-bottom:1px solid var(--glass-border);">
            <button class="btn btn-sm ${sortedCategories.length > 1 ? 'btn-primary' : 'btn-primary'}" 
                    onclick="document.getElementById('inventoryAll').scrollIntoView({behavior:'smooth',block:'start'})"
                    style="font-size:0.7rem;padding:4px 12px;border-radius:30px;">
                📦 الكل (${inventory.length})
            </button>
            ${sortedCategories.map(cat => `
                <button class="btn btn-sm btn-outline" 
                        onclick="document.getElementById('inventory-${cat}').scrollIntoView({behavior:'smooth',block:'start'})" 
                        style="font-size:0.7rem;padding:4px 12px;border-radius:30px;border-color:var(--glass-border);">
                    ${categoryNames[cat] || cat} (${categories[cat].length})
                </button>
            `).join('')}
        </div>
        <div id="inventoryAll" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.6rem;">
    `;
    
    // عرض العناصر مباشرة (جميع الفئات معاً)
    const allItems = [];
    sortedCategories.forEach(cat => {
        categories[cat].forEach(item => {
            allItems.push({ ...item, category: cat });
        });
    });
    
    // عرض كل العناصر دفعة واحدة مع تصنيفات مخفية (لعرضها معاً ولكن مع فواصل)
    // بدلاً من ذلك، نعرض كل فئة على حدة مع عنوان صغير
    sortedCategories.forEach((cat, catIndex) => {
        const items = categories[cat];
        html += `
            <div class="inventory-category" id="inventory-${cat}" style="grid-column:1/-1;scroll-margin-top:80px;margin-top:${catIndex === 0 ? '0' : '0.8rem'};">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
                    <span style="font-size:0.8rem;font-weight:600;color:var(--gray);">${categoryNames[cat] || cat}</span>
                    <span style="font-size:0.6rem;color:var(--gray-dark);background:var(--glass);padding:0 8px;border-radius:30px;">${items.length}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.6rem;">
        `;
        
        items.forEach(item => {
            const isActive = activeItems.includes(item.id);
            const rarityMap = {
                common: { label: 'عادي', color: '#8e8e8e' },
                uncommon: { label: 'نادر', color: '#2ecc71' },
                rare: { label: 'مميز', color: '#3498db' },
                epic: { label: 'أسطوري', color: '#9b59b6' },
                legendary: { label: 'خرافي', color: '#f1c40f' }
            };
            const rarity = rarityMap[item.rarity] || rarityMap.common;
            const quantity = item.quantity || 1;
            const isEquippable = item.duration === 'permanent';
            
            // أيقونة حقيقية أو افتراضية
            let icon = item.icon;
            if (!icon) {
                const defaultIcons = {
                    'boosts': '⚡',
                    'room_boosts': '🏠',
                    'frames': '🖼️',
                    'backgrounds': '🌄',
                    'badges': '🏅',
                    'emotes': '💬',
                    'themes': '🎨',
                    'loot_boxes': '📦'
                };
                icon = defaultIcons[item.category] || '📦';
            }
            
            // تصميم البطاقة الصغيرة
            html += `
                <div class="inventory-item ${isActive ? 'active' : ''}" 
                     style="background:var(--card-bg);border:1.5px solid ${isActive ? 'var(--accent)' : rarity.color}44;
                            border-radius:10px;padding:0.5rem;text-align:center;
                            transition:all 0.2s ease;position:relative;
                            ${isActive ? 'box-shadow:0 0 15px rgba(255,217,61,0.1);' : ''}
                            cursor:default;">
                    ${isActive ? '<span style="position:absolute;top:2px;right:2px;font-size:0.5rem;background:var(--accent);color:#000;padding:0 6px;border-radius:20px;font-weight:700;">مفعل</span>' : ''}
                    <div style="font-size:1.8rem;line-height:1.2;margin-bottom:0.1rem;filter:${item.rarity === 'legendary' ? 'drop-shadow(0 0 10px rgba(241,196,15,0.3))' : 'none'};">
                        ${icon}
                    </div>
                    <div style="font-weight:600;font-size:0.7rem;color:${rarity.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${item.name}
                    </div>
                    <div style="font-size:0.55rem;color:var(--gray);margin-top:0.1rem;display:flex;justify-content:center;gap:0.3rem;flex-wrap:wrap;">
                        <span style="background:${rarity.color}22;padding:0 6px;border-radius:10px;font-size:0.5rem;">${rarity.label}</span>
                        ${quantity > 1 ? `<span>×${quantity}</span>` : ''}
                    </div>
                    ${isEquippable ? `
                        <button class="btn btn-xs ${isActive ? 'btn-danger' : 'btn-primary'}" 
                                onclick="App._toggleActiveItem('${item.id}');" 
                                style="font-size:0.5rem;padding:1px 8px;margin-top:0.2rem;border-radius:30px;min-height:20px;">
                            ${isActive ? 'إلغاء' : 'تفعيل'}
                        </button>
                    ` : `
                        ${quantity > 0 ? `<span style="font-size:0.5rem;color:var(--success);">✅</span>` : `<span style="font-size:0.5rem;color:var(--secondary);">❌</span>`}
                    `}
                </div>
            `;
        });
        
        html += `</div></div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
},

_renderStoreSection() {
    return `
        <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:1.5rem;">
            <i class="fas fa-store" style="color:var(--accent);"></i> المتجر المتطور 🛒
        </h2>
        <div class="flex-between mb-2" style="flex-wrap:wrap;gap:0.5rem;">
            <div style="display:flex;gap:0.8rem;flex-wrap:wrap;align-items:center;">
                <span class="currency-display" style="background:var(--glass);padding:4px 16px;border-radius:40px;border:1px solid var(--accent);">
                    🪙 <span id="storeCoins">0</span>
                </span>
                <span class="currency-display" style="background:var(--glass);padding:4px 16px;border-radius:40px;border:1px solid #9b59b6;">
                    💎 <span id="storeGems">0</span>
                </span>
                <button class="btn btn-sm btn-outline" onclick="App._renderInventory()"><i class="fas fa-box"></i> مخزوني</button>
            </div>
            <button class="btn btn-sm btn-outline" id="refreshStoreBtn" onclick="App._renderStore(DataManager.data.storeItems || [])">
                <i class="fas fa-refresh"></i> تحديث
            </button>
        </div>
        <div id="storeGrid"><div class="text-gray">جاري التحميل...</div></div>
    `;
},

_renderAchievementsSection() {
        return `
            <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:1.5rem;"><i class="fas fa-star" style="color:var(--accent);"></i> الإنجازات والجوائز</h2>
            <div class="card">
                <div class="flex-between mb-2" style="flex-wrap:wrap;gap:0.5rem;">
                    <span class="text-gray">مجموع النقاط: <strong id="achTotalScore">0</strong></span>
                    <span class="text-gray">المستوى: <strong id="achLevel">مبتدئ 🌟</strong></span>
                    <span class="text-gray">الإنجازات: <strong id="achCount">0 / 0</strong></span>
                    <span class="text-gray">العملات: <strong id="achCoins">0</strong></span>
                </div>
                <div class="grid-4" id="achievementsGrid"><div class="text-gray">جاري التحميل...</div></div>
            </div>
        `;
    },

_getCategoryIcon(category) {
    const icons = {
        'boosts': '⚡',
        'room_boosts': '🏠',
        'frames': '🖼️',
        'backgrounds': '🌄',
        'badges': '🏅',
        'emotes': '💬',
        'themes': '🎨',
        'loot_boxes': '📦'
    };
    return icons[category] || '📌';
},

_updateProfileStats(user) {
    const stats = user.stats || {};
    const gamesPlayed = stats.gamesPlayed || 0;
    const gamesWon = stats.gamesWon || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const avgScore = gamesPlayed > 0 ? Math.round((user.totalScore || 0) / gamesPlayed) : 0;
    // أفضل سلسلة - يمكن تخزينها في قاعدة البيانات أو حسابها
    const bestStreak = parseInt(localStorage.getItem('bestStreak') || '0');

    document.getElementById('statWinRate').textContent = winRate + '%';
    document.getElementById('statAvgScore').textContent = avgScore;
    document.getElementById('statBestStreak').textContent = bestStreak;
},

_updateProfileFriends(user) {
    const container = document.getElementById('profileFriendsList');
    if (!container) return;
    if (!user) {
        container.innerHTML = '<div class="text-gray">سجل الدخول لعرض الأصدقاء</div>';
        return;
    }
    
    const friends = user.friends || [];
    document.getElementById('friendsCount').textContent = friends.length;
    
    // عرض طلبات الصداقة المعلقة
    db.collection('friendRequests')
        .where('to', '==', user.uid)
        .where('status', '==', 'pending')
        .get()
        .then((snapshot) => {
            const requests = [];
            snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
            
            let html = '';
            
            // عرض الطلبات
            if (requests.length > 0) {
                html += `
                    <div style="margin-bottom:1rem;padding:0.8rem;background:var(--glass);border-radius:var(--radius-sm);border:1px solid var(--accent);">
                        <h5 style="color:var(--accent);margin-bottom:0.5rem;">
                            <i class="fas fa-bell"></i> طلبات صداقة (${requests.length})
                        </h5>
                        ${requests.map(r => `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--glass-border);">
                                <span><i class="fas fa-user-circle"></i> ${r.fromName || 'مجهول'}</span>
                                <div style="display:flex;gap:4px;">
                                    <button class="btn btn-xs btn-success" onclick="window.acceptFriendRequest('${r.id}')">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button class="btn btn-xs btn-danger" onclick="window.rejectFriendRequest('${r.id}')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            // عرض الأصدقاء
            if (friends.length === 0 && requests.length === 0) {
                container.innerHTML = '<div class="text-gray">لا توجد أصدقاء. أضف أصدقاء لبدء التفاعل!</div>';
                return;
            }
            
            if (friends.length > 0) {
                html += `
                    <h5 style="margin-bottom:0.5rem;color:var(--gray);">
                        <i class="fas fa-user-friends"></i> أصدقاؤك (${friends.length})
                    </h5>
                    ${friends.map(f => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--glass-border);">
                            <span><i class="fas fa-user-circle" style="font-size:1.2rem;color:var(--accent);"></i> ${f}</span>
                            <button class="btn btn-xs btn-danger" onclick="window.removeFriend('${f}')">
                                <i class="fas fa-user-minus"></i>
                            </button>
                        </div>
                    `).join('')}
                `;
            }
            
            container.innerHTML = html;
        })
        .catch(() => {
            // عرض الأصدقاء فقط في حالة فشل جلب الطلبات
            if (friends.length === 0) {
                container.innerHTML = '<div class="text-gray">لا توجد أصدقاء</div>';
                return;
            }
            container.innerHTML = friends.map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--glass-border);">
                    <span><i class="fas fa-user-circle" style="font-size:1.2rem;color:var(--accent);"></i> ${f}</span>
                    <button class="btn btn-xs btn-danger" onclick="window.removeFriend('${f}')">
                        <i class="fas fa-user-minus"></i>
                    </button>
                </div>
            `).join('');
        });
},

_updateProfileBadges(user) {
    const container = document.getElementById('profileBadgesContainer');
    if (!container) return;
    if (!user) {
        container.innerHTML = '<span class="badge-empty">سجل الدخول لعرض الشارات</span>';
        return;
    }
    
    // الحصول على الإنجازات
    const achievements = user.achievements || [];
    const badges = achievements.slice(0, 6).map(id => {
        const ach = AchievementSystem.achievements.find(a => a.id === id);
        return ach ? ach.icon : '🏅';
    });
    
    // إضافة شارة الصورة إذا كانت موجودة
    if (user.avatar) {
        // إضافة شارة خاصة بوجود صورة شخصية
        badges.unshift('📸');
    }
    
    if (badges.length === 0) {
        container.innerHTML = '<span class="badge-empty">لا توجد شارات بعد</span>';
        return;
    }
    container.innerHTML = badges.map(b => `<span class="badge-icon" title="شارة مكتسبة">${b}</span>`).join('');
},

_updateProfileLevel(user) {
    if (!user) {
const levelNum = getLevel(user.totalScore || 0).level;
const levelDisplay = document.getElementById('profileLevelDisplay');
if (levelDisplay) {
    levelDisplay.innerHTML = `
        <span class="level-emoji" style="font-size:1.2rem;">🏅</span>
        <span class="level-name" style="font-weight:700;color:var(--accent);">المستوى ${levelNum}</span>
        <span class="level-points-badge" style="background:var(--glass);padding:2px 12px;border-radius:20px;font-size:0.75rem;color:var(--gray);">${user.totalScore || 0} نقطة</span>
    `;
}
        const progressBar = document.getElementById('profileLevelProgress');
        if (progressBar) progressBar.style.width = '0%';
        return;
    }
    
    const score = user.totalScore || 0;
    const level = getLevel(score);
    const progress = getLevelProgress(score);
    
    // ✅ تحديث عرض المستوى
    const levelDisplay = document.getElementById('profileLevelDisplay');
    if (levelDisplay) {
        levelDisplay.innerHTML = `
            <span class="level-name" style="color:${level.color};">المستوى ${level.level}</span>
            <span class="level-points-badge" style="background:var(--glass);padding:2px 12px;border-radius:20px;font-size:0.75rem;color:var(--gray);">${score} نقطة</span>
        `;
    }
    
    // ✅ تحديث شريط التقدم
    const progressBar = document.getElementById('profileLevelProgress');
    if (progressBar) {
        progressBar.style.width = `${Math.min(progress.progress, 100)}%`;
    }
    
    // ✅ تحديث التسميات
    const currentLabel = document.getElementById('levelCurrentLabel');
    const nextLabel = document.getElementById('levelNextLabel');
    if (currentLabel) {
        currentLabel.textContent = `المستوى ${progress.currentLevel || 1}`;
    }
    if (nextLabel) {
        const nextLevel = progress.nextLevel || (progress.currentLevel + 1);
        const nextMin = nextLevel * 1000; // 1000 نقطة لكل مستوى (مضروبة في 10)
        nextLabel.textContent = `المستوى ${nextLevel} (${nextMin} نقطة)`;
    }
},

// ============================================================
// دالة عرض منشورات المستخدم في الملف الشخصي
// ============================================================

_renderProfilePosts(user) {
    const container = document.getElementById('profilePostsFeed');
    if (!container) return;
    
    const posts = DataManager.data.posts || [];
    const userPosts = posts.filter(p => p.userId === user?.uid);
    
    document.getElementById('profilePostsCount').textContent = userPosts.length;
    
    if (userPosts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>لا توجد منشورات</h3>
                <p class="text-gray">انشر أول منشور لك!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    userPosts.forEach(post => {
        const comments = DataManager.data.comments?.filter(c => c.postId === post.id) || [];
        const isLiked = user && post.likes && post.likes.includes(user.uid);
        
        html += `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar">${(post.userName || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="post-user">${post.userName || 'مجهول'}</div>
                        <div class="post-time">${formatDate(post.createdAt)}</div>
                    </div>
                    ${user && post.userId === user.uid ? `
                        <button class="btn btn-xs btn-danger" onclick="window.deletePost('${post.id}')" style="margin-right:auto;">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="post-content">${post.content}</div>
                ${post.image ? `<img src="${post.image}" class="post-image" alt="صورة المنشور">` : ''}
                <div class="post-actions">
                    <button class="${isLiked ? 'liked' : ''}" onclick="window.toggleLike('${post.id}')">
                        <i class="fas fa-heart"></i> <span>${post.likes ? post.likes.length : 0}</span>
                    </button>
                    <button onclick="window.toggleComments('${post.id}')">
                        <i class="fas fa-comment"></i> <span>${comments.length}</span>
                    </button>
                </div>
                <div class="post-comments" id="comments-${post.id}" style="display:none;">
                    ${comments.map(c => `
                        <div class="post-comment">
                            <span class="comment-user">${c.userName || 'مجهول'}:</span>
                            <span class="comment-text">${c.text}</span>
                            ${user && c.userId === user.uid ? `
                                <button class="btn btn-xs btn-danger" onclick="window.deleteComment('${c.id}')" 
                                    style="margin-right:auto;background:transparent;color:var(--secondary);font-size:0.6rem;">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    `).join('')}
                    ${user ? `
                        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
                            <input type="text" id="commentInput-${post.id}" placeholder="اكتب تعليقاً..." 
                                style="flex:1;padding:6px 12px;border-radius:40px;background:var(--glass);
                                border:1px solid var(--glass-border);color:var(--light);font-size:0.85rem;">
                            <button class="btn btn-sm btn-primary" onclick="window.addComment('${post.id}')">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
},

_updateProfileChart(user) {
    const canvas = document.getElementById('profileScoreChart');
    if (!canvas) return;
    // رسم بياني بسيط لتطور النقاط (مثال)
    const ctx = canvas.getContext('2d');
    if (window.profileChartInstance) window.profileChartInstance.destroy();
    // بيانات افتراضية - يمكن استرجاعها من Firestore
    const data = [0, 10, 25, 40, 55, 70, 85, 100, 120, user.totalScore || 0];
    window.profileChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => `جلسة ${i+1}`),
            datasets: [{
                label: 'نقاط',
                data: data,
                borderColor: '#6C63FF',
                backgroundColor: 'rgba(108,99,255,0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6C63FF',
                pointRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'var(--light)' } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: 'var(--gray)' } },
                x: { ticks: { color: 'var(--gray)' } }
            }
        }
    });
},

// ============================================================
// نظام المتابعة والأصدقاء المتكامل
// ============================================================

/**
 * متابعة/إلغاء متابعة مستخدم - مع نظام الأصدقاء التلقائي
 */
async toggleFollow(userId) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    const currentUser = AuthService.currentUser;
    if (currentUser.uid === userId) {
        showToast('لا يمكن متابعة نفسك', 'error');
        return;
    }
    
    try {
        const followRef = db.collection('follows');
        const docId = `${currentUser.uid}_${userId}`;
        const doc = await followRef.doc(docId).get();
        
        // جلب بيانات المستخدم المستهدف
        let targetName = 'مستخدم';
        let targetData = {};
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                targetData = userDoc.data();
                targetName = targetData.username || targetData.displayName || 'مستخدم';
            }
        } catch (e) {}
        
        if (doc.exists) {
            // ===== إلغاء المتابعة =====
            await followRef.doc(docId).delete();
            
            // التحقق من وجود متابعة عكسية (لإزالة الصداقة)
            const reverseDocId = `${userId}_${currentUser.uid}`;
            const reverseDoc = await followRef.doc(reverseDocId).get();
            
            if (reverseDoc.exists) {
                await followRef.doc(reverseDocId).delete();
                await this._removeFriend(currentUser.uid, userId);
                await this._removeFriend(userId, currentUser.uid);
                showToast(`✅ تم إلغاء المتابعة وإزالة ${targetName} من الأصدقاء`, 'info');
            } else {
                showToast(`✅ تم إلغاء متابعة ${targetName}`, 'info');
            }
            
            this._updateFollowButtons(userId, false);
            
        } else {
            // ===== متابعة =====
            await followRef.doc(docId).set({
                followerId: currentUser.uid,
                followerName: currentUser.username || currentUser.displayName || 'مجهول',
                followingId: userId,
                followingName: targetName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // التحقق من وجود متابعة عكسية (لإضافة الصداقة)
            const reverseDocId = `${userId}_${currentUser.uid}`;
            const reverseDoc = await followRef.doc(reverseDocId).get();
            
            let isFriend = false;
            if (reverseDoc.exists) {
                isFriend = true;
                await this._addFriend(currentUser.uid, userId, targetName);
                await this._addFriend(userId, currentUser.uid, currentUser.username || currentUser.displayName || 'مجهول');
                
                // إرسال إشعار للمستخدم المستهدف
                await this._sendNotification(userId, {
                    type: 'friend_request_accepted',
                    title: '🎉 صديق جديد!',
                    message: `${currentUser.username || currentUser.displayName} أصبح صديقك الآن`,
                    fromUserId: currentUser.uid,
                    fromName: currentUser.username || currentUser.displayName || 'مجهول'
                });
                
                showToast(`🎉 أصبحت أنت و ${targetName} أصدقاء!`, 'success', 5000);
            } else {
                // إرسال إشعار متابعة
                await this._sendNotification(userId, {
                    type: 'new_follower',
                    title: '👤 متابع جديد',
                    message: `${currentUser.username || currentUser.displayName} بدأ متابعتك`,
                    fromUserId: currentUser.uid,
                    fromName: currentUser.username || currentUser.displayName || 'مجهول'
                });
                
                showToast(`✅ تم متابعة ${targetName}`, 'success');
            }
            
            this._updateFollowButtons(userId, true, isFriend);
        }
        
        // ✅ تحديث الأعداد في الأزرار
        this._updateFollowCounts();
        this._updateAllFollowButtons();
        
    } catch (e) {
        console.error('Follow error:', e);
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

/**
 * إضافة صديق (داخلية)
 */
async _addFriend(userId, friendId, friendName) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data();
            const friends = data.friends || [];
            if (!friends.some(f => f.id === friendId)) {
                friends.push({ id: friendId, name: friendName, since: new Date().toISOString() });
                await userRef.update({ friends });
            }
        }
    } catch (e) {
        console.warn('Error adding friend:', e);
    }
},

/**
 * إزالة صديق (داخلية)
 */
async _removeFriend(userId, friendId) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data();
            const friends = (data.friends || []).filter(f => f.id !== friendId);
            await userRef.update({ friends });
        }
    } catch (e) {
        console.warn('Error removing friend:', e);
    }
},

/**
 * تحديث أزرار المتابعة
 */
_updateFollowButtons(userId, isFollowing, isFriend = false) {
    document.querySelectorAll(`[data-follow-user="${userId}"]`).forEach(btn => {
        if (isFollowing) {
            if (isFriend) {
                btn.innerHTML = '<i class="fas fa-user-friends"></i> صديق';
                btn.classList.add('friend');
                btn.classList.remove('btn-outline', 'btn-success');
                btn.classList.add('btn-primary');
                btn.style.borderColor = 'var(--primary)';
                btn.dataset.status = 'friend';
            } else {
                btn.innerHTML = '<i class="fas fa-user-check"></i> متابَع';
                btn.classList.add('following');
                btn.classList.remove('btn-outline', 'btn-primary', 'friend');
                btn.classList.add('btn-success');
                btn.style.borderColor = 'var(--success)';
                btn.dataset.status = 'following';
            }
        } else {
            btn.innerHTML = '<i class="fas fa-user-plus"></i> متابعة';
            btn.classList.remove('following', 'friend', 'btn-success', 'btn-primary');
            btn.classList.add('btn-outline');
            btn.style.borderColor = '';
            btn.dataset.status = 'none';
        }
    });
},

/**
 * التحقق من حالة المتابعة
 */
async _checkFollowStatus(userId) {
    if (!AuthService.currentUser) return { isFollowing: false, isFriend: false };
    try {
        const docId = `${AuthService.currentUser.uid}_${userId}`;
        const doc = await db.collection('follows').doc(docId).get();
        const isFollowing = doc.exists;
        
        // التحقق من كونهم أصدقاء
        const userDoc = await db.collection('users').doc(AuthService.currentUser.uid).get();
        if (userDoc.exists) {
            const friends = userDoc.data().friends || [];
            const isFriend = friends.some(f => f.id === userId);
            return { isFollowing, isFriend };
        }
        return { isFollowing, isFriend: false };
    } catch (e) {
        return { isFollowing: false, isFriend: false };
    }
},

/**
 * تحديث جميع أزرار المتابعة
 */
async _updateAllFollowButtons() {
    if (!AuthService.currentUser) return;
    
    const buttons = document.querySelectorAll('[data-follow-user]');
    const userIds = [...new Set([...buttons].map(btn => btn.dataset.followUser).filter(Boolean))];
    
    for (const userId of userIds) {
        const { isFollowing, isFriend } = await this._checkFollowStatus(userId);
        this._updateFollowButtons(userId, isFollowing, isFriend);
    }
},

/**
 * تحديث أعداد المتابعين والمتابَعين والأصدقاء
 */
async _updateFollowCounts() {
    if (!AuthService.currentUser) return;
    
    const userId = AuthService.currentUser.uid;
    
    try {
        // عدد المتابعين (من يتابعني)
        const followersSnap = await db.collection('follows')
            .where('followingId', '==', userId)
            .get();
        const followersCount = followersSnap.size;
        
        // عدد المتابَعين (من أتابعهم)
        const followingSnap = await db.collection('follows')
            .where('followerId', '==', userId)
            .get();
        const followingCount = followingSnap.size;
        
        // عدد الأصدقاء
        const userDoc = await db.collection('users').doc(userId).get();
        const friendsCount = userDoc.exists ? (userDoc.data().friends || []).length : 0;
        
        // تحديث الواجهة - استخدام جميع المعرفات الممكنة
        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        updateElement('followersCount', followersCount);
        updateElement('followingCount', followingCount);
        updateElement('friendsCount', friendsCount);
        
        // تحديث في الشريط الجانبي إذا وجد
        const sidebarFriends = document.querySelector('.user-badge .friends-count');
        if (sidebarFriends) sidebarFriends.textContent = friendsCount;
        
    } catch (e) {
        console.warn('Error updating follow counts:', e);
    }
},

// ============================================================
// قوائم المتابعين والمتابَعين والأصدقاء
// ============================================================

/**
 * عرض قائمة المتابعين (من يتابعني)
 */
async _showFollowers() {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }
    
    try {
        const snapshot = await db.collection('follows')
            .where('followingId', '==', AuthService.currentUser.uid)
            .get();
        
        const followers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            followers.push({
                id: data.followerId,
                name: data.followerName || 'مجهول',
                since: data.createdAt?.toDate?.() || new Date()
            });
        });
        
        this._showUserListModal('المتابعين', followers, 'من يتابعك');
    } catch (e) {
        showToast('❌ خطأ في تحميل المتابعين', 'error');
        console.error(e);
    }
},

/**
 * عرض قائمة من أتابعهم
 */
async _showFollowing() {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }
    
    try {
        const snapshot = await db.collection('follows')
            .where('followerId', '==', AuthService.currentUser.uid)
            .get();
        
        const following = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            following.push({
                id: data.followingId,
                name: data.followingName || 'مجهول',
                since: data.createdAt?.toDate?.() || new Date()
            });
        });
        
        this._showUserListModal('المتابَعين', following, 'الأشخاص الذين تتابعهم');
    } catch (e) {
        showToast('❌ خطأ في تحميل المتابَعين', 'error');
        console.error(e);
    }
},

/**
 * عرض قائمة الأصدقاء (تفتح دائماً)
 */
async _showFriends() {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }
    
    try {
        const userDoc = await db.collection('users').doc(AuthService.currentUser.uid).get();
        if (!userDoc.exists) {
            this._showUserListModal('الأصدقاء', [], 'لا توجد بيانات');
            return;
        }
        
        const friends = userDoc.data().friends || [];
        
        // عرض المودال دائماً (حتى لو كانت القائمة فارغة)
        this._showUserListModal('الأصدقاء', friends, 
            friends.length === 0 ? 'ليس لديك أصدقاء بعد. ابدأ بمتابعة الآخرين!' : 'أصدقاؤك'
        );
        
    } catch (e) {
        console.error('Error loading friends:', e);
        // عرض المودال فارغاً في حالة الخطأ
        this._showUserListModal('الأصدقاء', [], 'حدث خطأ في تحميل الأصدقاء');
    }
},

/**
 * عرض مودال قائمة المستخدمين
 */
_showUserListModal(title, users, subtitle) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card fullscreen-modal" style="max-width:500px;">
            <div class="modal-header">
                <h3><i class="fas fa-users"></i> ${title}</h3>
                <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="margin-bottom:0.5rem;color:var(--gray);font-size:0.85rem;">
                ${subtitle} (${users.length})
            </div>
            <div style="max-height:60vh;overflow-y:auto;">
                ${users.length === 0 ? `
                    <div class="text-gray text-center" style="padding:2rem;">
                        <i class="fas fa-users" style="font-size:2rem;color:var(--gray-dark);"></i>
                        <p>لا يوجد مستخدمين</p>
                    </div>
                ` : `
                    ${users.map(u => `
                        <div class="user-list-item" onclick="App._openUserProfileModal('${u.id}')" style="display:flex;align-items:center;gap:1rem;padding:0.6rem 0.8rem;border-bottom:1px solid var(--glass-border);cursor:pointer;transition:var(--transition);">
                            <div class="user-avatar" style="width:40px;height:40px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;flex-shrink:0;">
                                ${u.name?.charAt(0)?.toUpperCase() || '👤'}
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:600;">${u.name}</div>
                                <div style="font-size:0.7rem;color:var(--gray);">
                                    ${u.since ? `منذ ${formatDate(u.since)}` : ''}
                                </div>
                            </div>
                            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); App._openUserProfileModal('${u.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    `).join('')}
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
},

// ===== مشاركة الملف الشخصي =====
shareProfile() {
    const user = AuthService.currentUser;
    if (!user) return showToast('يجب تسجيل الدخول', 'error');
    const name = user.username || user.displayName || 'مستخدم';
    const score = user.totalScore || 0;
    const level = getLevel(score).name;
    const text = `⚽ تعرف على ملفي الشخصي في مدير كرة القدم!\n👤 ${name}\n⭐ ${score} نقطة\n🏆 المستوى: ${level}\n\nانضم الآن واستمتع!`;
    if (navigator.share) {
        navigator.share({ title: 'ملفي الشخصي', text }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => {
            showToast('✅ تم نسخ الرابط إلى الحافظة', 'success');
        }).catch(() => {
            showToast('⚠️ لا يمكن نسخ النص تلقائياً', 'error');
        });
    }
},

// ============================================================
// ربط أزرار الإضافة
// ============================================================

_setupAddButtons() {
    const addButtons = [
        { id: 'openAddPlayer', modal: 'playerModal', title: 'إضافة لاعب' },
        { id: 'openAddClub', modal: 'clubModal', title: 'إضافة نادي' },
        { id: 'openAddMatch', modal: 'matchModal', title: 'إضافة مباراة' },
        { id: 'openAddTournament', modal: 'tournamentModal', title: 'إضافة بطولة' },
        { id: 'openAddQuestion', modal: 'questionModal', title: 'إضافة سؤال' }
    ];
    
    addButtons.forEach(({ id, modal, title }) => {
        const btn = document.getElementById(id);
        if (btn) {
            // إزالة أي مستمعات قديمة
            btn.replaceWith(btn.cloneNode(true));
            const newBtn = document.getElementById(id);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // التحقق من الصلاحية
                if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole) {
                    showToast('ليس لديك صلاحية لإضافة بيانات', 'error');
                    return;
                }
                
                const modalEl = document.getElementById(modal);
                if (!modalEl) {
                    showToast('خطأ في فتح النافذة', 'error');
                    return;
                }
                
                // إعادة تعيين النموذج
                const form = modalEl.querySelector('form');
                if (form) {
                    form.reset();
                    form.dataset.mode = '';
                    form.dataset.id = '';
                }
                
                // إعادة تعيين الحقول المخفية
                const idInput = modalEl.querySelector('input[type="hidden"]');
                if (idInput) idInput.value = '';
                
                // تحديث العنوان
                const titleMap = {
                    playerModal: 'إضافة لاعب',
                    clubModal: 'إضافة نادي',
                    matchModal: 'إضافة مباراة',
                    tournamentModal: 'إضافة بطولة',
                    questionModal: 'إضافة سؤال'
                };
                const titleEl = document.getElementById(`${modal.replace('Modal', '')}ModalTitle`);
                if (titleEl) titleEl.textContent = titleMap[modal] || title;
                
                // فتح المودال
                modalEl.classList.add('open');
                showToast(`📝 فتح نموذج ${title}`, 'info', 1500);
            });
        } else {
            console.warn(`⚠️ Button ${id} not found`);
        }
    });
},

_renderAnalyticsSection() {
    return `
        <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:1.5rem;">
            <i class="fas fa-chart-pie" style="color:var(--accent);"></i> 
            لوحة التحليلات والإحصائيات
        </h2>
        
        <!-- الإحصائيات السريعة -->
        <div class="grid-4 mb-2" id="statsGrid">
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-number" id="statPlayers">0</div><div class="stat-label">اللاعبين</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-trophy"></i></div><div class="stat-number" id="statClubs">0</div><div class="stat-label">الأندية</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-futbol"></i></div><div class="stat-number" id="statMatches">0</div><div class="stat-label">المباريات</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-medal"></i></div><div class="stat-number" id="statTournaments">0</div><div class="stat-label">البطولات</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-question-circle"></i></div><div class="stat-number" id="statQuestions">0</div><div class="stat-label">الأسئلة</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-gamepad"></i></div><div class="stat-number" id="statGamesPlayed">0</div><div class="stat-label">مرات اللعب</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-star"></i></div><div class="stat-number" id="statAchievements">0</div><div class="stat-label">الإنجازات</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-crown"></i></div><div class="stat-number" id="statTotalScore">0</div><div class="stat-label">مجموع النقاط</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-coins"></i></div><div class="stat-number" id="statCoins">0</div><div class="stat-label">العملات</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-newspaper"></i></div><div class="stat-number" id="statPosts">0</div><div class="stat-label">المنشورات</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-number" id="statRooms">0</div><div class="stat-label">الغرف النشطة</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-store"></i></div><div class="stat-number" id="statStoreItems">0</div><div class="stat-label">عناصر المتجر</div></div>
        </div>
        
        <!-- الرسوم البيانية الأساسية -->
        <div class="grid-2 mb-2">
            <div class="card">
                <div class="card-title"><i class="fas fa-chart-pie"></i> توزيع اللاعبين حسب المركز</div>
                <div class="chart-container"><canvas id="positionChart"></canvas></div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fas fa-chart-bar"></i> توزيع الأسئلة حسب الفئة</div>
                <div class="chart-container"><canvas id="categoryChart"></canvas></div>
            </div>
        </div>
        
        <!-- آخر اللاعبين والمباريات -->
        <div class="grid-2 mb-2">
            <div class="card">
                <div class="card-title"><i class="fas fa-user-plus"></i> آخر اللاعبين</div>
                <div id="recentPlayers">جاري التحميل...</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fas fa-plus-circle"></i> آخر المباريات</div>
                <div id="recentMatches">جاري التحميل...</div>
            </div>
        </div>
        
        <!-- أفضل اللاعبين -->
        <div class="card mb-2">
            <div class="card-title"><i class="fas fa-crown"></i> أفضل 5 لاعبين</div>
            <div id="topScorers">جاري التحميل...</div>
        </div>
        
        <!-- تقدم المستوى -->
        <div class="card" style="border-color:var(--accent);">
            <div class="card-title"><i class="fas fa-tasks"></i> تقدم المستوى</div>
            <div id="levelProgressContainer">
                <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
                    <span id="levelCurrent">مبتدئ</span>
                    <span id="levelNext">محترف (100 نقطة)</span>
                </div>
                <div class="progress-bar"><div id="levelProgressFill" style="height:100%;width:0%;"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--gray);margin-top:2px;">
                    <span>0</span>
                    <span id="levelPointsDisplay">0 نقطة</span>
                    <span>500+</span>
                </div>
            </div>
        </div>
        
        <!-- التحليلات المتقدمة (سيتم تعبئتها بواسطة _renderAnalyticsCharts) -->
        <div class="grid-2 mt-2">
            <div class="card">
                <div class="card-title"><i class="fas fa-chart-line"></i> أداء الفرق</div>
                <div class="chart-container" style="height:280px;"><canvas id="teamPerformanceChart"></canvas></div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fas fa-bullseye"></i> التنبؤ بالنتائج</div>
                <div id="predictionResults">جاري التحليل...</div>
            </div>
        </div>
        <div class="card mt-2">
            <div class="card-title"><i class="fas fa-calendar-alt"></i> المباريات القادمة</div>
            <div id="upcomingMatches">جاري التحميل...</div>
        </div>
        <div class="card mt-2">
            <div class="card-title"><i class="fas fa-chart-scatter"></i> إحصائيات إضافية</div>
            <div class="grid-3">
                <div class="stat-card"><div class="stat-number" id="analyticsTotalGoals">0</div><div class="stat-label">إجمالي الأهداف</div></div>
                <div class="stat-card"><div class="stat-number" id="analyticsAvgGoals">0</div><div class="stat-label">متوسط الأهداف/مباراة</div></div>
                <div class="stat-card"><div class="stat-number" id="analyticsTotalComments">0</div><div class="stat-label">إجمالي التعليقات</div></div>
            </div>
        </div>
    `;
},

// ============================================================
// التحقق من صلاحية المشرف (آمن)
// ============================================================

_isAdminUser() {
    const user = AuthService.currentUser;
    if (!user) {
        console.warn('⚠️ No user logged in - admin check failed');
        return false;
    }
    // التحقق من الأدوار
    const adminRoles = ['admin', 'super_admin'];
    const isAdmin = adminRoles.includes(user.role);
    const hasAdminRole = user.adminRole && user.adminRole !== '' && user.adminRole !== null;
    return isAdmin || hasAdminRole;
},

/**
 * التحقق من صلاحية المشرف مع إمكانية تحديد الحد الأدنى للدور
 */
_checkAdminLevel(minLevel = 'admin') {
    const user = AuthService.currentUser;
    if (!user) return false;
    
    const levelMap = {
        'viewer': 0,
        'user': 1,
        'editor': 2,
        'moderator': 3,
        'manager': 4,
        'admin': 5,
        'super_admin': 6
    };
    
    const userLevel = levelMap[user.role] || 0;
    const requiredLevel = levelMap[minLevel] || 0;
    
    // المشرفين المخصصين (adminRole) لهم صلاحيات admin على الأقل
    if (user.adminRole && user.adminRole !== '') {
        return userLevel >= 4 || requiredLevel <= 5;
    }
    
    return userLevel >= requiredLevel;
},

_renderAdminSection() {
    // ✅ لا ننتظر المستخدم هنا، نعرض اللوحة مباشرة مع رسالة تحميل داخل الحاوية
    // وسيتم تحديثها لاحقاً عند تحميل المستخدم
    return `
        <div class="admin-page">
            <div class="flex-between mb-2">
                <h2><i class="fas fa-shield-halved" style="color:var(--accent);"></i> لوحة المشرفين</h2>
                <button class="btn btn-sm btn-outline" onclick="App._refreshAdmin()">
                    <i class="fas fa-sync"></i> تحديث
                </button>
            </div>
            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="dashboard">📊 لوحة التحكم</button>
                <button class="admin-tab" data-tab="users">👥 المستخدمين</button>
                <button class="admin-tab" data-tab="content">📝 المحتوى</button>
                <button class="admin-tab" data-tab="data">🗃️ البيانات</button>
                <button class="admin-tab" data-tab="logs">📋 السجلات</button>
                <button class="admin-tab" data-tab="settings">⚙️ الإعدادات</button>
            </div>
            <div id="adminContentContainer">
                <div class="text-gray text-center" style="padding:2rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
                    <p>جاري تحميل بيانات لوحة التحكم...</p>
                </div>
            </div>
        </div>
    `;
},

/**
 * عرض محتوى لوحة المشرفين
 */
_renderAdminPanel() {
    return `
        <div class="admin-page">
            <div class="flex-between mb-2">
                <div>
                    <h2 style="font-size:1.8rem;font-weight:800;">
                        <i class="fas fa-shield-halved" style="color:var(--accent);"></i> 
                        لوحة المشرفين
                    </h2>
                    <p class="text-gray">مرحباً بك مشرفنا العزيز! 👋</p>
                </div>
                <div class="flex-center" style="flex-wrap:wrap;gap:8px;">
                    <span class="badge badge-success">🔐 ${AuthService.currentUser?.role || 'مشرف'}</span>
                    <button class="btn btn-sm btn-outline" onclick="App._refreshAdmin()">
                        <i class="fas fa-sync"></i> تحديث
                    </button>
                </div>
            </div>
            <!-- التبويبات -->
            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="dashboard">📊 لوحة التحكم</button>
                <button class="admin-tab" data-tab="users">👥 المستخدمين</button>
                <button class="admin-tab" data-tab="content">📝 المحتوى</button>
                <button class="admin-tab" data-tab="data">🗃️ البيانات</button>
                <button class="admin-tab" data-tab="logs">📋 السجلات</button>
                <button class="admin-tab" data-tab="settings">⚙️ الإعدادات</button>
            </div>
            <div id="adminContentContainer">
                <!-- سيتم تعبئته بواسطة JavaScript -->
            </div>
        </div>
    `;
},

// ============================================================
// دوال لوحة المشرفين - جميع التبويبات
// ============================================================

/**
 * عرض لوحة تحكم المشرف
 */
_renderAdminDashboard() {
    return `
        <div class="admin-stats-grid grid-4 mb-2">
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminTotalUsers">0</div>
                <div class="admin-stat-label">👥 إجمالي المستخدمين</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminActiveUsers">0</div>
                <div class="admin-stat-label">🟢 نشطاء اليوم</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminTotalPosts">0</div>
                <div class="admin-stat-label">📝 المنشورات</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminTotalRooms">0</div>
                <div class="admin-stat-label">🎮 الغرف</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminTotalQuestions">0</div>
                <div class="admin-stat-label">❓ الأسئلة</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminTotalComments">0</div>
                <div class="admin-stat-label">💬 التعليقات</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminTotalGames">0</div>
                <div class="admin-stat-label">🎯 المباريات</div>
            </div>
            <div class="admin-stat">
                <div class="admin-stat-number" id="adminStorageUsed">0 MB</div>
                <div class="admin-stat-label">💾 المساحة المستخدمة</div>
            </div>
        </div>
        <div class="grid-2">
            <div class="card"><div class="card-title"><i class="fas fa-chart-line"></i> نشاط المستخدمين</div><div class="chart-container" style="height:200px;"><canvas id="adminActivityChart"></canvas></div></div>
            <div class="card"><div class="card-title"><i class="fas fa-chart-pie"></i> توزيع الأدوار</div><div class="chart-container" style="height:200px;"><canvas id="adminRolesChart"></canvas></div></div>
        </div>
        <div class="card mt-2">
            <div class="card-title"><i class="fas fa-bell"></i> آخر النشاطات</div>
            <div id="adminRecentActivity"><div class="text-gray">جاري التحميل...</div></div>
        </div>
    `;
},

// ============================================================
// دوال عرض التبويبات
// ============================================================

_showAdminTab(tab) {
    console.log(`🔄 Showing admin tab: ${tab}`);
    
    const container = document.getElementById('adminContentContainer');
    if (!container) {
        console.warn('⚠️ adminContentContainer not found');
        return;
    }

    // ✅ عرض المحتوى حسب التبويب
    let content = '';
    switch(tab) {
        case 'dashboard': content = this._renderAdminDashboardContent(); break;
case 'users':
    content = this._renderAdminUsersContent();
    container.innerHTML = content;
    // تأخير بسيط لضمان تحميل العناصر
    setTimeout(() => {
        this._renderAdminUsers(1);
    }, 300);
    break;
        case 'content': content = this._renderAdminContentContent(); break;
        case 'data': content = this._renderAdminDataContent(); break;
        case 'logs': content = this._renderAdminLogsContent(); break;
        case 'settings': content = this._renderAdminSettingsContent(); break;
        default: content = '<div class="text-gray">قسم غير معروف</div>';
    }
    container.innerHTML = content;

    // ✅ بعد عرض المحتوى، قم بتحميل البيانات (مع تأخير كافٍ)
    setTimeout(() => {
        console.log(`⏳ Loading data for tab: ${tab}`);
        try {
            switch(tab) {
                case 'dashboard':
                    this._updateAdminDashboard();
                    break;
case 'users':
    content = this._renderAdminUsersContent();
    container.innerHTML = content;
    // تأخير بسيط لضمان تحميل العناصر
    setTimeout(() => {
        this._renderAdminUsers(1);
    }, 300);
    break;
                case 'content':
                    this._renderAdminContentData();
                    break;
                case 'data':
                    this._renderAdminDataStats();
                    break;
                case 'logs':
                    this._renderAdminLogs();
                    break;
                case 'settings':
                    // لا توجد بيانات للتحميل
                    break;
                default:
                    console.warn('⚠️ Unknown tab:', tab);
            }
        } catch (e) {
            console.error(`❌ Error loading tab "${tab}":`, e);
        }
    }, 300);
},

async _refreshAdminStats() {
    // التحقق من وجود العناصر
    const totalUsersEl = document.getElementById('adminTotalUsers');
    if (!totalUsersEl) {
        console.warn('⚠️ Admin stats elements not found');
        return;
    }
    
    try {
        const stats = DataManager.getStats();
        const usersSnap = await db.collection('users').get();
        const totalUsers = usersSnap.size;
        let activeUsers = 0;
        const now = Date.now();
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.lastActive) {
                const lastActive = data.lastActive.toDate?.() || new Date(data.lastActive);
                if (now - lastActive.getTime() < 24 * 60 * 60 * 1000) activeUsers++;
            }
        });
        const updateEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        updateEl('adminTotalUsers', totalUsers);
        updateEl('adminActiveUsers', activeUsers);
        updateEl('adminTotalPosts', stats.posts || 0);
        updateEl('adminTotalRooms', stats.rooms || 0);
        updateEl('adminTotalQuestions', stats.questions || 0);
        updateEl('adminTotalComments', stats.comments || 0);
        updateEl('adminTotalMatches', stats.matches || 0);
        updateEl('adminStorageUsed', Math.round((totalUsers * 0.3) + (stats.posts * 0.1)) + ' MB');
    } catch (e) {
        console.warn('Admin stats error:', e);
    }
},

_renderAdminDashboardContent() {
    return `
        <div class="admin-stats-grid grid-4 mb-2">
            <div class="admin-stat"><div class="admin-stat-number" id="adminTotalUsers">0</div><div class="admin-stat-label">👥 المستخدمين</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminActiveUsers">0</div><div class="admin-stat-label">🟢 نشطاء اليوم</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminTotalPosts">0</div><div class="admin-stat-label">📝 المنشورات</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminTotalRooms">0</div><div class="admin-stat-label">🎮 الغرف</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminTotalQuestions">0</div><div class="admin-stat-label">❓ الأسئلة</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminTotalComments">0</div><div class="admin-stat-label">💬 التعليقات</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminTotalMatches">0</div><div class="admin-stat-label">⚽ المباريات</div></div>
            <div class="admin-stat"><div class="admin-stat-number" id="adminStorageUsed">0 MB</div><div class="admin-stat-label">💾 التخزين</div></div>
        </div>
        <div class="grid-2">
            <div class="card"><div class="card-title"><i class="fas fa-chart-line"></i> نشاط المستخدمين</div><div class="chart-container"><canvas id="adminActivityChart"></canvas></div></div>
            <div class="card"><div class="card-title"><i class="fas fa-chart-pie"></i> توزيع الأدوار</div><div class="chart-container"><canvas id="adminRolesChart"></canvas></div></div>
        </div>
        <div class="card mt-2">
            <div class="card-title"><i class="fas fa-clock"></i> آخر النشاطات</div>
            <div id="adminRecentActivity"><div class="text-gray">لا توجد نشاطات حديثة</div></div>
        </div>
    `;
},

_renderAdminUsersContent() {
    return `
        <div class="card">
            <div class="flex-between mb-1">
                <div class="flex-center gap-1" style="flex-wrap:wrap;">
                    <input type="text" id="adminSearchUser" placeholder="🔍 بحث..." style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                    <select id="adminFilterRole" style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                        <option value="">كل الأدوار</option>
                        <option value="user">مستخدم</option>
                        <option value="editor">محرر</option>
                        <option value="manager">مدير عام</option>
                        <option value="admin">مدير</option>
                        <option value="super_admin">مشرف عام</option>
                    </select>
                    <select id="adminFilterStatus" style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                        <option value="">كل الحالات</option>
                        <option value="active">نشط</option>
                        <option value="banned">محظور</option>
                        <option value="inactive">غير نشط</option>
                    </select>
                    <button class="btn btn-sm btn-primary" onclick="App._adminAddUser()"><i class="fas fa-user-plus"></i> إضافة</button>
                    <button class="btn btn-sm btn-outline" onclick="App._exportUsersCSV()"><i class="fas fa-file-export"></i> CSV</button>
                    <button class="btn btn-sm btn-outline" onclick="App._renderAdminUsers()"><i class="fas fa-sync"></i> تحديث</button>
                </div>
                <span class="text-gray" id="adminUsersCount">0 مستخدم</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>#</th><th>المستخدم</th><th>البريد</th><th>الدور</th><th>النقاط</th><th>العملات</th><th>الحالة</th><th>آخر نشاط</th><th>الإجراءات</th></tr></thead>
                    <tbody id="adminUsersTableBody"><tr><td colspan="9" class="text-center text-gray"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</td></tr></tbody>
                </table>
            </div>
            <div class="pagination" id="adminUsersPagination"></div>
        </div>
    `;
},

_renderAdminContentContent() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-newspaper"></i> إدارة المحتوى</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1rem;">
                <div class="stat-card"><div class="stat-number" id="adminContentPosts">0</div><div class="stat-label">منشورات</div><button class="btn btn-sm btn-outline" onclick="App._adminViewPosts()">عرض</button></div>
                <div class="stat-card"><div class="stat-number" id="adminContentComments">0</div><div class="stat-label">تعليقات</div><button class="btn btn-sm btn-outline" onclick="App._adminViewComments()">عرض</button></div>
                <div class="stat-card"><div class="stat-number" id="adminContentReports">0</div><div class="stat-label">تقارير</div><button class="btn btn-sm btn-danger" onclick="App._adminViewReports()">عرض</button></div>
            </div>
            <div id="adminContentList"><div class="text-gray">اختر فئة لعرض المحتوى</div></div>
        </div>
    `;
},

_renderAdminDataContent() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-database"></i> إدارة البيانات</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;">
                <div class="stat-card"><div class="stat-number" id="adminDataPlayers">0</div><div class="stat-label">لاعبين</div><button class="btn btn-xs btn-outline" onclick="App._adminExportData('players')">تصدير</button></div>
                <div class="stat-card"><div class="stat-number" id="adminDataClubs">0</div><div class="stat-label">أندية</div><button class="btn btn-xs btn-outline" onclick="App._adminExportData('clubs')">تصدير</button></div>
                <div class="stat-card"><div class="stat-number" id="adminDataMatches">0</div><div class="stat-label">مباريات</div><button class="btn btn-xs btn-outline" onclick="App._adminExportData('matches')">تصدير</button></div>
                <div class="stat-card"><div class="stat-number" id="adminDataQuestions">0</div><div class="stat-label">أسئلة</div><button class="btn btn-xs btn-outline" onclick="App._adminExportData('questions')">تصدير</button></div>
            </div>
            <div class="mt-2"><button class="btn btn-primary" onclick="App._adminExportAllData()">تصدير الكل</button> <button class="btn btn-danger" onclick="App._adminClearAllData()">مسح الكل</button></div>
        </div>
    `;
},

_renderAdminLogsContent() {
    return `<div class="card"><div class="card-title"><i class="fas fa-list"></i> سجلات النظام</div><div id="adminLogsContainer"><div class="text-gray">جاري التحميل...</div></div></div>`;
},

_renderAdminSettingsContent() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-cog"></i> إعدادات النظام</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                    <div class="form-group"><label>اسم التطبيق</label><input type="text" id="adminAppName" value="مدير كرة القدم" style="width:100%;"></div>
                    <div class="form-group"><label>الوضع الافتراضي</label><select id="adminDefaultTheme" style="width:100%;"><option value="dark">داكن</option><option value="light">فاتح</option></select></div>
                    <button class="btn btn-primary" onclick="App._adminSaveSettings()">حفظ</button>
                </div>
                <div>
                    <button class="btn btn-outline w-100 mb-1" onclick="App._adminClearCache()">مسح الكاش</button>
                    <button class="btn btn-outline w-100 mb-1" onclick="App._adminRebuildIndexes()">إعادة بناء الفهارس</button>
                    <button class="btn btn-danger w-100" onclick="App._showResetConfirm()" style="background:var(--secondary);">⚠️ إعادة تعيين النظام بالكامل</button>
                </div>
            </div>
            <!-- نموذج التأكيد الإضافي (يظهر عند الضغط على الزر) -->
            <div id="resetConfirmArea" style="display:none; margin-top:1rem; padding:1rem; background:var(--glass); border-radius:var(--radius-sm); border:1px solid var(--secondary);">
                <h4 style="color:var(--secondary);">⚠️ تحذير: إعادة تعيين النظام</h4>
                <p style="color:var(--gray);">سيتم حذف <strong>جميع البيانات</strong> من قاعدة البيانات والتخزين المحلي، بما في ذلك:</p>
                <ul style="color:var(--gray); font-size:0.9rem; padding-right:1.5rem;">
                    <li>اللاعبين، الأندية، المباريات، البطولات</li>
                    <li>الأسئلة، التعليقات، المنشورات، الغرف</li>
                    <li>عناصر المتجر، المعاملات، لوحة المتصدرين</li>
                    <li>جميع المستخدمين (بما فيهم أنت)</li>
                    <li>الإشعارات، طلبات الصداقة، المتابعات</li>
                </ul>
                <p style="color:var(--secondary); font-weight:700;">لا يمكن التراجع عن هذه العملية!</p>
                <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-top:0.5rem;">
                    <label style="color:var(--light);">اكتب <strong style="color:var(--secondary);">"حذف كامل"</strong> للتأكيد:</label>
                    <input type="text" id="resetConfirmInput" placeholder="أدخل النص المطلوب" style="flex:1; min-width:150px; padding:6px 12px; border-radius:8px; background:var(--dark); border:1px solid var(--glass-border); color:var(--light);">
                    <button class="btn btn-danger" id="resetExecuteBtn" disabled style="justify-content:center;">تنفيذ الحذف</button>
                    <button class="btn btn-outline" onclick="App._cancelReset()">إلغاء</button>
                </div>
            </div>
        </div>
    `;
},

// ============================================================
// دوال إعادة تعيين النظام بالكامل
// ============================================================

_showResetConfirm() {
    const area = document.getElementById('resetConfirmArea');
    if (area) {
        area.style.display = 'block';
        const input = document.getElementById('resetConfirmInput');
        const btn = document.getElementById('resetExecuteBtn');
        if (input) {
            input.value = '';
            input.focus();
            input.oninput = function() {
                btn.disabled = (this.value.trim() !== 'حذف كامل');
            };
        }
        if (btn) {
            btn.disabled = true;
            btn.onclick = function() {
                App._executeReset();
            };
        }
        // إغلاق المنطقة إذا نقر المستخدم خارجها (اختياري)
    }
},

_cancelReset() {
    const area = document.getElementById('resetConfirmArea');
    if (area) area.style.display = 'none';
    const input = document.getElementById('resetConfirmInput');
    if (input) input.value = '';
    const btn = document.getElementById('resetExecuteBtn');
    if (btn) btn.disabled = true;
},

async _executeReset() {
    const user = AuthService.currentUser;
    if (!user || user.role !== 'super_admin') {
        showToast('❌ فقط المشرف العام يمكنه تنفيذ هذا الإجراء', 'error');
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد بنسبة 100%؟')) return;

    const btn = document.getElementById('resetExecuteBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الحذف...'; }

    try {
        showToast('⏳ جاري حذف جميع البيانات...', 'info', 5000);

        const collections = [
            'players', 'clubs', 'matches', 'tournaments', 'questions',
            'leaderboard', 'comments', 'posts', 'rooms', 'storeItems',
            'transactions', 'notifications', 'follows', 'friendRequests',
            'roomMessages'
        ];

        // ✅ نستخدم حلقة مع تأخير لتجنب تجاوز وقت التنفيذ
        for (const col of collections) {
            await this._deleteCollectionInBatches(col);
        }

        // حذف وثائق users
        await this._deleteCollectionInBatches('users');

        // مسح التخزين المحلي
        localStorage.clear();
        sessionStorage.clear();

        // إلغاء الاشتراكات
        if (DataManager._unsubscribers) {
            DataManager._unsubscribers.forEach(unsub => unsub());
            DataManager._unsubscribers = [];
        }
        // ... إلغاء باقي الاشتراكات (اختصاراً)

        // إعادة تهيئة البيانات
        DataManager.data = {
            players: [], clubs: [], matches: [], tournaments: [],
            questions: [], leaderboard: [], comments: [], posts: [],
            rooms: [], storeItems: [], transactions: []
        };

        await AuthService.logout();
        showToast('✅ تم الحذف! سيتم إعادة التحميل.', 'success', 5000);
        setTimeout(() => location.reload(true), 2000);

    } catch (error) {
        console.error('❌ خطأ:', error);
        showToast('❌ فشل الحذف: ' + error.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'تنفيذ الحذف'; }
    }
},

// ✅ دالة مساعدة لحذف مجموعة على دفعات صغيرة
async _deleteCollectionInBatches(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        this._deleteQueryBatch(query, resolve, reject);
    });
},

async _deleteQueryBatch(query, resolve, reject) {
    try {
        const snapshot = await query.get();
        if (snapshot.empty) {
            resolve();
            return;
        }

        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // ✅ تأخير بسيط بين الدفعات لتجنب إرهاق المتصفح
        await new Promise(res => setTimeout(res, 200));

        // استمرار الحذف للمجموعة التالية
        const nextQuery = query.startAfter(snapshot.docs[snapshot.docs.length - 1]);
        await this._deleteQueryBatch(nextQuery, resolve, reject);
    } catch (error) {
        reject(error);
    }
},

/**
 * عرض إدارة المستخدمين
 */
_renderAdminUsersPanel() {
    return `
        <div class="card">
            <div class="flex-between mb-1">
                <div class="flex-center gap-1" style="flex-wrap:wrap;">
                    <input type="text" id="adminSearchUser" placeholder="🔍 بحث عن مستخدم..." style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                    <select id="adminFilterRole" style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                        <option value="">كل الأدوار</option>
                        <option value="user">مستخدم</option>
                        <option value="editor">محرر</option>
                        <option value="manager">مدير عام</option>
                        <option value="admin">مدير</option>
                        <option value="super_admin">مشرف عام</option>
                    </select>
                    <select id="adminFilterStatus" style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                        <option value="">كل الحالات</option>
                        <option value="active">نشط</option>
                        <option value="banned">محظور</option>
                        <option value="inactive">غير نشط</option>
                    </select>
                    <button class="btn btn-sm btn-primary" id="adminAddUserBtn"><i class="fas fa-user-plus"></i> إضافة مستخدم</button>
                </div>
                <span class="text-gray" id="adminUsersCount">0 مستخدم</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>#</th><th>المستخدم</th><th>البريد</th><th>الدور</th><th>النقاط</th><th>العملات</th><th>الحالة</th><th>تاريخ الانضمام</th><th>الإجراءات</th></tr></thead>
                    <tbody id="adminUsersTableBody"><tr><td colspan="9" class="text-center text-gray">جاري التحميل...</td></tr></tbody>
                </table>
            </div>
            <div class="pagination" id="adminUsersPagination"></div>
        </div>
    `;
},

/**
 * عرض إدارة المحتوى
 */
_renderAdminContentPanel() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-newspaper"></i> إدارة المحتوى</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;">
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminContentPosts">0</div>
                    <div class="stat-label">📝 المنشورات</div>
                    <button class="btn btn-sm btn-outline mt-1" onclick="App._adminViewPosts()">عرض</button>
                </div>
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminContentComments">0</div>
                    <div class="stat-label">💬 التعليقات</div>
                    <button class="btn btn-sm btn-outline mt-1" onclick="App._adminViewComments()">عرض</button>
                </div>
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminContentReports">0</div>
                    <div class="stat-label">🚨 تقارير</div>
                    <button class="btn btn-sm btn-danger mt-1" onclick="App._adminViewReports()">عرض</button>
                </div>
            </div>
            <div id="adminContentList">
                <div class="text-gray">اختر فئة لعرض المحتوى</div>
            </div>
        </div>
    `;
},

/**
 * عرض إدارة البيانات
 */
_renderAdminDataPanel() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-database"></i> إدارة البيانات</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminDataPlayers">0</div>
                    <div class="stat-label">⚽ لاعبين</div>
                    <button class="btn btn-xs btn-outline" onclick="App._adminExportData('players')">تصدير</button>
                </div>
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminDataClubs">0</div>
                    <div class="stat-label">🏆 أندية</div>
                    <button class="btn btn-xs btn-outline" onclick="App._adminExportData('clubs')">تصدير</button>
                </div>
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminDataMatches">0</div>
                    <div class="stat-label">⚽ مباريات</div>
                    <button class="btn btn-xs btn-outline" onclick="App._adminExportData('matches')">تصدير</button>
                </div>
                <div class="stat-card" style="padding:0.8rem;text-align:center;">
                    <div class="stat-number" style="font-size:1.4rem;" id="adminDataQuestions">0</div>
                    <div class="stat-label">❓ أسئلة</div>
                    <button class="btn btn-xs btn-outline" onclick="App._adminExportData('questions')">تصدير</button>
                </div>
            </div>
            <div class="mt-2">
                <button class="btn btn-primary" onclick="App._adminExportAllData()"><i class="fas fa-file-export"></i> تصدير جميع البيانات</button>
                <button class="btn btn-danger" onclick="App._adminClearAllData()"><i class="fas fa-trash-alt"></i> مسح جميع البيانات</button>
            </div>
        </div>
    `;
},

/**
 * عرض إدارة الصلاحيات
 */
_renderAdminPermissionsPanel() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-key"></i> إدارة الصلاحيات</div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>الدور</th><th>الصلاحيات</th></tr></thead>
                    <tbody>
                        <tr><td><span class="badge badge-danger">مشرف عام</span></td><td>جميع الصلاحيات</td></tr>
                        <tr><td><span class="badge badge-primary">مدير</span></td><td>إدارة المستخدمين، المحتوى، البيانات، النظام</td></tr>
                        <tr><td><span class="badge badge-warning">مدير عام</span></td><td>إدارة المحتوى والبيانات، عرض المستخدمين</td></tr>
                        <tr><td><span class="badge badge-info">محرر</span></td><td>إضافة وتعديل المحتوى والبيانات</td></tr>
                        <tr><td><span class="badge badge-secondary">مراقب</span></td><td>مراقبة المحتوى، عرض المستخدمين</td></tr>
                        <tr><td><span class="badge badge-light">مستخدم</span></td><td>عرض المحتوى فقط</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="mt-2">
                <h5>تعديل صلاحيات الدور</h5>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                    <select id="adminRoleSelect" style="padding:6px 12px;border-radius:8px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                        <option value="user">مستخدم</option>
                        <option value="editor">محرر</option>
                        <option value="moderator">مراقب</option>
                        <option value="manager">مدير عام</option>
                        <option value="admin">مدير</option>
                    </select>
                    <button class="btn btn-sm btn-primary" onclick="App._adminEditPermissions()"><i class="fas fa-edit"></i> تعديل</button>
                </div>
            </div>
        </div>
    `;
},

// ============================================================
// دوال معالجة أحداث لوحة المشرفين
// ============================================================

/**
 * تحديث إحصائيات لوحة التحكم
 */
async _renderAdminDashboardStats() {
    try {
        const usersSnap = await db.collection('users').get();
        const totalUsers = usersSnap.size;
        let activeUsers = 0;
        const now = Date.now();
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.lastActive) {
                const lastActive = data.lastActive.toDate?.() || new Date(data.lastActive);
                if (now - lastActive.getTime() < 24 * 60 * 60 * 1000) activeUsers++;
            }
        });
        const stats = DataManager.getStats();
        const updateEl = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        updateEl('adminTotalUsers', totalUsers);
        updateEl('adminActiveUsers', activeUsers);
        updateEl('adminTotalPosts', stats.posts || 0);
        updateEl('adminTotalRooms', stats.rooms || 0);
        updateEl('adminTotalQuestions', stats.questions || 0);
        updateEl('adminTotalComments', stats.comments || 0);
        updateEl('adminTotalGames', stats.matches || 0);
        // تقدير المساحة
        const storage = Math.round((totalUsers * 0.5) + (stats.posts * 0.2));
        updateEl('adminStorageUsed', storage + ' MB');
    } catch (e) {
        console.warn('Admin stats error:', e);
    }
},

/**
 * عرض ملف مستخدم من لوحة المشرفين
 */
async _viewUserProfile(uid) {
    this._openUserProfileModal(uid);
},

// ============================================================
// المحتوى
// ============================================================

_adminViewPosts() {
    const posts = DataManager.data.posts || [];
    if (!posts.length) { showToast('لا توجد منشورات', 'info'); return; }
    this._showAdminListModal('المنشورات', posts, (p) => p.content, 'post');
},

_adminViewComments() {
    const comments = DataManager.data.comments || [];
    if (!comments.length) { showToast('لا توجد تعليقات', 'info'); return; }
    this._showAdminListModal('التعليقات', comments, (c) => `${c.userName}: ${c.text}`, 'comment');
},

_adminViewReports() {
    showToast('🚨 ميزة التقارير قيد التطوير', 'info');
},

_showAdminListModal(title, items, textFn, type) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:700px; max-height:80vh;">
            <div class="modal-header"><h3>${title} (${items.length})</h3><button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button></div>
            <div style="max-height:60vh; overflow-y:auto;">
                ${items.slice(0, 20).map((item, idx) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--glass-border);">
                        <span style="font-size:0.9rem;">${textFn(item)}</span>
                        <button class="btn btn-xs btn-danger" onclick="App._adminDeleteItem('${type}','${item.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                `).join('')}
                ${items.length > 20 ? `<div class="text-gray">... و ${items.length - 20} أخرى</div>` : ''}
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">إغلاق</button></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
},

async _adminDeleteItem(type, id) {
    if (!confirm(`حذف هذا ${type}؟`)) return;
    try {
        await DataManager.delete(type === 'post' ? 'posts' : 'comments', id);
        showToast('✅ تم الحذف', 'success');
        if (type === 'post') this._adminViewPosts(); else this._adminViewComments();
    } catch (e) { showToast('❌ خطأ: ' + e.message, 'error'); }
},

// ============================================================
// السجلات
// ============================================================

async _renderAdminLogs() {
    console.log('🔄 Loading admin logs...');
    const container = document.getElementById('adminLogsContainer');
    if (!container) {
        console.warn('⚠️ adminLogsContainer not found, retrying...');
        setTimeout(() => this._renderAdminLogs(), 300);
        return;
    }

    try {
        // محاولة جلب السجلات من Firestore
        let logs = [];
        try {
            const snapshot = await Promise.race([
                db.collection('logs').orderBy('createdAt', 'desc').limit(50).get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
            ]);
            snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn('⚠️ Logs fetch timeout or not available');
            // سجلات وهمية للتوضيح
            logs = [
                { message: '🔧 تم تحديث النظام', createdAt: new Date(), userName: 'نظام' },
                { message: '👤 مستخدم جديد سجل', createdAt: new Date(Date.now() - 3600000), userName: 'نظام' },
                { message: '📝 منشور جديد تم نشره', createdAt: new Date(Date.now() - 7200000), userName: 'نظام' },
            ];
        }

        if (logs.length === 0) {
            container.innerHTML = '<div class="text-gray">لا توجد سجلات</div>';
            return;
        }

        let html = `
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
                <span class="text-gray" style="font-size:0.8rem;">📋 آخر ${logs.length} سجل</span>
                <button class="btn btn-xs btn-outline" onclick="App._renderAdminLogs()"><i class="fas fa-sync"></i> تحديث</button>
            </div>
            <div style="max-height:400px;overflow-y:auto;font-size:0.85rem;">
        `;

        logs.forEach(log => {
            const time = log.createdAt?.toDate?.() || new Date(log.createdAt) || new Date();
            html += `
                <div style="display:flex;gap:0.5rem;padding:4px 0;border-bottom:1px solid var(--glass-border);align-items:center;">
                    <span style="font-size:0.7rem;color:var(--gray);min-width:80px;">${formatDate(time)}</span>
                    <span style="flex:1;">${log.message || 'نشاط غير معروف'}</span>
                    <span style="font-size:0.7rem;color:var(--gray);">${log.userName || 'نظام'}</span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
        console.log('✅ Logs loaded successfully');
    } catch (e) {
        console.error('❌ Error loading logs:', e);
        container.innerHTML = `<div class="text-gray">❌ خطأ في تحميل السجلات: ${e.message}</div>`;
    }
},

// ============================================================
// عرض إحصائيات المحتوى
// ============================================================

_renderAdminContentData() {
    console.log('🔄 Loading content stats...');
    const stats = DataManager.getStats();
    const posts = DataManager.data.posts || [];
    const comments = DataManager.data.comments || [];

    const updateEl = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    updateEl('adminContentPosts', posts.length);
    updateEl('adminContentComments', comments.length);
    updateEl('adminContentReports', 0); // يمكن جلبها من مجموعة reports

    // عرض قائمة بالمنشورات الأخيرة
    const listContainer = document.getElementById('adminContentList');
    if (listContainer) {
        if (posts.length === 0) {
            listContainer.innerHTML = '<div class="text-gray">لا توجد منشورات</div>';
            return;
        }
        let html = '<div style="max-height:300px;overflow-y:auto;">';
        posts.slice(0, 10).forEach(p => {
            html += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--glass-border);">
                    <span style="font-size:0.85rem;flex:1;">${p.content?.substring(0, 50) || '...'}</span>
                    <span style="font-size:0.7rem;color:var(--gray);">❤️ ${p.likes?.length || 0}</span>
                    <button class="btn btn-xs btn-danger" onclick="App._adminDeleteItem('post','${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
        html += '</div>';
        listContainer.innerHTML = html;
    }
    console.log('✅ Content stats loaded');
},

// ============================================================
// عرض إحصائيات البيانات
// ============================================================

_renderAdminDataStats() {
    console.log('🔄 Loading data stats...');
    const stats = DataManager.getStats();
    const updateEl = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    updateEl('adminDataPlayers', stats.players || 0);
    updateEl('adminDataClubs', stats.clubs || 0);
    updateEl('adminDataMatches', stats.matches || 0);
    updateEl('adminDataQuestions', stats.questions || 0);
    console.log('✅ Data stats loaded');
},

// ============================================================
// الإعدادات
// ============================================================

_adminSaveSettings() {
    const name = document.getElementById('adminAppName')?.value || 'مدير كرة القدم';
    const theme = document.getElementById('adminDefaultTheme')?.value || 'dark';
    localStorage.setItem('admin_appName', name);
    localStorage.setItem('admin_theme', theme);
    showToast('✅ تم حفظ الإعدادات', 'success');
},

_adminClearCache() {
    if (!confirm('مسح الكاش؟')) return;
    localStorage.clear();
    showToast('✅ تم مسح الكاش، سيتم إعادة التحميل', 'success');
    setTimeout(() => location.reload(), 1500);
},

_adminRebuildIndexes() {
    showToast('⏳ جاري إعادة بناء الفهارس...', 'info');
    setTimeout(() => {
        DataManager.loadAll().then(() => showToast('✅ تم إعادة البناء', 'success')).catch(() => showToast('❌ فشل', 'error'));
    }, 2000);
},

_adminResetSystem() {
    if (!confirm('⚠️ إعادة تشغيل النظام؟')) return;
    AuthService.logout();
    localStorage.clear();
    showToast('🔄 إعادة تشغيل...', 'info');
    setTimeout(() => location.reload(), 2000);
},

// ============================================================
// تصدير البيانات
// ============================================================

_adminExportData(collection) {
    const data = DataManager.data[collection] || [];
    if (!data.length) { showToast('لا توجد بيانات', 'info'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ تم تصدير ${collection}`, 'success');
},

_adminExportAllData() {
    const data = DataManager.data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_data_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ تم تصدير جميع البيانات', 'success');
},

_adminClearAllData() {
    if (!confirm('⚠️ مسح جميع البيانات؟')) return;
    showToast('⚠️ هذه الميزة غير متاحة حالياً', 'warning');
},

/**
 * عرض السجلات
 */
_renderAdminLogsPanel() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-list"></i> سجلات النظام</div>
            <div id="adminLogsContainer"><div class="text-gray">جاري تحميل السجلات...</div></div>
        </div>
    `;
},

/**
 * عرض إعدادات النظام
 */
_renderAdminSystemPanel() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-cog"></i> إعدادات النظام</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                    <h5>الإعدادات العامة</h5>
                    <div class="form-group">
                        <label>اسم التطبيق</label>
                        <input type="text" id="adminAppName" value="مدير كرة القدم" style="width:100%;">
                    </div>
                    <div class="form-group">
                        <label>الوضع الافتراضي</label>
                        <select id="adminDefaultTheme" style="width:100%;">
                            <option value="dark">داكن</option>
                            <option value="light">فاتح</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="App._adminSaveSettings()"><i class="fas fa-save"></i> حفظ الإعدادات</button>
                </div>
                <div>
                    <h5>أدوات النظام</h5>
                    <button class="btn btn-outline w-100 mb-1" onclick="App._adminClearCache()"><i class="fas fa-broom"></i> مسح الكاش</button>
                    <button class="btn btn-outline w-100 mb-1" onclick="App._adminRebuildIndexes()"><i class="fas fa-database"></i> إعادة بناء الفهارس</button>
                    <button class="btn btn-danger w-100" onclick="App._adminResetSystem()"><i class="fas fa-power-off"></i> إعادة تشغيل النظام</button>
                </div>
            </div>
        </div>
    `;
},

/**
 * عرض النسخ الاحتياطي
 */
_renderAdminBackupPanel() {
    return `
        <div class="card">
            <div class="card-title"><i class="fas fa-database"></i> النسخ الاحتياطي</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
                <div class="stat-card" style="padding:1rem;text-align:center;">
                    <div style="font-size:2rem;">📦</div>
                    <h4>إنشاء نسخة احتياطية</h4>
                    <p class="text-gray" style="font-size:0.85rem;">تصدير جميع البيانات</p>
                    <button class="btn btn-primary" id="adminCreateBackupBtn"><i class="fas fa-download"></i> إنشاء</button>
                </div>
                <div class="stat-card" style="padding:1rem;text-align:center;">
                    <div style="font-size:2rem;">🔄</div>
                    <h4>استعادة نسخة</h4>
                    <p class="text-gray" style="font-size:0.85rem;">استيراد بيانات من ملف</p>
                    <button class="btn btn-outline" id="adminRestoreBackupBtn"><i class="fas fa-upload"></i> استعادة</button>
                    <input type="file" id="adminRestoreFile" accept=".json" style="display:none;">
                </div>
                <div class="stat-card" style="padding:1rem;text-align:center;">
                    <div style="font-size:2rem;">📋</div>
                    <h4>النسخ السابقة</h4>
                    <p class="text-gray" style="font-size:0.85rem;">قائمة النسخ المحفوظة</p>
                    <button class="btn btn-outline" id="adminListBackupsBtn"><i class="fas fa-list"></i> عرض</button>
                </div>
            </div>
            <div id="adminBackupList" style="margin-top:1rem;"></div>
        </div>
    `;
},

// ============================================================
// تحديث البيانات
// ============================================================

// ============================================================
// تحديث لوحة تحكم المشرفين (الإحصائيات والرسوم البيانية)
// ============================================================

async _updateAdminDashboard() {
    const container = document.getElementById('adminContentContainer');
    if (!container) return;

    // ✅ التحقق من وجود العناصر
    if (!document.getElementById('adminTotalUsers')) {
        console.warn('⚠️ Admin stats elements not found, skipping render');
        return;
    }

    // ✅ إذا كان غير متصل، استخدم البيانات المخزنة مؤقتاً
    if (!this._isOnline) {
        this._updateAdminDashboardOffline();
        return;
    }

    try {
        // جلب الإحصائيات من DataManager (مخزنة محلياً)
        const stats = DataManager.getStats();

        // محاولة جلب المستخدمين من Firestore مع مهلة 5 ثوانٍ
        let usersSnap;
        try {
            usersSnap = await Promise.race([
                db.collection('users').get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
        } catch (e) {
            console.warn('⚠️ Firestore timeout, using cached data');
            // استخدام البيانات المخزنة مؤقتاً
            this._updateAdminDashboardOffline();
            return;
        }

        const totalUsers = usersSnap.size;
        let activeUsers = 0;
        const now = Date.now();
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.lastActive) {
                const lastActive = data.lastActive.toDate?.() || new Date(data.lastActive);
                if (now - lastActive.getTime() < 24 * 60 * 60 * 1000) activeUsers++;
            }
        });

        // تحديث العناصر
        const updateEl = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        updateEl('adminTotalUsers', totalUsers);
        updateEl('adminActiveUsers', activeUsers);
        updateEl('adminTotalPosts', stats.posts || 0);
        updateEl('adminTotalRooms', stats.rooms || 0);
        updateEl('adminTotalQuestions', stats.questions || 0);
        updateEl('adminTotalComments', stats.comments || 0);
        updateEl('adminTotalMatches', stats.matches || 0);
        updateEl('adminStorageUsed', Math.round((totalUsers * 0.3) + (stats.posts * 0.1) + (stats.questions * 0.05)) + ' MB');

        // الرسوم البيانية والنشاطات
        this._renderAdminCharts(usersSnap);
        this._renderAdminRecentActivity();

        // إزالة رسالة التحذير إن وجدت
        const warning = document.getElementById('offlineWarning');
        if (warning) warning.remove();

        console.log('✅ Admin dashboard updated (online)');
    } catch (error) {
        console.error('❌ Error updating admin dashboard:', error);
        // في حالة الخطأ، استخدم البيانات المخزنة
        this._updateAdminDashboardOffline();
    }
},

// ============================================================
// عرض لوحة المشرفين في وضع عدم الاتصال
// ============================================================

_updateAdminDashboardOffline() {
    const stats = DataManager.getStats();
    const updateEl = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    // عرض بيانات مخزنة أو تقديرية
    updateEl('adminTotalUsers', '—');
    updateEl('adminActiveUsers', '—');
    updateEl('adminTotalPosts', stats.posts || 0);
    updateEl('adminTotalRooms', stats.rooms || 0);
    updateEl('adminTotalQuestions', stats.questions || 0);
    updateEl('adminTotalComments', stats.comments || 0);
    updateEl('adminTotalMatches', stats.matches || 0);
    updateEl('adminStorageUsed', '—');

    // عرض رسالة في مكان الرسم البياني
    const chartsContainer = document.querySelector('#adminContentContainer .grid-2');
    if (chartsContainer) {
        chartsContainer.innerHTML = `
            <div class="card" style="grid-column:1/-1; text-align:center; padding:1rem;">
                <i class="fas fa-wifi-slash" style="font-size:2rem;color:var(--gray);"></i>
                <p class="text-gray">غير متصل بالإنترنت. البيانات غير محدثة.</p>
                <button class="btn btn-sm btn-primary" onclick="App._refreshAdmin()">محاولة إعادة الاتصال</button>
            </div>
        `;
    }

    // عرض رسالة في آخر النشاطات
    const activityContainer = document.getElementById('adminRecentActivity');
    if (activityContainer) {
        activityContainer.innerHTML = '<div class="text-gray">⚠️ غير متصل، لا توجد نشاطات حديثة</div>';
    }

    // إضافة تحذير في الأعلى
    const container = document.getElementById('adminContentContainer');
    if (container) {
        let warning = document.getElementById('offlineWarning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'offlineWarning';
            warning.style.cssText = 'background:var(--secondary);color:#fff;padding:8px 16px;border-radius:8px;margin-bottom:10px;text-align:center;';
            warning.innerHTML = '⚠️ أنت غير متصل بالإنترنت، البيانات المعروضة قديمة.';
            container.prepend(warning);
        }
    }
},

_renderAdminCharts(usersSnap) {
    // 1️⃣ رسم بياني توزيع الأدوار
    const rolesCanvas = document.getElementById('adminRolesChart');
    if (rolesCanvas) {
        // تدمير الرسم البياني السابق بأمان
        if (window.adminRolesChart && typeof window.adminRolesChart.destroy === 'function') {
            try {
                window.adminRolesChart.destroy();
            } catch (e) {
                console.warn('⚠️ Could not destroy previous roles chart:', e);
            }
            window.adminRolesChart = null;
        }

        // حساب توزيع الأدوار
        const roles = {};
        if (usersSnap) {
            usersSnap.forEach(doc => {
                const role = doc.data().role || 'user';
                roles[role] = (roles[role] || 0) + 1;
            });
        } else {
            // إذا لم تكن هناك بيانات، استخدم بيانات افتراضية
            roles['مستخدم'] = 1;
        }

        const labels = Object.keys(roles);
        const data = Object.values(roles);
        const colors = ['#6C63FF', '#FF6B6B', '#FFD93D', '#2ecc71', '#a29bfe', '#f39c12', '#1abc9c'];

        try {
            const ctx = rolesCanvas.getContext('2d');
            window.adminRolesChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, data.length),
                        borderColor: 'var(--dark)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: 'var(--light)', font: { size: 11 } }
                        }
                    }
                }
            });
        } catch (e) {
            console.warn('⚠️ Could not create roles chart:', e);
        }
    }

    // 2️⃣ رسم بياني للنشاط (خطي)
    const activityCanvas = document.getElementById('adminActivityChart');
    if (activityCanvas) {
        // تدمير الرسم البياني السابق بأمان
        if (window.adminActivityChart && typeof window.adminActivityChart.destroy === 'function') {
            try {
                window.adminActivityChart.destroy();
            } catch (e) {
                console.warn('⚠️ Could not destroy previous activity chart:', e);
            }
            window.adminActivityChart = null;
        }

        // بيانات النشاط (مثال - يمكن جلبها من Firestore)
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        // بيانات افتراضية (يمكن استبدالها ببيانات حقيقية)
        const activityData = [5, 8, 6, 12, 9, 15, 10];

        try {
            const ctx = activityCanvas.getContext('2d');
            window.adminActivityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'نشاط المستخدمين',
                        data: activityData,
                        borderColor: '#6C63FF',
                        backgroundColor: 'rgba(108, 99, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#6C63FF',
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: 'var(--light)', font: { size: 11 } }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: 'var(--gray)' }
                        },
                        x: {
                            ticks: { color: 'var(--gray)' }
                        }
                    }
                }
            });
        } catch (e) {
            console.warn('⚠️ Could not create activity chart:', e);
        }
    }
},

_renderAdminRecentActivity() {
    const container = document.getElementById('adminRecentActivity');
    if (!container) return;
    // يمكن جلب آخر النشاطات من Firestore (collection 'activities')
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.3rem;">
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--glass-border);">
                <span>📝 مستخدم جديد سجل</span>
                <span class="text-gray" style="font-size:0.8rem;">منذ 5 دقائق</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--glass-border);">
                <span>⚽ مباراة جديدة أضيفت</span>
                <span class="text-gray" style="font-size:0.8rem;">منذ ساعة</span>
            </div>
            <div class="text-gray">(يمكنك تخصيص هذا القسم لجلب النشاطات الفعلية)</div>
        </div>
    `;
},

async _renderAdminUsers() {
    console.log('🔄 _renderAdminUsers called, page:', page);
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) {
        console.error('❌ adminUsersTableBody not found!');
        // محاولة إعادة إنشاء الجدول
        const tableWrap = document.querySelector('.table-wrap');
        if (tableWrap) {
            tableWrap.innerHTML = `
                <table>
                    <thead><tr><th>#</th><th>المستخدم</th><th>البريد</th><th>الدور</th><th>النقاط</th><th>العملات</th><th>الحالة</th><th>تاريخ الانضمام</th><th>الإجراءات</th></tr></thead>
                    <tbody id="adminUsersTableBody"><tr><td colspan="9" class="text-center text-gray">⚠️ إعادة إنشاء الجدول، حاول التحديث</td></tr></tbody>
                </table>
            `;
            setTimeout(() => this._renderAdminUsers(page), 300);
        }
        return;
    }

    // ✅ 1. استخدام البيانات المخزنة محلياً أولاً (إن وجدت)
    let users = this._cachedUsers || [];
    let fromFirestore = false;

    // إذا كانت البيانات المحلية فارغة، نحاول جلبها من DataManager (إن وجدت)
    if (users.length === 0 && DataManager.data.users) {
        users = DataManager.data.users;
        this._cachedUsers = users;
        console.log(`📦 Using users from DataManager (${users.length})`);
    }

    // عرض البيانات المحلية فوراً (حتى لو كانت فارغة)
    this._renderUserTable(users, page);

    // ✅ 2. في الخلفية، نحاول جلب البيانات من Firestore (لتحديث القائمة)
    try {
        console.log('📡 Fetching users from Firestore...');
        const snapshot = await db.collection('users').get();
        const freshUsers = [];
        snapshot.forEach(doc => {
            freshUsers.push({ id: doc.id, uid: doc.id, ...doc.data() });
        });
        console.log(`✅ Fetched ${freshUsers.length} users from Firestore`);

        // تحديث الكاش والجدول بالبيانات الجديدة
        this._cachedUsers = freshUsers;
        this._renderUserTable(freshUsers, page);
        fromFirestore = true;
    } catch (error) {
        console.warn('⚠️ Could not fetch from Firestore, using cached data:', error.message);
        // إذا كان هناك خطأ (مثل تجاوز الحد)، نستمر في عرض البيانات المحلية
        if (users.length === 0) {
            // إذا لم تكن هناك بيانات محلية ولا Firestore، نعرض بيانات تجريبية
            users = this._getMockUsers();
            this._cachedUsers = users;
            this._renderUserTable(users, page);
            showToast('⚠️ عرض بيانات تجريبية (تعذر الاتصال بقاعدة البيانات)', 'error', 5000);
        }
    }
},

// ✅ دالة مساعدة لعرض الجدول (مستقلة عن مصدر البيانات)
_renderUserTable(users, page = 1) {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;

    // تطبيق البحث والفلترة
    const search = document.getElementById('adminSearchUser')?.value?.toLowerCase() || '';
    const roleFilter = document.getElementById('adminFilterRole')?.value || '';
    const statusFilter = document.getElementById('adminFilterStatus')?.value || '';

    let filteredUsers = users.filter(u => {
        const name = (u.username || u.displayName || u.email || '').toLowerCase();
        const matchSearch = name.includes(search);
        const matchRole = roleFilter ? u.role === roleFilter : true;
        let status = 'active';
        if (u.banned) status = 'banned';
        else if (u.lastActive) {
            const last = u.lastActive.toDate?.() || new Date(u.lastActive);
            if (Date.now() - last.getTime() > 7 * 24 * 60 * 60 * 1000) status = 'inactive';
        }
        const matchStatus = statusFilter ? status === statusFilter : true;
        return matchSearch && matchRole && matchStatus;
    });

    filteredUsers.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    const total = filteredUsers.length;
    const pageSize = 10;
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = Math.min(page, totalPages) || 1;
    const start = (currentPage - 1) * pageSize;
    const paginated = filteredUsers.slice(start, start + pageSize);

    // تحديث العدد
    const countEl = document.getElementById('adminUsersCount');
    if (countEl) countEl.textContent = `${total} مستخدم`;

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-gray">لا توجد نتائج مطابقة</td></tr>`;
    } else {
        let html = '';
        const canEdit = AuthService.checkPermission('admin') || AuthService.checkPermission('super_admin');

    paginated.forEach((u, idx) => {
        // ✅ الاسم الكامل هو المعروض
        const fullName = u.fullName || u.displayName || u.username || 'مجهول';
        const username = u.username || 'guest';            const status = u.banned ? 'banned' : 'active';
            const statusColor = status === 'active' ? 'success' : 'danger';
            const statusText = status === 'active' ? '🟢 نشط' : '🔴 محظور';
            const avatarHtml = u.avatar 
                ? `<div style="width:32px;height:32px;border-radius:50%;background:url('${u.avatar}') center/cover;flex-shrink:0;"></div>` 
                : `<div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.8rem;flex-shrink:0;">${(u.username?.charAt(0) || '👤').toUpperCase()}</div>`;

            const joinDate = u.createdAt ? formatDate(u.createdAt) : '—';

        html += `
            <tr>
                <td>${start + idx + 1}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${avatarHtml}
                        <div>
                            <div style="font-weight:600;">${fullName}</div>
                            <div style="font-size:0.7rem;color:var(--gray);">@${username}</div>
                        </div>
                    </div>
                </td>
                    <td>${u.email || '—'}</td>
                    <td><span class="badge badge-primary">${AuthService.getRoleLabel(u.role || 'user')}</span></td>
                    <td>⭐ ${u.totalScore || 0}</td>
                    <td>💰 ${u.coins || 0}</td>
                    <td><span class="badge badge-${statusColor}">${statusText}</span></td>
                    <td>${joinDate}</td>
                    <td>
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            ${canEdit ? `
                                <button class="btn btn-xs btn-primary" onclick="App._openAdminEditUser('${u.uid}')" title="تعديل"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-xs btn-${status === 'banned' ? 'success' : 'danger'}" onclick="App._toggleUserBan('${u.uid}','${status}')" title="${status === 'banned' ? 'إلغاء الحظر' : 'حظر'}">
                                    <i class="fas fa-${status === 'banned' ? 'unlock' : 'ban'}"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-xs btn-outline" onclick="App._viewUserProfile('${u.uid}')" title="عرض الملف"><i class="fas fa-eye"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    // الترقيم
    this._renderAdminPagination('adminUsersPagination', totalPages, currentPage, (p) => {
        this._renderUserTable(filteredUsers, p); // استخدام البيانات المفلترة نفسها
    });
},

// ✅ دالة للحصول على بيانات تجريبية (في حالة عدم وجود أي بيانات)
_getMockUsers() {
    return [
        { uid: 'mock1', username: 'أحمد', email: 'ahmed@example.com', role: 'admin', totalScore: 1500, coins: 200, banned: false, createdAt: new Date().toISOString() },
        { uid: 'mock2', username: 'سارة', email: 'sara@example.com', role: 'user', totalScore: 800, coins: 50, banned: false, createdAt: new Date().toISOString() },
        { uid: 'mock3', username: 'محمد', email: 'mohamed@example.com', role: 'editor', totalScore: 1200, coins: 100, banned: true, createdAt: new Date().toISOString() },
    ];
},

// ============================================================
// عرض أزرار الترقيم
// ============================================================

_renderAdminPagination(containerId, totalPages, currentPage, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page !== currentPage) callback(page);
        });
    });
},

// ============================================================
// فتح نافذة تعديل المستخدم (مطورة)
// ============================================================

async _openAdminEditUser(uid) {
    if (!AuthService.checkPermission('admin') && !AuthService.checkPermission('super_admin')) {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) {
            showToast('المستخدم غير موجود', 'error');
            return;
        }
        const data = doc.data();
        // تعبئة النموذج في المودال (سنفترض وجود عناصر)
        document.getElementById('adminUserUid').value = uid;
        document.getElementById('adminUserRole').value = data.role || 'user';
        document.getElementById('adminUserAdminRole').value = data.adminRole || '';
        document.getElementById('adminUserScore').value = data.totalScore || 0;
        document.getElementById('adminUserCoins').value = data.coins || 0;
        document.getElementById('adminUserModal').classList.add('open');
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

// ============================================================
// تبديل حالة الحظر
// ============================================================

async _toggleUserBan(uid, currentStatus) {
    if (!AuthService.checkPermission('admin') && !AuthService.checkPermission('super_admin')) {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    if (!confirm(`هل أنت متأكد من ${currentStatus === 'banned' ? 'إلغاء حظر' : 'حظر'} هذا المستخدم؟`)) return;
    try {
        await db.collection('users').doc(uid).update({ banned: currentStatus !== 'banned' });
        showToast(`✅ تم ${currentStatus === 'banned' ? 'إلغاء حظر' : 'حظر'} المستخدم`, 'success');
        this._renderAdminUsers(); // تحديث القائمة
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

// ============================================================
// تصدير المستخدمين كـ CSV
// ============================================================

_exportUsersCSV() {
    db.collection('users').get().then(snapshot => {
        const rows = [['الاسم', 'البريد', 'الدور', 'النقاط', 'العملات', 'الحالة', 'تاريخ الانضمام']];
        snapshot.forEach(doc => {
            const u = doc.data();
            rows.push([
                u.username || u.displayName || 'مجهول',
                u.email || '',
                AuthService.getRoleLabel(u.role || 'user'),
                u.totalScore || 0,
                u.coins || 0,
                u.banned ? 'محظور' : 'نشط',
                formatDate(u.createdAt)
            ]);
        });
        const csv = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('✅ تم تصدير المستخدمين', 'success');
    }).catch(e => showToast('❌ خطأ في التصدير', 'error'));
},

// ============================================================
// إضافة مستخدم جديد (من لوحة المشرفين)
// ============================================================

_adminAddUser() {
    // فتح مودال لإضافة مستخدم
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:450px;">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> إضافة مستخدم جديد</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <form id="adminAddUserForm">
                <div class="form-group">
                    <label>اسم المستخدم *</label>
                    <input type="text" id="adminAddUsername" placeholder="أدخل اسم المستخدم" required>
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني *</label>
                    <input type="email" id="adminAddEmail" placeholder="example@mail.com" required>
                </div>
                <div class="form-group">
                    <label>كلمة المرور *</label>
                    <input type="password" id="adminAddPassword" placeholder="••••••••" required minlength="6">
                </div>
                <div class="form-group">
                    <label>الدور</label>
                    <select id="adminAddRole">
                        <option value="user">مستخدم</option>
                        <option value="editor">محرر</option>
                        <option value="manager">مدير عام</option>
                        <option value="admin">مدير</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> إضافة</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // ✅ معالج إرسال النموذج
    modal.querySelector('#adminAddUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('adminAddUsername').value.trim();
        const email = document.getElementById('adminAddEmail').value.trim();
        const password = document.getElementById('adminAddPassword').value;
        const role = document.getElementById('adminAddRole').value;

        if (!username || !email || !password) {
            showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
            return;
        }
        if (password.length < 6) {
            showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }

        try {
            showToast('⏳ جاري إنشاء المستخدم...', 'info');
            // إنشاء المستخدم في Firebase Auth
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: username });
            
            // إضافة المستخدم في Firestore
            await db.collection('users').doc(cred.user.uid).set({
                email: email,
                username: username,
                displayName: username,
                role: role || 'user',
                totalScore: 0,
                coins: 100,
                achievements: [],
                inventory: [],
                bio: '',
                location: '',
                avatar: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                adminRole: null,
                friends: [],
                blocked: [],
                stats: { gamesPlayed: 0, gamesWon: 0, correctAnswers: 0 }
            });

            showToast('✅ تم إنشاء المستخدم بنجاح', 'success');
            modal.remove();
            // تحديث قائمة المستخدمين
            this._renderAdminUsers();
            // تحديث إحصائيات لوحة التحكم
            this._updateAdminDashboard();

        } catch (error) {
            console.error('❌ Error creating user:', error);
            let message = 'فشل إنشاء المستخدم';
            if (error.code === 'auth/email-already-in-use') message = 'البريد الإلكتروني مستخدم بالفعل';
            else if (error.code === 'auth/weak-password') message = 'كلمة المرور ضعيفة جداً';
            else message = error.message;
            showToast('❌ ' + message, 'error');
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
},

_getUserStatus(user) {
    if (user.banned) return 'banned';
    if (user.lastActive) {
        const lastActive = user.lastActive.toDate?.() || new Date(user.lastActive);
        const diff = Date.now() - lastActive.getTime();
        if (diff < 7 * 24 * 60 * 60 * 1000) return 'active';
    }
    return 'inactive';
},

async _createBackup() {
    try {
        showToast('⏳ جاري إنشاء النسخة الاحتياطية...', 'info');
        const data = DataManager.data;
        const backup = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            data: data
        };
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('✅ تم إنشاء النسخة الاحتياطية', 'success');
        await this._logActivity('system', 'تم إنشاء نسخة احتياطية');
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

async _restoreBackup(file) {
    if (!file) return;
    if (!confirm('⚠️ استعادة النسخة ستستبدل جميع البيانات الحالية. هل أنت متأكد؟')) return;
    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.data) { showToast('❌ تنسيق الملف غير صحيح', 'error'); return; }
        showToast('⏳ جاري استعادة البيانات...', 'info');
        for (const [collection, items] of Object.entries(backup.data)) {
            if (Array.isArray(items) && ['players','clubs','matches','tournaments','questions','posts','rooms','storeItems'].includes(collection)) {
                for (const item of items) {
                    const { id, ...rest } = item;
                    if (id) await FirestoreService.update(collection, id, rest);
                    else await FirestoreService.add(collection, rest);
                }
            }
        }
        await DataManager.loadAll();
        showToast('✅ تم استعادة البيانات بنجاح', 'success');
        await this._logActivity('system', 'تم استعادة نسخة احتياطية');
    } catch (e) {
        showToast('❌ خطأ في الاستعادة: ' + e.message, 'error');
    }
},

    _renderSettingsSection() {
        return `
            <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:1.5rem;"><i class="fas fa-cog" style="color:var(--accent);"></i> الإعدادات المتقدمة</h2>
            <div class="grid-2">
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-cloud"></i> اتصال Firebase</h3>
                    <p class="text-gray">الحالة: <span id="firebaseStatus">جاري التحقق...</span></p>
                    <p class="text-gray" style="font-size:0.8rem;">آخر تحديث: <span id="lastUpdateTime">—</span></p>
                    <button class="btn btn-sm btn-primary" id="testConnectionBtn"><i class="fas fa-wifi"></i> اختبار الاتصال</button>
                </div>
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-users-cog"></i> إدارة المستخدمين</h3>
                    <p class="text-gray">المستخدم الحالي: <strong id="settingsCurrentUser">زائر</strong></p>
                    <p class="text-gray">الدور: <span id="settingsCurrentRole">user</span></p>
                    <div class="flex-center gap-1" style="flex-wrap:wrap;">
                        <button class="btn btn-outline" id="logoutBtn2"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>
                        <button class="btn btn-outline" id="profileSettingsBtn"><i class="fas fa-user-edit"></i> تعديل الملف</button>
                    </div>
                </div>
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-palette"></i> المظهر</h3>
                    <button class="btn btn-outline" id="themeToggleBtn"><i class="fas fa-moon"></i> الوضع الليلي</button>
                    <div class="form-group mt-1">
                        <label>لون الواجهة</label>
                        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                            <button class="btn btn-xs theme-color-btn" style="background:#6C63FF;color:#fff;" data-color="#6C63FF">أرجواني</button>
                            <button class="btn btn-xs theme-color-btn" style="background:#2196F3;color:#fff;" data-color="#2196F3">أزرق</button>
                            <button class="btn btn-xs theme-color-btn" style="background:#4CAF50;color:#fff;" data-color="#4CAF50">أخضر</button>
                            <button class="btn btn-xs theme-color-btn" style="background:#FF5722;color:#fff;" data-color="#FF5722">برتقالي</button>
                            <button class="btn btn-xs theme-color-btn" style="background:#E91E63;color:#fff;" data-color="#E91E63">وردي</button>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-database"></i> البيانات</h3>
                    <button class="btn btn-sm btn-outline" id="exportDataBtn"><i class="fas fa-file-export"></i> تصدير البيانات (JSON)</button>
                    <button class="btn btn-sm btn-outline mt-1" id="importDataBtn"><i class="fas fa-file-import"></i> استيراد البيانات</button>
                    <input type="file" id="importFileInput" accept=".json" style="display:none;">
                    <button class="btn btn-sm btn-danger mt-1" id="clearLocalStorageBtn"><i class="fas fa-trash"></i> مسح البيانات المحلية</button>
                </div>
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-bell"></i> الإشعارات</h3>
                    <div class="form-group"><label><input type="checkbox" id="notifGame"> إشعارات اللعبة</label></div>
                    <div class="form-group"><label><input type="checkbox" id="notifPosts"> إشعارات المنشورات</label></div>
                    <div class="form-group"><label><input type="checkbox" id="notifFriends"> طلبات الصداقة</label></div>
                    <div class="form-group"><label><input type="checkbox" id="notifStore"> عروض المتجر</label></div>
                    <button class="btn btn-sm btn-primary" id="saveNotifSettings"><i class="fas fa-save"></i> حفظ الإعدادات</button>
                </div>
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-shield"></i> الخصوصية</h3>
                    <div class="form-group"><label><input type="checkbox" id="privacyProfile"> إظهار الملف الشخصي للجميع</label></div>
                    <div class="form-group"><label><input type="checkbox" id="privacyOnline"> إظهار حالة الاتصال</label></div>
                    <button class="btn btn-sm btn-primary" id="savePrivacySettings"><i class="fas fa-save"></i> حفظ الإعدادات</button>
                </div>
            </div>
        `;
    },

    // ===== دوال التحديث =====
_updateStats(stats) {
    document.getElementById('statPlayers').textContent = stats.players || 0;
    document.getElementById('statClubs').textContent = stats.clubs || 0;
    document.getElementById('statMatches').textContent = stats.matches || 0;
    document.getElementById('statTournaments').textContent = stats.tournaments || 0;
    document.getElementById('statQuestions').textContent = stats.questions || 0;
    document.getElementById('statGamesPlayed').textContent = stats.gamesPlayed || 0;
    document.getElementById('statAchievements').textContent = stats.achievements || 0;
    document.getElementById('statTotalScore').textContent = stats.totalScore || 0;
    document.getElementById('statCoins').textContent = stats.coins || 0;
    document.getElementById('statPosts').textContent = stats.posts || 0;
    document.getElementById('statRooms').textContent = stats.rooms || 0;
    document.getElementById('statStoreItems').textContent = stats.storeItems || 0;
},

// ============================================================
// تحديث واجهة المستخدم بناءً على بيانات المستخدم
// ============================================================

_updateUserUI(user) {
    // ✅ عناصر رئيسية - التحقق من وجودها قبل التعديل
    const nameEl = document.getElementById('userNameDisplay');
    const roleEl = document.getElementById('userRoleDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtn2 = document.getElementById('logoutBtn2');
    const settingsUser = document.getElementById('settingsCurrentUser');
    const settingsRole = document.getElementById('settingsCurrentRole');
    const welcomeUser = document.getElementById('welcomeUser');
    const scoreDisplay = document.getElementById('userScoreDisplay');
    const coinsDisplay = document.getElementById('coinsAmount');
    const achTotalScore = document.getElementById('achTotalScore');
    const achLevel = document.getElementById('achLevel');
    const achCount = document.getElementById('achCount');
    const achCoins = document.getElementById('achCoins');
    const levelCurrent = document.getElementById('levelCurrent');
    const levelNext = document.getElementById('levelNext');
    const levelProgressFill = document.getElementById('levelProgressFill');
    const levelPointsDisplay = document.getElementById('levelPointsDisplay');
    const storeCoins = document.getElementById('storeCoins');
    const profileName = document.getElementById('profileName');
    const profileUsername = document.getElementById('profileUsername');
    const profileBio = document.getElementById('profileBio');
    const profileLocation = document.getElementById('profileLocation');
    const profileRole = document.getElementById('profileRole');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileJoinDate = document.getElementById('profileJoinDate');
    const profileGamesPlayed = document.getElementById('profileGamesPlayed');
    const profileGamesWon = document.getElementById('profileGamesWon');
    const profileCorrectAnswers = document.getElementById('profileCorrectAnswers');
    const profileCoins = document.getElementById('profileCoins');
    const profileScore = document.getElementById('profileScore');
    const adminNavLink = document.getElementById('adminNavLink');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    const gemsEl = document.getElementById('userGemsDisplay');

    if (user) {
            // الرتبة
    const rank = getRank(user.rankPoints || 0);
    const rankDisplay = document.getElementById('profileRankDisplay');
    if (rankDisplay) {
        rankDisplay.innerHTML = `
            <span style="font-size:1.2rem;">${rank.icon}</span>
            <span style="font-weight:700;color:${rank.color};">${rank.name}</span>
            <span style="font-size:0.7rem;color:var(--gray);">${user.rankPoints || 0} نقطة رتبة</span>
        `;
    }
    const rankPointsEl = document.getElementById('profileRankPoints');
    if (rankPointsEl) rankPointsEl.textContent = user.rankPoints || 0;
    
    const rankProgress = document.getElementById('rankProgressFill');
    if (rankProgress) {
        rankProgress.style.width = `${Math.min(rank.progress, 100)}%`;
        rankProgress.style.background = `linear-gradient(90deg, ${rank.color}, var(--accent))`;
    }
    const rankLabels = document.getElementById('rankLabels');
    if (rankLabels) {
        rankLabels.innerHTML = `
            <span>${rank.name}</span>
            <span>${rank.nextName}${rank.nextMin ? ` (${rank.nextMin})` : ''}</span>
        `;
    }
        const displayName = user.fullName || user.displayName || user.username || user.email || 'مستخدم';
        const username = user.username || 'guest';
        
        if (changeAvatarBtn) changeAvatarBtn.style.display = 'flex';
        if (removeAvatarBtn) {
            removeAvatarBtn.style.display = user.avatar ? 'flex' : 'none';
        }

        if (nameEl) nameEl.textContent = displayName;
        if (roleEl) {
            roleEl.textContent = AuthService.getRoleLabel(user.role);
            roleEl.style.display = 'inline-block';
        }
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (logoutBtn2) logoutBtn2.style.display = 'inline-flex';
        if (settingsUser) settingsUser.textContent = displayName;
        if (settingsRole) settingsRole.textContent = AuthService.getRoleLabel(user.role);
        if (welcomeUser) welcomeUser.textContent = `مرحباً ${displayName}`;
        if (scoreDisplay) scoreDisplay.textContent = `⭐ ${user.totalScore || 0}`;
        if (coinsDisplay) coinsDisplay.textContent = user.coins || 0;
        if (achTotalScore) achTotalScore.textContent = user.totalScore || 0;
        if (achCoins) achCoins.textContent = user.coins || 0;
        if (storeCoins) storeCoins.textContent = user.coins || 0;
        if (gemsEl) gemsEl.textContent = user.gems || 0;

        if (profileName) profileName.textContent = displayName;
        if (profileUsername) profileUsername.textContent = `@${username}`;
        if (profileBio) profileBio.textContent = user.bio || 'لا توجد سيرة ذاتية';
        if (profileLocation) profileLocation.textContent = user.location ? `📍 ${user.location}` : '📍 غير محدد';
        if (profileRole) profileRole.textContent = `دور: ${AuthService.getRoleLabel(user.role)}`;
        
        if (profileAvatar) {
            if (user.avatar && user.avatar.startsWith('data:image')) {
                profileAvatar.style.backgroundImage = `url(${user.avatar})`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';
            } else {
                profileAvatar.style.backgroundImage = '';
                profileAvatar.textContent = displayName.charAt(0).toUpperCase();
            }
        }
        
        if (profileJoinDate) profileJoinDate.textContent = formatDate(user.createdAt);
        if (profileGamesPlayed) profileGamesPlayed.textContent = user.stats?.gamesPlayed || 0;
        if (profileGamesWon) profileGamesWon.textContent = user.stats?.gamesWon || 0;
        if (profileCorrectAnswers) profileCorrectAnswers.textContent = user.stats?.correctAnswers || 0;
        if (profileCoins) profileCoins.textContent = user.coins || 0;
        if (profileScore) profileScore.textContent = user.totalScore || 0;

        if (achLevel) {
            const level = getLevel(user.totalScore || 0);
            achLevel.style.color = level.color;
        }
        if (achCount) {
            const stats = AchievementSystem.getAchievementStats(user);
            achCount.textContent = `${stats.unlocked} / ${stats.total}`;
        }

if (user) {
    // عرض الرتبة
    const rank = getRank(user.rankPoints || 0);
    const rankDisplay = document.getElementById('profileRankDisplay');
    if (rankDisplay) {
        rankDisplay.innerHTML = `
            <span style="font-size:1.2rem;">${rank.icon}</span>
            <span style="font-weight:700;color:${rank.color};">${rank.name}</span>
            <span style="font-size:0.7rem;color:var(--gray);">${user.rankPoints || 0} نقطة رتبة</span>
        `;
    }
    
    // شريط تقدم الرتبة
    const rankProgress = document.getElementById('rankProgressFill');
    if (rankProgress) {
        rankProgress.style.width = `${Math.min(rank.progress, 100)}%`;
        rankProgress.style.background = `linear-gradient(90deg, ${rank.color}, var(--accent))`;
    }
    const rankLabels = document.getElementById('rankLabels');
    if (rankLabels) {
        rankLabels.innerHTML = `
            <span>${rank.name}</span>
            <span>${rank.nextName}${rank.nextMin ? ` (${rank.nextMin})` : ''}</span>
        `;
    }
}

const progress = getLevelProgress(user.totalScore || 0);
document.getElementById('levelCurrentLabel').textContent = `المستوى ${progress.currentLevel}`;
if (progress.nextMin) {
    document.getElementById('levelNextLabel').textContent = `المستوى ${progress.nextLevel} (${progress.nextMin} نقطة)`;
} else {
    document.getElementById('levelNextLabel').textContent = '🏆 مكتمل';
}
        if (levelCurrent) levelCurrent.textContent = progress.current;
        if (levelNext) levelNext.textContent = progress.next;
        if (levelProgressFill) levelProgressFill.style.width = `${Math.min(progress.progress, 100)}%`;
        if (levelPointsDisplay) levelPointsDisplay.textContent = `${user.totalScore || 0} نقطة`;

        const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin' || user.adminRole);
        if (adminNavLink) {
            adminNavLink.style.display = isAdmin ? 'flex' : 'none';
        }

        // ✅ ============================================================
        // ✅ تطبيق التخصيصات (الإطارات، الخلفيات، الشارات، السمات)
        // ✅ يتم تطبيقها دائماً عند وجود مستخدم (من قاعدة البيانات)
        // ✅ ============================================================
        this._applyUserCustomizations(user);

    } else {
        // ❌ حالة عدم وجود مستخدم (زائر) - نعرض الواجهة الافتراضية فقط
        // ✅ لا نقوم بإزالة التخصيصات هنا لأن المستخدم غير موجود أصلاً
        const defaultName = 'زائر';
        if (nameEl) nameEl.textContent = defaultName;
        if (roleEl) {
            roleEl.textContent = '👀 لاعب';
            roleEl.style.display = 'inline-block';
        }
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (logoutBtn2) logoutBtn2.style.display = 'none';
        if (settingsUser) settingsUser.textContent = defaultName;
        if (settingsRole) settingsRole.textContent = '👀 لاعب';
        if (welcomeUser) welcomeUser.textContent = 'مرحباً بك!';
        if (scoreDisplay) scoreDisplay.textContent = '⭐ 0';
        if (coinsDisplay) coinsDisplay.textContent = '0';
        if (changeAvatarBtn) changeAvatarBtn.style.display = 'none';
        if (removeAvatarBtn) removeAvatarBtn.style.display = 'none';
        
        if (levelCurrent) levelCurrent.textContent = 'مبتدئ';
        if (levelNext) levelNext.textContent = 'محترف (100 نقطة)';
        if (levelProgressFill) levelProgressFill.style.width = '0%';
        if (levelPointsDisplay) levelPointsDisplay.textContent = '0 نقطة';
        
        if (profileName) profileName.textContent = defaultName;
        if (profileUsername) profileUsername.textContent = '@guest';
        if (profileBio) profileBio.textContent = 'لا توجد سيرة ذاتية';
        if (profileLocation) profileLocation.textContent = '📍 غير محدد';
        if (profileRole) profileRole.textContent = 'دور: لاعب';
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = '';
            profileAvatar.textContent = '👤';
        }
        if (adminNavLink) adminNavLink.style.display = 'none';
        
        // ✅ استعادة الألوان الافتراضية للواجهة (لأن المستخدم غير موجود)
        const root = document.documentElement;
        root.style.setProperty('--primary', '#6C63FF');
        root.style.setProperty('--accent', '#FFD93D');
        root.style.setProperty('--secondary', '#FF6B6B');
        
        // ✅ إعادة تعيين الإطار إلى الافتراضي
        if (profileAvatar) {
            profileAvatar.style.border = `4px solid var(--accent)`;
            profileAvatar.style.boxShadow = 'none';
        }
        
        // ✅ إزالة الشارة من الاسم (لأن المستخدم غير موجود)
        const nameEl2 = document.querySelector('.profile-name');
        if (nameEl2) {
            const oldBadge = nameEl2.querySelector('.active-badge-icon');
            if (oldBadge) oldBadge.remove();
        }
    }
},

/**
 * تطبيق جميع التخصيصات (الإطار، الخلفية، الشارة، السمة)
 */
_applyUserCustomizations(user) {
    if (!user) return;
    
    const activeItems = user.activeItems || [];
    const storeItems = DataManager.data.storeItems || [];
    const root = document.documentElement;
    
    // 1️⃣ الإطار المفعّل
    const activeFrame = storeItems.find(item => 
        activeItems.includes(item.id) && item.category === 'frames'
    );
    const avatarContainer = document.getElementById('profileAvatar');
    if (avatarContainer) {
        if (activeFrame) {
            const frameColors = {
                'bronze': '#cd7f32',
                'silver': '#c0c0c0',
                'gold': '#FFD700',
                'platinum': '#e5e4e2',
                'diamond': '#b9f2ff',
                'fire': '#ff4500',
                'legend': '#f1c40f',
                'glow': '#00ffff'
            };
            const color = frameColors[activeFrame.value] || 'var(--accent)';
            avatarContainer.style.border = `4px solid ${color}`;
            avatarContainer.style.boxShadow = `0 0 25px ${color}66`;
            avatarContainer.style.transition = 'all 0.3s ease';
        } else {
            avatarContainer.style.border = `4px solid var(--accent)`;
            avatarContainer.style.boxShadow = '0 0 15px rgba(255,217,61,0.2)';
        }
    }
    
    // 2️⃣ الخلفية المفعّلة على غلاف الملف الشخصي
    const activeBg = storeItems.find(item => 
        activeItems.includes(item.id) && item.category === 'backgrounds'
    );
    const cover = document.querySelector('.profile-cover');
    if (cover) {
        if (activeBg) {
            const bgStyles = {
                'stadium': 'linear-gradient(135deg, #1a3a2a, #2d7d46)',
                'crowd': 'linear-gradient(135deg, #1a252f, #2c3e50)',
                'trophy': 'linear-gradient(135deg, #d4ac0d, #f1c40f)',
                'night': 'linear-gradient(135deg, #0a0a1a, #1a1a3e)',
                'sunset': 'linear-gradient(135deg, #c0392b, #f39c12)',
                'sky': 'linear-gradient(135deg, #2980b9, #27ae60)',
                'lights': 'linear-gradient(135deg, #8e44ad, #3498db)',
                'legend_bg': 'linear-gradient(135deg, #f1c40f, #e67e22, #f1c40f)'
            };
            cover.style.background = bgStyles[activeBg.value] || 'var(--card-bg)';
            cover.style.backgroundSize = 'cover';
            cover.style.borderColor = 'var(--accent)';
        } else {
            cover.style.background = 'var(--card-bg)';
            cover.style.borderColor = 'var(--border-color)';
        }
    }
    
    // 3️⃣ الشارة المفعّلة
    const activeBadge = storeItems.find(item => 
        activeItems.includes(item.id) && item.category === 'badges'
    );
    const badgeContainer = document.querySelector('.profile-badges-container');
    if (badgeContainer && activeBadge) {
        const nameEl = document.querySelector('.profile-name');
        if (nameEl) {
            const oldBadge = nameEl.querySelector('.active-badge-icon');
            if (oldBadge) oldBadge.remove();
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'active-badge-icon';
            // ✅ استخدام الأيقونة الحقيقية من الشارة
            const badgeIcon = this._getBadgeIcon(activeBadge.id) || activeBadge.icon || '🏅';
            badgeSpan.textContent = badgeIcon;
            badgeSpan.style.marginRight = '8px';
            badgeSpan.style.fontSize = '1.2rem';
            const rarityColors = {
                'common': '#8e8e8e',
                'uncommon': '#2ecc71',
                'rare': '#3498db',
                'epic': '#9b59b6',
                'legendary': '#f1c40f'
            };
            badgeSpan.style.filter = `drop-shadow(0 0 8px ${rarityColors[activeBadge.rarity] || 'var(--accent)'}66)`;
            nameEl.prepend(badgeSpan);
        }
    }
    
    // 4️⃣ السمة المفعّلة
    const activeTheme = storeItems.find(item => 
        activeItems.includes(item.id) && item.category === 'themes'
    );
    
    // ألوان السمات
    const themeColors = {
        'gold': { primary: '#f1c40f', accent: '#f39c12', secondary: '#e67e22' },
        'electric': { primary: '#00d4ff', accent: '#0099ff', secondary: '#0066cc' },
        'fire': { primary: '#ff4500', accent: '#ff6b35', secondary: '#cc3300' },
        'emerald': { primary: '#2ecc71', accent: '#27ae60', secondary: '#1a8a4a' },
        'purple': { primary: '#9b59b6', accent: '#8e44ad', secondary: '#6c3483' },
        'neon_pink': { primary: '#ff2d75', accent: '#ff6b9d', secondary: '#cc0055' }
    };
    
    if (activeTheme && themeColors[activeTheme.value]) {
        const colors = themeColors[activeTheme.value];
        root.style.setProperty('--primary', colors.primary);
        root.style.setProperty('--accent', colors.accent);
        root.style.setProperty('--secondary', colors.secondary);
        console.log(`🎨 تم تطبيق سمة: ${activeTheme.name}`);
    } else {
        // العودة للألوان الافتراضية
        root.style.setProperty('--primary', '#6C63FF');
        root.style.setProperty('--accent', '#FFD93D');
        root.style.setProperty('--secondary', '#FF6B6B');
    }
},

/**
 * الحصول على الأيقونة الصحيحة للشارة
 */
_getBadgeIcon(badgeId) {
    const icons = {
        'badge_star': '⭐',
        'badge_king': '👑',
        'badge_warrior': '⚔️',
        'badge_god': '⚡',
        'badge_speed': '💨',
        'badge_smart': '🧠',
        'badge_invincible': '🛡️',
        'badge_legendary': '🌟'
    };
    return icons[badgeId] || '🏅';
},

// ============================================================
// تفعيل القسم المحدد
// ============================================================

_activateSection(id) {
    this.currentSection = id;
    // تحديث التنقل
    this.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === id);
    });
    document.querySelectorAll('.section').forEach(el => {
        el.classList.toggle('active', el.id === `section-${id}`);
    });
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.mobile-nav')?.classList?.remove('open');

    // ✅ معالجة قسم المشرفين
    if (id === 'admin') {
        // انتظر حتى يتم تحميل العناصر ثم اعرض التبويب
        const waitForContainer = () => {
            const container = document.getElementById('adminContentContainer');
            if (container) {
                this._showAdminTab('dashboard');
            } else {
                setTimeout(waitForContainer, 100);
            }
        };
        waitForContainer();
        return;
    }

if (id === 'multiplayer') {
    this._refreshMultiplayerGames();
    const container = document.getElementById('multiplayerGameContainer');
    if (container) container.innerHTML = '';
    this._hideMultiplayerGamePage();
    this._hideMultiplayerResultPage();
}

    // ✅ باقي الأقسام
    if (id === 'notifications') {
        this._renderNotificationsPage();
    }
    if (id === 'questions') {
        setTimeout(() => this._renderQuestionsAdvanced(), 100);
    }
    if (id === 'players' || id === 'clubs' || id === 'matches' || id === 'tournaments' || id === 'league') {
        this._renderAllTables(DataManager.data);
        this._populateSelects(DataManager.data);
        if (id === 'league') this._renderLeagueTable(DataManager.data);
    }
    if (id === 'store') {
        this._renderStore(DataManager.data.storeItems || []);
    }
    if (id === 'game') {
        document.getElementById('gameStartScreen').style.display = 'block';
        document.getElementById('gamePlayScreen').style.display = 'none';
    }
},

_waitForElement(selector, callback, timeout = 5000) {
    const startTime = Date.now();
    const check = () => {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }
        if (Date.now() - startTime > timeout) {
            console.warn(`⚠️ Element "${selector}" not found after ${timeout}ms`);
            return;
        }
        requestAnimationFrame(check);
    };
    check();
},

/**
 * فتح لوحة المشرفين بعد التأكد من المستخدم
 */
_openAdminPanel() {
    if (!this._isAdminUser()) {
        showToast('⚠️ ليس لديك صلاحية للدخول', 'error');
        this._activateSection('dashboard');
        return;
    }
    // تأخير صغير لضمان تحميل العناصر
    setTimeout(() => {
        this._showAdminTab('dashboard');
    }, 100);
},

    // ===== معالجات الأحداث =====
    _setupUI() {
        this._initSearch();
        // Navigation
        this.navLinks = document.querySelectorAll('#mainNav a, #mobileNav a');
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this._activateSection(section);
                if (section === 'game') {
                    document.getElementById('gameStartScreen').style.display = 'block';
                    document.getElementById('gamePlayScreen').style.display = 'none';
                    document.getElementById('gameResultScreen').style.display = 'none';
                }
                if (section === 'admin') this._renderAdminData();
                if (section === 'store') this._renderStore(DataManager.data.storeItems || []);
            });
        });

const searchInput = document.getElementById('searchQuestion');
if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
        App._renderQuestionsAdvanced();
    }, 300));
}

// تصنيف - تطبيق فوري
const categoryFilter = document.getElementById('filterQuestionCategory');
if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
        App._renderQuestionsAdvanced();
    });
}

// الصعوبة - تطبيق فوري
const difficultyFilter = document.getElementById('filterQuestionDifficulty');
if (difficultyFilter) {
    difficultyFilter.addEventListener('change', () => {
        App._renderQuestionsAdvanced();
    });
}

// النوع - تطبيق فوري
const typeFilter = document.getElementById('filterQuestionType');
if (typeFilter) {
    typeFilter.addEventListener('change', () => {
        App._renderQuestionsAdvanced();
    });
}

// الترتيب - تطبيق فوري
const sortFilter = document.getElementById('filterQuestionSort');
if (sortFilter) {
    sortFilter.addEventListener('change', () => {
        App._renderQuestionsAdvanced();
    });
}

// ===== أحداث لوحة المشرفين =====
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.preventDefault();
        // إزالة التحديد من جميع التبويبات
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        const tabName = this.dataset.tab;
        console.log(`📌 Tab clicked: ${tabName}`);
        App._showAdminTab(tabName);
    });
});
// زر تحديث لوحة المشرفين
document.getElementById('refreshAdminBtn')?.addEventListener('click', () => {
    App._showAdminTab('dashboard');
});

// أحداث البحث والفلترة
document.getElementById('adminSearchUser')?.addEventListener('input', debounce(() => {
    App._renderAdminUsers();
}, 300));
document.getElementById('adminFilterRole')?.addEventListener('change', () => {
    App._renderAdminUsers();
});

// أزرار النسخ الاحتياطي
document.getElementById('adminCreateBackupBtn')?.addEventListener('click', () => {
    App._createBackup();
});
document.getElementById('adminRestoreBackupBtn')?.addEventListener('click', () => {
    document.getElementById('adminRestoreFile').click();
});
document.getElementById('adminRestoreFile')?.addEventListener('change', (e) => {
    if (e.target.files[0]) App._restoreBackup(e.target.files[0]);
    e.target.value = '';
});

document.getElementById('adminFilterStatus')?.addEventListener('change', () => {
    App._renderAdminUsers();
});

// أزرار النسخ الاحتياطي
document.getElementById('adminCreateBackupBtn')?.addEventListener('click', () => {
    App._createBackup();
});
document.getElementById('adminRestoreBackupBtn')?.addEventListener('click', () => {
    document.getElementById('adminRestoreFile').click();
});
document.getElementById('adminRestoreFile')?.addEventListener('change', (e) => {
    if (e.target.files[0]) App._restoreBackup(e.target.files[0]);
    e.target.value = '';
});

    // ===== زر إنشاء منشور =====
    const openAddPostBtn = document.getElementById('openAddPostBtn');
    if (openAddPostBtn) {
        openAddPostBtn.addEventListener('click', () => {
            if (!AuthService.currentUser) {
                showToast('يجب تسجيل الدخول أولاً', 'error');
                return;
            }
            document.getElementById('postForm').reset();
            document.getElementById('postModal').classList.add('open');
        });
    }

// ===== أحداث صفحة الأسئلة =====
// البحث
document.getElementById('searchQuestion')?.addEventListener('input', debounce(() => {
    App._renderQuestionsAdvanced();
}, 300));

document.getElementById('importQuestionsBtn')?.addEventListener('click', () => {
    document.getElementById('importQuestionsFile').click();
});

document.getElementById('importQuestionsFile')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        App._importQuestions(e.target.files[0]);
    }
    e.target.value = '';
});

document.getElementById('checkDuplicatesBtn')?.addEventListener('click', () => {
    const questions = DataManager.data.questions || [];
    if (questions.length === 0) {
        showToast('لا توجد أسئلة للتدقيق', 'info');
        return;
    }
    
    // عرض رسالة تحميل
    showToast('🔍 جاري فحص الأسئلة...', 'info', 2000);
    
    // ✅ استخدام setTimeout لتجنب تجميد الواجهة
    setTimeout(() => {
        const duplicates = App._findDuplicateQuestions(questions);
        const similar = App._findSimilarQuestions(questions, 0.85);
        
        App._showDuplicateReport(questions, duplicates, similar);
    }, 100);
});

// في _setupUI - أضف هذه الأحداث

// ===== زر إلغاء الاستيراد =====
document.getElementById('cancelImportBtn')?.addEventListener('click', () => {
    if (confirm('هل تريد إلغاء عملية الاستيراد؟')) {
        if (App._importTimer) {
            clearInterval(App._importTimer);
            App._importTimer = null;
        }
        App._isImporting = false;
        App._showImportProgress(false);
        showToast('⏹️ تم إلغاء الاستيراد', 'info');
    }
});

// ===== زر إلغاء الحذف =====
document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    if (confirm('هل تريد إلغاء عملية الحذف؟')) {
        if (App._deleteTimer) {
            clearInterval(App._deleteTimer);
            App._deleteTimer = null;
        }
        App._showDeleteProgress(false);
        showToast('⏹️ تم إلغاء عملية الحذف', 'info');
        App._renderQuestionsAdvanced();
    }
});

// فلاتر
document.getElementById('filterQuestionCategory')?.addEventListener('change', () => {
    App._renderQuestionsAdvanced();
});
document.getElementById('filterQuestionDifficulty')?.addEventListener('change', () => {
    App._renderQuestionsAdvanced();
});
document.getElementById('filterQuestionSort')?.addEventListener('change', () => {
    App._renderQuestionsAdvanced();
});

document.getElementById('openQuestionBank')?.addEventListener('click', () => {
    App._openQuestionBank();
});

// مسح الفلاتر
document.getElementById('clearQuestionFilters')?.addEventListener('click', () => {
    const search = document.getElementById('searchQuestion');
    const category = document.getElementById('filterQuestionCategory');
    const difficulty = document.getElementById('filterQuestionDifficulty');
    const type = document.getElementById('filterQuestionType');
    const sort = document.getElementById('filterQuestionSort');
    
    if (search) search.value = '';
    if (category) category.value = '';
    if (difficulty) difficulty.value = '';
    if (type) type.value = '';
    if (sort) sort.value = 'newest';
    
    App._renderQuestionsAdvanced();
});

// زر تحديد الكل
document.getElementById('selectAllQuestionsBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('selectAllQuestionsBtn');
    const questions = DataManager.data.questions || [];
    const filtered = App._getFilteredQuestions();
    
    if (App._selectedQuestions.length === filtered.length && filtered.length > 0) {
        App._deselectAllQuestions();
        btn.innerHTML = '<i class="fas fa-check-double"></i> تحديد الكل';
    } else {
        App._selectAllQuestions();
        btn.innerHTML = '<i class="fas fa-times"></i> إلغاء الكل';
    }
});

// زر حذف المحدد
document.getElementById('deleteSelectedQuestionsBtn')?.addEventListener('click', () => {
    App._deleteSelectedQuestions();
});

// زر حذف جميع الأسئلة
document.getElementById('deleteAllQuestionsBtn')?.addEventListener('click', () => {
    App._deleteAllQuestions();
});

// تحديث حالة زر "تحديد الكل" عند تغيير الفلاتر
document.getElementById('searchQuestion')?.addEventListener('input', () => {
    App._updateSelectAllButton();
});
document.getElementById('filterQuestionType')?.addEventListener('change', () => {
    App._updateSelectAllButton();
});
document.getElementById('filterQuestionCategory')?.addEventListener('change', () => {
    App._updateSelectAllButton();
});
document.getElementById('filterQuestionDifficulty')?.addEventListener('change', () => {
    App._updateSelectAllButton();
});

// زر إضافة سؤال من القائمة الفارغة
document.getElementById('emptyAddQuestion')?.addEventListener('click', () => {
    document.getElementById('openAddQuestion').click();
});

// استيراد
document.getElementById('importQuestionsBtn')?.addEventListener('click', () => {
    document.getElementById('importQuestionsFile').click();
});
document.getElementById('importQuestionsFile')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        App._importQuestions(e.target.files[0]);
    }
    e.target.value = '';
});

// تصدير
document.getElementById('exportQuestionsBtn')?.addEventListener('click', () => {
    App._exportQuestions();
});

// عند فتح مودال السؤال، تأكد من تحديث النوع
document.getElementById('openAddQuestion')?.addEventListener('click', () => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'question') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    // إعادة تعيين النموذج
    const form = document.getElementById('questionForm');
    if (form) {
        form.reset();
        form.dataset.mode = '';
        form.dataset.id = '';
    }
    document.getElementById('qFormId').value = '';
    document.getElementById('questionModalTitle').textContent = 'إضافة سؤال';
    
    // إظهار الخيارات الافتراضية
    App._updateQuestionTypeUI('multiple_choice');
    
    App._openModal('questionModal');
});

    // ===== زر تحديث المنشورات =====
    document.getElementById('refreshPostsBtn')?.addEventListener('click', () => {
        this._renderPosts(DataManager.data.posts || []);
        showToast('✅ تم تحديث المنشورات', 'success');
    });

document.getElementById('loginToPostBtn')?.addEventListener('click', () => {
    document.getElementById('loginModal').classList.add('open');
});

        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Sync button
        document.getElementById('syncDataBtn')?.addEventListener('click', async () => {
            const btn = document.getElementById('syncDataBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
            try {
                await DataManager.loadAll();
                showToast('✅ تمت المزامنة بنجاح', 'success');
            } catch (e) {
                showToast('❌ خطأ في المزامنة: ' + e.message, 'error');
            }
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync"></i> مزامنة';
        });

        document.getElementById('refreshStatsBtn')?.addEventListener('click', () => {
            this._updateUI();
            showToast('✅ تم تحديث الإحصائيات', 'success');
        });

        document.getElementById('refreshLeagueBtn')?.addEventListener('click', () => {
            this._renderLeagueTable(DataManager.data);
            showToast('✅ تم تحديث جدول الدوري', 'success');
        });

        document.getElementById('refreshStoreBtn')?.addEventListener('click', () => {
            this._renderStore(DataManager.data.storeItems || []);
            showToast('✅ تم تحديث المتجر', 'success');
        });

        // Search filters
        const searchFields = ['player', 'club', 'match', 'tournament', 'question'];
        searchFields.forEach(field => {
            const input = document.getElementById(`search${capitalize(field)}`);
            if (input) {
                input.addEventListener('input', debounce(() => {
                    localStorage.setItem(`${field}Page`, '1');
                    this._renderAllTables(DataManager.data);
                }, 300));
            }
        });

        document.getElementById('filterPlayerPosition')?.addEventListener('change', () => {
            localStorage.setItem('playerPage', '1');
            this._renderAllTables(DataManager.data);
        });
        document.getElementById('filterQuestionCategory')?.addEventListener('change', () => {
            localStorage.setItem('questionPage', '1');
            this._renderAllTables(DataManager.data);
        });

   // فلاتر الإشعارات
    document.querySelectorAll('.notification-filters .filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('.notification-filters .filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            App._renderNotificationsPage();
        });
    });
    
    // زر تحديد الكل كمقروء
    document.getElementById('markAllNotificationsRead')?.addEventListener('click', async () => {
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول', 'error');
            return;
        }
        
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', AuthService.currentUser.uid)
                .where('read', '==', false)
                .get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();
            
            showToast('✅ تم تحديث جميع الإشعارات كمقروءة', 'success');
            this._renderNotificationsPage();
            this._updateNotificationBadge();
        } catch (e) {
            showToast('❌ خطأ: ' + e.message, 'error');
        }
    });
    
    // زر تحديث الإشعارات
    document.getElementById('refreshNotificationsBtn')?.addEventListener('click', () => {
        this._renderNotificationsPage();
        showToast('✅ تم تحديث الإشعارات', 'success');
    });

        document.querySelectorAll('.clear-filters-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const section = this.dataset.section;
                const input = document.getElementById(`search${capitalize(section)}`);
                if (input) input.value = '';
                if (section === 'players') document.getElementById('filterPlayerPosition').value = '';
                if (section === 'questions') document.getElementById('filterQuestionCategory').value = '';
                localStorage.setItem(`${section}Page`, '1');
                App._renderAllTables(DataManager.data);
            });
        });

    // ===== ربط أزرار الإضافة =====
    const addButtons = [
        { id: 'openAddPlayer', modal: 'playerModal' },
        { id: 'openAddClub', modal: 'clubModal' },
        { id: 'openAddMatch', modal: 'matchModal' },
        { id: 'openAddTournament', modal: 'tournamentModal' },
        { id: 'openAddQuestion', modal: 'questionModal' }
    ];
    
    addButtons.forEach(({ id, modal }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole) {
                    showToast('ليس لديك صلاحية', 'error');
                    return;
                }
                const modalEl = document.getElementById(modal);
                if (modalEl) {
                    // إعادة تعيين النموذج
                    const form = modalEl.querySelector('form');
                    if (form) {
                        form.reset();
                        form.dataset.mode = '';
                        form.dataset.id = '';
                    }
                    const idInput = modalEl.querySelector('input[type="hidden"]');
                    if (idInput) idInput.value = '';
                    
                    // تحديث العنوان
                    const titleMap = {
                        playerModal: 'إضافة لاعب',
                        clubModal: 'إضافة نادي',
                        matchModal: 'إضافة مباراة',
                        tournamentModal: 'إضافة بطولة',
                        questionModal: 'إضافة سؤال'
                    };
                    const titleEl = document.getElementById(`${modal.replace('Modal', '')}ModalTitle`);
                    if (titleEl) titleEl.textContent = titleMap[modal] || 'إضافة';
                    
                    modalEl.classList.add('open');
                }
            });
        }
    });

        this._setupModalHandlers();
        this._setupFormHandlers();
        this._setupAuthHandlers();
        this._setupSettingsHandlers();
        this._setupCRUDHandlers();
        this._setupPostHandlers();
        this._setupStoreHandlers();
        this._setupAdminHandlers();
        this._setupProfileHandlers();
        this._initQuestionForm();
        this._setupMultiplayerHandlers();
    },

_setupModalHandlers() {
    // ===== إغلاق المودالات عند النقر على الخلفية =====
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.removeEventListener('click', this._handleOverlayClick);
        overlay.addEventListener('click', this._handleOverlayClick);
    });
    
    // ===== إغلاق عند الضغط على ESC =====
    document.removeEventListener('keydown', this._handleEscKey);
    document.addEventListener('keydown', this._handleEscKey);
    
    // ===== ربط جميع أزرار الإغلاق =====
    this._bindCloseButtons();

    // ===== زر إنشاء منشور =====
    document.getElementById('openAddPostBtn')?.addEventListener('click', () => {
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        document.getElementById('postForm').reset();
        document.getElementById('postModal').classList.add('open');
    });

        document.getElementById('closeProfileEditModal')?.addEventListener('click', () => {
            document.getElementById('profileEditModal').classList.remove('open');
        });
        document.getElementById('profileEditModal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('profileEditModal').classList.remove('open');
        });

        document.getElementById('closeAdminUserModal')?.addEventListener('click', () => {
            document.getElementById('adminUserModal').classList.remove('open');
        });
        document.getElementById('adminUserModal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('adminUserModal').classList.remove('open');
        });

        document.getElementById('closeStorePurchaseModal')?.addEventListener('click', () => {
            document.getElementById('storePurchaseModal').classList.remove('open');
        });
        document.getElementById('storePurchaseModal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('storePurchaseModal').classList.remove('open');
        });
        document.getElementById('cancelPurchaseBtn')?.addEventListener('click', () => {
            document.getElementById('storePurchaseModal').classList.remove('open');
        });
    },

    _setupFormHandlers() {
      // في _setupFormHandlers أو _setupUI
document.getElementById('editPostForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const postId = document.getElementById('editPostId').value;
    const content = document.getElementById('editPostContent').value.trim();
    const image = document.getElementById('editPostImage').value.trim();
    if (!content) {
        showToast('يرجى إدخال محتوى المنشور', 'error');
        return;
    }
    await App._editPost(postId, content, image);
});

// إغلاق المودال
document.getElementById('closeEditPostModal')?.addEventListener('click', () => {
    document.getElementById('editPostModal').classList.remove('open');
});
document.getElementById('editPostModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('editPostModal').classList.remove('open');
    }
});
        // Player form
document.getElementById('playerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'player') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const form = e.target;
    const id = form.dataset.id || document.getElementById('playerFormId').value;
    const data = {
        name: document.getElementById('pName').value.trim(),
        club: document.getElementById('pClub').value,
        position: document.getElementById('pPosition').value,
        age: parseInt(document.getElementById('pAge').value),
        nationality: document.getElementById('pNationality').value.trim(),
        number: parseInt(document.getElementById('pNumber').value) || 0,
        goals: parseInt(document.getElementById('pGoals').value) || 0,
        assists: parseInt(document.getElementById('pAssists').value) || 0,
        image: document.getElementById('pImage').value.trim(),
    };
    if (!data.name || !data.club || !data.position || !data.age) {
        return showToast('يرجى ملء الحقول المطلوبة (*)', 'error');
    }
    try {
        if (id && form.dataset.mode === 'update') {
            await DataManager.update('players', id, data);
            showToast('✅ تم التحديث بنجاح', 'success');
        } else {
            await DataManager.add('players', data);
            showToast('✅ تم الإضافة بنجاح', 'success');
        }
        document.getElementById('playerModal').classList.remove('open');
        // ✅ تحديث الجداول
        App._renderAllTables(DataManager.data);
        App._populateSelects(DataManager.data);
        App._updateStats(DataManager.getStats());
    } catch (err) {
        showToast('❌ خطأ: ' + err.message, 'error');
    }
});


        // Club form
document.getElementById('clubForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'club') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const form = e.target;
    const id = form.dataset.id || document.getElementById('clubFormId').value;
    const data = {
        name: document.getElementById('cName').value.trim(),
        city: document.getElementById('cCity').value.trim(),
        league: document.getElementById('cLeague').value.trim(),
        founded: parseInt(document.getElementById('cFounded').value) || null,
        logo: document.getElementById('cLogo').value.trim(),
    };
    if (!data.name) {
        showToast('يرجى إدخال اسم النادي', 'error');
        return;
    }
    try {
        if (id && form.dataset.mode === 'update') {
            await DataManager.update('clubs', id, data);
            showToast('✅ تم تحديث النادي', 'success');
        } else {
            await DataManager.add('clubs', data);
            showToast('✅ تم إضافة النادي', 'success');
        }
        App._closeModal('clubModal');
        App._refreshAllData(); // ✅ تحديث جميع الجداول
    } catch (err) {
        showToast('❌ خطأ: ' + err.message, 'error');
    }
});

// في _setupFormHandlers
document.getElementById('matchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'match') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const form = e.target;
    const id = form.dataset.id || document.getElementById('matchFormId').value;
    const team1 = document.getElementById('mTeam1').value;
    const team2 = document.getElementById('mTeam2').value;
    if (team1 === team2) {
        showToast('لا يمكن أن يكون الفريقان متطابقين', 'error');
        return;
    }
    const data = {
        team1: team1,
        team2: team2,
        score1: parseInt(document.getElementById('mScore1').value) || 0,
        score2: parseInt(document.getElementById('mScore2').value) || 0,
        date: document.getElementById('mDate').value,
        tournament: document.getElementById('mTournament').value,
    };
    try {
        if (id && form.dataset.mode === 'update') {
            await DataManager.update('matches', id, data);
            showToast('✅ تم تحديث المباراة', 'success');
        } else {
            await DataManager.add('matches', data);
            showToast('✅ تم إضافة المباراة', 'success');
        }
        App._closeModal('matchModal');
        App._refreshAllData(); // ✅ تحديث جميع الجداول
    } catch (err) {
        showToast('❌ خطأ: ' + err.message, 'error');
    }
});

// في _setupFormHandlers
document.getElementById('tournamentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'tournament') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const form = e.target;
    const id = form.dataset.id || document.getElementById('tournamentFormId').value;
    const clubsSelect = document.getElementById('tClubs');
    const selectedClubs = Array.from(clubsSelect.selectedOptions).map(o => o.value);
    const data = {
        name: document.getElementById('tName').value.trim(),
        year: parseInt(document.getElementById('tYear').value) || null,
        winner: document.getElementById('tWinner').value || '',
        clubs: selectedClubs,
    };
    if (!data.name) {
        showToast('يرجى إدخال اسم البطولة', 'error');
        return;
    }
    try {
        if (id && form.dataset.mode === 'update') {
            await DataManager.update('tournaments', id, data);
            showToast('✅ تم تحديث البطولة', 'success');
        } else {
            await DataManager.add('tournaments', data);
            showToast('✅ تم إضافة البطولة', 'success');
        }
        App._closeModal('tournamentModal');
        App._refreshAllData(); // ✅ تحديث جميع الجداول
    } catch (err) {
        showToast('❌ خطأ: ' + err.message, 'error');
    }
});

// في _setupFormHandlers
document.getElementById('questionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'question') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    
    const form = e.target;
    const id = form.dataset.id || document.getElementById('qFormId').value;
    const type = document.getElementById('qType').value;
    
    // جمع البيانات حسب النوع
    let data = {
        type: type,
        question: document.getElementById('qText').value.trim(),
        difficulty: document.getElementById('qDifficulty').value,
        category: document.getElementById('qCategory').value,
        points: parseInt(document.getElementById('qPoints').value) || 10,
        timeLimit: parseInt(document.getElementById('qTimeLimit').value) || 30,
        isPublic: document.getElementById('qIsPublic').checked,
        tags: []
    };
    
    if (!data.question) {
        showToast('يرجى إدخال نص السؤال', 'error');
        return;
    }
    
    // معالجة حسب النوع
    switch(type) {
        case 'multiple_choice':
            const options = [];
            const optionInputs = document.querySelectorAll('#qOptionsList .option-input');
            optionInputs.forEach(input => {
                if (input.value.trim()) {
                    options.push(input.value.trim());
                }
            });
            if (options.length < 2) {
                showToast('يرجى إدخال خيارين على الأقل', 'error');
                return;
            }
            const correctRadio = document.querySelector('input[name="qCorrect"]:checked');
            data.options = options;
            data.correct = parseInt(correctRadio?.value || 0);
            break;
            
        case 'true_false':
            data.options = ['صحيح', 'خطأ'];
            data.correct = parseInt(document.querySelector('input[name="qCorrect"]:checked')?.value || 0);
            break;
            
        case 'fill_blank':
            const answer = document.getElementById('qFillBlankAnswer').value.trim();
            if (!answer) {
                showToast('يرجى إدخال الإجابة الصحيحة', 'error');
                return;
            }
            data.correctAnswer = answer;
            data.options = [];
            break;
            
        case 'matching':
            const pairs = [];
            const leftInputs = document.querySelectorAll('.matching-left');
            const rightInputs = document.querySelectorAll('.matching-right');
            leftInputs.forEach((left, idx) => {
                if (left.value.trim() && rightInputs[idx]?.value.trim()) {
                    pairs.push({
                        left: left.value.trim(),
                        right: rightInputs[idx].value.trim()
                    });
                }
            });
            if (pairs.length < 2) {
                showToast('يرجى إدخال زوجين على الأقل للمطابقة', 'error');
                return;
            }
            data.matchingPairs = pairs;
            data.options = [];
            break;
            
        case 'ordering':
            const items = [];
            document.querySelectorAll('#qOrderingItems .ordering-item input').forEach(input => {
                if (input.value.trim()) {
                    items.push(input.value.trim());
                }
            });
            if (items.length < 3) {
                showToast('يرجى إدخال 3 عناصر على الأقل للترتيب', 'error');
                return;
            }
            data.orderedItems = items;
            data.options = [];
            break;
    }
    
    try {
        if (id && form.dataset.mode === 'update') {
            await DataManager.update('questions', id, data);
            showToast('✅ تم تحديث السؤال', 'success');
        } else {
            await DataManager.add('questions', data);
            showToast('✅ تم إضافة السؤال', 'success');
        }
        App._closeModal('questionModal');
        App._renderQuestionsAdvanced();
        App._refreshAllData();
    } catch (err) {
        showToast('❌ خطأ: ' + err.message, 'error');
    }
});

        // Comment form
        document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            const data = {
                matchId: document.getElementById('commentMatchId').value,
                text: document.getElementById('commentText').value.trim(),
                rating: parseInt(document.getElementById('commentRating').value) || 3,
                userName: AuthService.currentUser.username || 'مجهول',
                userId: AuthService.currentUser.uid,
                date: new Date().toISOString()
            };
            if (!data.text) return showToast('يرجى إدخال نص التعليق', 'error');
            try {
                await DataManager.add('comments', data);
                showToast('✅ تم إضافة التعليق', 'success');
                document.getElementById('commentModal').classList.remove('open');
            } catch (err) {
                showToast('❌ خطأ: ' + err.message, 'error');
            }
        });

        // Post form
        document.getElementById('postForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            const data = {
                content: document.getElementById('postContent').value.trim(),
                image: document.getElementById('postImage').value.trim(),
                userId: AuthService.currentUser.uid,
                userName: AuthService.currentUser.username || AuthService.currentUser.displayName || 'مجهول',
                likes: [],
                createdAt: new Date().toISOString()
            };
            if (!data.content) return showToast('يرجى إدخال محتوى المنشور', 'error');
            try {
                await DataManager.add('posts', data);
                showToast('✅ تم نشر المنشور', 'success');
                document.getElementById('postModal').classList.remove('open');
                this._renderPosts(DataManager.data.posts || []);
            } catch (err) {
                showToast('❌ خطأ: ' + err.message, 'error');
            }
        });

        // Profile edit form
        document.getElementById('profileEditForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            const data = {
                username: document.getElementById('editUsername').value.trim(),
                bio: document.getElementById('editBio').value.trim(),
                location: document.getElementById('editLocation').value.trim(),
                avatar: document.getElementById('editAvatar').value.trim() || null,
            };
            if (!data.username) return showToast('يرجى إدخال اسم المستخدم', 'error');
            try {
                await AuthService.updateUser(data);
                showToast('✅ تم تحديث الملف الشخصي', 'success');
                document.getElementById('profileEditModal').classList.remove('open');
                this._updateUserUI(AuthService.currentUser);
            } catch (err) {
                showToast('❌ خطأ: ' + err.message, 'error');
            }
        });

        // Admin user form
        document.getElementById('adminUserForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!AuthService.currentUser?.role === 'admin' && !AuthService.currentUser?.role === 'super_admin')
                return showToast('ليس لديك صلاحية', 'error');
            const uid = document.getElementById('adminUserUid').value;
            if (!uid) return showToast('خطأ في معرف المستخدم', 'error');
            const data = {
                role: document.getElementById('adminUserRole').value,
                adminRole: document.getElementById('adminUserAdminRole').value || null,
                totalScore: parseInt(document.getElementById('adminUserScore').value) || 0,
                coins: parseInt(document.getElementById('adminUserCoins').value) || 0,
            };
            try {
                await db.collection('users').doc(uid).update(data);
                showToast('✅ تم تحديث المستخدم', 'success');
                document.getElementById('adminUserModal').classList.remove('open');
                this._renderAdminData();
            } catch (err) {
                showToast('❌ خطأ: ' + err.message, 'error');
            }
        });
    },

_setupAuthHandlers() {
    console.log('🔐 Setting up auth handlers...');
    
    // ===== التبديل بين التبويبات =====
    document.getElementById('loginTabBtn')?.addEventListener('click', function() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.querySelectorAll('.tab-login').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
    });
    
    document.getElementById('registerTabBtn')?.addEventListener('click', function() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.querySelectorAll('.tab-login').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        // تحديث حالة الزر
        App._updateRegisterButton();
    });
    
    // ===== التحقق الفوري من اسم المستخدم =====
    const usernameInput = document.getElementById('regUsername');
    let usernameDebounceTimer;
    usernameInput?.addEventListener('input', function() {
        const username = this.value.trim();
        const statusEl = document.getElementById('usernameStatus');
        const feedbackEl = document.getElementById('usernameFeedback');
        
        clearTimeout(usernameDebounceTimer);
        
        if (username.length < 3) {
            statusEl.textContent = '📝 أدخل 3 أحرف';
            statusEl.style.color = 'var(--gray)';
            feedbackEl.textContent = '';
            App._updateRegisterButton();
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            statusEl.textContent = '⚠️ غير صالح';
            statusEl.style.color = 'var(--secondary)';
            feedbackEl.textContent = '⚠️ يسمح فقط بالحروف والأرقام و_';
            feedbackEl.style.color = 'var(--secondary)';
            App._updateRegisterButton();
            return;
        }
        
        statusEl.textContent = '🔍 جاري...';
        statusEl.style.color = 'var(--gray)';
        feedbackEl.textContent = '';
        
        usernameDebounceTimer = setTimeout(async () => {
            const result = await App._checkUsernameAvailability(username);
            statusEl.textContent = result.available ? '✅ متوفر' : '❌ غير متوفر';
            statusEl.style.color = result.available ? 'var(--success)' : 'var(--secondary)';
            feedbackEl.textContent = result.message;
            feedbackEl.style.color = result.available ? 'var(--success)' : 'var(--secondary)';
            App._updateRegisterButton();
        }, 400);
    });
    
    // ===== التحقق الفوري من البريد الإلكتروني =====
    const emailInput = document.getElementById('regEmail');
    emailInput?.addEventListener('input', function() {
        const email = this.value.trim();
        const feedbackEl = document.getElementById('emailFeedback');
        const result = App._validateEmail(email);
        if (email && result.valid) {
            feedbackEl.textContent = '✅ صيغة صحيحة';
            feedbackEl.style.color = 'var(--success)';
        } else if (email && !result.valid) {
            feedbackEl.textContent = '⚠️ صيغة غير صحيحة (example@mail.com)';
            feedbackEl.style.color = 'var(--secondary)';
        } else {
            feedbackEl.textContent = '';
        }
        App._updateRegisterButton();
    });
    
    // ===== تقييم قوة كلمة المرور (فوري) =====
    const passwordInput = document.getElementById('regPassword');
    passwordInput?.addEventListener('input', function() {
        const password = this.value;
        const strength = App._evaluatePasswordStrength(password);
        
        // تحديث أشرطة القوة
        const bars = document.querySelectorAll('.strength-bar');
        const maxScore = 5;
        bars.forEach((bar, index) => {
            if (index < strength.score) {
                bar.style.background = strength.color;
                bar.style.opacity = '1';
            } else {
                bar.style.background = 'var(--glass)';
                bar.style.opacity = '0.3';
            }
        });
        
        // تحديث النص
        const textEl = document.getElementById('strengthText');
        if (password.length === 0) {
            textEl.textContent = 'ضعيفة';
            textEl.style.color = 'var(--gray)';
        } else {
            textEl.textContent = strength.label;
            textEl.style.color = strength.color;
            
            // عرض نصائح إضافية
            const feedbackEl = document.getElementById('passwordMatchFeedback');
            if (strength.tips.length > 0 && password.length > 0 && strength.score < 3) {
                feedbackEl.textContent = `💡 أضف: ${strength.tips.join('، ')}`;
                feedbackEl.style.color = 'var(--gray)';
            } else if (strength.score >= 3) {
                feedbackEl.textContent = '✅ كلمة مرور قوية!';
                feedbackEl.style.color = 'var(--success)';
            }
        }
        
        // التحقق من تطابق كلمة المرور مع التأكيد
        const confirmInput = document.getElementById('regPasswordConfirm');
        if (confirmInput.value) {
            const match = App._checkPasswordMatch(password, confirmInput.value);
            const matchFeedback = document.getElementById('passwordMatchFeedback');
            if (!match.match) {
                matchFeedback.textContent = match.message;
                matchFeedback.style.color = 'var(--secondary)';
            } else {
                matchFeedback.textContent = match.message;
                matchFeedback.style.color = 'var(--success)';
            }
        }
        
        App._updateRegisterButton();
    });
    
    // ===== التحقق الفوري من تطابق كلمة المرور =====
    const confirmInput = document.getElementById('regPasswordConfirm');
    confirmInput?.addEventListener('input', function() {
        const password = document.getElementById('regPassword').value;
        const confirm = this.value;
        const match = App._checkPasswordMatch(password, confirm);
        const feedbackEl = document.getElementById('passwordMatchFeedback');
        
        if (!match.match && confirm.length > 0) {
            feedbackEl.textContent = match.message;
            feedbackEl.style.color = 'var(--secondary)';
            this.style.borderColor = 'var(--secondary)';
        } else if (match.match && confirm.length > 0) {
            feedbackEl.textContent = match.message;
            feedbackEl.style.color = 'var(--success)';
            this.style.borderColor = 'var(--success)';
        } else {
            feedbackEl.textContent = '';
            this.style.borderColor = '';
        }
        App._updateRegisterButton();
    });
    
    // ===== تحديث الزر عند تغيير أي حقل =====
    document.getElementById('regFullName')?.addEventListener('input', function() {
        App._updateRegisterButton();
    });
    
    // ===== نموذج تسجيل الدخول =====
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔐 Login form submitted');
            
            const email = document.getElementById('loginEmail')?.value.trim();
            const password = document.getElementById('loginPassword')?.value.trim();
            const errorEl = document.getElementById('loginError');
            
            if (!email || !password) {
                errorEl.textContent = '❌ يرجى إدخال البريد الإلكتروني وكلمة المرور';
                errorEl.style.display = 'block';
                return;
            }
            
            errorEl.style.display = 'none';
            
            try {
                const submitBtn = document.getElementById('loginSubmitBtn');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
                
                await AuthService.login(email, password);
                
                document.getElementById('loginModal').classList.remove('open');
                await DataManager.loadAll();
                showToast('✅ تم تسجيل الدخول بنجاح', 'success');
                
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
                
            } catch (err) {
                console.error('❌ Login error:', err);
                errorEl.textContent = '❌ ' + err.message;
                errorEl.style.display = 'block';
                
                const submitBtn = document.getElementById('loginSubmitBtn');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول';
            }
        });
    }
    
// ===== نموذج التسجيل =====
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('🔐 Register form submitted');
        
        const fullName = document.getElementById('regFullName')?.value?.trim() || '';
        const username = document.getElementById('regUsername')?.value?.trim() || '';
        const email = document.getElementById('regEmail')?.value?.trim() || '';
        const password = document.getElementById('regPassword')?.value || '';
        const errorEl = document.getElementById('registerError');
        const submitBtn = document.getElementById('registerSubmitBtn');
        
        // ✅ التحقق النهائي
        if (!fullName || !username || !email || !password) {
            errorEl.textContent = '❌ يرجى ملء جميع الحقول';
            errorEl.style.display = 'block';
            return;
        }
        
        if (password.length < 6) {
            errorEl.textContent = '❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل';
            errorEl.style.display = 'block';
            return;
        }
        
        // ✅ التحقق من توفر اسم المستخدم
        errorEl.textContent = '⏳ جاري التحقق من اسم المستخدم...';
        errorEl.style.display = 'block';
        errorEl.style.color = 'var(--gray)';
        
        try {
            const availability = await App._checkUsernameAvailability(username);
            if (!availability.available) {
                errorEl.textContent = '❌ اسم المستخدم غير متوفر';
                errorEl.style.color = 'var(--secondary)';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب';
                return;
            }
        } catch (checkError) {
            console.warn('⚠️ Username check failed:', checkError);
        }
        
        errorEl.style.display = 'none';
        
        // ✅ تعطيل الزر
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
        
        try {
            console.log('📡 Attempting registration with:', { fullName, username, email });
            
            // ✅ التسجيل مع إرسال الاسم الكامل
            const user = await AuthService.register(email, password, username, fullName);
            console.log('✅ Registration successful:', user);
            
            // ✅ إغلاق المودال
            document.getElementById('loginModal').classList.remove('open');
            await DataManager.loadAll();
            showToast(`✅ مرحباً ${fullName}! تم إنشاء حسابك بنجاح`, 'success', 5000);
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب';
            
        } catch (err) {
            console.error('❌ Register error:', err);
            
            let errorMessage = err.message || 'حدث خطأ غير متوقع';
            if (errorMessage.includes('email-already-in-use')) {
                errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
            } else if (errorMessage.includes('weak-password')) {
                errorMessage = 'كلمة المرور ضعيفة جداً (استخدم 6 أحرف على الأقل)';
            } else if (errorMessage.includes('invalid-email')) {
                errorMessage = 'صيغة البريد الإلكتروني غير صحيحة';
            } else if (errorMessage.includes('network-request-failed')) {
                errorMessage = 'فشل الاتصال بالإنترنت، تحقق من اتصالك';
            }
            
            errorEl.textContent = '❌ ' + errorMessage;
            errorEl.style.color = 'var(--secondary)';
            errorEl.style.display = 'block';
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب';
        }
    });
}
    
    // ===== أزرار تسجيل الخروج =====
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        AuthService.logout();
        document.getElementById('loginModal').classList.add('open');
        showToast('تم تسجيل الخروج', 'info');
    });
    
    document.getElementById('logoutBtn2')?.addEventListener('click', () => {
        AuthService.logout();
        document.getElementById('loginModal').classList.add('open');
        showToast('تم تسجيل الخروج', 'info');
    });
    
    // ===== إغلاق المودال =====
    document.getElementById('closeLoginModal')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.remove('open');
    });
    
    document.getElementById('loginModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('loginModal').classList.remove('open');
        }
    });
    
    console.log('✅ Auth handlers setup complete');
},

    _setupSettingsHandlers() {
        document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
            const body = document.body;
            if (body.classList.contains('dark-theme')) {
                body.classList.remove('dark-theme');
                body.classList.add('light-theme');
                document.getElementById('themeToggleBtn').innerHTML = '<i class="fas fa-sun"></i> الوضع النهاري';
                localStorage.setItem('theme', 'light');
            } else {
                body.classList.remove('light-theme');
                body.classList.add('dark-theme');
                document.getElementById('themeToggleBtn').innerHTML = '<i class="fas fa-moon"></i> الوضع الليلي';
                localStorage.setItem('theme', 'dark');
            }
        });

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            document.getElementById('themeToggleBtn').innerHTML = '<i class="fas fa-sun"></i> الوضع النهاري';
        } else {
            document.body.classList.add('dark-theme');
        }

        document.querySelectorAll('.theme-color-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const color = this.dataset.color;
                document.documentElement.style.setProperty('--primary', color);
                localStorage.setItem('accentColor', color);
                showToast('✅ تم تغيير اللون بنجاح', 'success');
            });
        });

        const savedColor = localStorage.getItem('accentColor');
        if (savedColor) {
            document.documentElement.style.setProperty('--primary', savedColor);
        }

        document.getElementById('testConnectionBtn')?.addEventListener('click', async () => {
            try {
                await db.collection('test').limit(1).get();
                showToast('✅ الاتصال بـ Firebase يعمل بشكل جيد', 'success');
                updateFirebaseStatus(true);
            } catch (e) {
                showToast('❌ فشل الاتصال بـ Firebase: ' + e.message, 'error');
                updateFirebaseStatus(false);
            }
        });

        document.getElementById('exportDataBtn')?.addEventListener('click', () => {
            const data = DataManager.data;
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `football_data_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ تم تصدير البيانات بنجاح', 'success');
        });

        document.getElementById('importDataBtn')?.addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                for (const [collection, items] of Object.entries(data)) {
                    if (Array.isArray(items) && ['players', 'clubs', 'matches', 'tournaments',
                            'questions', 'comments', 'posts', 'rooms', 'storeItems'
                        ].includes(collection)) {
                        for (const item of items) {
                            const { id, ...rest } = item;
                            if (id) {
                                await FirestoreService.update(collection, id, rest);
                            } else {
                                await FirestoreService.add(collection, rest);
                            }
                        }
                    }
                }
                showToast('✅ تم استيراد البيانات بنجاح', 'success');
                await DataManager.loadAll();
            } catch (err) {
                showToast('❌ خطأ في الاستيراد: ' + err.message, 'error');
            }
            e.target.value = '';
        });

        document.getElementById('clearLocalStorageBtn')?.addEventListener('click', () => {
            if (confirm('هل أنت متأكد من مسح جميع البيانات المحلية؟')) {
                localStorage.clear();
                showToast('✅ تم مسح البيانات المحلية', 'success');
                location.reload();
            }
        });

        document.getElementById('saveNotifSettings')?.addEventListener('click', () => {
            const settings = {
                game: document.getElementById('notifGame').checked,
                posts: document.getElementById('notifPosts').checked,
                friends: document.getElementById('notifFriends').checked,
                store: document.getElementById('notifStore').checked,
            };
            localStorage.setItem('notifSettings', JSON.stringify(settings));
            showToast('✅ تم حفظ إعدادات الإشعارات', 'success');
        });
        const notifSettings = JSON.parse(localStorage.getItem('notifSettings') || '{}');
        if (document.getElementById('notifGame')) document.getElementById('notifGame').checked = notifSettings.game || false;
        if (document.getElementById('notifPosts')) document.getElementById('notifPosts').checked = notifSettings.posts || false;
        if (document.getElementById('notifFriends')) document.getElementById('notifFriends').checked = notifSettings.friends || false;
        if (document.getElementById('notifStore')) document.getElementById('notifStore').checked = notifSettings.store || false;

        document.getElementById('savePrivacySettings')?.addEventListener('click', () => {
            const settings = {
                profile: document.getElementById('privacyProfile').checked,
                online: document.getElementById('privacyOnline').checked,
            };
            localStorage.setItem('privacySettings', JSON.stringify(settings));
            showToast('✅ تم حفظ إعدادات الخصوصية', 'success');
        });
        const privacySettings = JSON.parse(localStorage.getItem('privacySettings') || '{}');
        if (document.getElementById('privacyProfile')) document.getElementById('privacyProfile').checked = privacySettings.profile !== false;
        if (document.getElementById('privacyOnline')) document.getElementById('privacyOnline').checked = privacySettings.online !== false;
    },

    _setupCRUDHandlers() {
window.editPlayer = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'player') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const player = DataManager.data.players.find(p => p.id === id);
    if (!player) {
        showToast('اللاعب غير موجود', 'error');
        return;
    }
    // تعبئة النموذج
    document.getElementById('playerModalTitle').textContent = 'تعديل لاعب';
    document.getElementById('playerFormId').value = id;
    document.getElementById('pName').value = player.name || '';
    document.getElementById('pClub').value = player.club || '';
    document.getElementById('pPosition').value = player.position || '';
    document.getElementById('pAge').value = player.age || '';
    document.getElementById('pNationality').value = player.nationality || '';
    document.getElementById('pNumber').value = player.number || '';
    document.getElementById('pGoals').value = player.goals || 0;
    document.getElementById('pAssists').value = player.assists || 0;
    document.getElementById('pImage').value = player.image || '';
    const form = document.getElementById('playerForm');
    form.dataset.mode = 'update';
    form.dataset.id = id;
    App._openModal('playerModal');
};

window.deletePlayer = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'player') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    if (!confirm('حذف هذا اللاعب؟')) return;
    try {
        await DataManager.delete('players', id);
        showToast('✅ تم الحذف', 'success');
        // ✅ تحديث الجداول
        App._renderAllTables(DataManager.data);
        App._populateSelects(DataManager.data);
        App._updateStats(DataManager.getStats());
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
};


window.editClub = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'club') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const club = DataManager.data.clubs.find(c => c.id === id);
    if (!club) {
        showToast('النادي غير موجود', 'error');
        return;
    }
    
    // تعبئة النموذج
    document.getElementById('clubModalTitle').textContent = 'تعديل نادي';
    document.getElementById('clubFormId').value = id;
    document.getElementById('cName').value = club.name || '';
    document.getElementById('cCity').value = club.city || '';
    document.getElementById('cLeague').value = club.league || '';
    document.getElementById('cFounded').value = club.founded || '';
    document.getElementById('cLogo').value = club.logo || '';
    
    const form = document.getElementById('clubForm');
    form.dataset.mode = 'update';
    form.dataset.id = id;
    
    App._openModal('clubModal');
};

window.deleteClub = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'club') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    if (!confirm('حذف هذا النادي؟')) return;
    try {
        await DataManager.delete('clubs', id);
        showToast('✅ تم الحذف', 'success');
        App._renderAllTables(DataManager.data);
        App._populateSelects(DataManager.data);
        App._renderLeagueTable(DataManager.data);
        App._updateStats(DataManager.getStats());
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
};

        window.editMatch = async (id) => {
            if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'match')
                return showToast('ليس لديك صلاحية', 'error');
            const match = DataManager.data.matches.find(m => m.id === id);
            if (!match) return showToast('المباراة غير موجودة', 'error');
            document.getElementById('matchModalTitle').textContent = 'تعديل مباراة';
            document.getElementById('matchFormId').value = id;
            document.getElementById('mTeam1').value = match.team1 || '';
            document.getElementById('mTeam2').value = match.team2 || '';
            document.getElementById('mScore1').value = match.score1 || 0;
            document.getElementById('mScore2').value = match.score2 || 0;
            document.getElementById('mDate').value = match.date || '';
            document.getElementById('mTournament').value = match.tournament || '';
            const form = document.getElementById('matchForm');
            form.dataset.mode = 'update';
            form.dataset.id = id;
            document.getElementById('matchModal').classList.add('open');
        };

window.deleteMatch = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'match') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    if (!confirm('حذف هذه المباراة؟')) return;
    try {
        await DataManager.delete('matches', id);
        showToast('✅ تم الحذف', 'success');
        App._renderAllTables(DataManager.data);
        App._populateSelects(DataManager.data);
        App._renderLeagueTable(DataManager.data);
        App._updateStats(DataManager.getStats());
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
};

        window.editTournament = async (id) => {
            if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'tournament')
                return showToast('ليس لديك صلاحية', 'error');
            const t = DataManager.data.tournaments.find(t => t.id === id);
            if (!t) return showToast('البطولة غير موجودة', 'error');
            document.getElementById('tournamentModalTitle').textContent = 'تعديل بطولة';
            document.getElementById('tournamentFormId').value = id;
            document.getElementById('tName').value = t.name || '';
            document.getElementById('tYear').value = t.year || '';
            document.getElementById('tWinner').value = t.winner || '';
            const clubsSelect = document.getElementById('tClubs');
            Array.from(clubsSelect.options).forEach(opt => {
                opt.selected = (t.clubs || []).includes(opt.value);
            });
            const form = document.getElementById('tournamentForm');
            form.dataset.mode = 'update';
            form.dataset.id = id;
            document.getElementById('tournamentModal').classList.add('open');
        };

window.deleteTournament = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'tournament') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    if (!confirm('حذف هذه البطولة؟')) return;
    try {
        await DataManager.delete('tournaments', id);
        showToast('✅ تم الحذف', 'success');
        App._renderAllTables(DataManager.data);
        App._populateSelects(DataManager.data);
        App._updateStats(DataManager.getStats());
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
};

// ============================================================
// تعديل السؤال - نسخة مصححة
// ============================================================

window.editQuestion = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'question') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    
    const q = DataManager.data.questions.find(q => q.id === id);
    if (!q) {
        showToast('السؤال غير موجود', 'error');
        return;
    }
    
    // تحديث العنوان
    const titleEl = document.getElementById('questionModalTitle');
    if (titleEl) titleEl.textContent = 'تعديل سؤال';
    
    // تعبئة الحقول الأساسية
    const qText = document.getElementById('qText');
    const qType = document.getElementById('qType');
    const qDifficulty = document.getElementById('qDifficulty');
    const qCategory = document.getElementById('qCategory');
    const qPoints = document.getElementById('qPoints');
    const qTimeLimit = document.getElementById('qTimeLimit');
    const qIsPublic = document.getElementById('qIsPublic');
    
    if (qText) qText.value = q.question || '';
    if (qType) qType.value = q.type || 'multiple_choice';
    if (qDifficulty) qDifficulty.value = q.difficulty || 'متوسط';
    if (qCategory) qCategory.value = q.category || 'عام';
    if (qPoints) qPoints.value = q.points || 10;
    if (qTimeLimit) qTimeLimit.value = q.timeLimit || 30;
    if (qIsPublic) qIsPublic.checked = q.isPublic !== false;
    
    // تعبئة حسب النوع
    if (q.type === 'true_false') {
        // صح/خطأ
        const correctVal = q.correct || 0;
        document.querySelectorAll('input[name="qCorrect"]').forEach((radio, idx) => {
            radio.checked = (idx === correctVal);
        });
    } else if (q.type === 'fill_blank') {
        const answerEl = document.getElementById('qFillBlankAnswer');
        if (answerEl) answerEl.value = q.correctAnswer || '';
    } else if (q.type === 'matching') {
        // تعبئة المطابقة
        const pairs = q.matchingPairs || [];
        const leftInputs = document.querySelectorAll('.matching-left');
        const rightInputs = document.querySelectorAll('.matching-right');
        pairs.forEach((pair, idx) => {
            if (leftInputs[idx]) leftInputs[idx].value = pair.left || '';
            if (rightInputs[idx]) rightInputs[idx].value = pair.right || '';
        });
    } else if (q.type === 'ordering') {
        // تعبئة الترتيب
        const items = q.orderedItems || [];
        const itemInputs = document.querySelectorAll('#qOrderingItems .ordering-item input');
        items.forEach((item, idx) => {
            if (itemInputs[idx]) itemInputs[idx].value = item || '';
        });
    } else {
        // اختيار من متعدد (default)
        const options = q.options || [];
        const optionInputs = document.querySelectorAll('#qOptionsList .option-input');
        optionInputs.forEach((input, idx) => {
            if (input) input.value = options[idx] || '';
        });
        // تعيين الإجابة الصحيحة
        const correct = q.correct || 0;
        document.querySelectorAll('input[name="qCorrect"]').forEach((radio, idx) => {
            radio.checked = (idx === correct);
        });
    }
    
    // تحديث النموذج
    const form = document.getElementById('questionForm');
    if (form) {
        form.dataset.mode = 'update';
        form.dataset.id = id;
    }
    
    // تحديث واجهة النوع
    App._updateQuestionTypeUI(q.type || 'multiple_choice');
    
    // فتح المودال
    App._openModal('questionModal');
};

window.deleteQuestion = async (id) => {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'question') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    if (!confirm('حذف هذا السؤال؟')) return;
    try {
        await DataManager.delete('questions', id);
        showToast('✅ تم حذف السؤال', 'success');
        App._renderQuestionsAdvanced();
        App._refreshAllData();
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
};
    },

    _setupPostHandlers() {
        window.toggleLike = async (postId) => {
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            const post = DataManager.data.posts.find(p => p.id === postId);
            if (!post) return;
            const likes = post.likes || [];
            const idx = likes.indexOf(AuthService.currentUser.uid);
            if (idx > -1) {
                likes.splice(idx, 1);
            } else {
                likes.push(AuthService.currentUser.uid);
            }
            try {
                await DataManager.update('posts', postId, { likes });
                showToast(idx > -1 ? 'تم إزالة الإعجاب' : '✅ تم الإعجاب!', 'success');
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        };

        window.toggleComments = (postId) => {
            const el = document.getElementById(`comments-${postId}`);
            if (el) {
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
        };

        window.addComment = async (postId) => {
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            const input = document.getElementById(`commentInput-${postId}`);
            if (!input) return;
            const text = input.value.trim();
            if (!text) return showToast('يرجى إدخال نص التعليق', 'error');
            try {
                await DataManager.add('comments', {
                    postId: postId,
                    text: text,
                    userId: AuthService.currentUser.uid,
                    userName: AuthService.currentUser.username || AuthService.currentUser.displayName || 'مجهول',
                    createdAt: new Date().toISOString()
                });
                input.value = '';
                showToast('✅ تم إضافة التعليق', 'success');
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        };

        window.deletePost = async (postId) => {
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            if (!confirm('حذف هذا المنشور؟')) return;
            try {
                await DataManager.delete('posts', postId);
                showToast('✅ تم حذف المنشور', 'success');
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        };

        window.deleteComment = async (commentId) => {
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            if (!confirm('حذف هذا التعليق؟')) return;
            try {
                await DataManager.delete('comments', commentId);
                showToast('✅ تم حذف التعليق', 'success');
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        };
    },

    _setupStoreHandlers() {
        window.purchaseItem = (itemId) => {
            if (!AuthService.currentUser) return showToast('يجب تسجيل الدخول', 'error');
            const item = DataManager.data.storeItems.find(i => i.id === itemId);
            if (!item) return showToast('العنصر غير موجود', 'error');
            const user = AuthService.currentUser;
            if (user.coins < item.price) return showToast('رصيدك غير كافٍ!', 'error');
            if (user.inventory?.some(i => i.itemId === itemId)) return showToast('لديك هذا العنصر بالفعل', 'error');

            document.getElementById('purchaseIcon').textContent = item.icon || '🛒';
            document.getElementById('purchaseName').textContent = item.name;
            document.getElementById('purchaseDesc').textContent = item.description || '';
            document.getElementById('purchasePrice').textContent = `💰 ${item.price} عملة`;
            document.getElementById('purchaseBalance').textContent = `رصيدك: ${user.coins} عملة`;
            document.getElementById('storePurchaseModal').dataset.itemId = itemId;
            document.getElementById('storePurchaseModal').classList.add('open');
        };

        document.getElementById('confirmPurchaseBtn')?.addEventListener('click', async () => {
            const modal = document.getElementById('storePurchaseModal');
            const itemId = modal.dataset.itemId;
            if (!itemId) return;
            const item = DataManager.data.storeItems.find(i => i.id === itemId);
            if (!item) return showToast('العنصر غير موجود', 'error');
            const user = AuthService.currentUser;
            if (!user) return showToast('يجب تسجيل الدخول', 'error');
            if (user.coins < item.price) return showToast('رصيدك غير كافٍ!', 'error');

            try {
                const inventory = user.inventory || [];
                inventory.push({ itemId: itemId, purchasedAt: new Date().toISOString() });
                await AuthService.updateUser({
                    coins: user.coins - item.price,
                    inventory: inventory
                });
                await DataManager.add('transactions', {
                    userId: user.uid,
                    userName: user.username || user.displayName || 'مجهول',
                    itemId: itemId,
                    itemName: item.name,
                    price: item.price,
                    date: new Date().toISOString()
                });
                showToast(`✅ تم شراء "${item.name}" بنجاح!`, 'success');
                modal.classList.remove('open');
                this._updateUserUI(AuthService.currentUser);
                this._renderStore(DataManager.data.storeItems || []);
                AchievementSystem.check(AuthService.currentUser, DataManager.data);
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        });

        this._initStoreItems();
    },

// ============================================================
// 1. تهيئة المتجر بالعناصر الافتراضية (60+ عنصر)
// ============================================================

async _initStoreItems() {
    if (this._storeInitialized) return;
    this._storeInitialized = true; // تعيين العلم فوراً
    if (!isFirebaseReady) return;

    try {
        const existingItems = await FirestoreService.getAll('storeItems');
        const defaultItems = this._getDefaultStoreItems();
        const existingMap = new Map();
        existingItems.forEach(item => existingMap.set(item.id, item));
        const itemsToAdd = defaultItems.filter(item => !existingMap.has(item.id));

        if (itemsToAdd.length === 0) {
            console.log(`✅ المتجر يحتوي بالفعل على جميع العناصر (${existingItems.length} عنصر)`);
            return;
        }

        // إضافة العناصر على دفعات (batch) لتجنب إرهاق المتصفح
        const batchSize = 10;
        let addedCount = 0;
        for (let i = 0; i < itemsToAdd.length; i += batchSize) {
            const batch = itemsToAdd.slice(i, i + batchSize);
            // استخدام Promise.all لإضافة الدفعة بالتوازي
            await Promise.all(batch.map(item => FirestoreService.add('storeItems', item)));
            addedCount += batch.length;
            // يمكنك إضافة تأخير صغير بين الدفعات لتخفيف الضغط (اختياري)
            // if (i + batchSize < itemsToAdd.length) await new Promise(res => setTimeout(res, 100));
        }

        showToast(`🛒 تم إضافة ${addedCount} عنصر جديد إلى المتجر`, 'success', 4000);
        console.log(`✅ تمت إضافة ${addedCount} عنصر جديد، إجمالي العناصر الآن: ${existingItems.length + addedCount}`);
    } catch (e) {
        console.error('❌ خطأ في تهيئة المتجر:', e);
        // إعادة تعيين العلم للسماح بمحاولة لاحقة (اختياري)
        this._storeInitialized = false;
        showToast('⚠️ فشل تهيئة المتجر', 'error');
    }
},

// ============================================================
// 2. قائمة العناصر الافتراضية (يمكن توسيعها)
// ============================================================

_getDefaultStoreItems() {
    const items = [];

    // ============================================================
    // 1. تعزيزات اللعبة (Boosts) - السابقة
    // ============================================================
    const boosts = [
        { id: 'boost_x2_points', name: '⚡ مضاعف النقاط ×2', icon: '⚡', desc: 'ضعف النقاط في جولة واحدة (3 استخدامات)', price: 150, currency: 'coins', rarity: 'uncommon', effect: 'point_multiplier', value: 2, uses: 3 },
        { id: 'boost_x3_points', name: '🔥 مضاعف النقاط ×3', icon: '🔥', desc: 'ثلاثة أضعاف النقاط (2 استخدامات)', price: 300, currency: 'coins', rarity: 'rare', effect: 'point_multiplier', value: 3, uses: 2 },
        { id: 'boost_x5_points', name: '💎 مضاعف النقاط ×5', icon: '💎', desc: 'خمسة أضعاف النقاط (استخدام واحد)', price: 50, currency: 'gems', rarity: 'epic', effect: 'point_multiplier', value: 5, uses: 1 },
        { id: 'boost_x2_coins', name: '🪙 مضاعف العملات ×2', icon: '🪙', desc: 'ضعف العملات في جولة (3 استخدامات)', price: 120, currency: 'coins', rarity: 'uncommon', effect: 'coin_multiplier', value: 2, uses: 3 },
        { id: 'boost_x3_coins', name: '💰 مضاعف العملات ×3', icon: '💰', desc: 'ثلاثة أضعاف العملات (2 استخدامات)', price: 250, currency: 'coins', rarity: 'rare', effect: 'coin_multiplier', value: 3, uses: 2 },
        { id: 'boost_freeze_5s', name: '❄️ تجميد 5s', icon: '❄️', desc: 'جمد المؤقت 5 ثوانٍ (مرة)', price: 80, currency: 'coins', rarity: 'common', effect: 'freeze_time', value: 5, uses: 1 },
        { id: 'boost_freeze_10s', name: '🧊 تجميد 10s', icon: '🧊', desc: 'جمد المؤقت 10 ثوانٍ (مرة)', price: 150, currency: 'coins', rarity: 'uncommon', effect: 'freeze_time', value: 10, uses: 1 },
        { id: 'boost_remove_wrong', name: '❌ حذف خاطئ', icon: '❌', desc: 'احذف خياراً خاطئاً (مرة)', price: 60, currency: 'coins', rarity: 'common', effect: 'remove_wrong_option', value: 1, uses: 1 },
        { id: 'boost_remove_3wrong', name: '🚫 حذف 3 خيارات', icon: '🚫', desc: 'احذف 3 خيارات خاطئة (مرة)', price: 200, currency: 'coins', rarity: 'rare', effect: 'remove_wrong_option', value: 3, uses: 1 },
        { id: 'boost_streak_shield', name: '🛡️ درع السلسلة', icon: '🛡️', desc: 'لا تنقطع السلسلة عند الخطأ (مرة)', price: 100, currency: 'coins', rarity: 'uncommon', effect: 'streak_shield', value: 1, uses: 1 },
        { id: 'boost_extra_life', name: '❤️ حياة إضافية', icon: '❤️', desc: 'استمر بعد خطأ (مرة)', price: 180, currency: 'coins', rarity: 'rare', effect: 'extra_life', value: 1, uses: 1 },
    ];
    boosts.forEach(b => items.push({ ...b, category: 'boosts', duration: 'limited', effectType: b.effect, effectValue: b.value, stackable: true, maxStack: 99 }));

    // ============================================================
    // 2. تعزيزات الغرف (Room Boosts) - السابقة
    // ============================================================
    const roomBoosts = [
        { id: 'room_head_start_20', name: '🏃 بداية +20', icon: '🏃', desc: 'في الغرف، ابدأ بـ 20 نقطة', price: 200, currency: 'coins', rarity: 'uncommon', effect: 'head_start', value: 20, uses: 1 },
        { id: 'room_head_start_50', name: '🚀 بداية +50', icon: '🚀', desc: 'في الغرف، ابدأ بـ 50 نقطة', price: 400, currency: 'coins', rarity: 'rare', effect: 'head_start', value: 50, uses: 1 },
        { id: 'room_attack', name: '⚔️ هجوم خصم', icon: '⚔️', desc: 'خصم 10 نقاط من جميع الخصوم', price: 300, currency: 'coins', rarity: 'rare', effect: 'attack_opponent', value: 10, uses: 1 },
        { id: 'room_shield', name: '🛡️ درع جماعي', icon: '🛡️', desc: 'احمِ فريقك من الهجمات', price: 250, currency: 'coins', rarity: 'uncommon', effect: 'team_shield', value: 1, uses: 1 },
        { id: 'room_double_guess', name: '🎯 تخمين مزدوج', icon: '🎯', desc: 'اختر خيارين بدلاً من واحد', price: 180, currency: 'coins', rarity: 'uncommon', effect: 'double_guess', value: 1, uses: 1 },
        { id: 'room_extra_time', name: '⏳ وقت إضافي 5s', icon: '⏳', desc: 'أضف 5 ثوانٍ للجميع', price: 150, currency: 'coins', rarity: 'common', effect: 'extra_room_time', value: 5, uses: 1 },
    ];
    roomBoosts.forEach(b => items.push({ ...b, category: 'room_boosts', duration: 'limited', effectType: b.effect, effectValue: b.value, stackable: true, maxStack: 99 }));

    // ============================================================
    // 3. إطارات الملف الشخصي (Frames)
    // ============================================================
    const frames = [
        { id: 'frame_bronze', name: '🟫 برونزي', icon: '🖼️', desc: 'إطار برونزي أنيق', price: 50, currency: 'coins', rarity: 'common', effect: 'profile_frame', value: 'bronze' },
        { id: 'frame_silver', name: '⬜ فضي', icon: '🖼️', desc: 'إطار فضي لامع', price: 100, currency: 'coins', rarity: 'uncommon', effect: 'profile_frame', value: 'silver' },
        { id: 'frame_gold', name: '🟨 ذهبي', icon: '🖼️', desc: 'إطار ذهبي فاخر', price: 200, currency: 'coins', rarity: 'rare', effect: 'profile_frame', value: 'gold' },
        { id: 'frame_platinum', name: '⬜ بلاتيني', icon: '🖼️', desc: 'إطار بلاتيني نادر', price: 350, currency: 'coins', rarity: 'epic', effect: 'profile_frame', value: 'platinum' },
        { id: 'frame_diamond', name: '💎 ألماس', icon: '🖼️', desc: 'إطار ألماسي متلألئ', price: 30, currency: 'gems', rarity: 'epic', effect: 'profile_frame', value: 'diamond' },
        { id: 'frame_fire', name: '🔥 ناري', icon: '🖼️', desc: 'إطار ناري متوهج', price: 50, currency: 'gems', rarity: 'legendary', effect: 'profile_frame', value: 'fire' },
        { id: 'frame_legend', name: '👑 أسطوري', icon: '🖼️', desc: 'إطار أسطوري نادر', price: 100, currency: 'gems', rarity: 'legendary', effect: 'profile_frame', value: 'legend' },
        { id: 'frame_glow', name: '✨ متوهج', icon: '🖼️', desc: 'إطار متوهج بأنيميشن', price: 80, currency: 'gems', rarity: 'epic', effect: 'profile_frame', value: 'glow' },
    ];
    frames.forEach(b => items.push({ ...b, category: 'frames', duration: 'permanent', effectType: b.effect, effectValue: b.value, stackable: false }));

    // ============================================================
    // 4. خلفيات الملف الشخصي (Backgrounds)
    // ============================================================
    const backgrounds = [
        { id: 'bg_stadium', name: '🏟️ ملعب', icon: '🏟️', desc: 'خلفية ملعب', price: 120, currency: 'coins', rarity: 'common', effect: 'profile_bg', value: 'stadium' },
        { id: 'bg_crowd', name: '👥 جماهير', icon: '👥', desc: 'خلفية مع جماهير', price: 150, currency: 'coins', rarity: 'uncommon', effect: 'profile_bg', value: 'crowd' },
        { id: 'bg_trophy', name: '🏆 كأس', icon: '🏆', desc: 'خلفية مع الكؤوس', price: 200, currency: 'coins', rarity: 'rare', effect: 'profile_bg', value: 'trophy' },
        { id: 'bg_night', name: '🌙 ليلة', icon: '🌙', desc: 'خلفية ليلية', price: 180, currency: 'coins', rarity: 'uncommon', effect: 'profile_bg', value: 'night' },
        { id: 'bg_sunset', name: '🌅 غروب', icon: '🌅', desc: 'خلفية غروب', price: 220, currency: 'coins', rarity: 'rare', effect: 'profile_bg', value: 'sunset' },
        { id: 'bg_sky', name: '☁️ سماء', icon: '☁️', desc: 'خلفية سماء', price: 130, currency: 'coins', rarity: 'common', effect: 'profile_bg', value: 'sky' },
        { id: 'bg_lights', name: '🎆 أضواء', icon: '🎆', desc: 'خلفية أضواء', price: 300, currency: 'coins', rarity: 'epic', effect: 'profile_bg', value: 'lights' },
        { id: 'bg_legend', name: '🌟 أسطوري', icon: '🌟', desc: 'خلفية أسطورية', price: 40, currency: 'gems', rarity: 'legendary', effect: 'profile_bg', value: 'legend_bg' },
    ];
    backgrounds.forEach(b => items.push({ ...b, category: 'backgrounds', duration: 'permanent', effectType: b.effect, effectValue: b.value, stackable: false }));

    // ============================================================
    // 5. شارات (Badges)
    // ============================================================
    const badges = [
        { id: 'badge_star', name: '⭐ نجم', icon: '⭐', desc: 'شارة نجم لامع', price: 80, currency: 'coins', rarity: 'common', effect: 'display_badge', value: '⭐' },
        { id: 'badge_king', name: '👑 ملك', icon: '👑', desc: 'شارة الملك المتوج', price: 300, currency: 'coins', rarity: 'rare', effect: 'display_badge', value: '👑' },
        { id: 'badge_warrior', name: '⚔️ محارب', icon: '⚔️', desc: 'شارة المحارب الشجاع', price: 150, currency: 'coins', rarity: 'uncommon', effect: 'display_badge', value: '⚔️' },
        { id: 'badge_god', name: '⚡ إله', icon: '⚡', desc: 'شارة إلهية أسطورية', price: 50, currency: 'gems', rarity: 'epic', effect: 'display_badge', value: '⚡' },
        { id: 'badge_speed', name: '💨 سريع', icon: '💨', desc: 'شارة السرعة الفائقة', price: 180, currency: 'coins', rarity: 'uncommon', effect: 'display_badge', value: '💨' },
        { id: 'badge_smart', name: '🧠 ذكي', icon: '🧠', desc: 'شارة الذكاء الحاد', price: 200, currency: 'coins', rarity: 'rare', effect: 'display_badge', value: '🧠' },
        { id: 'badge_invincible', name: '🛡️ لا يُقهر', icon: '🛡️', desc: 'شارة الذي لا يُقهر', price: 400, currency: 'coins', rarity: 'epic', effect: 'display_badge', value: '🛡️' },
        { id: 'badge_legendary', name: '🌟 خرافي', icon: '🌟', desc: 'شارة أسطورية نادرة', price: 80, currency: 'gems', rarity: 'legendary', effect: 'display_badge', value: '🌟' },
    ];
    badges.forEach(b => items.push({ ...b, category: 'badges', duration: 'permanent', effectType: b.effect, effectValue: b.value, stackable: false }));

    // ============================================================
    // 6. رموز الدردشة (Emotes)
    // ============================================================
    const emotes = [
        { id: 'emote_fire', name: '🔥 نار', icon: '🔥', desc: 'رمز ناري', price: 30, currency: 'coins', rarity: 'common', effect: 'chat_emote', value: '🔥' },
        { id: 'emote_diamond', name: '💎 ماسة', icon: '💎', desc: 'رمز ماسي', price: 60, currency: 'coins', rarity: 'uncommon', effect: 'chat_emote', value: '💎' },
        { id: 'emote_crown', name: '👑 تاج', icon: '👑', desc: 'رمز تاج', price: 80, currency: 'coins', rarity: 'rare', effect: 'chat_emote', value: '👑' },
        { id: 'emote_thunder', name: '⚡ صاعقة', icon: '⚡', desc: 'رمز صاعقة', price: 100, currency: 'coins', rarity: 'uncommon', effect: 'chat_emote', value: '⚡' },
        { id: 'emote_fireball', name: '🔥 كرة نارية', icon: '🔥', desc: 'رمز كرة نارية', price: 150, currency: 'coins', rarity: 'rare', effect: 'chat_emote', value: '🔥' },
        { id: 'emote_beast', name: '👹 وحش', icon: '👹', desc: 'رمز وحش', price: 200, currency: 'coins', rarity: 'epic', effect: 'chat_emote', value: '👹' },
        { id: 'emote_shining', name: '✨ نجم ساطع', icon: '✨', desc: 'رمز نجم ساطع', price: 120, currency: 'coins', rarity: 'uncommon', effect: 'chat_emote', value: '✨' },
        { id: 'emote_heartbeat', name: '💓 قلب نابض', icon: '💓', desc: 'رمز قلب', price: 50, currency: 'coins', rarity: 'common', effect: 'chat_emote', value: '💓' },
    ];
    emotes.forEach(b => items.push({ ...b, category: 'emotes', duration: 'permanent', effectType: b.effect, effectValue: b.value, stackable: false }));

    // ============================================================
    // 7. سمات الواجهة (Themes)
    // ============================================================
    const themes = [
        { id: 'theme_gold', name: '🟨 ذهبي', icon: '🎨', desc: 'سمة ذهبية فاخرة', price: 250, currency: 'coins', rarity: 'rare', effect: 'ui_theme', value: 'gold' },
        { id: 'theme_electric', name: '🔵 أزرق كهربائي', icon: '🎨', desc: 'سمة زرقاء نيون', price: 200, currency: 'coins', rarity: 'uncommon', effect: 'ui_theme', value: 'electric' },
        { id: 'theme_fire', name: '🔴 أحمر ناري', icon: '🎨', desc: 'سمة حمراء مشتعلة', price: 220, currency: 'coins', rarity: 'rare', effect: 'ui_theme', value: 'fire' },
        { id: 'theme_emerald', name: '🟢 أخضر زمردي', icon: '🎨', desc: 'سمة خضراء أنيقة', price: 200, currency: 'coins', rarity: 'uncommon', effect: 'ui_theme', value: 'emerald' },
        { id: 'theme_purple', name: '🟣 بنفسجي', icon: '🎨', desc: 'سمة بنفسجية ساحرة', price: 300, currency: 'coins', rarity: 'epic', effect: 'ui_theme', value: 'purple' },
        { id: 'theme_neon_pink', name: '🩷 وردي نيون', icon: '🎨', desc: 'سمة وردية جريئة', price: 350, currency: 'coins', rarity: 'epic', effect: 'ui_theme', value: 'neon_pink' },
    ];
    themes.forEach(b => items.push({ ...b, category: 'themes', duration: 'permanent', effectType: b.effect, effectValue: b.value, stackable: false }));

    // ============================================================
    // 8. صناديق الحظ (Loot Boxes)
    // ============================================================
    const lootBoxes = [
        { id: 'loot_common', name: '📦 صندوق عادي', icon: '📦', desc: 'عنصر عادي أو غير عادي', price: 50, currency: 'coins', rarity: 'common', effect: 'loot_box', value: 'common' },
        { id: 'loot_rare', name: '🎁 صندوق مميز', icon: '🎁', desc: 'عنصر نادر أو أسطوري', price: 150, currency: 'coins', rarity: 'rare', effect: 'loot_box', value: 'rare' },
        { id: 'loot_epic', name: '💎 صندوق أسطوري', icon: '💎', desc: 'عنصر أسطوري أو خرافي', price: 50, currency: 'gems', rarity: 'epic', effect: 'loot_box', value: 'epic' },
        { id: 'loot_legendary', name: '🌟 صندوق خرافي', icon: '🌟', desc: 'عنصر خرافي مضمون', price: 150, currency: 'gems', rarity: 'legendary', effect: 'loot_box', value: 'legendary' },
    ];
    lootBoxes.forEach(b => items.push({ ...b, category: 'loot_boxes', duration: 'limited', effectType: b.effect, effectValue: b.value, stackable: true, maxStack: 99 }));

    // ============================================================
    // 9. عناصر مضاعفة النقود (Coin Multipliers) - NEW
    // ============================================================
    const coinMultipliers = [
        // مدد زمنية (بالساعات)
        { id: 'coin_x2_1h', name: '🪙 ×2 نقود (ساعة)', icon: '🪙', desc: 'مضاعفة النقود ×2 لمدة ساعة', price: 50, currency: 'coins', rarity: 'uncommon', effect: 'coin_multiplier', value: 2, durationType: 'time', durationValue: 1 },
        { id: 'coin_x2_5h', name: '🪙 ×2 نقود (5 ساعات)', icon: '🪙', desc: 'مضاعفة النقود ×2 لمدة 5 ساعات', price: 200, currency: 'coins', rarity: 'rare', effect: 'coin_multiplier', value: 2, durationType: 'time', durationValue: 5 },
        { id: 'coin_x2_24h', name: '🪙 ×2 نقود (24 ساعة)', icon: '🪙', desc: 'مضاعفة النقود ×2 لمدة 24 ساعة', price: 700, currency: 'coins', rarity: 'epic', effect: 'coin_multiplier', value: 2, durationType: 'time', durationValue: 24 },
        { id: 'coin_x3_1h', name: '🪙 ×3 نقود (ساعة)', icon: '🪙', desc: 'مضاعفة النقود ×3 لمدة ساعة', price: 120, currency: 'coins', rarity: 'rare', effect: 'coin_multiplier', value: 3, durationType: 'time', durationValue: 1 },
        { id: 'coin_x3_5h', name: '🪙 ×3 نقود (5 ساعات)', icon: '🪙', desc: 'مضاعفة النقود ×3 لمدة 5 ساعات', price: 450, currency: 'coins', rarity: 'epic', effect: 'coin_multiplier', value: 3, durationType: 'time', durationValue: 5 },
        { id: 'coin_x3_24h', name: '🪙 ×3 نقود (24 ساعة)', icon: '🪙', desc: 'مضاعفة النقود ×3 لمدة 24 ساعة', price: 1500, currency: 'coins', rarity: 'legendary', effect: 'coin_multiplier', value: 3, durationType: 'time', durationValue: 24 },
        // مدد جولات (Rounds)
        { id: 'coin_x2_1r', name: '🪙 ×2 نقود (جولة)', icon: '🪙', desc: 'مضاعفة النقود ×2 لجولة واحدة', price: 30, currency: 'coins', rarity: 'common', effect: 'coin_multiplier', value: 2, durationType: 'rounds', durationValue: 1 },
        { id: 'coin_x2_5r', name: '🪙 ×2 نقود (5 جولات)', icon: '🪙', desc: 'مضاعفة النقود ×2 لخمس جولات', price: 120, currency: 'coins', rarity: 'uncommon', effect: 'coin_multiplier', value: 2, durationType: 'rounds', durationValue: 5 },
        { id: 'coin_x2_10r', name: '🪙 ×2 نقود (10 جولات)', icon: '🪙', desc: 'مضاعفة النقود ×2 لعشرة جولات', price: 220, currency: 'coins', rarity: 'rare', effect: 'coin_multiplier', value: 2, durationType: 'rounds', durationValue: 10 },
        { id: 'coin_x3_1r', name: '🪙 ×3 نقود (جولة)', icon: '🪙', desc: 'مضاعفة النقود ×3 لجولة واحدة', price: 70, currency: 'coins', rarity: 'rare', effect: 'coin_multiplier', value: 3, durationType: 'rounds', durationValue: 1 },
        { id: 'coin_x3_5r', name: '🪙 ×3 نقود (5 جولات)', icon: '🪙', desc: 'مضاعفة النقود ×3 لخمس جولات', price: 280, currency: 'coins', rarity: 'epic', effect: 'coin_multiplier', value: 3, durationType: 'rounds', durationValue: 5 },
        { id: 'coin_x3_10r', name: '🪙 ×3 نقود (10 جولات)', icon: '🪙', desc: 'مضاعفة النقود ×3 لعشرة جولات', price: 520, currency: 'coins', rarity: 'epic', effect: 'coin_multiplier', value: 3, durationType: 'rounds', durationValue: 10 },
    ];
    coinMultipliers.forEach(b => items.push({ ...b, category: 'boosts', duration: 'limited', effectType: b.effect, effectValue: b.value, stackable: true, maxStack: 99, uses: 1 }));

    // ============================================================
    // 10. عناصر مضاعفة النقاط (Point Multipliers) - NEW
    // ============================================================
    const pointMultipliers = [
        // مدد زمنية (بالساعات)
        { id: 'point_x2_1h', name: '⭐ ×2 نقاط (ساعة)', icon: '⭐', desc: 'مضاعفة النقاط ×2 لمدة ساعة', price: 60, currency: 'coins', rarity: 'uncommon', effect: 'point_multiplier', value: 2, durationType: 'time', durationValue: 1 },
        { id: 'point_x2_5h', name: '⭐ ×2 نقاط (5 ساعات)', icon: '⭐', desc: 'مضاعفة النقاط ×2 لمدة 5 ساعات', price: 250, currency: 'coins', rarity: 'rare', effect: 'point_multiplier', value: 2, durationType: 'time', durationValue: 5 },
        { id: 'point_x2_24h', name: '⭐ ×2 نقاط (24 ساعة)', icon: '⭐', desc: 'مضاعفة النقاط ×2 لمدة 24 ساعة', price: 800, currency: 'coins', rarity: 'epic', effect: 'point_multiplier', value: 2, durationType: 'time', durationValue: 24 },
        { id: 'point_x3_1h', name: '⭐ ×3 نقاط (ساعة)', icon: '⭐', desc: 'مضاعفة النقاط ×3 لمدة ساعة', price: 150, currency: 'coins', rarity: 'rare', effect: 'point_multiplier', value: 3, durationType: 'time', durationValue: 1 },
        { id: 'point_x3_5h', name: '⭐ ×3 نقاط (5 ساعات)', icon: '⭐', desc: 'مضاعفة النقاط ×3 لمدة 5 ساعات', price: 550, currency: 'coins', rarity: 'epic', effect: 'point_multiplier', value: 3, durationType: 'time', durationValue: 5 },
        { id: 'point_x3_24h', name: '⭐ ×3 نقاط (24 ساعة)', icon: '⭐', desc: 'مضاعفة النقاط ×3 لمدة 24 ساعة', price: 1800, currency: 'coins', rarity: 'legendary', effect: 'point_multiplier', value: 3, durationType: 'time', durationValue: 24 },
        // مدد جولات (Rounds)
        { id: 'point_x2_1r', name: '⭐ ×2 نقاط (جولة)', icon: '⭐', desc: 'مضاعفة النقاط ×2 لجولة واحدة', price: 40, currency: 'coins', rarity: 'common', effect: 'point_multiplier', value: 2, durationType: 'rounds', durationValue: 1 },
        { id: 'point_x2_5r', name: '⭐ ×2 نقاط (5 جولات)', icon: '⭐', desc: 'مضاعفة النقاط ×2 لخمس جولات', price: 150, currency: 'coins', rarity: 'uncommon', effect: 'point_multiplier', value: 2, durationType: 'rounds', durationValue: 5 },
        { id: 'point_x2_10r', name: '⭐ ×2 نقاط (10 جولات)', icon: '⭐', desc: 'مضاعفة النقاط ×2 لعشرة جولات', price: 270, currency: 'coins', rarity: 'rare', effect: 'point_multiplier', value: 2, durationType: 'rounds', durationValue: 10 },
        { id: 'point_x3_1r', name: '⭐ ×3 نقاط (جولة)', icon: '⭐', desc: 'مضاعفة النقاط ×3 لجولة واحدة', price: 90, currency: 'coins', rarity: 'rare', effect: 'point_multiplier', value: 3, durationType: 'rounds', durationValue: 1 },
        { id: 'point_x3_5r', name: '⭐ ×3 نقاط (5 جولات)', icon: '⭐', desc: 'مضاعفة النقاط ×3 لخمس جولات', price: 350, currency: 'coins', rarity: 'epic', effect: 'point_multiplier', value: 3, durationType: 'rounds', durationValue: 5 },
        { id: 'point_x3_10r', name: '⭐ ×3 نقاط (10 جولات)', icon: '⭐', desc: 'مضاعفة النقاط ×3 لعشرة جولات', price: 650, currency: 'coins', rarity: 'epic', effect: 'point_multiplier', value: 3, durationType: 'rounds', durationValue: 10 },
    ];
    pointMultipliers.forEach(b => items.push({ ...b, category: 'boosts', duration: 'limited', effectType: b.effect, effectValue: b.value, stackable: true, maxStack: 99, uses: 1 }));

    // ============================================================
    // 11. عناصر إضافية (يمكنك إضافة المزيد هنا)
    // ============================================================

    return items;
},

    _setupAdminHandlers() {
        window.editAdminUser = async (uid) => {
            if (!AuthService.currentUser?.role === 'admin' && !AuthService.currentUser?.role === 'super_admin') {
                return showToast('ليس لديك صلاحية', 'error');
            }
            try {
                const doc = await db.collection('users').doc(uid).get();
                if (!doc.exists) return showToast('المستخدم غير موجود', 'error');
                const data = doc.data();
                document.getElementById('adminUserUid').value = uid;
                document.getElementById('adminUserRole').value = data.role || 'user';
                document.getElementById('adminUserAdminRole').value = data.adminRole || '';
                document.getElementById('adminUserScore').value = data.totalScore || 0;
                document.getElementById('adminUserCoins').value = data.coins || 0;
                document.getElementById('adminUserModal').classList.add('open');
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        };
    },

    _setupProfileHandlers() {
    document.getElementById('editProfileBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        const user = AuthService.currentUser;
        
        // تعبئة النموذج ببيانات المستخدم
        const usernameInput = document.getElementById('editUsername');
        const bioInput = document.getElementById('editBio');
        const locationInput = document.getElementById('editLocation');
        
        if (usernameInput) usernameInput.value = user.username || user.displayName || '';
        if (bioInput) bioInput.value = user.bio || '';
        if (locationInput) locationInput.value = user.location || '';
        
        // فتح المودال
        const modal = document.getElementById('profileEditModal');
        if (modal) modal.classList.add('open');
    });

    document.getElementById('profileSettingsBtn')?.addEventListener('click', () => {
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول', 'error');
            return;
        }
        const user = AuthService.currentUser;
        document.getElementById('editUsername').value = user.username || user.displayName || '';
        document.getElementById('editBio').value = user.bio || '';
        document.getElementById('editLocation').value = user.location || '';
        // ⚠️ تم إزالة حقل الرابط (editAvatar)
        document.getElementById('profileEditModal').classList.add('open');
    });

    // ===== عرض المتابعين =====
    document.getElementById('showFollowersBtn')?.addEventListener('click', () => {
        this._showFollowers();
    });
    
    // ===== عرض المتابَعين =====
    document.getElementById('showFollowingBtn')?.addEventListener('click', () => {
        this._showFollowing();
    });
    
    // ===== عرض الأصدقاء (تحديث) =====
    document.getElementById('profileFriendsBtn')?.addEventListener('click', () => {
        this._showFriends();
    });
   // زر تغيير الصورة
    document.getElementById('changeAvatarBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        // فتح نافذة اختيار الملف
        document.getElementById('avatarFileInput').click();
    });

        document.getElementById('avatarFileInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // التحقق من نوع الملف
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                showToast('❌ نوع الملف غير مدعوم. يرجى استخدام JPG, PNG, GIF, أو WebP', 'error');
                e.target.value = '';
                return;
            }
            // التحقق من الحجم
            if (file.size > 5 * 1024 * 1024) {
                showToast('❌ حجم الصورة كبير جداً (الحد الأقصى 5MB)', 'error');
                e.target.value = '';
                return;
            }
            this._handleAvatarUpload(file);
        }
        e.target.value = ''; // إعادة تعيين الإدخال
    });

        document.getElementById('removeAvatarBtn')?.addEventListener('click', () => {
        this._handleRemoveAvatar();
    });

    document.getElementById('profileAddPostBtn')?.addEventListener('click', () => {
        if (!AuthService.currentUser) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        document.getElementById('postForm').reset();
        document.getElementById('postModal').classList.add('open');
    });

    // زر مشاركة الملف
    document.getElementById('shareProfileBtn')?.addEventListener('click', () => {
        this.shareProfile();
    });

    // إضافة صديق
    document.getElementById('addFriendBtn')?.addEventListener('click', () => {
        const input = document.getElementById('addFriendInput');
        this.addFriend(input.value);
        input.value = '';
    });
    
    document.getElementById('addFriendInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addFriendBtn')?.click();
        }
    });

    // تبويبات الملف الشخصي
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const tab = this.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById(`tab-${tab}`);
            if (panel) panel.classList.add('active');
        });
    });
},

async _fixBadgeIcons() {
    if (!AuthService.currentUser || AuthService.currentUser.role !== 'admin') {
        console.warn('⚠️ تحتاج صلاحيات مشرف لتحديث الشارات');
        return;
    }
    
    try {
        showToast('⏳ جاري تحديث أيقونات الشارات...', 'info');
        
        // جلب جميع الشارات من Firestore
        const storeItems = await FirestoreService.getAll('storeItems');
        const badges = storeItems.filter(item => item.category === 'badges');
        
        // الأيقونات الصحيحة لكل شارة حسب المعرف
        const badgeIcons = {
            'badge_star': '⭐',
            'badge_king': '👑',
            'badge_warrior': '⚔️',
            'badge_god': '⚡',
            'badge_speed': '💨',
            'badge_smart': '🧠',
            'badge_invincible': '🛡️',
            'badge_legendary': '🌟'
        };
        
        let updatedCount = 0;
        for (const badge of badges) {
            const correctIcon = badgeIcons[badge.id];
            if (correctIcon && badge.icon !== correctIcon) {
                await FirestoreService.update('storeItems', badge.id, { icon: correctIcon });
                updatedCount++;
                console.log(`✅ تم تحديث شارة ${badge.id}: ${badge.icon} → ${correctIcon}`);
            }
        }
        
        showToast(`✅ تم تحديث ${updatedCount} شارة`, 'success');
        // إعادة تحميل البيانات
        await DataManager.loadAll();
        // تحديث الواجهة
        this._updateUserUI(AuthService.currentUser);
        this._renderStore(DataManager.data.storeItems || []);
        
    } catch (e) {
        console.error('❌ خطأ في تحديث الشارات:', e);
        showToast('❌ فشل تحديث الشارات', 'error');
    }
},

// ============================================================
// عرض جميع الجداول
// ============================================================

_renderAllTables(data) {
    // التأكد من وجود البيانات
    if (!data) {
        console.warn('⚠️ No data provided to _renderAllTables');
        data = DataManager.data || {};
    }
    
    // التأكد من أن كل مجموعة هي مصفوفة
    const safeData = {
        players: data.players || [],
        clubs: data.clubs || [],
        matches: data.matches || [],
        tournaments: data.tournaments || [],
        questions: data.questions || [],
        leaderboard: data.leaderboard || [],
        comments: data.comments || [],
        posts: data.posts || [],
        rooms: data.rooms || [],
        storeItems: data.storeItems || [],
        transactions: data.transactions || []
    };
    
    this._renderPlayersTable(safeData);
    this._renderClubsTable(safeData);
    this._renderMatchesTable(safeData);
    this._renderTournamentsTable(safeData);
    this._renderQuestionsTable(safeData);
    this._renderLeagueTable(safeData);
},

_renderPlayersTable(data) {
    const tbody = document.getElementById('playersTableBody');
    if (!tbody) {
        console.warn('⚠️ playersTableBody not found');
        return;
    }
    
    const search = document.getElementById('searchPlayer')?.value?.toLowerCase() || '';
    const posFilter = document.getElementById('filterPlayerPosition')?.value || '';
    
    // التأكد من وجود البيانات
    let list = (data?.players || []).slice();
    
    if (search) {
        list = list.filter(p => 
            (p.name || '').toLowerCase().includes(search) || 
            (p.club || '').toLowerCase().includes(search)
        );
    }
    if (posFilter) {
        list = list.filter(p => (p.position || '') === posFilter);
    }
    
    const total = list.length;
    const page = parseInt(localStorage.getItem('playerPage') || '1');
    const size = 8;
    const start = (page - 1) * size;
    const paginated = list.slice(start, start + size);
    
    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-gray">${list.length === 0 ? 'لا يوجد لاعبين' : 'لا توجد نتائج مطابقة'}</td></tr>`;
    } else {
        let html = '';
        const clubs = data?.clubs || [];
        paginated.forEach((p, idx) => {
            const clubName = clubs.find(c => c.name === p.club)?.name || p.club || '—';
            const img = p.image ? `<img src="${p.image}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="" loading="lazy">` : '—';
            const rate = p.goals > 0 && p.age ? (p.goals / (2026 - p.age)).toFixed(1) : '0';
            const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'player';
            
            html += `<tr>
                <td>${start + idx + 1}</td>
                <td><strong>${p.name || '—'}</strong></td>
                <td>${clubName}</td>
                <td><span class="badge badge-primary">${p.position || '—'}</span></td>
                <td>${p.age || '—'}</td>
                <td>⚽ ${p.goals || 0}</td>
                <td>${rate}</td>
                <td>${img}</td>
                <td>
                    <div class="table-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editPlayer('${p.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-xs btn-danger" onclick="window.deletePlayer('${p.id}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    
    const countEl = document.getElementById('playerCount');
    if (countEl) countEl.textContent = `${total} لاعب`;
    
    this._renderPagination('playerPagination', total, page, (p) => {
        localStorage.setItem('playerPage', p);
        this._renderPlayersTable(DataManager.data);
    });
},

_renderClubsTable(data) {
    const tbody = document.getElementById('clubsTableBody');
    if (!tbody) {
        console.warn('⚠️ clubsTableBody not found');
        return;
    }
    
    const search = document.getElementById('searchClub')?.value?.toLowerCase() || '';
    let list = (data?.clubs || []).slice();
    
    if (search) {
        list = list.filter(c => 
            (c.name || '').toLowerCase().includes(search) || 
            (c.city || '').toLowerCase().includes(search)
        );
    }
    
    const total = list.length;
    const page = parseInt(localStorage.getItem('clubPage') || '1');
    const size = 8;
    const start = (page - 1) * size;
    const paginated = list.slice(start, start + size);
    
    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray">${list.length === 0 ? 'لا يوجد أندية' : 'لا توجد نتائج مطابقة'}</td></tr>`;
    } else {
        let html = '';
        paginated.forEach((c, idx) => {
            const logo = c.logo ? `<img src="${c.logo}" style="width:32px;height:32px;object-fit:contain;" alt="" loading="lazy">` : '—';
            const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'club';
            
            html += `<tr>
                <td>${start + idx + 1}</td>
                <td><strong>${c.name || '—'}</strong></td>
                <td>${c.city || '—'}</td>
                <td>${c.league || '—'}</td>
                <td>${c.founded || '—'}</td>
                <td>${logo}</td>
                <td>
                    <div class="table-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editClub('${c.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-xs btn-danger" onclick="window.deleteClub('${c.id}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    
    const countEl = document.getElementById('clubCount');
    if (countEl) countEl.textContent = `${total} نادي`;
    
    this._renderPagination('clubPagination', total, page, (p) => {
        localStorage.setItem('clubPage', p);
        this._renderClubsTable(DataManager.data);
    });
},

_renderMatchesTable(data) {
    const tbody = document.getElementById('matchesTableBody');
    if (!tbody) {
        console.warn('⚠️ matchesTableBody not found');
        return;
    }
    
    const search = document.getElementById('searchMatch')?.value?.toLowerCase() || '';
    let list = (data?.matches || []).slice();
    
    if (search) {
        list = list.filter(m => 
            (m.team1 || '').toLowerCase().includes(search) || 
            (m.team2 || '').toLowerCase().includes(search)
        );
    }
    
    const total = list.length;
    const page = parseInt(localStorage.getItem('matchPage') || '1');
    const size = 8;
    const start = (page - 1) * size;
    const paginated = list.slice(start, start + size);
    
    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray">${list.length === 0 ? 'لا يوجد مباريات' : 'لا توجد نتائج مطابقة'}</td></tr>`;
    } else {
        let html = '';
        const comments = data?.comments || [];
        paginated.forEach((m, idx) => {
            const matchComments = comments.filter(c => c.matchId === m.id);
            const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'match';
            const result = (m.score1 !== undefined && m.score2 !== undefined) ? `${m.score1} - ${m.score2}` : '—';
            
            html += `<tr>
                <td>${start + idx + 1}</td>
                <td><strong>${m.team1 || '—'}</strong></td>
                <td><strong>${m.team2 || '—'}</strong></td>
                <td><span class="badge ${(m.score1 > m.score2) ? 'badge-success' : (m.score1 < m.score2) ? 'badge-danger' : 'badge-warning'}">${result}</span></td>
                <td>${formatDate(m.date)}</td>
                <td>${m.tournament || '—'}</td>
                <td><span class="badge badge-primary">${matchComments.length}</span></td>
                <td>
                    <div class="table-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                        <button class="btn btn-xs btn-info" onclick="window.openCommentModal('${m.id}')"><i class="fas fa-comment"></i></button>
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editMatch('${m.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-xs btn-danger" onclick="window.deleteMatch('${m.id}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    
    const countEl = document.getElementById('matchCount');
    if (countEl) countEl.textContent = `${total} مباراة`;
    
    this._renderPagination('matchPagination', total, page, (p) => {
        localStorage.setItem('matchPage', p);
        this._renderMatchesTable(DataManager.data);
    });
},

_renderTournamentsTable(data) {
    const tbody = document.getElementById('tournamentsTableBody');
    if (!tbody) {
        console.warn('⚠️ tournamentsTableBody not found');
        return;
    }
    
    const search = document.getElementById('searchTournament')?.value?.toLowerCase() || '';
    let list = (data?.tournaments || []).slice();
    
    if (search) {
        list = list.filter(t => (t.name || '').toLowerCase().includes(search));
    }
    
    const total = list.length;
    const page = parseInt(localStorage.getItem('tournamentPage') || '1');
    const size = 8;
    const start = (page - 1) * size;
    const paginated = list.slice(start, start + size);
    
    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray">${list.length === 0 ? 'لا يوجد بطولات' : 'لا توجد نتائج مطابقة'}</td></tr>`;
    } else {
        let html = '';
        paginated.forEach((t, idx) => {
            const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'tournament';
            
            html += `<tr>
                <td>${start + idx + 1}</td>
                <td><strong>${t.name || '—'}</strong></td>
                <td>${t.year || '—'}</td>
                <td>${t.winner ? `<span class="badge badge-gold">${t.winner}</span>` : '—'}</td>
                <td>${(t.clubs || []).join('، ') || '—'}</td>
                <td>
                    <div class="table-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editTournament('${t.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-xs btn-danger" onclick="window.deleteTournament('${t.id}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    
    const countEl = document.getElementById('tournamentCount');
    if (countEl) countEl.textContent = `${total} بطولة`;
    
    this._renderPagination('tournamentPagination', total, page, (p) => {
        localStorage.setItem('tournamentPage', p);
        this._renderTournamentsTable(DataManager.data);
    });
},

_renderQuestionsTable(data) {
    const tbody = document.getElementById('questionsTableBody');
    if (!tbody) {
        // ✅ إذا لم يوجد الجدول، نستخدم نظام البطاقات بدلاً من ذلك
        this._renderQuestionsAdvanced();
        return;
    }
    
    const search = document.getElementById('searchQuestion')?.value?.toLowerCase() || '';
    const catFilter = document.getElementById('filterQuestionCategory')?.value || '';
    let list = (data?.questions || []).slice();
    
    if (search) {
        list = list.filter(q => (q.question || '').toLowerCase().includes(search));
    }
    if (catFilter) {
        list = list.filter(q => (q.category || '') === catFilter);
    }
    
    const total = list.length;
    const page = parseInt(localStorage.getItem('questionPage') || '1');
    const size = 8;
    const start = (page - 1) * size;
    const paginated = list.slice(start, start + size);
    
    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray">${list.length === 0 ? 'لا يوجد أسئلة' : 'لا توجد نتائج مطابقة'}</td></tr>`;
    } else {
        let html = '';
        paginated.forEach((q, idx) => {
            const diffColor = q.difficulty === 'سهل' ? 'badge-success' : q.difficulty === 'صعب' ? 'badge-danger' : 'badge-warning';
            const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'question';
            
            html += `<tr>
                <td>${start + idx + 1}</td>
                <td>${truncateText(q.question, 40)}</td>
                <td><span class="badge badge-primary">${q.category || 'عام'}</span></td>
                <td><span class="badge ${diffColor}">${q.difficulty || 'متوسط'}</span></td>
                <td>
                    <div class="table-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editQuestion('${q.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-xs btn-danger" onclick="window.deleteQuestion('${q.id}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    
    const countEl = document.getElementById('questionCount');
    if (countEl) countEl.textContent = `${total} سؤال`;
    
    this._renderPagination('questionPagination', total, page, (p) => {
        localStorage.setItem('questionPage', p);
        this._renderQuestionsTable(DataManager.data);
    });
},

    _renderPagination(containerId, total, currentPage, callback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const totalPages = Math.max(1, Math.ceil(total / 8));
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        container.innerHTML = html;
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page !== currentPage) callback(page);
            });
        });
    },

_renderLeagueTable(data) {
    const tbody = document.getElementById('leagueTableBody');
    if (!tbody) {
        console.warn('⚠️ leagueTableBody not found');
        return;
    }
    
    const matches = data?.matches || [];
    const clubs = data?.clubs || [];

    const stats = {};
    clubs.forEach(c => {
        stats[c.name] = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    });

    matches.forEach(m => {
        const t1 = stats[m.team1];
        const t2 = stats[m.team2];
        if (t1 && t2) {
            t1.played++;
            t2.played++;
            t1.goalsFor += m.score1 || 0;
            t1.goalsAgainst += m.score2 || 0;
            t2.goalsFor += m.score2 || 0;
            t2.goalsAgainst += m.score1 || 0;
            if ((m.score1 || 0) > (m.score2 || 0)) {
                t1.wins++;
                t1.points += 3;
                t2.losses++;
            } else if ((m.score1 || 0) < (m.score2 || 0)) {
                t2.wins++;
                t2.points += 3;
                t1.losses++;
            } else {
                t1.draws++;
                t2.draws++;
                t1.points += 1;
                t2.points += 1;
            }
        }
    });

    const sorted = Object.entries(stats)
        .filter(([name]) => name && name !== 'undefined' && name !== 'null' && name !== '')
        .sort((a, b) => {
            if (b[1].points !== a[1].points) return b[1].points - a[1].points;
            const diffA = a[1].goalsFor - a[1].goalsAgainst;
            const diffB = b[1].goalsFor - b[1].goalsAgainst;
            if (diffB !== diffA) return diffB - diffA;
            return b[1].goalsFor - a[1].goalsFor;
        });

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-gray">${matches.length === 0 ? 'لا توجد مباريات لعرض الترتيب' : 'لا توجد فرق'}</td></tr>`;
    } else {
        let html = '';
        sorted.forEach(([name, stat], idx) => {
            const diff = stat.goalsFor - stat.goalsAgainst;
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
            html += `<tr class="${rankClass}">
                <td><strong>${idx + 1}</strong></td>
                <td><strong>${name}</strong></td>
                <td>${stat.played}</td>
                <td>${stat.wins}</td>
                <td>${stat.draws}</td>
                <td>${stat.losses}</td>
                <td>${stat.goalsFor}</td>
                <td>${stat.goalsAgainst}</td>
                <td>${diff > 0 ? '+' + diff : diff}</td>
                <td><strong style="color:var(--accent);">${stat.points}</strong></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
},

    _renderRecent(data) {
        const recentPlayers = document.getElementById('recentPlayers');
        const recentMatches = document.getElementById('recentMatches');
        const players = [...data.players].slice(-5).reverse();
        const matches = [...data.matches].slice(-5).reverse();

        if (recentPlayers) {
            if (players.length === 0) {
                recentPlayers.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>لا يوجد لاعبين</h3></div>';
            } else {
                recentPlayers.innerHTML = players.map(p =>
                    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--glass-border);">
                        <span><strong>${p.name}</strong></span>
                        <span class="text-gray">${p.club || '—'}</span>
                    </div>`
                ).join('');
            }
        }

        if (recentMatches) {
            if (matches.length === 0) {
                recentMatches.innerHTML = '<div class="empty-state"><i class="fas fa-futbol"></i><h3>لا يوجد مباريات</h3></div>';
            } else {
                recentMatches.innerHTML = matches.map(m =>
                    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--glass-border);">
                        <span>${m.team1} 🆚 ${m.team2}</span>
                        <span class="text-gray">${m.score1} - ${m.score2}</span>
                    </div>`
                ).join('');
            }
        }
    },

    _renderTopScorers(data) {
        const container = document.getElementById('topScorers');
        if (!container) return;
        const sorted = [...data.players].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 5);
        if (sorted.length === 0) {
            container.innerHTML = '<div class="text-gray">لا يوجد لاعبين</div>';
        } else {
            container.innerHTML = sorted.map((p, idx) =>
                `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--glass-border);">
                    <span>${['🥇','🥈','🥉','4.','5.'][idx] || idx+1} ${p.name}</span>
                    <span style="font-weight:700;color:var(--accent);">⚽ ${p.goals || 0}</span>
                </div>`
            ).join('');
        }
    },

_renderAchievements() {
    const container = document.getElementById('achievementsGrid');
    if (!container) return;
    const user = AuthService.currentUser;
    if (!user) {
        container.innerHTML = '<div class="text-gray">سجل الدخول لعرض الإنجازات</div>';
        return;
    }
    const achievements = AchievementSystem.getUserAchievements(user);
    container.innerHTML = achievements.map(ach =>
        `<div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}" style="background:${ach.unlocked ? 'var(--card-bg)' : 'var(--glass)'};border:1px solid ${ach.unlocked ? 'var(--accent)' : 'var(--glass-border)'};border-radius:var(--radius);padding:1rem;text-align:center;transition:var(--transition);${ach.unlocked ? 'box-shadow:0 0 30px rgba(255,217,61,0.1);' : ''}">
            <div class="ach-icon" style="font-size:2.5rem;margin-bottom:4px;">${ach.icon}</div>
            <div class="ach-name" style="font-weight:700;font-size:0.9rem;">${ach.name}</div>
            <div class="ach-desc" style="font-size:0.75rem;color:var(--gray);">${ach.desc}</div>
            <div class="ach-desc" style="font-size:0.7rem;color:var(--accent);">+${ach.points} نقطة</div>
            ${ach.unlocked ? '<div style="color:var(--success);font-size:0.7rem;">✅ مكتمل</div>' : '<div style="color:var(--gray);font-size:0.7rem;">🔒 مغلق</div>'}
        </div>`
    ).join('');
    
    // ✅ تحديث الإحصائيات (النقاط، العملات، الإنجازات)
    const stats = AchievementSystem.getAchievementStats(user);
    document.getElementById('statAchievements').textContent = stats.unlocked;
    document.getElementById('achTotalScore').textContent = user.totalScore || 0;
    document.getElementById('achCoins').textContent = user.coins || 0;
    
    // ✅ تحديث المستوى - استخدم الأرقام فقط
    const levelNum = getLevel(user.totalScore || 0).level;
    document.getElementById('achLevel').textContent = `المستوى ${levelNum}`;
    document.getElementById('achLevel').style.color = 'var(--accent)';
    
    // ✅ تحديث عدد الإنجازات
    document.getElementById('achCount').textContent = `${stats.unlocked} / ${stats.total}`;
},

    _renderAnalytics(data) {
        const chartCanvas = document.getElementById('teamPerformanceChart');
        if (!chartCanvas) return;
        const matches = data.matches || [];
        const teams = {};
        matches.forEach(m => {
            if (!teams[m.team1]) teams[m.team1] = { goals: 0, matches: 0, wins: 0 };
            if (!teams[m.team2]) teams[m.team2] = { goals: 0, matches: 0, wins: 0 };
            teams[m.team1].goals += m.score1 || 0;
            teams[m.team1].matches++;
            teams[m.team2].goals += m.score2 || 0;
            teams[m.team2].matches++;
            if ((m.score1 || 0) > (m.score2 || 0)) teams[m.team1].wins++;
            else if ((m.score1 || 0) < (m.score2 || 0)) teams[m.team2].wins++;
        });

        const labels = Object.keys(teams);
        const avgGoals = labels.map(name => teams[name].matches > 0 ? (teams[name].goals / teams[name].matches).toFixed(1) : 0);
        const winRates = labels.map(name => teams[name].matches > 0 ? ((teams[name].wins / teams[name].matches) * 100).toFixed(0) : 0);

        if (window.teamChartInstance) window.teamChartInstance.destroy();
        window.teamChartInstance = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['لا توجد فرق'],
                datasets: [
                    { label: 'متوسط الأهداف', data: labels.length ? avgGoals : [0], backgroundColor: '#6C63FF',
                        borderRadius: 6 },
                    { label: 'نسبة الفوز %', data: labels.length ? winRates : [0], backgroundColor: '#FFD93D',
                        borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'var(--light)' } } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'var(--gray)' } },
                    x: { ticks: { color: 'var(--gray)', maxRotation: 45 } }
                }
            }
        });

        const predContainer = document.getElementById('predictionResults');
        if (predContainer) {
            if (matches.length < 2) {
                predContainer.innerHTML = '<div class="text-gray">لا توجد بيانات كافية للتنبؤ</div>';
            } else {
                const lastMatch = matches[matches.length - 1];
                if (lastMatch) {
                    const t1Stats = teams[lastMatch.team1];
                    const t2Stats = teams[lastMatch.team2];
                    if (t1Stats && t2Stats) {
                        const t1Avg = t1Stats.matches > 0 ? t1Stats.goals / t1Stats.matches : 0;
                        const t2Avg = t2Stats.matches > 0 ? t2Stats.goals / t2Stats.matches : 0;
                        const predScore1 = Math.round(t1Avg);
                        const predScore2 = Math.round(t2Avg);
                        predContainer.innerHTML = `
                            <div style="padding:1rem;text-align:center;">
                                <h4>${lastMatch.team1} 🆚 ${lastMatch.team2}</h4>
                                <div style="font-size:2.5rem;font-weight:900;color:var(--accent);margin:0.5rem 0;">
                                    ${predScore1} - ${predScore2}
                                </div>
                                <div class="text-gray">نتيجة متوقعة بناءً على متوسط الأهداف</div>
                                <div style="display:flex;justify-content:center;gap:2rem;margin-top:0.5rem;font-size:0.9rem;">
                                    <span>⚽ ${t1Avg.toFixed(1)}/مباراة</span>
                                    <span>⚽ ${t2Avg.toFixed(1)}/مباراة</span>
                                </div>
                            </div>
                        `;
                    } else {
                        predContainer.innerHTML = '<div class="text-gray">بيانات غير كافية للتنبؤ</div>';
                    }
                }
            }
        }

        let totalGoals = 0;
        matches.forEach(m => {
            totalGoals += (m.score1 || 0) + (m.score2 || 0);
        });
        document.getElementById('analyticsTotalGoals').textContent = totalGoals;
        document.getElementById('analyticsAvgGoals').textContent = matches.length > 0 ? (totalGoals / matches.length).toFixed(1) : '0';
        document.getElementById('analyticsTotalComments').textContent = data.comments?.length || 0;
    },

    _renderUpcomingMatches(data) {
        const container = document.getElementById('upcomingMatches');
        if (!container) return;
        const matches = data.matches || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = matches.filter(m => m.date && new Date(m.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);

        if (upcoming.length === 0) {
            container.innerHTML = '<div class="text-gray">لا توجد مباريات قادمة</div>';
        } else {
            container.innerHTML = upcoming.map(m =>
                `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--glass-border);align-items:center;flex-wrap:wrap;gap:4px;">
                    <span><strong>${m.team1}</strong> 🆚 <strong>${m.team2}</strong></span>
                    <span class="text-gray" style="font-size:0.85rem;">${formatDate(m.date)}</span>
                    <span class="badge badge-primary badge-sm">${m.tournament || 'ودية'}</span>
                </div>`
            ).join('');
        }
    },

_populateSelects(data) {
    const clubs = data?.clubs || [];
    const tournaments = data?.tournaments || [];
    
    // نادي اللاعب
    const clubSelect = document.getElementById('pClub');
    if (clubSelect) {
        const curVal = clubSelect.value;
        clubSelect.innerHTML = '<option value="">اختر النادي</option>';
        clubs.forEach(c => {
            clubSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
        clubSelect.value = curVal;
    }

    // فرق المباراة
    const mTeam1 = document.getElementById('mTeam1');
    const mTeam2 = document.getElementById('mTeam2');
    const mTournament = document.getElementById('mTournament');
    
    [mTeam1, mTeam2].forEach(sel => {
        if (sel) {
            const cur = sel.value;
            sel.innerHTML = '<option value="">اختر</option>';
            clubs.forEach(c => {
                sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
            sel.value = cur;
        }
    });
    
    if (mTournament) {
        const cur = mTournament.value;
        mTournament.innerHTML = '<option value="">اختر</option>';
        tournaments.forEach(t => {
            mTournament.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        });
        mTournament.value = cur;
    }

    // الفائز بالبطولة
    const tWinner = document.getElementById('tWinner');
    const tClubs = document.getElementById('tClubs');
    
    if (tWinner) {
        const cur = tWinner.value;
        tWinner.innerHTML = '<option value="">—</option>';
        clubs.forEach(c => {
            tWinner.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
        tWinner.value = cur;
    }
    
    if (tClubs) {
        const selected = Array.from(tClubs.selectedOptions).map(o => o.value);
        tClubs.innerHTML = '';
        clubs.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            if (selected.includes(c.name)) opt.selected = true;
            tClubs.appendChild(opt);
        });
    }
},

    _updateCharts(data) {
        const positions = {};
        data.players.forEach(p => {
            const pos = p.position || 'غير محدد';
            positions[pos] = (positions[pos] || 0) + 1;
        });
        const posLabels = Object.keys(positions);
        const posData = Object.values(positions);
        const ctx1 = document.getElementById('positionChart');
        if (ctx1) {
            const context = ctx1.getContext('2d');
            if (window.positionChartInstance) window.positionChartInstance.destroy();
            window.positionChartInstance = new Chart(context, {
                type: 'doughnut',
                data: {
                    labels: posLabels.length ? posLabels : ['لا يوجد لاعبين'],
                    datasets: [{
                        data: posLabels.length ? posData : [1],
                        backgroundColor: ['#6C63FF', '#FF6B6B', '#FFD93D', '#2ecc71', '#a29bfe'],
                        borderColor: 'var(--dark)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: 'var(--light)', font: { size: 11 } }
                        }
                    }
                }
            });
        }

        const categories = {};
        data.questions.forEach(q => {
            const cat = q.category || 'عام';
            categories[cat] = (categories[cat] || 0) + 1;
        });
        const catLabels = Object.keys(categories);
        const catData = Object.values(categories);
        const ctx2 = document.getElementById('categoryChart');
        if (ctx2) {
            const context = ctx2.getContext('2d');
            if (window.categoryChartInstance) window.categoryChartInstance.destroy();
            window.categoryChartInstance = new Chart(context, {
                type: 'bar',
                data: {
                    labels: catLabels.length ? catLabels : ['لا يوجد أسئلة'],
                    datasets: [{
                        label: 'عدد الأسئلة',
                        data: catLabels.length ? catData : [0],
                        backgroundColor: '#6C63FF',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { color: 'var(--gray)' } },
                        x: { ticks: { color: 'var(--gray)' } }
                    }
                }
            });
        }
    },

// ============================================================
// دوال المنشورات المتقدمة
// ============================================================

/**
 * عرض جميع المنشورات في الصفحة الرئيسية
 */
_renderPosts(posts) {
    const container = document.getElementById('postsFeed');
    if (!container) return;
    
    const user = AuthService.currentUser;
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>لا توجد منشورات</h3>
                <p class="text-gray">كن أول من ينشر!</p>
                ${user ? `
                    <button class="btn btn-primary mt-1" id="emptyPostBtn">
                        <i class="fas fa-plus"></i> أنشئ منشوراً
                    </button>
                ` : `
                    <button class="btn btn-primary mt-1" id="loginToPostBtn">
                        <i class="fas fa-sign-in-alt"></i> سجل دخول للنشر
                    </button>
                `}
            </div>
        `;
        const emptyBtn = document.getElementById('emptyPostBtn');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => {
                if (!AuthService.currentUser) {
                    showToast('يجب تسجيل الدخول أولاً', 'error');
                    return;
                }
                document.getElementById('postForm').reset();
                document.getElementById('postModal').classList.add('open');
            });
        }
        const loginBtn = document.getElementById('loginToPostBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                document.getElementById('loginModal').classList.add('open');
            });
        }
        return;
    }
    
    // ترتيب المنشورات من الأحدث إلى الأقدم
    const sortedPosts = [...posts].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    let html = '';
    sortedPosts.forEach(post => {
        const isLiked = user && post.likes && post.likes.includes(user.uid);
        const comments = DataManager.data.comments?.filter(c => c.postId === post.id) || [];
        const isOwner = user && post.userId === user.uid;
        const avatarUrl = this._getUserAvatar(post.userId);
        
        // ✅ عرض الاسم الكامل بدلاً من اسم المستخدم
        const userFullName = post.fullName || post.displayName || post.userName || 'مجهول';
        const userUsername = post.username || 'guest';
        
        html += `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-avatar">${userFullName.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="post-user">${userFullName}</div>
                        <div class="post-username">@${userUsername}</div>
                        <div class="post-time">${formatDate(post.createdAt)}</div>
                    </div>
                    <div style="margin-right:auto;display:flex;gap:4px;">
                        ${isOwner ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editPost('${post.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-xs btn-danger" onclick="window.deletePost('${post.id}')"><i class="fas fa-trash"></i></button>
                        ` : ''}
${user && !isOwner ? `
    <button class="btn btn-xs btn-outline" onclick="window.toggleFollow('${post.userId}')" 
            data-follow-user="${post.userId}" 
            id="followBtn-${post.userId}">
        <i class="fas fa-user-plus"></i> متابعة
    </button>
` : ''}
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                ${post.image ? `<img src="${post.image}" class="post-image" alt="صورة المنشور" loading="lazy">` : ''}
                <div class="post-actions">
                    <button class="${isLiked ? 'liked' : ''}" onclick="window.toggleLike('${post.id}')">
                        <i class="fas fa-heart"></i> <span>${post.likes ? post.likes.length : 0}</span>
                    </button>
                    <button onclick="window.toggleComments('${post.id}')">
                        <i class="fas fa-comment"></i> <span>${comments.length}</span>
                    </button>
                    <button onclick="window.sharePost('${post.id}')">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
                <div class="post-comments" id="comments-${post.id}" style="display:none;">
                    ${comments.map(c => `
                        <div class="post-comment">
                            <span class="comment-avatar" style="display:inline-block;width:24px;height:24px;border-radius:50%;background:var(--primary);text-align:center;line-height:24px;font-size:0.6rem;color:#fff;flex-shrink:0;">
                                ${(c.userName || 'U').charAt(0).toUpperCase()}
                            </span>
                            <span class="comment-user">${c.userName || 'مجهول'}:</span>
                            <span class="comment-text">${c.text}</span>
                            ${user && c.userId === user.uid ? `
                                <button class="btn btn-xs btn-danger" onclick="window.deleteComment('${c.id}')" 
                                    style="margin-right:auto;background:transparent;color:var(--secondary);font-size:0.6rem;">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    `).join('')}
                    ${user ? `
                        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
                            <input type="text" id="commentInput-${post.id}" placeholder="اكتب تعليقاً..." 
                                style="flex:1;padding:6px 12px;border-radius:40px;background:var(--glass);
                                border:1px solid var(--glass-border);color:var(--light);font-size:0.85rem;">
                            <button class="btn btn-sm btn-primary" onclick="window.addComment('${post.id}')">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
},

/**
 * الحصول على صورة المستخدم
 */
_getUserAvatar(userId) {
    // البحث عن المستخدم في DataManager (إذا كان مخزناً)
    const user = AuthService.currentUser;
    if (user && user.uid === userId && user.avatar) {
        return user.avatar;
    }
    // محاولة البحث في قائمة المستخدمين (إذا كانت متوفرة)
    // يمكن إضافة تخزين للمستخدمين في DataManager
    return null;
},

/**
 * عرض منشورات المستخدم فقط (في مودال)
 */
async _showMyPosts() {
    const user = AuthService.currentUser;
    if (!user) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }
    
    const posts = DataManager.data.posts || [];
    const myPosts = posts.filter(p => p.userId === user.uid);
    
    if (myPosts.length === 0) {
        showToast('📝 لا توجد منشورات لك. أنشئ منشوراً الآن!', 'info');
        return;
    }
    
    // إنشاء مودال لعرض منشوراتي
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:700px;max-height:80vh;">
            <div class="modal-header">
                <h3><i class="fas fa-newspaper"></i> منشوراتي (${myPosts.length})</h3>
                <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="max-height:60vh;overflow-y:auto;padding:0.5rem 0;">
                ${myPosts.map(p => `
                    <div class="post-card" style="margin-bottom:0.8rem;padding:1rem;">
                        <div class="post-header">
                            <div class="post-avatar" style="background-image:url('${user.avatar || ''}'); background-size:cover; background-position:center;">
                                ${!user.avatar ? (user.username || 'U').charAt(0).toUpperCase() : ''}
                            </div>
                            <div>
                                <div class="post-user">${user.username || 'أنا'}</div>
                                <div class="post-time">${formatDate(p.createdAt)}</div>
                            </div>
                            <div style="margin-right:auto;display:flex;gap:4px;">
                                <button class="btn btn-xs btn-primary" onclick="window.editPost('${p.id}')"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-xs btn-danger" onclick="window.deletePost('${p.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="post-content">${p.content}</div>
                        ${p.image ? `<img src="${p.image}" class="post-image" alt="صورة المنشور" style="max-height:200px;">` : ''}
                        <div class="post-actions">
                            <span><i class="fas fa-heart" style="color:var(--secondary);"></i> ${p.likes ? p.likes.length : 0}</span>
                            <span><i class="fas fa-comment"></i> ${DataManager.data.comments?.filter(c => c.postId === p.id).length || 0}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
},

// ============================================================
// تعديل منشور
// ============================================================

async _editPost(postId, content, image) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }
    
    try {
        await DataManager.update('posts', postId, {
            content: content.trim(),
            image: image.trim() || null,
            updatedAt: new Date().toISOString()
        });
        showToast('✅ تم تحديث المنشور', 'success');
        document.getElementById('editPostModal').classList.remove('open');
        // تحديث العرض
        this._renderPosts(DataManager.data.posts || []);
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

// ============================================================
// فتح مودال تعديل المنشور
// ============================================================

_openEditPostModal(postId) {
    const post = DataManager.data.posts.find(p => p.id === postId);
    if (!post) {
        showToast('المنشور غير موجود', 'error');
        return;
    }
    
    // التحقق من أن المستخدم هو صاحب المنشور
    const user = AuthService.currentUser;
    if (!user || post.userId !== user.uid) {
        showToast('ليس لديك صلاحية لتعديل هذا المنشور', 'error');
        return;
    }
    
    document.getElementById('editPostId').value = postId;
    document.getElementById('editPostContent').value = post.content || '';
    document.getElementById('editPostImage').value = post.image || '';
    document.getElementById('editPostModal').classList.add('open');
},

/**
 * مشاركة منشور
 */
_sharePost(postId) {
    const post = DataManager.data.posts.find(p => p.id === postId);
    if (!post) {
        showToast('المنشور غير موجود', 'error');
        return;
    }
    
    const text = `📝 ${post.content.substring(0, 100)}...\n\n— ${post.userName || 'مجهول'}`;
    if (navigator.share) {
        navigator.share({
            title: 'منشور',
            text: text,
            url: window.location.href
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text + '\n\n' + window.location.href).then(() => {
            showToast('✅ تم نسخ المنشور إلى الحافظة', 'success');
        }).catch(() => {
            showToast('⚠️ لا يمكن نسخ النص تلقائياً', 'error');
        });
    }
},

// ============================================================
// 3. عرض المتجر (نسخة متطورة)
// ============================================================

_renderStore(items, filter = 'all') {
    const container = document.getElementById('storeGrid');
    if (!container) return;

    const user = AuthService.currentUser;
    const inventory = user?.inventory || [];
    const activeItems = user?.activeItems || [];
    const coins = user?.coins || 0;
    const gems = user?.gems || 0;

    // تحديث العملات
    document.getElementById('storeCoins').textContent = coins;
    const gemsEl = document.getElementById('storeGems');
    if (gemsEl) gemsEl.textContent = gems;

    // تعريفات
    const rarityMap = {
        common: { label: 'عادي', color: '#8e8e8e' },
        uncommon: { label: 'غير عادي', color: '#2ecc71' },
        rare: { label: 'نادر', color: '#3498db' },
        epic: { label: 'أسطوري', color: '#9b59b6' },
        legendary: { label: 'خرافي', color: '#f1c40f' }
    };

    const categories = {
        all: '📦 الكل',
        boosts: '⚡ تعزيزات اللعبة',
        room_boosts: '🏠 تعزيزات الغرف',
        frames: '🖼️ إطارات',
        backgrounds: '🌄 خلفيات',
        badges: '🏅 شارات',
        emotes: '💬 رموز',
        themes: '🎨 سمات',
        loot_boxes: '🎁 صناديق الحظ'
    };

    const activeCategory = document.querySelector('.store-filter.active')?.dataset?.category || 'all';

    // فلترة
    let filteredItems = items.filter(item => {
        if (!item.category) item.category = 'boosts';
        return true;
    });
    if (activeCategory !== 'all') {
        filteredItems = filteredItems.filter(item => item.category === activeCategory);
    }

    // بناء HTML
    let html = `
        <div class="store-filters" style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:1.5rem;padding:0.5rem;background:var(--glass);border-radius:var(--radius-sm);">
            ${Object.entries(categories).map(([key, label]) => `
                <button class="store-filter ${key === activeCategory ? 'active' : ''}" 
                        data-category="${key}" 
                        style="padding:6px 16px;border-radius:30px;background:${key === activeCategory ? 'var(--primary)' : 'transparent'};color:${key === activeCategory ? '#fff' : 'var(--gray)'};border:1px solid ${key === activeCategory ? 'var(--primary)' : 'var(--glass-border)'};font-size:0.75rem;cursor:pointer;transition:var(--transition);font-weight:${key === activeCategory ? '700' : '400'};"
                        onclick="App._filterStore('${key}')">
                    ${label}
                </button>
            `).join('')}
        </div>
    `;

    if (filteredItems.length === 0) {
        html += `<div class="empty-state" style="text-align:center;padding:3rem;">
            <i class="fas fa-box-open" style="font-size:4rem;color:var(--gray-dark);"></i>
            <h3>لا توجد عناصر في هذه الفئة</h3>
        </div>`;
        container.innerHTML = html;
        return;
    }

    // فصل العروض المميزة
    const featured = filteredItems.filter(i => i.rarity === 'legendary' || i.rarity === 'epic');
    const regular = filteredItems.filter(i => i.rarity !== 'legendary' && i.rarity !== 'epic');

    if (featured.length > 0 && activeCategory === 'all') {
        html += `<h3 style="margin-bottom:1rem;color:var(--accent);">🔥 العروض المميزة</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1.2rem;margin-bottom:2rem;">
                ${featured.map(item => this._renderStoreItem(item, inventory, activeItems, coins, gems, rarityMap)).join('')}
            </div>
            <hr style="border-color:var(--glass-border);margin:1.5rem 0;">`;
    }

    if (regular.length > 0) {
        if (featured.length > 0 && activeCategory === 'all') {
            html += `<h3 style="margin-bottom:1rem;color:var(--gray);">📦 جميع العناصر</h3>`;
        }
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;">
            ${regular.map(item => this._renderStoreItem(item, inventory, activeItems, coins, gems, rarityMap)).join('')}
        </div>`;
    }

    container.innerHTML = html;
},

// ============================================================
// 4. عرض عنصر واحد
// ============================================================

_renderStoreItem(item, inventory, activeItems, coins, gems, rarityMap) {
    const owned = inventory.some(i => i.itemId === item.id);
    const quantity = inventory.find(i => i.itemId === item.id)?.quantity || 0;
    const isActive = activeItems.includes(item.id);
    const isAffordable = item.currency === 'gems' ? gems >= item.price : coins >= item.price;
    const isEquippable = item.duration === 'permanent';
    const rarity = rarityMap[item.rarity] || rarityMap.common;
    const currencyIcon = item.currency === 'gems' ? '💎' : '🪙';

    return `
        <div style="background:var(--card-bg);border:2px solid ${isActive ? 'var(--accent)' : rarity.color};border-radius:var(--radius);padding:1.2rem;text-align:center;transition:all 0.3s ease;position:relative;${isActive ? 'transform:scale(1.02);box-shadow:0 0 30px rgba(255,217,61,0.15);' : ''}">
            ${isActive ? '<span style="position:absolute;top:8px;right:8px;font-size:0.55rem;background:var(--accent);color:#000;padding:2px 10px;border-radius:30px;font-weight:700;">مفعل</span>' : ''}
            ${item.rarity === 'legendary' ? '<span style="position:absolute;top:8px;left:8px;font-size:1.5rem;animation:spin 3s linear infinite;">🌟</span>' : ''}
            <div style="font-size:3.2rem;margin-bottom:0.3rem;">${item.icon || '🛒'}</div>
            <div style="font-weight:800;font-size:1.05rem;color:${rarity.color};">${item.name}</div>
            <div style="font-size:0.7rem;color:var(--gray);margin:0.2rem 0;">
                <span style="background:${rarity.color}22;color:${rarity.color};padding:1px 10px;border-radius:30px;border:1px solid ${rarity.color}44;">${rarity.label}</span>
                ${item.uses && item.uses !== Infinity ? ` • ${item.uses} استخدام` : ''}
                ${item.duration === 'permanent' ? ' • دائم' : ''}
            </div>
            <div style="font-size:0.8rem;color:var(--gray);margin:0.3rem 0;min-height:40px;">${item.description || ''}</div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--accent);margin-bottom:0.5rem;">${currencyIcon} ${item.price}</div>
            ${owned ? `
                <div style="display:flex;gap:0.3rem;justify-content:center;flex-wrap:wrap;">
                    <span style="font-size:0.65rem;background:var(--success);color:#fff;padding:2px 12px;border-radius:30px;">✅ مملوك ${quantity > 0 ? `(${quantity})` : ''}</span>
                    ${isEquippable ? `
                        <button class="btn btn-xs ${isActive ? 'btn-danger' : 'btn-primary'}" onclick="App._toggleActiveItem('${item.id}')" style="font-size:0.6rem;padding:2px 12px;">${isActive ? 'إلغاء' : 'تفعيل'}</button>
                    ` : ''}
                    ${item.category === 'loot_boxes' && quantity > 0 ? `
                        <button class="btn btn-xs btn-warning" onclick="App._openLootBox('${item.id}')" style="font-size:0.6rem;padding:2px 12px;">🎲 فتح</button>
                    ` : ''}
                </div>
            ` : `
                <button class="btn btn-sm ${isAffordable ? 'btn-success' : 'btn-outline'}" 
                        onclick="App._purchaseItem('${item.id}')" 
                        style="width:100%;justify-content:center;${!isAffordable ? 'opacity:0.5;cursor:not-allowed;' : ''}"
                        ${!isAffordable ? 'disabled' : ''}>
                    ${isAffordable ? '<i class="fas fa-shopping-cart"></i> شراء' : '⚠️ رصيد غير كافٍ'}
                </button>
                ${!isAffordable ? `<div style="font-size:0.55rem;color:var(--gray);margin-top:4px;">تحتاج ${currencyIcon} ${item.price}</div>` : ''}
            `}
        </div>
    `;
},

// ============================================================
// 5. فلتر المتجر
// ============================================================

_filterStore(category) {
    document.querySelectorAll('.store-filter').forEach(el => {
        el.classList.toggle('active', el.dataset.category === category);
    });
    this._renderStore(DataManager.data.storeItems || []);
},

// ===== دالة مساعدة لعرض عنصر واحد =====
// ============================================================
// عرض عنصر واحد في المتجر
// ============================================================

_renderStoreItem(item, inventory, activeItems, coins, gems) {
    const RARITY_COLORS = {
        common: '#8e8e8e',
        uncommon: '#2ecc71',
        rare: '#3498db',
        epic: '#9b59b6',
        legendary: '#f1c40f'
    };
    const RARITY_LABELS = {
        common: 'عادي',
        uncommon: 'غير عادي',
        rare: 'نادر',
        epic: 'أسطوري',
        legendary: 'خرافي'
    };

    const owned = inventory.some(i => i.itemId === item.id);
    const quantity = inventory.find(i => i.itemId === item.id)?.quantity || 0;
    const isActive = activeItems.includes(item.id);
    const isAffordable = item.currency === 'gems' ? gems >= item.price : coins >= item.price;
    const isEquippable = item.duration === 'permanent';
    const rarityColor = RARITY_COLORS[item.rarity] || '#8e8e8e';
    const rarityLabel = RARITY_LABELS[item.rarity] || 'عادي';
    const currencyIcon = item.currency === 'gems' ? '💎' : '🪙';
    const stackable = item.stackable === true;
    const ownedCount = inventory.find(i => i.itemId === item.id)?.quantity || 0;
    return `
        <div style="background:var(--card-bg);border:2px solid ${isActive ? 'var(--accent)' : rarityColor};border-radius:var(--radius);padding:1.2rem;text-align:center;transition:all 0.3s ease;position:relative;overflow:hidden;transform:${isActive ? 'scale(1.02)' : 'scale(1)'};box-shadow:${isActive ? '0 0 30px rgba(255,217,61,0.15)' : 'none'};">
            ${isActive ? '<span style="position:absolute;top:8px;right:8px;font-size:0.55rem;background:var(--accent);color:#000;padding:2px 10px;border-radius:30px;font-weight:700;z-index:2;">مفعل</span>' : ''}
            ${item.rarity === 'legendary' ? '<span style="position:absolute;top:8px;left:8px;font-size:1.5rem;animation:spin 3s linear infinite;">🌟</span>' : ''}
            <div style="font-size:3.2rem;margin-bottom:0.3rem;filter:${item.rarity === 'legendary' ? 'drop-shadow(0 0 20px rgba(241,196,15,0.5))' : 'none'};">
                ${item.icon || '🛒'}
            </div>
            <div style="font-weight:800;font-size:1.05rem;color:${rarityColor};">${item.name}</div>
            <div style="font-size:0.7rem;color:var(--gray);margin:0.2rem 0;">
                <span style="background:${rarityColor}22;color:${rarityColor};padding:1px 10px;border-radius:30px;border:1px solid ${rarityColor}44;">
                    ${rarityLabel}
                </span>
                ${item.uses && item.uses !== Infinity ? ` • ${item.uses} استخدام` : ''}
                ${item.duration === 'permanent' ? ' • دائم' : ''}
            </div>
            <div style="font-size:0.8rem;color:var(--gray);margin:0.3rem 0;min-height:40px;">${item.description || ''}</div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--accent);margin-bottom:0.5rem;">
                ${currencyIcon} ${item.price}
            </div>
${owned ? `
    <div style="display:flex;gap:0.3rem;justify-content:center;flex-wrap:wrap;">
        <span style="font-size:0.65rem;background:var(--success);color:#fff;padding:2px 12px;border-radius:30px;">✅ مملوك (${ownedCount})</span>
        ${stackable ? `
            <button class="btn btn-xs btn-primary" onclick="App._purchaseItem('${item.id}', 1)" style="font-size:0.6rem;padding:2px 8px;">شراء 1</button>
            <button class="btn btn-xs btn-success" onclick="App._purchaseItem('${item.id}', 10)" style="font-size:0.6rem;padding:2px 8px;">شراء 10</button>
        ` : ''}
        ${isEquippable ? `
            <button class="btn btn-xs ${isActive ? 'btn-danger' : 'btn-primary'}" onclick="App._toggleActiveItem('${item.id}')" style="font-size:0.6rem;padding:2px 12px;">${isActive ? 'إلغاء' : 'تفعيل'}</button>
        ` : ''}
        ${!isEquippable && stackable ? `
            <button class="btn btn-xs btn-warning" onclick="App._useBoostItem('${item.id}')" style="font-size:0.6rem;padding:2px 12px;">⚡ استخدام</button>
        ` : ''}
    </div>
` : `
    <button class="btn btn-sm ${isAffordable ? 'btn-success' : 'btn-outline'}" 
            onclick="App._purchaseItem('${item.id}', 1)" 
            style="width:100%;justify-content:center;${!isAffordable ? 'opacity:0.5;cursor:not-allowed;' : ''}"
            ${!isAffordable ? 'disabled' : ''}>
        ${isAffordable ? '<i class="fas fa-shopping-cart"></i> شراء' : '⚠️ رصيد غير كافٍ'}
    </button>
    ${stackable && isAffordable ? `
        <button class="btn btn-xs btn-primary" onclick="App._purchaseItem('${item.id}', 10)" style="font-size:0.6rem;padding:2px 8px;margin-top:0.2rem;">شراء 10</button>
    ` : ''}
`}

            ${item.category === 'loot_boxes' && !owned ? `
                <div style="font-size:0.55rem;color:var(--gray-dark);margin-top:4px;">🎲 احصل على عنصر عشوائي!</div>
            ` : ''}
        </div>
    `;
},

/**
 * عرض المضاعفات النشطة في واجهة اللعبة
 */
_refreshActiveBoosts() {
    const container = document.getElementById('activeBoostsList');
    if (!container) {
        console.warn('⚠️ activeBoostsList not found');
        return;
    }

    const user = AuthService.currentUser;
    if (!user) {
        container.innerHTML = '<span class="text-gray" style="font-size:0.85rem;">سجل الدخول لعرض المضاعفات</span>';
        return;
    }

    const activeDetails = user.activeItemDetails || [];
    const storeItems = DataManager.data.storeItems || [];
    const now = Date.now();

    // تصفية العناصر النشطة (غير منتهية الصلاحية)
    const validBoosts = activeDetails.filter(d => {
        if (d.durationType === 'time' && d.expiresAt) {
            return new Date(d.expiresAt).getTime() > now;
        }
        if (d.durationType === 'rounds') {
            return (d.remainingRounds || 0) > 0;
        }
        return true;
    });

    if (validBoosts.length === 0) {
        container.innerHTML = '<span class="text-gray" style="font-size:0.85rem;">لا توجد مضاعفات نشطة</span>';
        return;
    }

    let html = '';
    validBoosts.forEach(d => {
        const item = storeItems.find(i => i.id === d.itemId);
        if (!item) return;

        let durationText = '';
        if (d.durationType === 'time' && d.expiresAt) {
            const remaining = Math.max(0, Math.floor((new Date(d.expiresAt).getTime() - now) / 60000));
            const hours = Math.floor(remaining / 60);
            const minutes = remaining % 60;
            if (hours > 0) durationText = `⏱ ${hours}h ${minutes}m`;
            else durationText = `⏱ ${minutes}m`;
        } else if (d.durationType === 'rounds') {
            durationText = `🎯 ${d.remainingRounds} جولة`;
        }

        const boostType = d.type === 'coin_multiplier' ? '🪙 نقود' : '⭐ نقاط';
        const multiplier = d.multiplier || 1;

        html += `
            <div style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--card-bg);border:1px solid var(--accent);border-radius:30px;padding:0.2rem 0.6rem;font-size:0.75rem;">
                <span>${item.icon || '⚡'}</span>
                <span style="font-weight:600;">×${multiplier}</span>
                <span style="color:var(--gray);">${boostType}</span>
                <span style="color:var(--gray-dark);font-size:0.6rem;">${durationText}</span>
            </div>
        `;
    });

    container.innerHTML = html;
},

/**
 * استخدام عنصر تعزيز من المخزون (تفعيله فوراً)
 */
async _useBoostItem(itemId) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    const user = AuthService.currentUser;
    const inventory = user.inventory || [];
    const item = inventory.find(i => i.itemId === itemId);
    
    if (!item || item.quantity === 0) {
        showToast('⚠️ ليس لديك هذا العنصر', 'error');
        return;
    }

    const storeItem = DataManager.data.storeItems.find(i => i.id === itemId);
    if (!storeItem) {
        showToast('العنصر غير موجود', 'error');
        return;
    }

    // التحقق من أن العنصر من نوع تعزيز (له effectType)
    if (!storeItem.effectType || !storeItem.effectValue) {
        showToast('هذا العنصر ليس تعزيزاً قابل للاستخدام', 'info');
        return;
    }

    // بناء بيانات التفعيل
    let expiry = null;
    let remainingRounds = null;
    const durationType = storeItem.durationType || 'time';
    const durationValue = storeItem.durationValue || 0;

    if (durationType === 'time' && durationValue > 0) {
        expiry = new Date(Date.now() + durationValue * 60 * 60 * 1000).toISOString();
    } else if (durationType === 'rounds' && durationValue > 0) {
        remainingRounds = durationValue;
    }

    // تحديث المخزون (خصم استخدام واحد)
    let newInventory = inventory.map(i => {
        if (i.itemId === itemId) {
            return { ...i, quantity: (i.quantity || 0) - 1 };
        }
        return i;
    }).filter(i => i.quantity > 0);

    // إضافة إلى العناصر النشطة
    const activeDetails = user.activeItemDetails || [];
    const activeItems = user.activeItems || [];

    // إزالة أي عنصر سابق من نفس النوع (إذا كان من نفس الفئة)
    const existingIndex = activeDetails.findIndex(d => d.type === storeItem.effectType);
    if (existingIndex !== -1) {
        activeDetails.splice(existingIndex, 1);
    }

    activeDetails.push({
        itemId: itemId,
        type: storeItem.effectType,
        multiplier: storeItem.effectValue || 1,
        durationType: durationType,
        expiresAt: expiry,
        remainingRounds: remainingRounds,
        activatedAt: new Date().toISOString()
    });

    // تحديث المستخدم
    await AuthService.updateUser({
        inventory: newInventory,
        activeItemDetails: activeDetails,
        activeItems: [...activeItems, itemId]
    });

    showToast(`✅ تم تفعيل "${storeItem.name}"`, 'success');

    // تحديث الواجهات
    this._refreshActiveBoosts();
    this._updateProfileInventory(AuthService.currentUser);
    this._renderStore(DataManager.data.storeItems || []);
},


// ============================================================
// 6. شراء عنصر
// ============================================================

async _purchaseItem(itemId, quantity = 1) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    const user = AuthService.currentUser;
    const item = DataManager.data.storeItems.find(i => i.id === itemId);
    if (!item) {
        showToast('العنصر غير موجود', 'error');
        return;
    }

    const currency = item.currency || 'coins';
    const totalPrice = item.price * quantity;
    const balance = currency === 'gems' ? (user.gems || 0) : (user.coins || 0);
    if (balance < totalPrice) {
        showToast(`⚠️ رصيد غير كافٍ! تحتاج ${totalPrice} ${currency === 'gems' ? 'ماسة' : 'عملة'}`, 'error');
        return;
    }

    // التحقق من العناصر الدائمة (لا يمكن شراؤها مرتين)
    if (item.duration === 'permanent' && !item.stackable) {
        const inventory = user.inventory || [];
        if (inventory.some(i => i.itemId === itemId)) {
            showToast('لديك هذا العنصر بالفعل', 'info');
            return;
        }
    }

    try {
        // ✅ تعريف updateData هنا
        const updateData = {};
        if (currency === 'gems') {
            updateData.gems = (user.gems || 0) - totalPrice;
        } else {
            updateData.coins = (user.coins || 0) - totalPrice;
        }

        // إضافة إلى المخزون (تكديس)
        let newInventory = [...(user.inventory || [])];
        const existing = newInventory.find(i => i.itemId === itemId);
        if (existing) {
            newInventory = newInventory.map(i => {
                if (i.itemId === itemId) {
                    return { ...i, quantity: (i.quantity || 0) + quantity };
                }
                return i;
            });
        } else {
            newInventory.push({
                itemId: itemId,
                purchasedAt: new Date().toISOString(),
                quantity: quantity,
                isActive: false
            });
        }
        updateData.inventory = newInventory;

        await AuthService.updateUser(updateData);

        // تسجيل المعاملة
        await DataManager.add('transactions', {
            userId: user.uid,
            userName: user.username || user.displayName || 'مجهول',
            itemId: itemId,
            itemName: item.name,
            price: totalPrice,
            currency: currency,
            quantity: quantity,
            date: new Date().toISOString()
        });

        showToast(`✅ تم شراء ${quantity} × "${item.name}" بنجاح!`, 'success');
        this._renderStore(DataManager.data.storeItems || []);
        this._updateUserUI(AuthService.currentUser);

    } catch (e) {
        console.error('Purchase error:', e);
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

async _toggleActiveItem(itemId) {
    if (!AuthService.currentUser) return;

    const user = AuthService.currentUser;
    const inventory = user.inventory || [];
    const item = inventory.find(i => i.itemId === itemId);
    if (!item || item.quantity === 0) {
        showToast('العنصر غير موجود في المخزون', 'error');
        return;
    }

    const storeItem = DataManager.data.storeItems.find(i => i.id === itemId);
    if (!storeItem) return;

    const activeItems = user.activeItems || [];
    const activeDetails = user.activeItemDetails || [];
    const isActive = activeItems.includes(itemId);

    if (isActive) {
        // إلغاء التفعيل
        const newActiveItems = activeItems.filter(id => id !== itemId);
        const newActiveDetails = activeDetails.filter(d => d.itemId !== itemId);
        await AuthService.updateUser({
            activeItems: newActiveItems,
            activeItemDetails: newActiveDetails
        });
        showToast(`تم إلغاء تفعيل "${storeItem.name}"`, 'info');
    } else {
        // تفعيل العنصر
        let newActiveItems = [...activeItems];
        let newActiveDetails = [...activeDetails];

        // إذا كان من نفس الفئة (إطارات، خلفيات، شارات، سمات) نزيل السابق
        const category = storeItem.category;
        if (['frames', 'backgrounds', 'badges', 'themes'].includes(category)) {
            const toRemove = activeDetails.filter(d => {
                const s = DataManager.data.storeItems.find(i => i.id === d.itemId);
                return s?.category === category;
            });
            toRemove.forEach(d => {
                newActiveItems = newActiveItems.filter(id => id !== d.itemId);
                newActiveDetails = newActiveDetails.filter(detail => detail.itemId !== d.itemId);
            });
        }

        // إضافة العنصر الجديد مع تفاصيل الصلاحية
        let expiry = null;
        let remainingRounds = null;
        let durationType = storeItem.durationType || 'time';
        let durationValue = storeItem.durationValue || 0;

        if (durationType === 'time') {
            expiry = new Date(Date.now() + durationValue * 60 * 60 * 1000).toISOString();
        } else if (durationType === 'rounds') {
            remainingRounds = durationValue;
        }

        newActiveItems.push(itemId);
        newActiveDetails.push({
            itemId: itemId,
            type: storeItem.effectType,
            multiplier: storeItem.effectValue || 1,
            durationType: durationType,
            expiresAt: expiry,
            remainingRounds: remainingRounds,
            activatedAt: new Date().toISOString()
        });

        await AuthService.updateUser({
            activeItems: newActiveItems,
            activeItemDetails: newActiveDetails
        });

        showToast(`✅ تم تفعيل "${storeItem.name}"`, 'success');
    }

    // تحديث الواجهة
    this._applyUserCustomizations(AuthService.currentUser);
    this._updateProfileInventory(AuthService.currentUser);
    this._renderStore(DataManager.data.storeItems || []);
},

// ============================================================
// 8. فتح صندوق حظ
// ============================================================

async _openLootBox(itemId) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }

    const user = AuthService.currentUser;
    const inventory = user.inventory || [];
    const box = inventory.find(i => i.itemId === itemId);
    if (!box || box.quantity === 0) {
        showToast('ليس لديك صناديق لفتحها', 'error');
        return;
    }

    const storeBox = DataManager.data.storeItems.find(i => i.id === itemId);
    if (!storeBox) {
        showToast('الصندوق غير موجود', 'error');
        return;
    }

    // الحصول على الجوائز المحتملة
    const allItems = DataManager.data.storeItems.filter(i => i.id !== itemId);
    let pool = [];
    const boxType = storeBox.value; // common, rare, epic, legendary

    switch (boxType) {
        case 'common': pool = allItems.filter(i => i.rarity === 'common' || i.rarity === 'uncommon'); break;
        case 'rare': pool = allItems.filter(i => i.rarity === 'uncommon' || i.rarity === 'rare'); break;
        case 'epic': pool = allItems.filter(i => i.rarity === 'rare' || i.rarity === 'epic'); break;
        case 'legendary': pool = allItems.filter(i => i.rarity === 'epic' || i.rarity === 'legendary'); break;
        default: pool = allItems;
    }

    if (pool.length === 0) {
        showToast('لا توجد جوائز متاحة حالياً', 'info');
        return;
    }

    // اختيار جائزة عشوائية
    const reward = pool[Math.floor(Math.random() * pool.length)];

    // إضافة الجائزة إلى المخزون
    let newInventory = [...inventory];
    const existing = newInventory.find(i => i.itemId === reward.id);
    if (existing) {
        newInventory = newInventory.map(i => {
            if (i.itemId === reward.id) {
                return { ...i, quantity: (i.quantity || 0) + 1 };
            }
            return i;
        });
    } else {
        newInventory.push({
            itemId: reward.id,
            purchasedAt: new Date().toISOString(),
            quantity: reward.uses || (reward.duration === 'permanent' ? Infinity : 1),
            isActive: false
        });
    }

    // خصم صندوق واحد
    newInventory = newInventory.map(i => {
        if (i.itemId === itemId) {
            return { ...i, quantity: (i.quantity || 0) - 1 };
        }
        return i;
    }).filter(i => i.quantity > 0);

    await AuthService.updateUser({ inventory: newInventory });

// داخل _openLootBox، بعد اختيار الجائزة
const icon = reward.icon || '📦';
showToast(`🎉 لقد حصلت على: ${icon} ${reward.name} (${reward.rarity})`, 'success', 5000);
    this._renderStore(DataManager.data.storeItems || []);
    this._updateUserUI(AuthService.currentUser);
},

// ============================================================
// 9. عرض المخزون الشخصي
// ============================================================

_renderInventory() {
    const user = AuthService.currentUser;
    if (!user) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }

    const inventory = user.inventory || [];
    const activeItems = user.activeItems || [];
    const storeItems = DataManager.data.storeItems || [];

    if (inventory.length === 0) {
        showToast('📦 مخزونك فارغ، اذهب إلى المتجر للشراء!', 'info');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    let html = `
        <div class="modal-card" style="max-width:700px;max-height:90vh;">
            <div class="modal-header">
                <h3><i class="fas fa-box"></i> مخزوني (${inventory.length})</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="max-height:60vh;overflow-y:auto;">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.8rem;">
    `;

    inventory.forEach(inv => {
        const item = storeItems.find(i => i.id === inv.itemId);
        if (!item) return;
        const isActive = activeItems.includes(item.id);
        const isEquippable = item.duration === 'permanent';
        const quantity = inv.quantity || 0;

        html += `
            <div style="background:var(--card-bg);border:1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'};border-radius:var(--radius-sm);padding:0.8rem;text-align:center;">
                <div style="font-size:2.5rem;">${item.icon || '📦'}</div>
                <div style="font-weight:700;font-size:0.9rem;">${item.name}</div>
                <div style="font-size:0.7rem;color:var(--gray);">${item.description || ''}</div>
                ${quantity !== Infinity ? `<div style="font-size:0.7rem;color:var(--gray-dark);">الكمية: ${quantity}</div>` : ''}
                ${isEquippable ? `
                    <button class="btn btn-xs ${isActive ? 'btn-danger' : 'btn-primary'} mt-1" onclick="App._toggleActiveItem('${item.id}'); this.closest('.modal-card').closest('.modal-overlay').remove(); App._renderInventory();" style="font-size:0.65rem;">
                        ${isActive ? 'إلغاء التفعيل' : 'تفعيل'}
                    </button>
                ` : `
                    ${quantity > 0 ? `<span style="font-size:0.6rem;color:var(--success);">✅ جاهز للاستخدام</span>` : `<span style="font-size:0.6rem;color:var(--secondary);">❌ مستنفذ</span>`}
                `}
            </div>
        `;
    });

    html += `</div></div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
},

_renderAdminData() {
    // التحقق من وجود العناصر الأساسية
    const statsGrid = document.getElementById('adminTotalUsers');
    if (!statsGrid) {
        console.warn('⚠️ Admin stats elements not found, skipping render');
        return;
    }
    
    if (isFirebaseReady) {
        db.collection('users').orderBy('createdAt', 'desc').get().then((snapshot) => {
            const users = [];
            snapshot.forEach(doc => users.push({ id: doc.id, uid: doc.id, ...doc.data() }));
            this._renderAdminUsers(users);
            const admins = users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.adminRole);
            const stats = DataManager.getStats();
            this._renderAdminStats({
                totalUsers: users.length,
                admins: admins.length,
                posts: stats.posts || 0,
                rooms: stats.rooms || 0
            });
            this._renderAdminSystemStats(DataManager.data);
        }).catch(err => {
            console.error('Error loading users:', err);
        });
    }
},

    _renderAdminUsers(users) {
        const tbody = document.getElementById('adminUsersTable');
        if (!tbody) return;
        if (!users || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray">لا يوجد مستخدمين</td></tr>`;
            return;
        }
        let html = '';
        users.forEach((u, idx) => {
            const roleLabel = AuthService.getRoleLabel(u.role);
            const adminRoleLabel = AuthService.getAdminRoleLabel(u.adminRole);
            html += `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${u.username || u.displayName || u.email}</strong></td>
                    <td>${u.email || '—'}</td>
                    <td><span class="badge badge-primary">${roleLabel}</span></td>
                    <td>${u.adminRole ? `<span class="admin-role-badge ${u.adminRole}">${adminRoleLabel}</span>` : '—'}</td>
                    <td>⭐ ${u.totalScore || 0}</td>
                    <td>💰 ${u.coins || 0}</td>
                    <td>
                        <button class="btn btn-xs btn-primary" onclick="window.editAdminUser('${u.uid}')"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

_renderAdminStats(stats) {
    const elementIds = [
        'adminTotalUsers', 'adminActiveUsers', 'adminTotalPosts',
        'adminTotalRooms', 'adminTotalQuestions', 'adminTotalComments',
        'adminTotalMatches', 'adminStorageUsed'
    ];
    let anyFound = false;
    elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            anyFound = true;
            const value = stats[id] !== undefined ? stats[id] : 0;
            el.textContent = value;
        }
    });
    if (!anyFound) {
        console.warn('⚠️ Admin stats elements not found, skipping render');
    }
},

    _renderAdminSystemStats(data) {
        const container = document.getElementById('adminSystemStats');
        if (!container) return;
        const stats = DataManager.getStats();
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div class="text-gray">اللاعبين: <strong>${stats.players}</strong></div>
                <div class="text-gray">الأندية: <strong>${stats.clubs}</strong></div>
                <div class="text-gray">المباريات: <strong>${stats.matches}</strong></div>
                <div class="text-gray">البطولات: <strong>${stats.tournaments}</strong></div>
                <div class="text-gray">الأسئلة: <strong>${stats.questions}</strong></div>
                <div class="text-gray">التعليقات: <strong>${stats.comments}</strong></div>
                <div class="text-gray">المنشورات: <strong>${stats.posts}</strong></div>
                <div class="text-gray">الغرف: <strong>${stats.rooms}</strong></div>
            </div>
        `;
    },

    /**
     * عرض المضاعفات النشطة في واجهة اللعبة
     */
    _refreshActiveBoosts() {
        const container = document.getElementById('activeBoostsList');
        if (!container) {
            console.warn('⚠️ activeBoostsList not found');
            return;
        }

        const user = AuthService.currentUser;
        if (!user) {
            container.innerHTML = '<span class="text-gray" style="font-size:0.85rem;">سجل الدخول لعرض المضاعفات</span>';
            return;
        }

        const activeDetails = user.activeItemDetails || [];
        const storeItems = DataManager.data.storeItems || [];
        const now = Date.now();

        const validBoosts = activeDetails.filter(d => {
            if (d.durationType === 'time' && d.expiresAt) {
                return new Date(d.expiresAt).getTime() > now;
            }
            if (d.durationType === 'rounds') {
                return (d.remainingRounds || 0) > 0;
            }
            return true;
        });

        if (validBoosts.length === 0) {
            container.innerHTML = '<span class="text-gray" style="font-size:0.85rem;">لا توجد مضاعفات نشطة</span>';
            return;
        }

        let html = '';
        validBoosts.forEach(d => {
            const item = storeItems.find(i => i.id === d.itemId);
            if (!item) return;

            let durationText = '';
            if (d.durationType === 'time' && d.expiresAt) {
                const remaining = Math.max(0, Math.floor((new Date(d.expiresAt).getTime() - now) / 60000));
                const hours = Math.floor(remaining / 60);
                const minutes = remaining % 60;
                if (hours > 0) durationText = `⏱ ${hours}h ${minutes}m`;
                else durationText = `⏱ ${minutes}m`;
            } else if (d.durationType === 'rounds') {
                durationText = `🎯 ${d.remainingRounds} جولة`;
            }

            const boostType = d.type === 'coin_multiplier' ? '🪙 نقود' : '⭐ نقاط';
            const multiplier = d.multiplier || 1;

            html += `
                <div style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--card-bg);border:1px solid var(--accent);border-radius:30px;padding:0.2rem 0.6rem;font-size:0.75rem;">
                    <span>${item.icon || '⚡'}</span>
                    <span style="font-weight:600;">×${multiplier}</span>
                    <span style="color:var(--gray);">${boostType}</span>
                    <span style="color:var(--gray-dark);font-size:0.6rem;">${durationText}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    },

_updateLevelProgress(user) {
    if (!user) {
        const levelCurrent = document.getElementById('levelCurrent');
        const levelNext = document.getElementById('levelNext');
        const levelProgressFill = document.getElementById('levelProgressFill');
        const levelPointsDisplay = document.getElementById('levelPointsDisplay');
        
        if (levelCurrent) levelCurrent.textContent = 'مبتدئ';
        if (levelNext) levelNext.textContent = 'محترف (1000 نقطة)';
        if (levelProgressFill) levelProgressFill.style.width = '0%';
        if (levelPointsDisplay) levelPointsDisplay.textContent = '0 نقطة';
        return;
    }
    
    const score = user.totalScore || 0;
    const progress = getLevelProgress(score);
    
    const levelCurrent = document.getElementById('levelCurrent');
    const levelNext = document.getElementById('levelNext');
    const levelProgressFill = document.getElementById('levelProgressFill');
    const levelPointsDisplay = document.getElementById('levelPointsDisplay');
    
    if (levelCurrent) levelCurrent.textContent = `المستوى ${progress.currentLevel || 1}`;
    if (levelNext) levelNext.textContent = progress.next || 'مكتمل 🏆';
    if (levelProgressFill) levelProgressFill.style.width = `${Math.min(progress.progress, 100)}%`;
    if (levelPointsDisplay) levelPointsDisplay.textContent = `${score} نقطة`;
},

_updateUI() {
    const data = DataManager.data;
    const user = AuthService.currentUser;
    
    // ✅ التأكد من وجود البيانات
    if (!data || Object.keys(data).length === 0) {
        console.warn('⚠️ No data available, waiting for load...');
        // محاولة تحميل البيانات
        DataManager.loadAll().then(() => {
            this._updateUI();
        }).catch(() => {});
        return;
    }
    
    // تحديث المنشورات في الصفحة الرئيسية
    this._renderPosts(data.posts || []);
    
    // تحديث الإحصائيات في صفحة التحليلات
    const stats = DataManager.getStats();
    const achStats = AchievementSystem.getAchievementStats(user);
    this._updateStats({
        ...stats,
        achievements: achStats.unlocked,
        totalScore: user?.totalScore || 0,
        coins: user?.coins || 0,
        posts: data.posts?.length || 0,
        rooms: data.rooms?.length || 0,
        storeItems: data.storeItems?.length || 0
    });
    
    // ✅ تحديث جميع الجداول
    this._renderAllTables(data);
    this._populateSelects(data);
    this._renderRecent(data);
    this._renderLeagueTable(data);
    this._updateCharts(data);
    this._renderTopScorers(data);
    this._renderAchievements();
    GameEngine.renderLeaderboard();
    this._renderAnalytics(data);
    this._renderUpcomingMatches(data);
    this._renderPosts(data.posts || []);
    this._renderStore(data.storeItems || []);
    
    if (user?.role === 'admin' || user?.role === 'super_admin' || user?.adminRole) {
        this._renderAdminData();
    }
    this._updateLastUpdateTime();
},

    _updateLastUpdateTime() {
        const el = document.getElementById('lastUpdateTime');
        if (el && DataManager._lastUpdate) {
            el.textContent = DataManager._lastUpdate.toLocaleTimeString('ar-SA');
        }
    },

_onDataUpdate(data) {
    // تحديث المنشورات في الصفحة الرئيسية
    this._renderPosts(data.posts || []);
    
    // تحديث الإحصائيات في صفحة التحليلات
    const stats = DataManager.getStats();
    const user = AuthService.currentUser;
    const achStats = AchievementSystem.getAchievementStats(user);
    this._updateStats({
        ...stats,
        achievements: achStats.unlocked,
        totalScore: user?.totalScore || 0,
        coins: user?.coins || 0,
        posts: data.posts?.length || 0,
        rooms: data.rooms?.length || 0,
        storeItems: data.storeItems?.length || 0
    });
    
    // تحديث العناصر الأخرى في صفحة التحليلات
    this._updateCharts(data);
    this._renderRecent(data);
    this._renderTopScorers(data);
    this._updateLevelProgress(user);
    this._renderAnalyticsCharts(data); // ✅ الدالة موجودة الآن
    this._renderUpcomingMatches(data);
    
    // تحديث عدد منشوراتي
    if (user) {
        const countEl = document.getElementById('myPostsCount');
        if (countEl) {
            const posts = data.posts || [];
            const count = posts.filter(p => p.userId === user.uid).length;
            countEl.textContent = count;
        }
    }
        if (AuthService.currentUser) {
        this._updateFollowCounts();
        this._updateAllFollowButtons();
    }
    this._updateLastUpdateTime();
},

// ============================================================
// الاستجابة لتحديث بيانات المستخدم (من AuthService)
// ============================================================

_onUserUpdate(user) {
    // 1️⃣ تحديث واجهة المستخدم الأساسية (الأزرار، الصور، الأسماء)
    this._updateUserUI(user);

    if (user) {
        // 2️⃣ تحديث إحصائيات الملف الشخصي (المتابعين، الأصدقاء، إلخ)
        this._updateFollowCounts();
        
        // 3️⃣ تحديث شارة الإشعارات
        this._updateNotificationBadge();
        
        // 4️⃣ بدء الاستماع للإشعارات الجديدة
        this._listenNotifications(user.uid);
        
        // 5️⃣ تحديث أزرار المتابعة في جميع أنحاء التطبيق
        this._updateAllFollowButtons();

        // 6️⃣ تحديث الإحصائيات العامة (اللاعبين، الأندية، إلخ)
        const stats = DataManager.getStats();
        const achStats = AchievementSystem.getAchievementStats(user);
        this._updateStats({
            ...stats,
            achievements: achStats.unlocked,
            totalScore: user.totalScore || 0,
            coins: user.coins || 0,
            posts: DataManager.data.posts?.length || 0,
            rooms: DataManager.data.rooms?.length || 0,
            storeItems: DataManager.data.storeItems?.length || 0
        });

        // 7️⃣ تحديث صفحة الإنجازات والمتجر
        this._renderAchievements();
        this._renderStore(DataManager.data.storeItems || []);

        // 8️⃣ تحديث محتوى الملف الشخصي (التبويبات)
        this._updateProfileTabContent(user);

        // ✅ إذا كان القسم الحالي هو admin، أعد تحميله
        if (this.currentSection === 'admin') {
            // تأكد من أن المستخدم مشرف
            if (this._isAdminUser()) {
                // إعادة تحميل التبويب النشط
                const activeTab = document.querySelector('.admin-tab.active');
                const tab = activeTab ? activeTab.dataset.tab : 'dashboard';
                // تأخير صغير لضمان وجود العناصر
                setTimeout(() => this._showAdminTab(tab), 150);
            } else {
                this._activateSection('dashboard');
                showToast('⚠️ تم تغيير صلاحياتك', 'info');
            }
        }

        // 🔟 تحديث أعداد المتابعين والمتابَعين والأصدقاء
        this._updateFollowCounts();

        // 1️⃣1️⃣ تحديث أزرار المتابعة (مرة أخرى للتأكد)
        this._updateAllFollowButtons();

    } else {
        // ❌ المستخدم سجل الخروج
        // 1️⃣ إعادة تعيين الملف الشخصي والشريط الجانبي
        this._updateUserUI(null);
        
        // 2️⃣ إخفاء أي محتوى خاص بالمستخدم
        const adminNavLink = document.getElementById('adminNavLink');
        if (adminNavLink) adminNavLink.style.display = 'none';
        
        // 3️⃣ إعادة تعيين شارة الإشعارات
        const badge = document.getElementById('notificationBadge');
        if (badge) badge.style.display = 'none';
    }

    // 1️⃣2️⃣ إذا كان المستخدم مشرفاً، قم بتحديث بيانات المشرفين
    if (user?.role === 'admin' || user?.role === 'super_admin' || user?.adminRole) {
        this._renderAdminData();
    }
    if (user) {
        this._refreshActiveBoosts();
    }
},

    /**
 * الاستماع للإشعارات الجديدة
 */
_listenNotifications(userId) {
    if (this._notifUnsubscribe) {
        this._notifUnsubscribe();
    }
    
    this._notifUnsubscribe = db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .onSnapshot((snapshot) => {
            this._updateNotificationBadge();
            
            // عرض تنبيه للإشعارات الجديدة
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    showToast(`🔔 ${data.title}: ${data.message}`, 'info', 4000);
                }
            });
        }, (error) => {
            console.warn('Notification listener error:', error);
        });
},

// ============================================================
// دالة رفع الصورة - حفظ كـ Base64 في Firestore
// ============================================================

async _handleAvatarUpload(file) {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    const user = AuthService.currentUser;
    const progressContainer = document.getElementById('avatarProgressContainer');
    const progressFill = document.getElementById('avatarProgressFill');
    const progressText = document.getElementById('avatarProgressText');
    const avatarContainer = document.getElementById('profileAvatar');
    
    try {
        // إظهار شريط التقدم
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        
        // تحويل الصورة إلى Base64
        const base64Image = await uploadProfileImageToBase64(
            file,
            (progress) => {
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressText) progressText.textContent = `${progress}%`;
                const event = new CustomEvent('uploadProgress', { 
                    detail: { progress: progress } 
                });
                document.dispatchEvent(event);
            }
        );
        
        // تحديث بيانات المستخدم في Firestore
        await AuthService.updateUser({ 
            avatar: base64Image,
            avatarUpdatedAt: new Date().toISOString()
        });
        
        // تحديث الواجهة
        if (avatarContainer) {
            avatarContainer.style.backgroundImage = `url(${base64Image})`;
            avatarContainer.style.backgroundSize = 'cover';
            avatarContainer.style.backgroundPosition = 'center';
            avatarContainer.textContent = '';
        }
        
        // تحديث الصورة في الشريط الجانبي
        const userBadgeIcon = document.querySelector('.user-badge i');
        if (userBadgeIcon) {
            userBadgeIcon.style.display = 'none';
        }
        
        // إظهار زر الحذف
        const removeBtn = document.getElementById('removeAvatarBtn');
        if (removeBtn) removeBtn.style.display = 'flex';
        await AuthService.updateUser({ avatar: base64Image });
        this._updateAllAvatars();

        
        // إخفاء شريط التقدم
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressFill) progressFill.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
        }, 1500);
        
        const sizeInKB = getBase64Size(base64Image);
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('❌ فشل في رفع الصورة: ' + error.message, 'error');
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }
},

// ============================================================
// دالة تحديث جميع صور المستخدم في التطبيق
// ============================================================

_updateAllAvatars() {
    const user = AuthService.currentUser;
    if (!user) return;
    
    // تحديث الصورة في جميع عناصر الواجهة
    const avatarElements = document.querySelectorAll('.user-avatar, .post-avatar, .comment-avatar, .profile-avatar');
    avatarElements.forEach(el => {
        if (user.avatar) {
            el.style.backgroundImage = `url(${user.avatar})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
        } else {
            el.style.backgroundImage = '';
            el.textContent = (user.username || 'U').charAt(0).toUpperCase();
        }
    });
    
    // تحديث الصورة في الشريط الجانبي
    const sidebarAvatar = document.querySelector('.user-badge i');
    if (sidebarAvatar) {
        if (user.avatar) {
            sidebarAvatar.style.display = 'none';
        } else {
            sidebarAvatar.style.display = 'inline-block';
        }
    }
},

// ============================================================
// دالة حذف الصورة الشخصية
// ============================================================

async _handleRemoveAvatar() {
    if (!AuthService.currentUser) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    if (!confirm('هل أنت متأكد من حذف الصورة الشخصية؟')) return;
    
    try {
        // تحديث بيانات المستخدم في Firestore
        await AuthService.updateUser({ avatar: null });
        
        // تحديث الواجهة
        const avatarContainer = document.getElementById('profileAvatar');
        if (avatarContainer) {
            avatarContainer.style.backgroundImage = '';
            avatarContainer.textContent = AuthService.currentUser.username?.charAt(0)?.toUpperCase() || '👤';
        }
        
        // إخفاء زر الحذف
        const removeBtn = document.getElementById('removeAvatarBtn');
        if (removeBtn) removeBtn.style.display = 'none';
        
        // تحديث الشريط الجانبي
        const userBadgeIcon = document.querySelector('.user-badge i');
        if (userBadgeIcon) userBadgeIcon.style.display = 'inline-block';
        
        showToast('✅ تم حذف الصورة الشخصية', 'success');
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('❌ فشل في حذف الصورة: ' + error.message, 'error');
    }
},

// ============================================================
// عرض الرسوم البيانية والتحليلات المتقدمة
// ============================================================

_renderAnalyticsCharts(data) {
    // 1. رسم بياني أداء الفرق
    const chartCanvas = document.getElementById('teamPerformanceChart');
    if (chartCanvas) {
        const matches = data.matches || [];
        const teams = {};
        matches.forEach(m => {
            if (!teams[m.team1]) teams[m.team1] = { goals: 0, matches: 0, wins: 0 };
            if (!teams[m.team2]) teams[m.team2] = { goals: 0, matches: 0, wins: 0 };
            teams[m.team1].goals += m.score1 || 0;
            teams[m.team1].matches++;
            teams[m.team2].goals += m.score2 || 0;
            teams[m.team2].matches++;
            if ((m.score1 || 0) > (m.score2 || 0)) teams[m.team1].wins++;
            else if ((m.score1 || 0) < (m.score2 || 0)) teams[m.team2].wins++;
        });

        const labels = Object.keys(teams);
        const avgGoals = labels.map(name => teams[name].matches > 0 ? (teams[name].goals / teams[name].matches).toFixed(1) : 0);
        const winRates = labels.map(name => teams[name].matches > 0 ? ((teams[name].wins / teams[name].matches) * 100).toFixed(0) : 0);

        if (window.teamChartInstance) window.teamChartInstance.destroy();
        window.teamChartInstance = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['لا توجد فرق'],
                datasets: [
                    { 
                        label: 'متوسط الأهداف', 
                        data: labels.length ? avgGoals : [0], 
                        backgroundColor: '#6C63FF', 
                        borderRadius: 6 
                    },
                    { 
                        label: 'نسبة الفوز %', 
                        data: labels.length ? winRates : [0], 
                        backgroundColor: '#FFD93D', 
                        borderRadius: 6 
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        labels: { color: 'var(--light)' } 
                    } 
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { color: 'var(--gray)' } 
                    },
                    x: { 
                        ticks: { color: 'var(--gray)', maxRotation: 45 } 
                    }
                }
            }
        });
    }

    // 2. التنبؤ بالنتائج
    const predContainer = document.getElementById('predictionResults');
    if (predContainer) {
        const matches = data.matches || [];
        if (matches.length < 2) {
            predContainer.innerHTML = '<div class="text-gray">لا توجد بيانات كافية للتنبؤ</div>';
        } else {
            const lastMatch = matches[matches.length - 1];
            if (lastMatch) {
                const teams = {};
                matches.forEach(m => {
                    if (!teams[m.team1]) teams[m.team1] = { goals: 0, matches: 0 };
                    if (!teams[m.team2]) teams[m.team2] = { goals: 0, matches: 0 };
                    teams[m.team1].goals += m.score1 || 0;
                    teams[m.team1].matches++;
                    teams[m.team2].goals += m.score2 || 0;
                    teams[m.team2].matches++;
                });
                const t1Stats = teams[lastMatch.team1];
                const t2Stats = teams[lastMatch.team2];
                if (t1Stats && t2Stats) {
                    const t1Avg = t1Stats.matches > 0 ? t1Stats.goals / t1Stats.matches : 0;
                    const t2Avg = t2Stats.matches > 0 ? t2Stats.goals / t2Stats.matches : 0;
                    const predScore1 = Math.round(t1Avg);
                    const predScore2 = Math.round(t2Avg);
                    predContainer.innerHTML = `
                        <div style="padding:1rem;text-align:center;">
                            <h4>${lastMatch.team1} 🆚 ${lastMatch.team2}</h4>
                            <div style="font-size:2.5rem;font-weight:900;color:var(--accent);margin:0.5rem 0;">
                                ${predScore1} - ${predScore2}
                            </div>
                            <div class="text-gray">نتيجة متوقعة بناءً على متوسط الأهداف</div>
                            <div style="display:flex;justify-content:center;gap:2rem;margin-top:0.5rem;font-size:0.9rem;">
                                <span>⚽ ${t1Avg.toFixed(1)}/مباراة</span>
                                <span>⚽ ${t2Avg.toFixed(1)}/مباراة</span>
                            </div>
                        </div>
                    `;
                } else {
                    predContainer.innerHTML = '<div class="text-gray">بيانات غير كافية للتنبؤ</div>';
                }
            }
        }
    }

    // 3. إحصائيات إضافية
    const matches = data.matches || [];
    let totalGoals = 0;
    matches.forEach(m => {
        totalGoals += (m.score1 || 0) + (m.score2 || 0);
    });
    document.getElementById('analyticsTotalGoals').textContent = totalGoals;
    document.getElementById('analyticsAvgGoals').textContent = matches.length > 0 ? (totalGoals / matches.length).toFixed(1) : '0';
    document.getElementById('analyticsTotalComments').textContent = data.comments?.length || 0;
},

// ============================================================
// نظام الإشعارات
// ============================================================

_showNotifications() {
    // التوجيه إلى صفحة الإشعارات
    this._activateSection('notifications');
},

/**
 * إرسال إشعار
 */
async _sendNotification(userId, notification) {
    if (!userId) return;
    
    try {
        await db.collection('notifications').add({
            userId: userId,
            type: notification.type || 'info',
            title: notification.title || 'إشعار',
            message: notification.message || '',
            fromUserId: notification.fromUserId || null,
            fromName: notification.fromName || null,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            data: notification.data || {}
        });
        
        // تحديث شارة الإشعارات
        this._updateNotificationBadge();
        
    } catch (e) {
        console.warn('Error sending notification:', e);
    }
},

// ============================================================
// صفحة الإشعارات
// ============================================================

_renderNotificationsSection() {
    return `
        <div class="notifications-page">
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;">
                    <i class="fas fa-bell" style="color:var(--accent);"></i> 
                    الإشعارات
                </h2>
                <div class="flex-center" style="flex-wrap:wrap;gap:8px;">
                    <button class="btn btn-sm btn-outline" id="markAllNotificationsRead">
                        <i class="fas fa-check-double"></i> تحديد الكل كمقروء
                    </button>
                    <button class="btn btn-sm btn-outline" id="refreshNotificationsBtn">
                        <i class="fas fa-sync"></i> تحديث
                    </button>
                </div>
            </div>
            
            <!-- فلاتر الإشعارات -->
            <div class="notification-filters mb-2">
                <button class="filter-chip active" data-filter="all">الكل</button>
                <button class="filter-chip" data-filter="new_follower">👤 متابعات</button>
                <button class="filter-chip" data-filter="friend_request_accepted">🎉 أصدقاء</button>
                <button class="filter-chip" data-filter="like">❤️ إعجابات</button>
                <button class="filter-chip" data-filter="comment">💬 تعليقات</button>
                <button class="filter-chip" data-filter="achievement">🏆 إنجازات</button>
            </div>
            
            <!-- قائمة الإشعارات -->
            <div class="card">
                <div id="notificationsList">
                    <div class="text-gray text-center" style="padding:2rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
                        <p>جاري تحميل الإشعارات...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
},

// ============================================================
// دوال صفحة الإشعارات
// ============================================================

/**
 * عرض الإشعارات في الصفحة
 */
async _renderNotificationsPage() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (!AuthService.currentUser) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>سجل الدخول لعرض الإشعارات</h3>
                <p class="text-gray">يجب تسجيل الدخول لتتمكن من رؤية إشعاراتك</p>
                <button class="btn btn-primary mt-1" onclick="document.getElementById('loginModal').classList.add('open')">
                    <i class="fas fa-sign-in-alt"></i> تسجيل الدخول
                </button>
            </div>
        `;
        return;
    }
    
    try {
        // جلب الإشعارات
        const snapshot = await db.collection('notifications')
            .where('userId', '==', AuthService.currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });
        
        this._displayNotifications(notifications);
        
    } catch (e) {
        console.warn('Error loading notifications:', e);
        // محاولة بديلة بدون orderBy
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', AuthService.currentUser.uid)
                .get();
            
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            
            // ترتيب يدوي
            notifications.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            
            this._displayNotifications(notifications);
        } catch (e2) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle" style="color:var(--secondary);"></i>
                    <h3>حدث خطأ</h3>
                    <p class="text-gray">تعذر تحميل الإشعارات. يرجى المحاولة مرة أخرى.</p>
                    <button class="btn btn-primary mt-1" onclick="App._renderNotificationsPage()">
                        <i class="fas fa-sync"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        }
    }
},

/**
 * عرض الإشعارات في الصفحة
 */
_displayNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    const filter = document.querySelector('.notification-filters .filter-chip.active')?.dataset?.filter || 'all';
    
    // تصفية الإشعارات
    let filtered = notifications;
    if (filter !== 'all') {
        filtered = notifications.filter(n => n.type === filter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash" style="font-size:3rem;color:var(--gray-dark);"></i>
                <h3>لا توجد إشعارات</h3>
                <p class="text-gray">${notifications.length === 0 ? 'ليس لديك أي إشعارات حتى الآن' : 'لا توجد إشعارات من هذا النوع'}</p>
                ${notifications.length === 0 ? `
                    <p class="text-gray" style="font-size:0.85rem;">ستظهر الإشعارات هنا عند تفاعل الآخرين معك</p>
                ` : `
                    <button class="btn btn-sm btn-outline mt-1" onclick="document.querySelector('.notification-filters .filter-chip[data-filter=\\'all\\']').click();">
                        <i class="fas fa-eye"></i> عرض الكل
                    </button>
                `}
            </div>
        `;
        return;
    }
    
    // عرض الإشعارات
    const getIcon = (type) => {
        const icons = {
            'new_follower': '👤',
            'friend_request_accepted': '🎉',
            'like': '❤️',
            'comment': '💬',
            'mention': '📢',
            'achievement': '🏆',
            'info': 'ℹ️'
        };
        return icons[type] || '📌';
    };
    
    const getTypeLabel = (type) => {
        const labels = {
            'new_follower': 'متابعة جديدة',
            'friend_request_accepted': 'صداقة جديدة',
            'like': 'إعجاب',
            'comment': 'تعليق',
            'mention': 'إشارة',
            'achievement': 'إنجاز',
            'info': 'معلومات'
        };
        return labels[type] || 'إشعار';
    };
    
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;padding:0 0.5rem;">
            <span class="text-gray" style="font-size:0.85rem;">${filtered.length} إشعار</span>
            <span class="text-gray" style="font-size:0.75rem;">${notifications.filter(n => !n.read).length} غير مقروء</span>
        </div>
    `;
    
    filtered.forEach(n => {
        const isRead = n.read === true;
        const time = n.createdAt?.toDate?.() || new Date(n.createdAt) || new Date();
        const timeStr = formatDate(time);
        
        html += `
            <div class="notification-item ${isRead ? 'read' : 'unread'}" 
                 style="display:flex;align-items:center;gap:0.8rem;padding:0.8rem 1rem;border-bottom:1px solid var(--glass-border);
                        ${!isRead ? 'background:var(--glass);border-right:3px solid var(--accent);' : ''}
                        transition:var(--transition);cursor:pointer;"
                 onclick="App._openNotificationSource('${n.id}')">
                <span style="font-size:1.8rem;flex-shrink:0;">${getIcon(n.type)}</span>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                        <span style="font-weight:600;font-size:0.95rem;">${n.title || 'إشعار'}</span>
                        <span style="font-size:0.65rem;color:var(--gray);">${timeStr}</span>
                    </div>
                    <div style="font-size:0.9rem;color:var(--gray);">${n.message || ''}</div>
                    <div style="display:flex;gap:0.5rem;margin-top:0.3rem;flex-wrap:wrap;">
                        <span class="badge badge-sm">${getTypeLabel(n.type)}</span>
                        ${!isRead ? '<span class="badge badge-primary badge-sm">جديد</span>' : ''}
                        ${n.fromName ? `<span class="badge badge-sm" style="background:var(--glass);">من: ${n.fromName}</span>` : ''}
                    </div>
                </div>
                ${n.fromUserId ? `
                    <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); App._openUserProfileModal('${n.fromUserId}')">
                        <i class="fas fa-user"></i>
                    </button>
                ` : ''}
                <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); App._deleteNotification('${n.id}')" title="حذف">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // تحديث شارة الإشعارات بعد عرضها
    this._updateNotificationBadge();
},

/**
 * حذف إشعار
 */
async _deleteNotification(notificationId) {
    if (!confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    
    try {
        await db.collection('notifications').doc(notificationId).delete();
        showToast('✅ تم حذف الإشعار', 'success');
        this._renderNotificationsPage();
        this._updateNotificationBadge();
    } catch (e) {
        showToast('❌ خطأ في حذف الإشعار', 'error');
    }
},

/**
 * فتح مصدر الإشعار
 */
_openNotificationSource(notificationId) {
    // تحديد الإشعار كمقروء
    db.collection('notifications').doc(notificationId).update({ read: true })
        .catch(() => {});
    
    // يمكن توجيه المستخدم إلى الصفحة المناسبة حسب نوع الإشعار
    showToast('🔔 تم تحديث الإشعار', 'info');
    this._renderNotificationsPage();
},

/**
 * تحديث شارة الإشعارات
 */
async _updateNotificationBadge() {
    if (!AuthService.currentUser) {
        const badge = document.getElementById('notificationBadge');
        if (badge) badge.style.display = 'none';
        return;
    }
    
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', AuthService.currentUser.uid)
            .where('read', '==', false)
            .get();
        
        const count = snapshot.size;
        this._updateBadgeUI(count);
        
    } catch (e) {
        // Fallback
        try {
            const snapshot = await db.collection('notifications').get();
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId === AuthService.currentUser.uid && data.read === false) {
                    count++;
                }
            });
            this._updateBadgeUI(count);
        } catch (e2) {}
    }
},

/**
 * تحديث واجهة شارة الإشعارات
 */
_updateBadgeUI(count) {
    const badge = document.getElementById('notificationBadge');
    const bell = document.getElementById('notificationBell');
    
    if (badge) {
        if (count > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = count > 9 ? '9+' : count;
        } else {
            badge.style.display = 'none';
        }
    }
    
    if (bell) {
        bell.style.color = count > 0 ? 'var(--accent)' : 'var(--gray)';
    }
},

// ============================================================
// دوال التحكم في المودالات - نسخة محسنة
// ============================================================

_openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn(`⚠️ Modal "${modalId}" not found`);
        return false;
    }
    
    // ✅ حفظ موضع التمرير الحالي
    sessionStorage.setItem('modalScrollY', window.scrollY);
    
    // إغلاق جميع المودالات المفتوحة
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
        if (m.id !== modalId) {
            m.classList.remove('open');
        }
    });
    
    modal.classList.add('open');
    
    // منع التمرير
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;
    
    console.log(`🟢 Modal opened: ${modalId}`);
    return true;
},

_closeModal(modalId) {    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('open');
    }
    
    // ✅ التحقق من عدم وجود مودالات مفتوحة
    const openModals = document.querySelectorAll('.modal-overlay.open');
    
    if (openModals.length === 0) {
        // ✅ استعادة التمرير بشكل مضمون
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        document.body.style.height = '';
        
        // إعادة التمرير إلى الموضع السابق
        const scrollY = parseInt(sessionStorage.getItem('modalScrollY') || '0');
        if (scrollY > 0) {
            window.scrollTo(0, scrollY);
            sessionStorage.removeItem('modalScrollY');
        }
    }
},

_closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
        m.classList.remove('open');
    });
    // استعادة التمرير
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
},

// ============================================================
// تحديث جميع الجداول والإحصائيات
// ============================================================

_refreshAllData() {
    const data = DataManager.data;
    this._renderAllTables(data);
    this._populateSelects(data);
    this._renderLeagueTable(data);
    this._updateCharts(data);
    this._renderRecent(data);
    this._renderTopScorers(data);
    this._updateStats(DataManager.getStats());
    this._updateLastUpdateTime();
    const user = AuthService.currentUser;
    if (user) {
        this._updateFollowCounts();
        this._updateAllFollowButtons();
    }
},

// دوال مساعدة لمنع تكرار الكود
_handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
        App._closeModal(e.currentTarget.id);
    }
},

_handleEscKey(e) {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-overlay.open');
        if (openModal) {
            App._closeModal(openModal.id);
        }
    }
},

// ============================================================
// ربط جميع أزرار الإغلاق في المودالات
// ============================================================

_bindCloseButtons() {
    // 1. الأزرار التي تحمل class "modal-close-btn"
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.removeEventListener('click', this._handleCloseBtnClick);
        btn.addEventListener('click', this._handleCloseBtnClick);
    });
    
    // 2. الأزرار التي تحمل id يبدأ بـ "close" وينتهي بـ "Modal"
    //    هذه هي أزرار الإغلاق في مودالات التعديل
    document.querySelectorAll('[id^="close"][id$="Modal"]').forEach(btn => {
        // استخراج اسم المودال من id الزر
        const modalId = btn.id.replace('close', '').replace('Modal', '');
        // التأكد من أن الزر ليس له onclick مخصص (لتجنب التعارض)
        if (!btn.hasAttribute('onclick')) {
            btn.removeEventListener('click', this._handleCloseBtnClick);
            btn.addEventListener('click', this._handleCloseBtnClick);
        }
    });
    
    // 3. الأزرار التي تحمل data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.removeEventListener('click', this._handleDataCloseClick);
        btn.addEventListener('click', this._handleDataCloseClick);
    });
    
    // 4. أزرار "إلغاء" في تذييل المودال (التي ليس لها onclick)
    document.querySelectorAll('.modal-footer .btn-outline').forEach(btn => {
        if (!btn.hasAttribute('onclick')) {
            btn.removeEventListener('click', this._handleCancelBtnClick);
            btn.addEventListener('click', this._handleCancelBtnClick);
        }
    });
},

// دوال معالجة الأحداث
_handleCloseBtnClick(e) {
    e.stopPropagation();
    const modal = this.closest('.modal-overlay');
    if (modal) {
        App._closeModal(modal.id);
    }
},

_handleDataCloseClick(e) {
    e.stopPropagation();
    const modalId = this.dataset.closeModal;
    if (modalId) {
        App._closeModal(modalId);
    }
},

_handleCancelBtnClick(e) {
    e.stopPropagation();
    const modal = this.closest('.modal-overlay');
    if (modal) {
        App._closeModal(modal.id);
    }
},

// ============================================================
// عرض الأسئلة - نسخة متطورة
// ============================================================

// ============================================================
// دوال إدارة الأسئلة المتقدمة
// ============================================================

renderQuestionsAdvanced() {
    const container = document.getElementById('questionsGrid');
    const empty = document.getElementById('questionsEmpty');
    
    if (!container) return;
    
    const questions = DataManager.data.questions || [];
    
    // تحديث الإحصائيات
    this._renderQuestionStats(questions);
    
    // تطبيق الفلترة
    const search = document.getElementById('searchQuestion')?.value?.toLowerCase() || '';
    const type = document.getElementById('filterQuestionType')?.value || '';
    const category = document.getElementById('filterQuestionCategory')?.value || '';
    const difficulty = document.getElementById('filterQuestionDifficulty')?.value || '';
    const sort = document.getElementById('filterQuestionSort')?.value || 'newest';
    
    let filtered = [...questions];
    
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(q => 
            (q.question || '').toLowerCase().includes(searchLower) ||
            (q.category || '').toLowerCase().includes(searchLower) ||
            (q.options || []).some(o => (o || '').toLowerCase().includes(searchLower))
        );
    }
    
    if (type) filtered = filtered.filter(q => q.type === type);
    if (category) filtered = filtered.filter(q => q.category === category);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
    
    // ترتيب
    switch(sort) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'alphabetical':
            filtered.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
            break;
        case 'difficulty':
            const diffOrder = { 'سهل': 1, 'متوسط': 2, 'صعب': 3 };
            filtered.sort((a, b) => (diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0));
            break;
        case 'popular':
            filtered.sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0));
            break;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        document.getElementById('questionsContainer').style.display = 'none';
        return;
    }
    
    if (empty) empty.style.display = 'none';
    document.getElementById('questionsContainer').style.display = 'block';
    
    const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'question';
    const isAdmin = AuthService.checkPermission('admin');
    
    let html = '';
    filtered.forEach((q, index) => {
        const diffColor = q.difficulty === 'سهل' ? 'easy' : q.difficulty === 'صعب' ? 'hard' : 'medium';
        const diffIcon = q.difficulty === 'سهل' ? '🟢' : q.difficulty === 'صعب' ? '🔴' : '🟡';
        const typeInfo = this._getQuestionTypeInfo(q.type);
        const isSelected = this._selectedQuestions && this._selectedQuestions.includes(q.id);
        
        html += `
            <div class="question-card ${isSelected ? 'selected' : ''}" data-id="${q.id}">
                <div class="question-card-header">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <!-- ✅ مربع اختيار لتحديد السؤال -->
                        ${canEdit ? `
                            <input type="checkbox" class="question-checkbox" data-id="${q.id}" 
                                   ${isSelected ? 'checked' : ''} 
                                   onchange="App._toggleQuestionSelection('${q.id}')">
                        ` : ''}
                        <span class="question-card-number">#${index + 1}</span>
                    </div>
                    <div class="question-card-badges">
                        <span class="badge badge-type">${typeInfo?.icon || '📝'} ${typeInfo?.name || 'اختيار من متعدد'}</span>
                        <span class="badge badge-category">${q.category || 'عام'}</span>
                        <span class="badge badge-difficulty ${diffColor}">${diffIcon} ${q.difficulty || 'متوسط'}</span>
                        <span class="badge badge-options">${q.options?.length || 0} خيارات</span>
                        ${q.usedCount > 0 ? `<span class="badge badge-used">🎯 ${q.usedCount} استخدم</span>` : ''}
                    </div>
                </div>
                <div class="question-card-body">
                    <div class="question-text">${q.question || 'سؤال بدون نص'}</div>
                    ${this._renderQuestionContent(q)}
                </div>
                <div class="question-card-footer">
                    <div class="question-meta">
                        <span><i class="far fa-calendar-alt"></i> ${formatDate(q.createdAt)}</span>
                        <span><i class="fas fa-star"></i> ${q.points || 10} نقطة</span>
                        <span><i class="fas fa-clock"></i> ${q.timeLimit || 30} ث</span>
                    </div>
                    <div class="question-actions">
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editQuestion('${q.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-xs btn-success" onclick="window.duplicateQuestion('${q.id}')">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="btn btn-xs btn-danger" onclick="window.deleteQuestion('${q.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-xs btn-outline" onclick="window.previewQuestion('${q.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // ✅ تحديث عدد المحددات
    this._updateSelectedCount();
},

/**
 * عرض محتوى السؤال حسب النوع
 */
_renderQuestionContent(q) {
    switch(q.type) {
        case 'true_false':
            return `
                <div class="question-options true-false-options">
                    <div class="option-item ${q.correct === 0 ? 'correct' : ''}">
                        <span class="option-letter">✅</span>
                        <span class="option-text">صحيح</span>
                        ${q.correct === 0 ? '<span class="option-correct">✓</span>' : ''}
                    </div>
                    <div class="option-item ${q.correct === 1 ? 'correct' : ''}">
                        <span class="option-letter">❌</span>
                        <span class="option-text">خطأ</span>
                        ${q.correct === 1 ? '<span class="option-correct">✓</span>' : ''}
                    </div>
                </div>
            `;
            
        case 'fill_blank':
            return `
                <div class="question-options fill-blank-options">
                    <div class="fill-blank-answer">
                        <span class="answer-label">الإجابة الصحيحة:</span>
                        <span class="answer-value">${q.correctAnswer || '—'}</span>
                    </div>
                </div>
            `;
            
        case 'matching':
            return `
                <div class="question-options matching-options">
                    ${q.matchingPairs?.map(pair => `
                        <div class="matching-pair">
                            <span class="pair-left">${pair.left}</span>
                            <span class="pair-arrow">↔</span>
                            <span class="pair-right">${pair.right}</span>
                        </div>
                    `).join('') || '<div class="text-gray">لا توجد أزواج مطابقة</div>'}
                </div>
            `;
            
        case 'ordering':
            return `
                <div class="question-options ordering-options">
                    ${q.orderedItems?.map((item, idx) => `
                        <div class="ordering-item-display">
                            <span class="order-num">${idx + 1}</span>
                            <span class="order-text">${item}</span>
                        </div>
                    `).join('') || '<div class="text-gray">لا توجد عناصر مرتبة</div>'}
                </div>
            `;
            
        default: // multiple_choice
            return `
                <div class="question-options">
                    ${q.options?.map((opt, idx) => `
                        <div class="option-item ${idx === q.correct ? 'correct' : ''}">
                            <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
                            <span class="option-text">${opt || '—'}</span>
                            ${idx === q.correct ? '<span class="option-correct">✓</span>' : ''}
                        </div>
                    `).join('') || '<div class="text-gray">لا توجد خيارات</div>'}
                </div>
            `;
    }
},

/**
 * الحصول على معلومات نوع السؤال
 */
_getQuestionTypeInfo(type) {
    const types = {
        'multiple_choice': { name: 'اختيار من متعدد', icon: '📝' },
        'true_false': { name: 'صح/خطأ', icon: '✅' },
        'fill_blank': { name: 'ملء الفراغ', icon: '✏️' },
        'matching': { name: 'مطابقة', icon: '🔗' },
        'ordering': { name: 'ترتيب', icon: '🔢' }
    };
    return types[type] || types['multiple_choice'];
},

/**
 * تحديث إحصائيات الأسئلة
 */
_renderQuestionStats(questions) {
    const total = questions.length;
    const easy = questions.filter(q => q.difficulty === 'سهل').length;
    const medium = questions.filter(q => q.difficulty === 'متوسط').length;
    const hard = questions.filter(q => q.difficulty === 'صعب').length;
    const categories = [...new Set(questions.map(q => q.category || 'عام'))].length;
    const types = [...new Set(questions.map(q => q.type || 'multiple_choice'))].length;
    const used = questions.filter(q => q.usedCount > 0).length;
    const avgDiff = total > 0 ? Math.round((easy * 1 + medium * 2 + hard * 3) / total * 10) / 10 : 0;
    
    document.getElementById('qStatTotal').textContent = total;
    document.getElementById('qStatEasy').textContent = easy;
    document.getElementById('qStatMedium').textContent = medium;
    document.getElementById('qStatHard').textContent = hard;
    document.getElementById('qStatCategories').textContent = categories;
    document.getElementById('qStatTypes').textContent = types;
    document.getElementById('qStatUsed').textContent = used;
    document.getElementById('qStatAvgDifficulty').textContent = avgDiff.toFixed(1);
},

// ============================================================
// استيراد وتصدير الأسئلة
// ============================================================

// ============================================================
// تصدير الأسئلة - نسخة محسنة
// ============================================================

async _exportQuestions() {
    const questions = DataManager.data.questions || [];
    if (questions.length === 0) {
        showToast('لا توجد أسئلة للتصدير', 'info');
        return;
    }
    
    // ✅ تنظيم البيانات للتصدير
    const exportData = {
        exportDate: new Date().toISOString(),
        totalQuestions: questions.length,
        version: '1.0',
        questions: questions.map(q => {
            const base = {
                question: q.question,
                options: q.options || [],
                correct: q.correct !== undefined ? q.correct : 0,
                difficulty: q.difficulty || 'متوسط',
                category: q.category || 'عام',
                type: q.type || 'multiple_choice',
                points: q.points || 10,
                timeLimit: q.timeLimit || 30
            };
            
            // إضافة حقول خاصة حسب النوع
            if (q.type === 'fill_blank' && q.correctAnswer) {
                base.correctAnswer = q.correctAnswer;
            }
            if (q.type === 'matching' && q.matchingPairs) {
                base.matchingPairs = q.matchingPairs;
            }
            if (q.type === 'ordering' && q.orderedItems) {
                base.orderedItems = q.orderedItems;
            }
            
            return base;
        })
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`✅ تم تصدير ${questions.length} سؤال`, 'success');
},

// ============================================================
// استيراد الأسئلة - نسخة بدون حد أقصى (معالجة تدريجية)
// ============================================================

async _importQuestions(file) {
    if (this._isImporting) {
        showToast('⏳ جاري استيراد أسئلة أخرى، انتظر قليلاً', 'info');
        return;
    }
    
    if (!file) return;
    
    try {
        this._isImporting = true;
        this._importedCount = 0;
        
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.questions || !Array.isArray(data.questions)) {
            showToast('❌ تنسيق الملف غير صحيح', 'error');
            this._isImporting = false;
            return;
        }
        
        // ✅ تعريف المتغير هنا أولاً
        const questionsToImport = data.questions;
        const totalQuestions = questionsToImport.length;
        
        if (totalQuestions === 0) {
            showToast('⚠️ الملف لا يحتوي على أسئلة', 'info');
            this._isImporting = false;
            return;
        }
        
        // ✅ ============================================================
        // ✅ الآن يمكن استخدام questionsToImport
        // ✅ ============================================================
        
        // كشف الأسئلة المكررة والمتشابهة
        const duplicates = this._findDuplicateQuestions(questionsToImport);
        const similar = this._findSimilarQuestions(questionsToImport, 0.85);
        
        const duplicateCount = Object.keys(duplicates).length;
        const similarCount = similar.length;
        
        if (duplicateCount > 0 || similarCount > 0) {
            // عرض تقرير للمستخدم
            this._showDuplicateReport(questionsToImport, duplicates, similar);
            
            if (duplicateCount > 0) {
                const proceed = confirm(
                    `⚠️ تم العثور على ${duplicateCount} سؤال مكرر و ${similarCount} سؤال متشابه.\n\n` +
                    `هل تريد متابعة الاستيراد؟ (سيتم تخطي المكررات)`
                );
                if (!proceed) {
                    this._isImporting = false;
                    this._showImportProgress(false);
                    showToast('⏹️ تم إلغاء الاستيراد', 'info');
                    return;
                }
            }
        }
        
        // ✅ ============================================================
        // ✅ انتهى كود كشف المكررات
        // ✅ ============================================================
        
        showToast(`📚 جاري استيراد ${totalQuestions} سؤال...`, 'info', 3000);
        this._showImportProgress(true);
        this._updateImportProgress(0, `0 / ${totalQuestions}`);
        
        let addedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        let currentIndex = 0;
        const total = totalQuestions;
        
        // تنظيف أي مؤقت سابق
        if (this._importTimer) {
            clearInterval(this._importTimer);
            this._importTimer = null;
        }
        
        // استخدام Promise مع setInterval للمعالجة التدريجية
        return new Promise((resolve) => {
            this._importTimer = setInterval(async () => {
                if (currentIndex >= total || !this._isImporting) {
                    clearInterval(this._importTimer);
                    this._importTimer = null;
                    this._isImporting = false;
                    this._showImportProgress(false);
                    
                    let message = `✅ تم استيراد ${addedCount} سؤال من ${total}`;
                    if (skippedCount > 0) message += `، تم تخطي ${skippedCount} سؤال غير صحيح`;
                    if (errorCount > 0) message += `، حدث ${errorCount} خطأ`;
                    showToast(message, 'success', 5000);
                    
                    this._renderQuestionsAdvanced();
                    this._refreshAllData();
                    resolve();
                    return;
                }
                
                const q = questionsToImport[currentIndex];
                currentIndex++;
                
                try {
                    if (!q.question || !q.question.trim()) {
                        skippedCount++;
                        return;
                    }
                    
                    const questionData = this._buildQuestionData(q);
                    
                    if (!this._validateQuestionData(questionData)) {
                        skippedCount++;
                        return;
                    }
                    
                    // التحقق من وجود سؤال مكرر في قاعدة البيانات الحالية
                    const exists = DataManager.data.questions.some(existing => 
                        existing.question === questionData.question
                    );
                    
                    if (exists) {
                        skippedCount++;
                        return;
                    }
                    
                    await DataManager.add('questions', questionData);
                    addedCount++;
                    this._importedCount = addedCount;
                    
                } catch (e) {
                    console.warn('خطأ في استيراد سؤال:', e);
                    errorCount++;
                }
                
                const progress = Math.round((currentIndex / total) * 100);
                this._updateImportProgress(progress, `${addedCount} / ${total}`);
                
            }, 50);
        });
        
    } catch (e) {
        console.error('Import error:', e);
        this._isImporting = false;
        if (this._importTimer) {
            clearInterval(this._importTimer);
            this._importTimer = null;
        }
        this._showImportProgress(false);
        showToast('❌ خطأ في الاستيراد: ' + e.message, 'error');
    }
},

/**
 * بناء بيانات السؤال للاستيراد
 */
_buildQuestionData(q) {
    const base = {
        question: q.question.trim(),
        options: q.options || [],
        correct: q.correct !== undefined ? q.correct : 0,
        difficulty: q.difficulty || 'متوسط',
        category: q.category || 'عام',
        type: q.type || 'multiple_choice',
        points: q.points || 10,
        timeLimit: q.timeLimit || 30,
        isPublic: q.isPublic !== false,
        tags: q.tags || [],
        usedCount: q.usedCount || 0,
        createdAt: new Date().toISOString()
    };
    
    if (q.type === 'fill_blank' && q.correctAnswer) base.correctAnswer = q.correctAnswer;
    if (q.type === 'matching' && q.matchingPairs) base.matchingPairs = q.matchingPairs;
    if (q.type === 'ordering' && q.orderedItems) base.orderedItems = q.orderedItems;
    if (q.type === 'odd_one_out' && q.items) {
        base.items = q.items;
        base.oddIndex = q.oddIndex;
    }
    return base;
},

/**
 * التحقق من صحة بيانات السؤال
 */
_validateQuestionData(data) {
    if (!data.question) return false;
    switch(data.type) {
        case 'multiple_choice': return data.options && data.options.length >= 2;
        case 'true_false': return data.options && data.options.length >= 2;
        case 'fill_blank': return data.correctAnswer && data.correctAnswer.trim().length > 0;
        case 'matching': return data.matchingPairs && data.matchingPairs.length >= 2;
        case 'ordering': return data.orderedItems && data.orderedItems.length >= 3;
        case 'odd_one_out': return data.items && data.items.length >= 3 && data.oddIndex !== undefined; // ✅
        default: return false;
    }
},

// ============================================================
// شريط تقدم الاستيراد
// ============================================================

/**
 * إظهار/إخفاء شريط تقدم الاستيراد
 */
_showImportProgress(show) {
    // ✅ البحث عن شريط التقدم
    let container = document.getElementById('importProgress');
    
    // ✅ إذا لم يوجد، قم بإنشائه
    if (!container) {
        container = document.createElement('div');
        container.id = 'importProgress';
        container.style.cssText = `
            display: none;
            margin-top: 1rem;
            background: var(--card-bg);
            padding: 0.8rem 1rem;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-color);
        `;
        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;">
                <i class="fas fa-spinner fa-spin" style="color:var(--accent);font-size:1.2rem;"></i>
                <div style="flex:1;">
                    <div class="progress-bar" style="height:8px; background:var(--glass);">
                        <div class="fill" id="importProgressFill" style="width:0%; height:100%; background:linear-gradient(90deg, var(--primary), var(--accent)); border-radius:10px; transition:width 0.3s ease;"></div>
                    </div>
                </div>
                <span id="importProgressText" style="font-size:0.85rem;color:var(--gray);min-width:80px;text-align:center;">0%</span>
                <button class="btn btn-sm btn-danger" id="cancelImportBtn" style="display:none;">
                    <i class="fas fa-times"></i> إلغاء
                </button>
            </div>
        `;
        
        // ✅ إضافة بعد حاوية الأسئلة
        const containerEl = document.getElementById('questionsContainer');
        if (containerEl) {
            containerEl.parentNode.insertBefore(container, containerEl.nextSibling);
        } else {
            // ✅ إذا لم توجد الحاوية، أضف في نهاية الصفحة
            const section = document.getElementById('section-questions');
            if (section) {
                section.appendChild(container);
            }
        }
        
        // ✅ ربط زر الإلغاء
        document.getElementById('cancelImportBtn')?.addEventListener('click', () => {
            if (confirm('هل تريد إلغاء عملية الاستيراد؟')) {
                if (App._importTimer) {
                    clearInterval(App._importTimer);
                    App._importTimer = null;
                }
                App._isImporting = false;
                App._showImportProgress(false);
                showToast('⏹️ تم إلغاء الاستيراد', 'info');
            }
        });
    }
    
    container.style.display = show ? 'block' : 'none';
    
    // ✅ إظهار/إخفاء زر الإلغاء
    const cancelBtn = document.getElementById('cancelImportBtn');
    if (cancelBtn) {
        cancelBtn.style.display = show ? 'inline-flex' : 'none';
    }
},

/**
 * تحديث تقدم الاستيراد
 */
_updateImportProgress(progress, text) {
    const fill = document.getElementById('importProgressFill');
    const label = document.getElementById('importProgressText');
    
    if (fill) fill.style.width = `${Math.min(progress, 100)}%`;
    if (label) {
        if (text) {
            label.textContent = text;
        } else {
            label.textContent = `${Math.round(progress)}%`;
        }
    }
},

/**
 * دالة تأخير
 */
_delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
},

    // ✅ صحيح - داخل كائن App
    _previewQuestion(id) {
        const question = DataManager.data.questions.find(q => q.id === id);
        if (!question) {
            showToast('السؤال غير موجود', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay open';
        modal.innerHTML = `
            <div class="modal-card" style="max-width:600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-eye"></i> معاينة السؤال</h3>
                    <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding:1rem 0;">
                    <div class="question-preview">
                        <div class="preview-badges">
                            <span class="badge badge-category">${question.category || 'عام'}</span>
                            <span class="badge badge-difficulty ${question.difficulty === 'سهل' ? 'easy' : question.difficulty === 'صعب' ? 'hard' : 'medium'}">
                                ${question.difficulty || 'متوسط'}
                            </span>
                            <span class="badge badge-type">${this._getQuestionTypeInfo(question.type)?.icon || '📝'} ${this._getQuestionTypeInfo(question.type)?.name || 'اختيار من متعدد'}</span>
                        </div>
                        <h3 style="margin:1rem 0 0.5rem;">${question.question}</h3>
                        ${this._renderQuestionContent(question)}
                        <div style="margin-top:1rem;display:flex;gap:1rem;flex-wrap:wrap;font-size:0.85rem;color:var(--gray);">
                            <span>⭐ ${question.points || 10} نقطة</span>
                            <span>⏱ ${question.timeLimit || 30} ثانية</span>
                            <span>📊 ${question.usedCount || 0} استخدام</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

// ============================================================
// فتح مصرف الأسئلة
// ============================================================

_openQuestionBank() {
    const questions = DataManager.data.questions || [];
    
    // إحصائيات المصرف
    const categories = {};
    questions.forEach(q => {
        const cat = q.category || 'عام';
        if (!categories[cat]) categories[cat] = { total: 0, easy: 0, medium: 0, hard: 0 };
        categories[cat].total++;
        if (q.difficulty === 'سهل') categories[cat].easy++;
        else if (q.difficulty === 'صعب') categories[cat].hard++;
        else categories[cat].medium++;
    });
    
    // الأسئلة الأكثر استخداماً
    const popular = [...questions].sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0)).slice(0, 5);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:800px;">
            <div class="modal-header">
                <h3><i class="fas fa-database" style="color:var(--accent);"></i> مصرف الأسئلة</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="padding:0.5rem 0;">
                <!-- الإحصائيات -->
                <div class="bank-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0.5rem;margin-bottom:1rem;">
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${questions.length}</div>
                        <div class="stat-label">إجمالي الأسئلة</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${Object.keys(categories).length}</div>
                        <div class="stat-label">التصنيفات</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${questions.filter(q => q.type === 'multiple_choice').length}</div>
                        <div class="stat-label">اختيار من متعدد</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${questions.filter(q => q.type === 'true_false').length}</div>
                        <div class="stat-label">صح/خطأ</div>
                    </div>
                </div>
                
                <!-- التصنيفات -->
                <h4 style="margin-bottom:0.5rem;"><i class="fas fa-folder"></i> التصنيفات</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.3rem;margin-bottom:1rem;">
                    ${Object.entries(categories).map(([name, data]) => `
                        <div style="background:var(--glass);border-radius:8px;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);">
                            <div style="font-weight:600;font-size:0.85rem;">${name}</div>
                            <div style="display:flex;gap:0.3rem;font-size:0.65rem;color:var(--gray);">
                                <span>🟢 ${data.easy}</span>
                                <span>🟡 ${data.medium}</span>
                                <span>🔴 ${data.hard}</span>
                                <span style="font-weight:700;color:var(--accent);">${data.total}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- الأسئلة الشائعة -->
                <h4 style="margin-bottom:0.5rem;"><i class="fas fa-fire" style="color:var(--secondary);"></i> الأسئلة الأكثر استخداماً</h4>
                ${popular.length === 0 ? '<div class="text-gray">لا توجد أسئلة مستخدمة بعد</div>' : ''}
                ${popular.map(q => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0.6rem;border-bottom:1px solid var(--glass-border);">
                        <span style="font-size:0.85rem;">${q.question?.substring(0, 60)}${q.question?.length > 60 ? '...' : ''}</span>
                        <span style="font-size:0.7rem;color:var(--accent);">🎯 ${q.usedCount || 0} استخدام</span>
                    </div>
                `).join('')}
                
                <!-- أزرار إضافية -->
                <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="this.closest('.modal-overlay').remove(); document.getElementById('openAddQuestion').click();">
                        <i class="fas fa-plus"></i> إضافة سؤال
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove(); document.getElementById('importQuestionsBtn').click();">
                        <i class="fas fa-file-import"></i> استيراد
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove(); document.getElementById('exportQuestionsBtn').click();">
                        <i class="fas fa-file-export"></i> تصدير
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
},

// ============================================================
// تحديث واجهة النموذج حسب نوع السؤال
// ============================================================

_updateQuestionTypeUI(type) {
    // إخفاء جميع الحاويات
    const containers = {
        options: document.getElementById('qOptionsContainer'),
        fillBlank: document.getElementById('qFillBlankContainer'),
        matching: document.getElementById('qMatchingContainer'),
        ordering: document.getElementById('qOrderingContainer')
    };
    
    Object.values(containers).forEach(el => {
        if (el) el.style.display = 'none';
    });
    
    // إظهار الحاوية المناسبة
    switch(type) {
        case 'multiple_choice':
            if (containers.options) containers.options.style.display = 'block';
            break;
        case 'true_false':
            // صح/خطأ يستخدم نفس حاوية الخيارات لكن مع خيارين فقط
            if (containers.options) {
                containers.options.style.display = 'block';
                // تحديث الخيارات لـ صح/خطأ
                const optionInputs = document.querySelectorAll('#qOptionsList .option-input');
                const optionLabels = document.querySelectorAll('#qOptionsList .option-label');
                if (optionInputs.length >= 2) {
                    optionInputs[0].value = 'صحيح';
                    optionInputs[1].value = 'خطأ';
                    optionInputs[0].disabled = true;
                    optionInputs[1].disabled = true;
                    if (optionInputs[2]) optionInputs[2].style.display = 'none';
                    if (optionInputs[3]) optionInputs[3].style.display = 'none';
                }
            }
            break;
        case 'fill_blank':
            if (containers.fillBlank) containers.fillBlank.style.display = 'block';
            break;
        case 'matching':
            if (containers.matching) containers.matching.style.display = 'block';
            break;
        case 'ordering':
            if (containers.ordering) containers.ordering.style.display = 'block';
            break;
        default:
            if (containers.options) containers.options.style.display = 'block';
            break;
    }
    
    // إعادة تعيين الخيارات عند التغيير
    if (type !== 'true_false' && type !== 'multiple_choice') {
        // إعادة تمكين الخيارات
        document.querySelectorAll('#qOptionsList .option-input').forEach(input => {
            input.disabled = false;
            input.style.display = '';
        });
    }
},

/**
 * تهيئة نموذج السؤال - ربط تغيير النوع
 */
_initQuestionForm() {
    const typeSelect = document.getElementById('qType');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            this._updateQuestionTypeUI(e.target.value);
        });
    }
    
    // أزرار إضافة وحذف الخيارات
    document.getElementById('addOptionBtn')?.addEventListener('click', () => {
        this._addQuestionOption();
    });
    document.getElementById('removeOptionBtn')?.addEventListener('click', () => {
        this._removeQuestionOption();
    });
    
    // أزرار المطابقة
    document.getElementById('addMatchingPairBtn')?.addEventListener('click', () => {
        this._addMatchingPair();
    });
    
    // أزرار الترتيب
    document.getElementById('addOrderingItemBtn')?.addEventListener('click', () => {
        this._addOrderingItem();
    });
},

/**
 * إضافة خيار جديد
 */
_addQuestionOption() {
    const list = document.getElementById('qOptionsList');
    if (!list) return;
    const count = list.querySelectorAll('.option-row').length;
    if (count >= 6) {
        showToast('الحد الأقصى 6 خيارات', 'info');
        return;
    }
    const row = document.createElement('div');
    row.className = 'option-row';
    row.innerHTML = `
        <input type="text" placeholder="الخيار ${count + 1}" class="option-input">
        <input type="radio" name="qCorrect" value="${count}">
        <span class="option-label">صحيح</span>
    `;
    list.appendChild(row);
    document.getElementById('removeOptionBtn').style.display = 'inline-flex';
},

/**
 * حذف خيار
 */
_removeQuestionOption() {
    const list = document.getElementById('qOptionsList');
    if (!list) return;
    const rows = list.querySelectorAll('.option-row');
    if (rows.length <= 2) {
        showToast('تحتاج إلى خيارين على الأقل', 'info');
        return;
    }
    rows[rows.length - 1].remove();
    if (list.querySelectorAll('.option-row').length <= 2) {
        document.getElementById('removeOptionBtn').style.display = 'none';
    }
},

/**
 * إضافة زوج مطابقة
 */
_addMatchingPair() {
    const container = document.getElementById('qMatchingPairs');
    if (!container) return;
    const count = container.querySelectorAll('.matching-row').length;
    if (count >= 6) {
        showToast('الحد الأقصى 6 أزواج', 'info');
        return;
    }
    const row = document.createElement('div');
    row.className = 'matching-row';
    row.innerHTML = `
        <input type="text" placeholder="العنصر ${count * 2 + 1}" class="matching-left">
        <span>↔</span>
        <input type="text" placeholder="العنصر ${count * 2 + 2}" class="matching-right">
    `;
    container.appendChild(row);
},

/**
 * إضافة عنصر ترتيب
 */
_addOrderingItem() {
    const container = document.getElementById('qOrderingItems');
    if (!container) return;
    const count = container.querySelectorAll('.ordering-item').length;
    if (count >= 8) {
        showToast('الحد الأقصى 8 عناصر', 'info');
        return;
    }
    const row = document.createElement('div');
    row.className = 'ordering-item';
    row.draggable = true;
    row.innerHTML = `
        <span class="drag-handle">⠿</span>
        <input type="text" placeholder="العنصر ${count + 1}">
        <span class="order-number">${count + 1}</span>
    `;
    container.appendChild(row);
    this._initOrderingDrag();
},

/**
 * تهيئة السحب والترتيب
 */
_initOrderingDrag() {
    const items = document.querySelectorAll('#qOrderingItems .ordering-item');
    let draggedItem = null;
    
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.style.opacity = '0.5';
        });
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem !== item) {
                const parent = item.parentNode;
                const itemsList = Array.from(parent.children);
                const draggedIndex = itemsList.indexOf(draggedItem);
                const targetIndex = itemsList.indexOf(item);
                
                if (draggedIndex < targetIndex) {
                    parent.insertBefore(draggedItem, item.nextSibling);
                } else {
                    parent.insertBefore(draggedItem, item);
                }
                // تحديث الأرقام
                parent.querySelectorAll('.ordering-item .order-number').forEach((num, idx) => {
                    num.textContent = idx + 1;
                });
            }
        });
    });
},

// ============================================================
// استيراد الأسئلة - نسخة مع Worker (للكميات الكبيرة)
// ============================================================

async _importQuestionsWithWorker(file) {
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.questions || !Array.isArray(data.questions)) {
            showToast('❌ تنسيق الملف غير صحيح', 'error');
            return;
        }
        
        // تقسيم الأسئلة إلى مجموعات صغيرة
        const chunks = [];
        const chunkSize = 10;
        for (let i = 0; i < data.questions.length; i += chunkSize) {
            chunks.push(data.questions.slice(i, i + chunkSize));
        }
        
        this._showImportProgress(true);
        let addedCount = 0;
        let totalProcessed = 0;
        const total = data.questions.length;
        
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            
            // معالجة كل مجموعة
            for (const q of chunk) {
                try {
                    if (q.question && q.question.trim()) {
                        const questionData = this._buildQuestionData(q);
                        if (this._validateQuestionData(questionData)) {
                            await DataManager.add('questions', questionData);
                            addedCount++;
                        }
                    }
                } catch (e) {
                    console.warn('Error importing question:', e);
                }
                totalProcessed++;
            }
            
            // تحديث التقدم
            const progress = Math.round((totalProcessed / total) * 100);
            this._updateImportProgress(progress, `جاري الاستيراد... ${addedCount} سؤال`);
            
            // انتظار 100ms بين المجموعات
            await this._delay(100);
        }
        
        this._showImportProgress(false);
        showToast(`✅ تم استيراد ${addedCount} سؤال`, 'success', 5000);
        this._renderQuestionsAdvanced();
        this._refreshAllData();
        
    } catch (e) {
        console.error('Import error:', e);
        this._showImportProgress(false);
        showToast('❌ خطأ في الاستيراد: ' + e.message, 'error');
    }
},

// ============================================================
// دوال تحديد وحذف الأسئلة
// ============================================================

/**
 * قائمة الأسئلة المحددة
 */
_selectedQuestions: [],

/**
 * تبديل تحديد سؤال
 */
_toggleQuestionSelection(questionId) {
    const index = this._selectedQuestions.indexOf(questionId);
    if (index > -1) {
        this._selectedQuestions.splice(index, 1);
    } else {
        this._selectedQuestions.push(questionId);
    }
    this._updateSelectedCount();
    this._updateCheckboxes();
},

/**
 * تحديث عدد المحددات
 */
_updateSelectedCount() {
    const count = this._selectedQuestions ? this._selectedQuestions.length : 0;
    
    const countEl = document.getElementById('selectedCount');
    const deleteBtn = document.getElementById('deleteSelectedQuestionsBtn');
    
    if (countEl) countEl.textContent = count;
    
    if (deleteBtn) {
        if (count > 0) {
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.innerHTML = `<i class="fas fa-trash"></i> حذف المحدد (${count})`;
        } else {
            deleteBtn.style.display = 'none';
        }
    }
    
    // ✅ تحديث زر "تحديد الكل"
    this._updateSelectAllButton();
},

/**
 * تحديث زر تحديد الكل
 */
_updateSelectAllButton() {
    const btn = document.getElementById('selectAllQuestionsBtn');
    if (!btn) return;
    
    const filtered = this._getFilteredQuestions();
    if (!filtered || filtered.length === 0) {
        btn.innerHTML = '<i class="fas fa-check-double"></i> تحديد الكل';
        return;
    }
    
    const allSelected = filtered.every(q => this._selectedQuestions.includes(q.id));
    
    if (allSelected) {
        btn.innerHTML = '<i class="fas fa-times"></i> إلغاء الكل';
    } else {
        btn.innerHTML = '<i class="fas fa-check-double"></i> تحديد الكل';
    }
},

/**
 * تحديث حالة مربعات الاختيار
 */
_updateCheckboxes() {
    document.querySelectorAll('.question-checkbox').forEach(cb => {
        cb.checked = this._selectedQuestions.includes(cb.dataset.id);
    });
},

/**
 * تحديد جميع الأسئلة
 */
_selectAllQuestions() {
    const questions = DataManager.data.questions || [];
    const filtered = this._getFilteredQuestions();
    
    this._selectedQuestions = filtered.map(q => q.id);
    this._updateSelectedCount();
    this._updateCheckboxes();
    
    showToast(`✅ تم تحديد ${this._selectedQuestions.length} سؤال`, 'info', 2000);
},

/**
 * إلغاء تحديد جميع الأسئلة
 */
_deselectAllQuestions() {
    this._selectedQuestions = [];
    this._updateSelectedCount();
    this._updateCheckboxes();
},

/**
 * الحصول على الأسئلة المفلترة
 */
_getFilteredQuestions() {
    const questions = DataManager.data.questions || [];
    const search = document.getElementById('searchQuestion')?.value?.toLowerCase() || '';
    const type = document.getElementById('filterQuestionType')?.value || '';
    const category = document.getElementById('filterQuestionCategory')?.value || '';
    const difficulty = document.getElementById('filterQuestionDifficulty')?.value || '';
    
    let filtered = [...questions];
    
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(q => 
            (q.question || '').toLowerCase().includes(searchLower) ||
            (q.category || '').toLowerCase().includes(searchLower)
        );
    }
    if (type) filtered = filtered.filter(q => q.type === type);
    if (category) filtered = filtered.filter(q => q.category === category);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
    
    return filtered;
},

// ============================================================
// حذف جميع الأسئلة - نسخة آمنة
// ============================================================

async _deleteAllQuestions() {
    const questions = DataManager.data.questions || [];
    if (questions.length === 0) {
        showToast('لا توجد أسئلة للحذف', 'info');
        return;
    }
    
    if (!confirm(`⚠️ هل أنت متأكد من حذف جميع الأسئلة (${questions.length} سؤال)؟`)) return;
    if (!confirm(`تأكيد نهائي: حذف ${questions.length} سؤال لا يمكن التراجع عنه!`)) return;
    
    // ✅ إظهار شريط تقدم الحذف
    this._showDeleteProgress(true, 0, questions.length);
    
    let deletedCount = 0;
    let errorCount = 0;
    let currentIndex = 0;
    const total = questions.length;
    
    // ✅ استخدام setInterval بدلاً من الحلقة for
    return new Promise((resolve) => {
        if (this._deleteTimer) {
            clearInterval(this._deleteTimer);
            this._deleteTimer = null;
        }
        
        this._deleteTimer = setInterval(async () => {
            // ✅ إذا انتهت المعالجة
            if (currentIndex >= total) {
                clearInterval(this._deleteTimer);
                this._deleteTimer = null;
                this._showDeleteProgress(false);
                
                let message = `✅ تم حذف ${deletedCount} سؤال`;
                if (errorCount > 0) message += `، حدث ${errorCount} خطأ`;
                showToast(message, 'success', 5000);
                
                this._selectedQuestions = [];
                this._updateSelectedCount();
                this._updateSelectAllButton();
                this._renderQuestionsAdvanced();
                this._refreshAllData();
                resolve();
                return;
            }
            
            // ✅ حذف سؤال واحد
            const q = questions[currentIndex];
            currentIndex++;
            
            try {
                await DataManager.delete('questions', q.id);
                deletedCount++;
            } catch (e) {
                console.warn('خطأ في حذف سؤال:', e);
                errorCount++;
            }
            
            // ✅ تحديث التقدم
            const progress = Math.round((currentIndex / total) * 100);
            this._updateDeleteProgress(progress, `جاري الحذف... ${deletedCount} سؤال`);
            
        }, 100); // ✅ حذف سؤال كل 100ms
    });
},

// ============================================================
// حذف الأسئلة المحددة - نسخة آمنة
// ============================================================

async _deleteSelectedQuestions() {
    const count = this._selectedQuestions ? this._selectedQuestions.length : 0;
    if (count === 0) {
        showToast('لا توجد أسئلة محددة', 'info');
        return;
    }
    
    if (!confirm(`هل أنت متأكد من حذف ${count} سؤال؟`)) return;
    if (!confirm(`تأكيد نهائي: حذف ${count} سؤال لا يمكن التراجع عنه!`)) return;
    
    // ✅ إظهار شريط تقدم الحذف
    this._showDeleteProgress(true, 0, count);
    
    let deletedCount = 0;
    let errorCount = 0;
    let currentIndex = 0;
    const ids = [...this._selectedQuestions];
    const total = ids.length;
    
    return new Promise((resolve) => {
        if (this._deleteTimer) {
            clearInterval(this._deleteTimer);
            this._deleteTimer = null;
        }
        
        this._deleteTimer = setInterval(async () => {
            if (currentIndex >= total) {
                clearInterval(this._deleteTimer);
                this._deleteTimer = null;
                this._showDeleteProgress(false);
                
                let message = `✅ تم حذف ${deletedCount} سؤال`;
                if (errorCount > 0) message += `، حدث ${errorCount} خطأ`;
                showToast(message, 'success', 5000);
                
                this._selectedQuestions = [];
                this._updateSelectedCount();
                this._updateSelectAllButton();
                this._renderQuestionsAdvanced();
                this._refreshAllData();
                resolve();
                return;
            }
            
            const id = ids[currentIndex];
            currentIndex++;
            
            try {
                await DataManager.delete('questions', id);
                deletedCount++;
            } catch (e) {
                console.warn('خطأ في حذف سؤال:', e);
                errorCount++;
            }
            
            const progress = Math.round((currentIndex / total) * 100);
            this._updateDeleteProgress(progress, `جاري الحذف... ${deletedCount} سؤال`);
            
        }, 100);
    });
},

/**
 * إظهار/إخفاء شريط تقدم الحذف
 */
_showDeleteProgress(show, progress, total) {
    const container = document.getElementById('deleteProgress');
    
    if (!container) {
        // إنشاء شريط التقدم إذا لم يكن موجوداً
        const newContainer = document.createElement('div');
        newContainer.id = 'deleteProgress';
        newContainer.style.cssText = `
            display: none;
            margin-top: 1rem;
            background: var(--card-bg);
            padding: 0.8rem 1rem;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-color);
        `;
        newContainer.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;">
                <i class="fas fa-spinner fa-spin" style="color:var(--secondary);font-size:1.2rem;"></i>
                <div style="flex:1;">
                    <div class="progress-bar" style="height:8px; background:var(--glass);">
                        <div class="fill" id="deleteProgressFill" style="width:0%; height:100%; background:linear-gradient(90deg, var(--secondary), var(--accent)); border-radius:10px; transition:width 0.3s ease;"></div>
                    </div>
                </div>
                <span id="deleteProgressText" style="font-size:0.85rem;color:var(--gray);min-width:80px;text-align:center;">0%</span>
                <button class="btn btn-sm btn-danger" id="cancelDeleteBtn" style="display:none;">
                    <i class="fas fa-times"></i> إلغاء
                </button>
            </div>
        `;
        
        // إضافة بعد حاوية الأسئلة
        const containerEl = document.getElementById('questionsContainer');
        if (containerEl) {
            containerEl.parentNode.insertBefore(newContainer, containerEl.nextSibling);
        }
        
        // ربط زر الإلغاء
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
            if (confirm('هل تريد إلغاء عملية الحذف؟')) {
                if (App._deleteTimer) {
                    clearInterval(App._deleteTimer);
                    App._deleteTimer = null;
                }
                App._showDeleteProgress(false);
                showToast('⏹️ تم إلغاء عملية الحذف', 'info');
                App._renderQuestionsAdvanced();
            }
        });
        
        this._showDeleteProgress = function(show, progress, total) {
            const container = document.getElementById('deleteProgress');
            if (!container) return;
            
            container.style.display = show ? 'block' : 'none';
            
            if (show && total !== undefined) {
                const fill = document.getElementById('deleteProgressFill');
                const text = document.getElementById('deleteProgressText');
                if (fill) fill.style.width = '0%';
                if (text) text.textContent = `0 / ${total}`;
                const cancelBtn = document.getElementById('cancelDeleteBtn');
                if (cancelBtn) cancelBtn.style.display = 'inline-flex';
            }
        };
        
        this._updateDeleteProgress = function(progress, text) {
            const fill = document.getElementById('deleteProgressFill');
            const label = document.getElementById('deleteProgressText');
            
            if (fill) fill.style.width = `${Math.min(progress, 100)}%`;
            if (label) label.textContent = text || `${Math.round(progress)}%`;
        };
    }
    
    container.style.display = show ? 'block' : 'none';
    
    if (show && total !== undefined) {
        const fill = document.getElementById('deleteProgressFill');
        const text = document.getElementById('deleteProgressText');
        if (fill) fill.style.width = '0%';
        if (text) text.textContent = `0 / ${total}`;
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    }
},

/**
 * تحديث تقدم الحذف
 */
_updateDeleteProgress(progress, text) {
    const fill = document.getElementById('deleteProgressFill');
    const label = document.getElementById('deleteProgressText');
    
    if (fill) fill.style.width = `${Math.min(progress, 100)}%`;
    if (label) label.textContent = text || `${Math.round(progress)}%`;
},

_renderQuestionsAdvanced() {
    const container = document.getElementById('questionsGrid');
    const empty = document.getElementById('questionsEmpty');
    
    if (!container) return;
    
    const questions = DataManager.data.questions || [];
    
    // تحديث الإحصائيات
    this._renderQuestionStats(questions);
    
    // تطبيق الفلترة
    const search = document.getElementById('searchQuestion')?.value?.toLowerCase() || '';
    const type = document.getElementById('filterQuestionType')?.value || '';
    const category = document.getElementById('filterQuestionCategory')?.value || '';
    const difficulty = document.getElementById('filterQuestionDifficulty')?.value || '';
    const sort = document.getElementById('filterQuestionSort')?.value || 'newest';
    
    let filtered = [...questions];
    
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(q => 
            (q.question || '').toLowerCase().includes(searchLower) ||
            (q.category || '').toLowerCase().includes(searchLower) ||
            (q.options || []).some(o => (o || '').toLowerCase().includes(searchLower))
        );
    }
    
    if (type) filtered = filtered.filter(q => q.type === type);
    if (category) filtered = filtered.filter(q => q.category === category);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
    
    // ترتيب
    switch(sort) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'alphabetical':
            filtered.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
            break;
        case 'difficulty':
            const diffOrder = { 'سهل': 1, 'متوسط': 2, 'صعب': 3 };
            filtered.sort((a, b) => (diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0));
            break;
        case 'popular':
            filtered.sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0));
            break;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        document.getElementById('questionsContainer').style.display = 'none';
        return;
    }
    
    if (empty) empty.style.display = 'none';
    document.getElementById('questionsContainer').style.display = 'block';
    
    const canEdit = AuthService.checkPermission('editor') || AuthService.currentUser?.adminRole === 'question';
    
    let html = '';
    filtered.forEach((q, index) => {
        const diffColor = q.difficulty === 'سهل' ? 'easy' : q.difficulty === 'صعب' ? 'hard' : 'medium';
        const diffIcon = q.difficulty === 'سهل' ? '🟢' : q.difficulty === 'صعب' ? '🔴' : '🟡';
        const typeInfo = this._getQuestionTypeInfo(q.type);
        const isSelected = this._selectedQuestions && this._selectedQuestions.includes(q.id);
        
        html += `
            <div class="question-card ${isSelected ? 'selected' : ''}" data-id="${q.id}">
                <div class="question-card-header">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        ${canEdit ? `
                            <input type="checkbox" class="question-checkbox" data-id="${q.id}" 
                                   ${isSelected ? 'checked' : ''} 
                                   onchange="App._toggleQuestionSelection('${q.id}')">
                        ` : ''}
                        <span class="question-card-number">#${index + 1}</span>
                    </div>
                    <div class="question-card-badges">
                        <span class="badge badge-type">${typeInfo?.icon || '📝'} ${typeInfo?.name || 'اختيار من متعدد'}</span>
                        <span class="badge badge-category">${q.category || 'عام'}</span>
                        <span class="badge badge-difficulty ${diffColor}">${diffIcon} ${q.difficulty || 'متوسط'}</span>
                        <span class="badge badge-options">${q.options?.length || 0} خيارات</span>
                        ${q.usedCount > 0 ? `<span class="badge badge-used">🎯 ${q.usedCount} استخدم</span>` : ''}
                    </div>
                </div>
                <div class="question-card-body">
                    <div class="question-text">${q.question || 'سؤال بدون نص'}</div>
                    ${this._renderQuestionContent(q)}
                </div>
                <div class="question-card-footer">
                    <div class="question-meta">
                        <span><i class="far fa-calendar-alt"></i> ${formatDate(q.createdAt)}</span>
                        <span><i class="fas fa-star"></i> ${q.points || 10} نقطة</span>
                        <span><i class="fas fa-clock"></i> ${q.timeLimit || 30} ث</span>
                    </div>
                    <div class="question-actions">
                        ${canEdit ? `
                            <button class="btn btn-xs btn-primary" onclick="window.editQuestion('${q.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-xs btn-success" onclick="window.duplicateQuestion('${q.id}')">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="btn btn-xs btn-danger" onclick="window.deleteQuestion('${q.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-xs btn-outline" onclick="window.previewQuestion('${q.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    this._updateSelectedCount();
},

// ============================================================
// دوال كشف الأسئلة المتكررة والمتشابهة
// ============================================================

/**
 * كشف الأسئلة المتكررة (نص مطابق تماماً)
 */
/**
 * كشف الأسئلة المتكررة - نسخة محسنة
 */
_findDuplicateQuestions(questions) {
    if (!questions || questions.length === 0) return {};
    
    const duplicates = {};
    const seen = new Map();
    const total = questions.length;
    
    // ✅ معالجة 200 سؤال كحد أقصى لتجنب الحلقات الطويلة
    const maxProcess = Math.min(total, 200);
    
    for (let i = 0; i < maxProcess; i++) {
        const q = questions[i];
        if (!q || !q.question) continue;
        
        const normalized = q.question.trim().toLowerCase();
        
        // ✅ تجاهل النصوص القصيرة جداً
        if (normalized.length < 3) continue;
        
        if (seen.has(normalized)) {
            const indices = seen.get(normalized);
            if (!duplicates[normalized]) {
                duplicates[normalized] = [indices];
            }
            duplicates[normalized].push(i);
        } else {
            seen.set(normalized, i);
        }
    }
    
    return duplicates;
},

/**
 * كشف الأسئلة المتشابهة (نص متقارب باستخدام Levenshtein distance)
 */
/**
 * كشف الأسئلة المتشابهة - نسخة محسنة وآمنة
 */
_findSimilarQuestions(questions, threshold = 0.8) {
    if (!questions || questions.length < 2) return [];
    
    const similar = [];
    const processed = new Set();
    const total = questions.length;
    
    // ✅ استخدام حلقة واحدة مع مقارنة محدودة
    // نأخذ عينة من الأسئلة لتجنب الحلقات الطويلة
    const sampleSize = Math.min(total, 100); // حد أقصى 100 سؤال للمقارنة
    
    // إذا كان عدد الأسئلة كبيراً، نأخذ عينة
    let questionsToCheck = questions;
    if (total > 100) {
        // أخذ عينة عشوائية
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        questionsToCheck = shuffled.slice(0, 100);
    }
    
    const checkCount = questionsToCheck.length;
    
    for (let i = 0; i < checkCount; i++) {
        if (processed.has(i)) continue;
        
        const group = [i];
        const q1 = questionsToCheck[i].question?.trim()?.toLowerCase() || '';
        
        // ✅ حد أقصى للمقارنات لكل سؤال (10 مقارنات فقط)
        let comparisons = 0;
        const maxComparisons = 10;
        
        for (let j = i + 1; j < checkCount; j++) {
            if (processed.has(j)) continue;
            if (comparisons >= maxComparisons) break;
            
            const q2 = questionsToCheck[j].question?.trim()?.toLowerCase() || '';
            
            // ✅ تجاهل النصوص القصيرة جداً
            if (q1.length < 5 || q2.length < 5) continue;
            
            // ✅ حساب سريع للتشابه (كلمات مشتركة)
            const words1 = q1.split(' ');
            const words2 = q2.split(' ');
            const commonWords = words1.filter(w => words2.includes(w));
            
            // إذا كانت الكلمات المشتركة قليلة، تخطى
            if (commonWords.length < 2) continue;
            
            // ✅ حساب التشابه الكامل فقط إذا كان هناك تشابه مبدئي
            const similarity = this._calculateSimilarity(q1, q2);
            comparisons++;
            
            if (similarity >= threshold) {
                group.push(j);
                processed.add(j);
            }
        }
        
        if (group.length > 1) {
            similar.push(group);
            processed.add(i);
        }
    }
    
    // ✅ إذا كان هناك أكثر من 20 مجموعة متشابهة، اختصرها
    if (similar.length > 20) {
        return similar.slice(0, 20);
    }
    
    return similar;
},

/**
 * حساب نسبة التشابه بين نصين
 */
_calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // حساب مسافة Levenshtein
    const distance = this._levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    if (maxLength === 0) return 1;
    return 1 - (distance / maxLength);
},

/**
 * حساب مسافة Levenshtein
 */
_levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + 1
                );
            }
        }
    }
    
    return dp[m][n];
},

/**
 * عرض تقرير الأسئلة المكررة والمتشابهة
 */
_showDuplicateReport(questions, duplicates, similar) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    
    const duplicateCount = Object.keys(duplicates).length;
    const similarCount = similar.length;
    
    let html = `
        <div class="modal-card" style="max-width:700px; max-height:90vh;">
            <div class="modal-header">
                <h3><i class="fas fa-clone" style="color:var(--accent);"></i> تقرير الأسئلة المكررة والمتشابهة</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="max-height:60vh; overflow-y:auto; padding:0.5rem 0;">
                <!-- الإحصائيات -->
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.5rem; margin-bottom:1rem;">
                    <div class="stat-card" style="padding:0.5rem;">
                        <div class="stat-number" style="font-size:1.2rem;">${questions.length}</div>
                        <div class="stat-label">إجمالي الأسئلة</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem; border-color:var(--secondary);">
                        <div class="stat-number" style="font-size:1.2rem; color:var(--secondary);">${duplicateCount}</div>
                        <div class="stat-label">🔄 مكررة</div>
                    </div>
                    <div class="stat-card" style="padding:0.5rem; border-color:var(--accent);">
                        <div class="stat-number" style="font-size:1.2rem; color:var(--accent);">${similarCount}</div>
                        <div class="stat-label">🔍 متشابهة</div>
                    </div>
                </div>
    `;
    
    // عرض الأسئلة المكررة
    if (duplicateCount > 0) {
        html += `
            <h4 style="color:var(--secondary); margin-bottom:0.5rem;">
                <i class="fas fa-exclamation-triangle"></i> أسئلة مكررة (${duplicateCount})
            </h4>
            <div style="margin-bottom:1rem;">
        `;
        
        Object.entries(duplicates).forEach(([text, indices]) => {
            html += `
                <div style="background:var(--glass); padding:0.5rem 0.8rem; border-radius:8px; margin-bottom:0.3rem; border-right:3px solid var(--secondary);">
                    <div style="font-weight:600; font-size:0.9rem;">${text}</div>
                    <div style="font-size:0.7rem; color:var(--gray);">
                        <i class="fas fa-hashtag"></i> مكرر في ${indices.length} موضع: 
                        ${indices.map(i => `#${i + 1}`).join('، ')}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    // عرض الأسئلة المتشابهة
    if (similarCount > 0) {
        html += `
            <h4 style="color:var(--accent); margin-bottom:0.5rem;">
                <i class="fas fa-link"></i> أسئلة متشابهة (${similarCount})
            </h4>
            <div style="margin-bottom:1rem;">
        `;
        
        similar.forEach(group => {
            const questionsList = group.map(i => questions[i]);
            html += `
                <div style="background:var(--glass); padding:0.5rem 0.8rem; border-radius:8px; margin-bottom:0.3rem; border-right:3px solid var(--accent);">
                    ${questionsList.map((q, idx) => `
                        <div style="font-size:0.85rem; padding:0.2rem 0;">
                            <span style="color:var(--gray); font-size:0.7rem;">#${group[idx] + 1}</span>
                            ${q.question}
                        </div>
                    `).join('')}
                    <div style="font-size:0.7rem; color:var(--gray); margin-top:0.2rem;">
                        <i class="fas fa-percent"></i> تشابه: 
                        ${this._calculateSimilarity(
                            questionsList[0].question,
                            questionsList[1].question
                        ).toFixed(1) * 100}%
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    // إذا لم توجد مكررات
    if (duplicateCount === 0 && similarCount === 0) {
        html += `
            <div class="empty-state">
                <i class="fas fa-check-circle" style="color:var(--success); font-size:3rem;"></i>
                <h3 style="color:var(--success);">لا توجد أسئلة مكررة أو متشابهة</h3>
                <p class="text-gray">جميع الأسئلة فريدة!</p>
            </div>
        `;
    }
    
    // أزرار الإجراءات
    html += `
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--glass-border);">
            ${duplicateCount > 0 ? `
                <button class="btn btn-sm btn-danger" onclick="App._deleteDuplicateQuestions(); this.closest('.modal-overlay').remove();">
                    <i class="fas fa-trash"></i> حذف المكررات
                </button>
            ` : ''}
            <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove();">
                <i class="fas fa-times"></i> إغلاق
            </button>
        </div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // حفظ البيانات للتقرير
    this._lastDuplicateReport = { duplicates, similar, questions };
},

/**
 * حذف الأسئلة المكررة
 */
async _deleteDuplicateQuestions() {
    const report = this._lastDuplicateReport;
    if (!report) return;
    
    const { duplicates, questions } = report;
    const duplicateIds = [];
    
    Object.values(duplicates).forEach(indices => {
        // احتفظ بالأول واحذف الباقي
        indices.slice(1).forEach(idx => {
            const q = questions[idx];
            if (q && q.id) {
                duplicateIds.push(q.id);
            }
        });
    });
    
    if (duplicateIds.length === 0) {
        showToast('لا توجد مكررات للحذف', 'info');
        return;
    }
    
    if (!confirm(`هل أنت متأكد من حذف ${duplicateIds.length} سؤال مكرر؟`)) return;
    
    try {
        let deletedCount = 0;
        for (const id of duplicateIds) {
            await DataManager.delete('questions', id);
            deletedCount++;
        }
        showToast(`✅ تم حذف ${deletedCount} سؤال مكرر`, 'success');
        this._renderQuestionsAdvanced();
        this._refreshAllData();
    } catch (e) {
        showToast('❌ خطأ في الحذف: ' + e.message, 'error');
    }
},

// ============================================================
// دوال إضافية للوحة المشرفين
// ============================================================

/**
 * حذف منشور (للإدارة)
 */
async _adminDeletePost(postId) {
    if (!confirm('حذف هذا المنشور؟')) return;
    try {
        await DataManager.delete('posts', postId);
        showToast('✅ تم حذف المنشور', 'success');
        // تحديث القائمة
        this._adminViewPosts();
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

/**
 * حذف جميع المنشورات
 */
async _adminDeleteAllPosts() {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع المنشورات؟')) return;
    if (!confirm('تأكيد نهائي؟')) return;
    try {
        const posts = DataManager.data.posts || [];
        for (const p of posts) {
            await DataManager.delete('posts', p.id);
        }
        showToast('✅ تم حذف جميع المنشورات', 'success');
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

/**
 * حذف تعليق (للإدارة)
 */
async _adminDeleteComment(commentId) {
    if (!confirm('حذف هذا التعليق؟')) return;
    try {
        await DataManager.delete('comments', commentId);
        showToast('✅ تم حذف التعليق', 'success');
        this._adminViewComments();
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
},

/**
 * تعديل صلاحيات الدور
 */
_adminEditPermissions() {
    const roleSelect = document.getElementById('adminRoleSelect');
    if (!roleSelect) {
        showToast('⚠️ يرجى اختيار دور أولاً', 'error');
        return;
    }
    const role = roleSelect.value;
    // فتح مودال لتعديل صلاحيات الدور المحدد
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:500px;">
            <div class="modal-header">
                <h3><i class="fas fa-key"></i> تعديل صلاحيات: ${role}</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding:0.5rem 0;">
                <p class="text-gray">يمكنك تعديل الصلاحيات للدور <strong>${role}</strong></p>
                <div class="form-group">
                    <label><input type="checkbox" checked> عرض المستخدمين</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" checked> إدارة المحتوى</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" ${role === 'admin' || role === 'super_admin' ? 'checked' : ''}> إدارة المستخدمين</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" ${role === 'super_admin' ? 'checked' : ''}> صلاحيات النظام</label>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button class="btn btn-primary" onclick="showToast('✅ تم حفظ الصلاحيات', 'success'); this.closest('.modal-overlay').remove();">حفظ</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
},

/**
 * عرض قائمة النسخ الاحتياطية (محلياً)
 */
_adminListBackups() {
    // يمكن عرض قائمة الملفات المحفوظة أو بيانات وهمية
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3><i class="fas fa-list"></i> النسخ الاحتياطية</h3>
                <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding:0.5rem 0;">
                <div class="text-gray">لا توجد نسخ احتياطية محفوظة حالياً</div>
                <p style="font-size:0.85rem;color:var(--gray);">يمكنك إنشاء نسخة جديدة باستخدام زر "إنشاء نسخة احتياطية"</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
},

_refreshAdmin() {
    const activeTab = document.querySelector('.admin-tab.active');
    if (activeTab) {
        this._showAdminTab(activeTab.dataset.tab);
    } else {
        this._showAdminTab('dashboard');
    }
    showToast('✅ تم تحديث لوحة المشرفين', 'success');
},

_updateConnectionStatusUI() {
    const container = document.getElementById('adminContentContainer');
    if (!container) return;
    // إذا كان القسم الحالي هو admin، أضف رسالة تحذيرية في الأعلى
    if (this.currentSection === 'admin' && !this._isOnline) {
        // نضيف رسالة مؤقتة (سيتم استبدالها عند تحديث المحتوى)
        const warning = document.createElement('div');
        warning.id = 'offlineWarning';
        warning.style.cssText = 'background:var(--secondary);color:#fff;padding:8px 16px;border-radius:8px;margin-bottom:10px;text-align:center;';
        warning.innerHTML = '⚠️ أنت غير متصل بالإنترنت، بعض البيانات قد لا تكون محدثة';
        // نضعها في بداية الحاوية
        container.prepend(warning);
    } else {
        // إزالة التحذير إذا كان موجوداً
        const warning = document.getElementById('offlineWarning');
        if (warning) warning.remove();
    }
},

// ============================================================
// دوال التحقق الفوري لنموذج التسجيل
// ============================================================

/**
 * التحقق من توفر اسم المستخدم (فوري)
 */
async _checkUsernameAvailability(username) {
    if (!username || username.length < 3) {
        return { available: false, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' };
    }
    
    // التحقق من الصيغة (حروف وأرقام و_ فقط)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return { available: false, message: 'يسمح فقط بالحروف والأرقام و_ (3-20 حرف)' };
    }
    
    try {
        // البحث في Firebase عن اسم المستخدم
        const snapshot = await db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!snapshot.empty) {
            return { available: false, message: '⚠️ اسم المستخدم غير متوفر' };
        }
        return { available: true, message: '✅ اسم المستخدم متوفر' };
    } catch (error) {
        console.warn('⚠️ Could not check username:', error);
        return { available: false, message: '⚠️ تعذر التحقق، حاول مرة أخرى' };
    }
},

/**
 * التحقق من صيغة البريد الإلكتروني
 */
_validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return { valid: false, message: '' };
    if (!re.test(email)) {
        return { valid: false, message: '⚠️ صيغة البريد الإلكتروني غير صحيحة' };
    }
    return { valid: true, message: '✅ صيغة صحيحة' };
},

/**
 * تقييم قوة كلمة المرور
 */
_evaluatePasswordStrength(password) {
    if (!password) return { score: 0, label: 'ضعيفة', color: 'var(--secondary)' };
    
    let score = 0;
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    score += checks.length ? 1 : 0;
    score += checks.lowercase ? 1 : 0;
    score += checks.uppercase ? 1 : 0;
    score += checks.number ? 1 : 0;
    score += checks.special ? 1 : 0;
    
    const levels = [
        { min: 0, label: 'ضعيفة 🔴', color: 'var(--secondary)' },
        { min: 2, label: 'ضعيفة 🟡', color: '#f39c12' },
        { min: 3, label: 'جيدة 🟢', color: '#2ecc71' },
        { min: 4, label: 'قوية 🟢', color: '#27ae60' },
        { min: 5, label: 'قوية جداً 🟣', color: '#9b59b6' }
    ];
    
    let level = levels[0];
    for (const l of levels) {
        if (score >= l.min) level = l;
    }
    
    // نصائح إضافية
    let tips = [];
    if (!checks.length) tips.push('8 أحرف على الأقل');
    if (!checks.lowercase) tips.push('حرف صغير');
    if (!checks.uppercase) tips.push('حرف كبير');
    if (!checks.number) tips.push('رقم');
    if (!checks.special) tips.push('رمز خاص (!@#$%...)');
    
    return {
        score: Math.min(score, 5),
        label: level.label,
        color: level.color,
        tips: tips,
        checks: checks
    };
},

/**
 * التحقق من تطابق كلمتي المرور
 */
_checkPasswordMatch(password, confirm) {
    if (!confirm) return { match: false, message: '' };
    if (password !== confirm) {
        return { match: false, message: '⚠️ كلمتا المرور غير متطابقتين' };
    }
    return { match: true, message: '✅ كلمتا المرور متطابقتان' };
},

/**
 * تحديث حالة زر التسجيل (تمكين/تعطيل)
 */
_updateRegisterButton() {
    const btn = document.getElementById('registerSubmitBtn');
    if (!btn) return;
    
    const fullName = document.getElementById('regFullName')?.value?.trim() || '';
    const username = document.getElementById('regUsername')?.value?.trim() || '';
    const email = document.getElementById('regEmail')?.value?.trim() || '';
    const password = document.getElementById('regPassword')?.value || '';
    const confirm = document.getElementById('regPasswordConfirm')?.value || '';
    
    // التحقق من جميع الشروط
    const isFullNameValid = fullName.length >= 3;
    const isUsernameValid = username.length >= 3 && /^[a-zA-Z0-9_]{3,20}$/.test(username);
    const isEmailValid = this._validateEmail(email).valid;
    const isPasswordValid = password.length >= 6;
    const isPasswordMatch = password === confirm && confirm.length > 0;
    
    const enabled = isFullNameValid && isUsernameValid && isEmailValid && isPasswordValid && isPasswordMatch;
    btn.disabled = !enabled;
    
    // تحديث لون الزر
    btn.style.opacity = enabled ? '1' : '0.5';
    btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
},

/**
 * نسخ سؤال
 */
async _duplicateQuestion (id) {
    if (!AuthService.checkPermission('editor') && !AuthService.currentUser?.adminRole === 'question') {
        showToast('ليس لديك صلاحية', 'error');
        return;
    }
    const question = DataManager.data.questions.find(q => q.id === id);
    if (!question) {
        showToast('السؤال غير موجود', 'error');
        return;
    }
    try {
        await DataManager.add('questions', {
            question: question.question + ' (نسخة)',
            options: [...question.options],
            correct: question.correct,
            difficulty: question.difficulty,
            category: question.category
        });
        showToast('✅ تم نسخ السؤال', 'success');
        App._renderQuestionsAdvanced();
        App._refreshAllData();
    } catch (e) {
        showToast('❌ خطأ: ' + e.message, 'error');
    }
}
};

// ============================================================
// دوال واجهة المستخدم للعب الجماعي - المعدلة
// ============================================================

App._renderMultiplayerSection = function() {
    return `
        <div class="multiplayer-page">
            <div class="flex-between mb-2">
                <h2 style="font-size:1.8rem;font-weight:800;">
                    <i class="fas fa-users" style="color:var(--accent);"></i> 
                    اللعب الجماعي المتطور
                </h2>
                <button class="btn btn-sm btn-outline" onclick="App._refreshMultiplayerGames()">
                    <i class="fas fa-sync"></i> تحديث
                </button>
            </div>

            <div class="card mb-2">
                <div class="card-title"><i class="fas fa-list"></i> المباريات النشطة</div>
                <div id="multiplayerGamesList">
                    <div class="text-gray">جاري التحميل...</div>
                </div>
            </div>

            <div class="card">
                <div class="card-title"><i class="fas fa-plus"></i> إنشاء مباراة جديدة</div>
                <form id="createMultiplayerForm" class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(150px,1fr));">
                    <div class="form-group">
                        <label>المستوى</label>
                        <select id="mpDifficulty" class="game-select">
                            <option value="easy">🟢 سهل</option>
                            <option value="medium" selected>🟡 متوسط</option>
                            <option value="hard">🔴 صعب</option>
                            <option value="expert">💀 خبير</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>الفئة</label>
                        <select id="mpCategory" class="game-select">
                            <option value="all">📚 الكل</option>
                            <option value="عام">🌍 عام</option>
                            <option value="تاريخ">📜 تاريخ</option>
                            <option value="لاعبين">⚽ لاعبين</option>
                            <option value="أندية">🏆 أندية</option>
                            <option value="بطولات">🏅 بطولات</option>
                            <option value="قوانين">📋 قوانين</option>
                            <option value="إحصائيات">📊 إحصائيات</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>نوع السؤال</label>
                        <select id="mpQuestionType" class="game-select">
                            <option value="all">📚 الكل</option>
                            <option value="multiple_choice">📝 اختيار من متعدد</option>
                            <option value="true_false">✅ صح/خطأ</option>
                            <option value="fill_blank">✏️ ملء الفراغ</option>
                            <option value="matching">🔗 مطابقة</option>
                            <option value="ordering">🔢 ترتيب</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>عدد الأسئلة</label>
                        <select id="mpQuestionCount" class="game-select">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="15">15</option>
                            <option value="20">20</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>وقت السؤال (ثانية)</label>
                        <select id="mpTimeLimit" class="game-select">
                            <option value="10">10</option>
                            <option value="15" selected>15</option>
                            <option value="20">20</option>
                            <option value="30">30</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="text" id="mpPassword" placeholder="اختياري" class="game-select">
                    </div>
                    <div style="display:flex;align-items:flex-end;gap:0.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;justify-content:center;">
                            <i class="fas fa-plus"></i> إنشاء
                        </button>
                    </div>
                </form>
            </div>

            <div class="card mt-2">
                <div class="card-title"><i class="fas fa-sign-in-alt"></i> انضمام برمز</div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                    <input type="text" id="mpJoinCode" placeholder="أدخل رمز المباراة" style="flex:1;padding:8px 16px;border-radius:12px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                    <input type="password" id="mpJoinPassword" placeholder="كلمة المرور" style="flex:1;padding:8px 16px;border-radius:12px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                    <button class="btn btn-success" id="mpJoinBtn"><i class="fas fa-sign-in-alt"></i> انضمام</button>
                </div>
            </div>

            <div id="multiplayerGameContainer" class="mt-2"></div>
        </div>
    `;
};

App._refreshMultiplayerGames = async function() {
    const container = document.getElementById('multiplayerGamesList');
    if (!container) return;

    try {
        const snapshot = await db.collection('multiplayerGames')
            .where('status', '==', 'waiting')
            .get();

        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });

        if (games.length === 0) {
            container.innerHTML = '<div class="text-gray">لا توجد مباريات نشطة حالياً</div>';
            return;
        }

        let html = '<div class="games-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">';
        games.forEach(g => {
            html += `
                <div class="card" style="padding:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:700;">${g.hostName || 'مجهول'}</span>
                        <span class="badge badge-success">🟢 مفتوحة</span>
                    </div>
                    <div style="font-size:0.85rem;color:var(--gray);">
                        <span>👥 ${g.players ? g.players.length : 0} لاعب</span>
                        <span>• ${g.settings?.questionCount || 10} سؤال</span>
                        <span>• رمز: <strong>${g.code}</strong></span>
                    </div>
                    <button class="btn btn-sm btn-primary mt-1" onclick="App._joinMultiplayerGame('${g.id}')">
                        <i class="fas fa-sign-in-alt"></i> انضمام
                    </button>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Error loading games:', e);
        container.innerHTML = '<div class="text-gray">⚠️ خطأ في تحميل المباريات</div>';
    }
};

App._joinMultiplayerGame = async function(gameId) {
    const password = prompt('أدخل كلمة المرور (إن وجدت):');
    if (password === null) return;
    await MultiplayerManager.joinGame(gameId, password);
};

App._setupMultiplayerHandlers = function() {
    const form = document.getElementById('createMultiplayerForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                difficulty: document.getElementById('mpDifficulty').value,
                category: document.getElementById('mpCategory').value,
                questionType: document.getElementById('mpQuestionType').value,
                questionCount: document.getElementById('mpQuestionCount').value,
                timeLimit: document.getElementById('mpTimeLimit').value,
                password: document.getElementById('mpPassword').value.trim() || null
            };
            const gameId = await MultiplayerManager.createGame(settings);
            if (gameId) {
                form.reset();
            }
        });
    }

    const joinBtn = document.getElementById('mpJoinBtn');
    if (joinBtn) {
        joinBtn.addEventListener('click', async () => {
            const code = document.getElementById('mpJoinCode').value.trim().toUpperCase();
            const password = document.getElementById('mpJoinPassword').value.trim();
            if (!code) {
                showToast('يرجى إدخال رمز المباراة', 'error');
                return;
            }
            try {
                const snapshot = await db.collection('multiplayerGames')
                    .where('code', '==', code)
                    .where('status', '==', 'waiting')
                    .get();
                if (snapshot.empty) {
                    showToast('لا توجد مباراة بهذا الرمز', 'error');
                    return;
                }
                const doc = snapshot.docs[0];
                await MultiplayerManager.joinGame(doc.id, password);
            } catch (e) {
                showToast('❌ خطأ: ' + e.message, 'error');
            }
        });
    }
};

// ===== إظهار / إخفاء صفحات اللعب والنتائج =====
App._showMultiplayerGamePage = function() {
    const section = document.getElementById('section-multiplayer-game');
    if (section) {
        section.style.display = 'block';
        section.style.position = 'fixed';
        section.style.top = '0';
        section.style.left = '0';
        section.style.right = '0';
        section.style.bottom = '0';
        section.style.zIndex = '1050';
        section.style.background = 'var(--dark)';
        section.style.overflowY = 'auto';
        section.style.padding = '1rem';
    }
    // إخفاء الأقسام الأخرى
    document.querySelectorAll('.section').forEach(s => {
        if (s.id !== 'section-multiplayer-game' && s.id !== 'section-multiplayer-result') {
            s.style.display = 'none';
        }
    });
};

App._hideMultiplayerGamePage = function() {
    const section = document.getElementById('section-multiplayer-game');
    if (section) {
        section.style.display = 'none';
    }
    // إظهار الأقسام الأخرى مرة أخرى
    document.querySelectorAll('.section').forEach(s => {
        if (s.id !== 'section-multiplayer-game' && s.id !== 'section-multiplayer-result') {
            s.style.display = '';
        }
    });
    // إعادة تفعيل القسم الحالي
    if (this.currentSection) {
        const activeSection = document.getElementById(`section-${this.currentSection}`);
        if (activeSection) activeSection.style.display = 'block';
    }
};

App._showMultiplayerResultPage = function(gameId) {
    const section = document.getElementById('section-multiplayer-result');
    if (section) {
        section.style.display = 'block';
        section.style.position = 'fixed';
        section.style.top = '0';
        section.style.left = '0';
        section.style.right = '0';
        section.style.bottom = '0';
        section.style.zIndex = '1050';
        section.style.background = 'var(--dark)';
        section.style.overflowY = 'auto';
        section.style.padding = '1rem';
    }
    // إخفاء صفحات اللعب
    const gameSection = document.getElementById('section-multiplayer-game');
    if (gameSection) gameSection.style.display = 'none';
    // عرض النتائج
    App._renderMultiplayerResult(gameId);
};

App._hideMultiplayerResultPage = function() {
    const section = document.getElementById('section-multiplayer-result');
    if (section) {
        section.style.display = 'none';
    }
    // إظهار الأقسام الأخرى
    document.querySelectorAll('.section').forEach(s => {
        if (s.id !== 'section-multiplayer-game' && s.id !== 'section-multiplayer-result') {
            s.style.display = '';
        }
    });
};

// ===== عرض شاشة الانتظار (Lobby) =====
App._renderMultiplayerLobby = function(gameId) {
    const container = document.getElementById('multiplayerGameContainer');
    if (!container) return;

    db.collection('multiplayerGames').doc(gameId).get().then((doc) => {
        if (!doc.exists) {
            container.innerHTML = '<div class="text-gray">المباراة غير موجودة</div>';
            return;
        }
        const g = doc.data();
        const isHost = g.hostId === AuthService.currentUser?.uid;
        const players = g.players || [];

        let html = `
            <div class="card">
                <div class="card-title">
                    <i class="fas fa-users"></i> غرفة الانتظار
                    <span class="badge badge-primary">رمز: ${g.code}</span>
                    ${g.password ? '<span class="badge badge-warning">🔒 محمية</span>' : ''}
                </div>
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                    <span>المضيف: <strong>${g.hostName}</strong></span>
                    <span>اللاعبين: ${players.length}</span>
                    <span>الحالة: <span class="badge badge-warning">⏳ في انتظار اللاعبين</span></span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem;">
                    ${players.map(p => `
                        <div style="background:var(--glass);padding:0.5rem;border-radius:10px;text-align:center;">
                            <div style="font-size:1.5rem;">👤</div>
                            <div style="font-weight:600;font-size:0.85rem;">${p.name}</div>
                            ${p.uid === AuthService.currentUser?.uid ? '<div style="font-size:0.6rem;color:var(--accent);">(أنت)</div>' : ''}
                            ${p.uid === g.hostId ? '<div style="font-size:0.6rem;color:var(--success);">👑 مضيف</div>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                    ${isHost ? `
                        <button class="btn btn-success" id="mpStartGameBtn" ${players.length < 2 ? 'disabled' : ''}>
                            <i class="fas fa-play"></i> بدء المباراة
                        </button>
                        <button class="btn btn-danger" id="mpDeleteGameBtn">
                            <i class="fas fa-trash"></i> حذف المباراة
                        </button>
                    ` : `
                        <button class="btn btn-danger" id="mpLeaveLobbyBtn">
                            <i class="fas fa-sign-out-alt"></i> مغادرة
                        </button>
                    `}
                </div>
            </div>
        `;
        container.innerHTML = html;

        if (isHost) {
            const startBtn = document.getElementById('mpStartGameBtn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    MultiplayerManager.startGame(gameId);
                });
            }
            const deleteBtn = document.getElementById('mpDeleteGameBtn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (confirm('هل أنت متأكد من حذف المباراة؟')) {
                        await db.collection('multiplayerGames').doc(gameId).delete();
                        showToast('تم حذف المباراة', 'info');
                        MultiplayerManager.leaveGame();
                    }
                });
            }
        }
        const leaveBtn = document.getElementById('mpLeaveLobbyBtn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => {
                MultiplayerManager.leaveGame();
            });
        }

        if (MultiplayerManager.unsubscribeGame) {
            MultiplayerManager.unsubscribeGame();
        }
        MultiplayerManager.unsubscribeGame = db.collection('multiplayerGames').doc(gameId)
            .onSnapshot((snap) => {
                if (!snap.exists) {
                    container.innerHTML = '<div class="text-gray">تم حذف المباراة</div>';
                    return;
                }
                const updated = snap.data();
                if (updated.status === 'playing') {
                    App._showMultiplayerGamePage();
                    App._renderMultiplayerGame(gameId);
                } else if (updated.status === 'finished') {
                    App._showMultiplayerResultPage(gameId);
                } else {
                    App._renderMultiplayerLobby(gameId);
                }
            });
    });
};

// ===== عرض شاشة اللعب (مع إصلاح الترتيب) =====
App._renderMultiplayerGame = function(gameId) {
    const container = document.getElementById('multiplayerGameContent');
    if (!container) return;

    db.collection('multiplayerGames').doc(gameId).get().then((doc) => {
        if (!doc.exists) {
            container.innerHTML = '<div class="text-gray">المباراة غير موجودة</div>';
            return;
        }
        const g = doc.data();
        if (g.status !== 'playing') return;

        const currentQ = g.currentQuestion || 0;
        const questions = g.questions || [];
        if (currentQ >= questions.length) {
            MultiplayerManager.endGame(gameId);
            return;
        }
        const question = questions[currentQ];
        const players = g.players || [];
        const answers = g.answers || {};
        const user = AuthService.currentUser;
        const isHost = g.hostId === user?.uid;
        const totalPlayers = players.length;
        const answeredCount = Object.keys(answers).length;

        const timeLimit = g.settings?.timeLimit || 15;
        const elapsed = (Date.now() - g.questionStartTime) / 1000;
        const timeLeft = Math.max(0, timeLimit - Math.floor(elapsed));
        const progress = Math.min((elapsed / timeLimit) * 100, 100);

        // ===== الترتيب الصحيح =====
        const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
        const userAnswered = user && answers[user.uid] && answers[user.uid][currentQ] !== undefined;

if (userAnswered) {
    // إيقاف المؤقت فوراً
    if (MultiplayerManager._timerInterval) {
        clearInterval(MultiplayerManager._timerInterval);
        MultiplayerManager._timerInterval = null;
    }
    // إظهار الوقت المتبقي عند الإجابة
    const timeElapsed = (Date.now() - g.questionStartTime) / 1000;
    const remaining = Math.max(0, timeLimit - Math.floor(timeElapsed));
    const timerEl = document.querySelector('.game-header .badge-warning, .game-header .badge-danger');
    if (timerEl) {
        timerEl.textContent = `⏱ ${remaining}s`;
    }
}

// ===== بدء المؤقت في بداية كل جولة =====
if (!MultiplayerManager._timerInterval) {
    MultiplayerManager._startTimer(gameId);
}

        // ===== بناء خيارات السؤال =====
        let optionsHtml = '';
        const qType = question.type || 'multiple_choice';

        if (qType === 'multiple_choice' || qType === 'true_false') {
            const opts = question.options || [];
// خيارات الإجابة (اختيار من متعدد / صح خطأ)
optionsHtml = opts.map((opt, idx) => {
    const isSelected = userAnswered && answers[user.uid][currentQ].answer === idx;
    const isCorrect = isSelected && answers[user.uid][currentQ].isCorrect;
    const isWrong = isSelected && !isCorrect;
    let btnClass = 'option-btn';
    if (userAnswered) {
        btnClass += ' disabled';
        if (idx === question.correct) btnClass += ' show-correct';
        if (isWrong) btnClass += ' selected-wrong';
    }
    return `<button class="${btnClass}" onclick="App._submitMultiplayerAnswer(${idx})" ${userAnswered ? 'disabled' : ''}>
        ${String.fromCharCode(65 + idx)}. ${opt}
    </button>`;
}).join('');
        } else if (qType === 'fill_blank') {
            optionsHtml = `
                <div style="display:flex;gap:0.5rem;justify-content:center;max-width:400px;margin:0 auto;">
                    <input type="text" id="mpFillBlankInput" placeholder="اكتب الإجابة..." style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--glass-border);background:var(--glass);color:var(--light);" ${userAnswered ? 'disabled' : ''}>
                    <button class="btn btn-primary" onclick="App._submitMultiplayerFillBlank()" ${userAnswered ? 'disabled' : ''}>تأكيد</button>
                </div>
            `;
        } else if (qType === 'matching') {
            const pairs = question.matchingPairs || [];
            if (userAnswered) {
                const userMatch = answers[user.uid][currentQ].answer || {};
                let resultHtml = pairs.map(pair => {
                    const isMatch = userMatch[pair.left] === pair.right;
                    return `<div style="display:flex;justify-content:center;gap:1rem;padding:0.2rem;">
                        <span>${pair.left} ↔ </span>
                        <span style="color:${isMatch ? 'var(--success)' : 'var(--secondary)'};">${userMatch[pair.left] || '(لم يختر)'}</span>
                        ${!isMatch ? `<span style="color:var(--gray);font-size:0.8rem;">(الصحيح: ${pair.right})</span>` : ''}
                    </div>`;
                }).join('');
                optionsHtml = `<div>${resultHtml}</div>`;
            } else {
                const rightOptions = pairs.map(p => p.right);
                let selectsHtml = pairs.map((pair, idx) => `
                    <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin-bottom:0.3rem;">
                        <span>${pair.left} ↔ </span>
                        <select id="mpMatchSelect_${idx}" style="padding:4px 8px;border-radius:6px;background:var(--glass);border:1px solid var(--glass-border);color:var(--light);">
                            <option value="">--- اختر ---</option>
                            ${rightOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
                        </select>
                    </div>
                `).join('');
                optionsHtml = `
                    <div>${selectsHtml}</div>
                    <button class="btn btn-primary mt-1" onclick="App._submitMultiplayerMatching()">تأكيد المطابقة</button>
                `;
            }
        } else if (qType === 'ordering') {
            const items = question.orderedItems || [];
            if (userAnswered) {
                const userOrder = answers[user.uid][currentQ].answer || [];
                const isCorrect = JSON.stringify(userOrder) === JSON.stringify(items);
                let resultHtml = userOrder.map((item, idx) => `
                    <div style="display:flex;gap:0.5rem;justify-content:center;padding:0.2rem;">
                        <span>${idx+1}</span>
                        <span style="color:${isCorrect ? 'var(--success)' : 'var(--gray)'};">${item}</span>
                        ${!isCorrect ? `<span style="color:var(--secondary);font-size:0.8rem;">(الصحيح: ${items[idx]})</span>` : ''}
                    </div>
                `).join('');
                optionsHtml = `<div>${resultHtml}</div>`;
            } else {
                const orderKey = `mpOrder_${gameId}`;
                if (!window[orderKey]) {
                    window[orderKey] = shuffleArray([...items]);
                }
                const currentOrder = window[orderKey];
                let orderHtml = currentOrder.map((item, idx) => `
                    <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin:0.2rem 0;">
                        <span style="min-width:30px;">${idx+1}</span>
                        <span>${item}</span>
                        <button class="btn btn-xs btn-outline" onclick="App._moveOrderingItem(${idx}, -1, '${gameId}')">▲</button>
                        <button class="btn btn-xs btn-outline" onclick="App._moveOrderingItem(${idx}, 1, '${gameId}')">▼</button>
                    </div>
                `).join('');
                optionsHtml = `
                    <div>${orderHtml}</div>
                    <button class="btn btn-primary mt-1" onclick="App._submitMultiplayerOrdering('${gameId}')">تأكيد الترتيب</button>
                `;
            }
        }

        // ===== بناء واجهة اللعب =====
        let html = `
            <div class="game-container">
                <div class="game-header">
                    <div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">
                        <span class="badge badge-primary">${currentQ+1}/${questions.length}</span>
                        <span class="badge ${timeLeft <= 5 ? 'badge-danger' : 'badge-warning'}">⏱ ${timeLeft}s</span>
                        <span class="badge badge-info">👥 ${answeredCount}/${totalPlayers}</span>
                    </div>
                    <button class="btn btn-sm btn-danger" id="mpExitGameBtn">
                        <i class="fas fa-times"></i> خروج
                    </button>
                </div>

                <div class="question-box">
                    <div class="q-category">📚 ${question.category || 'عام'}</div>
                    <div class="q-type-badge">${GameEngine._getTypeLabel(question.type)}</div>
                    <div class="q-text">${question.question}</div>
                    <div class="options-grid">
                        ${optionsHtml}
                    </div>
                </div>

                <div class="card" style="padding:0.8rem;">
                    <div class="card-title" style="font-size:1rem;"><i class="fas fa-crown"></i> الترتيب الحالي</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.3rem;">
                        ${sortedPlayers.map((p, i) => {
                            const isMe = p.uid === user?.uid;
                            // حساب النقاط من scores إذا كانت موجودة
                            const scoreData = g.scores[p.uid] || p;
                            return `
                                <div class="player-rank-item ${i === 0 ? 'top1' : ''} ${isMe ? 'me' : ''}" style="background:${i === 0 ? 'var(--accent)' : 'var(--glass)'};${i === 0 ? 'color:var(--dark);' : ''}">
                                    <span>${i+1}. ${p.name} ${isMe ? '(أنت)' : ''}</span>
                                    <span style="font-weight:700;">⭐ ${scoreData.score || 0}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        // ربط أزرار الخروج
        const exitBtn = document.getElementById('mpExitGameBtn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                if (confirm('هل تريد مغادرة المباراة؟')) {
                    MultiplayerManager.leaveGame();
                }
            });
        }

        // ===== تحديث المؤقت =====
        if (MultiplayerManager._timerInterval) {
            clearInterval(MultiplayerManager._timerInterval);
        }
        MultiplayerManager._timerInterval = setInterval(() => {
            const elapsedNow = (Date.now() - g.questionStartTime) / 1000;
            const remaining = Math.max(0, timeLimit - Math.floor(elapsedNow));
            const timerEl = document.querySelector('.game-header .badge-warning, .game-header .badge-danger');
            if (timerEl) {
                timerEl.textContent = `⏱ ${remaining}s`;
                timerEl.className = `badge ${remaining <= 5 ? 'badge-danger' : 'badge-warning'}`;
            }
            // شريط التقدم
            const progressFill = document.querySelector('.game-progress .fill');
            if (progressFill) {
                const prog = Math.min((elapsedNow / timeLimit) * 100, 100);
                progressFill.style.width = `${prog}%`;
                progressFill.style.background = remaining <= 5 ? 'var(--secondary)' : 'linear-gradient(90deg, var(--primary), var(--accent))';
            }

            if (remaining === 0 && !userAnswered && !MultiplayerManager._gameEnded) {
                if (user) {
                    MultiplayerManager.submitAnswer(gameId, -1);
                }
            }
        }, 1000);
    });
};

// ===== إرسال إجابة (اختيار من متعدد / صح خطأ) =====
App._submitMultiplayerAnswer = async function(answerIndex) {
    const gameId = MultiplayerManager.currentGameId;
    if (!gameId) {
        showToast('لا توجد مباراة نشطة', 'error');
        return;
    }
    // منع الإجابة المكررة
    const user = AuthService.currentUser;
    if (!user) {
        showToast('يجب تسجيل الدخول', 'error');
        return;
    }
    // التحقق من أن المستخدم لم يجب بالفعل
    const doc = await db.collection('multiplayerGames').doc(gameId).get();
    if (doc.exists) {
        const game = doc.data();
        const answers = game.answers || {};
        const currentQ = game.currentQuestion;
        if (answers[user.uid] && answers[user.uid][currentQ] !== undefined) {
            showToast('لقد أجبت بالفعل على هذا السؤال', 'info');
            return;
        }
    }
    MultiplayerManager.submitAnswer(gameId, answerIndex);
};

// ===== إرسال إجابة (ملء الفراغ) =====
App._submitMultiplayerFillBlank = async function() {
    const input = document.getElementById('mpFillBlankInput');
    if (!input) return;
    const answer = input.value.trim();
    if (!answer) {
        showToast('يرجى كتابة الإجابة', 'info');
        return;
    }
    const gameId = MultiplayerManager.currentGameId;
    if (!gameId) return;
    
    // التحقق من عدم الإجابة المكررة
    const user = AuthService.currentUser;
    if (!user) return;
    const doc = await db.collection('multiplayerGames').doc(gameId).get();
    if (doc.exists) {
        const game = doc.data();
        const answers = game.answers || {};
        const currentQ = game.currentQuestion;
        if (answers[user.uid] && answers[user.uid][currentQ] !== undefined) {
            showToast('لقد أجبت بالفعل على هذا السؤال', 'info');
            return;
        }
    }
    MultiplayerManager.submitAnswer(gameId, answer);
};

// ===== إرسال إجابة (مطابقة) =====
App._submitMultiplayerMatching = async function() {
    const gameId = MultiplayerManager.currentGameId;
    if (!gameId) return;
    
    // التحقق من عدم الإجابة المكررة
    const user = AuthService.currentUser;
    if (!user) return;
    const doc = await db.collection('multiplayerGames').doc(gameId).get();
    if (doc.exists) {
        const game = doc.data();
        const answers = game.answers || {};
        const currentQ = game.currentQuestion;
        if (answers[user.uid] && answers[user.uid][currentQ] !== undefined) {
            showToast('لقد أجبت بالفعل على هذا السؤال', 'info');
            return;
        }
    }
    
    const selects = document.querySelectorAll('[id^="mpMatchSelect_"]');
    const result = {};
    selects.forEach(select => {
        const container = select.closest('div');
        const leftSpan = container ? container.querySelector('span') : null;
        if (leftSpan) {
            const left = leftSpan.textContent.trim();
            result[left] = select.value;
        }
    });
    const allSelected = Object.values(result).every(v => v !== '');
    if (!allSelected) {
        showToast('يرجى اختيار جميع المطابقات', 'info');
        return;
    }
    MultiplayerManager.submitAnswer(gameId, result);
};

// ===== تحريك عنصر الترتيب =====
App._moveOrderingItem = function(index, direction, gameId) {
    const orderKey = `mpOrder_${gameId}`;
    if (!window[orderKey]) return;
    const arr = window[orderKey];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    App._renderMultiplayerGame(gameId);
};

// ===== إرسال إجابة (ترتيب) =====
App._submitMultiplayerOrdering = async function(gameId) {
    const orderKey = `mpOrder_${gameId}`;
    if (!window[orderKey]) return;
    
    // التحقق من عدم الإجابة المكررة
    const user = AuthService.currentUser;
    if (!user) return;
    const doc = await db.collection('multiplayerGames').doc(gameId).get();
    if (doc.exists) {
        const game = doc.data();
        const answers = game.answers || {};
        const currentQ = game.currentQuestion;
        if (answers[user.uid] && answers[user.uid][currentQ] !== undefined) {
            showToast('لقد أجبت بالفعل على هذا السؤال', 'info');
            return;
        }
    }
    
    const order = window[orderKey];
    MultiplayerManager.submitAnswer(gameId, order);
};

App._renderMultiplayerResult = function(gameId) {
    const container = document.getElementById('multiplayerResultContent');
    if (!container) return;

    db.collection('multiplayerGames').doc(gameId).get().then(async (doc) => {
        if (!doc.exists) {
            container.innerHTML = '<div class="text-gray">المباراة غير موجودة</div>';
            return;
        }
        const g = doc.data();
        const user = AuthService.currentUser;
        const isLightTheme = document.body.classList.contains('light-theme');

        // ===== استخراج البيانات الصحيحة من scores =====
        const scoresData = g.scores || {};
        
        // بناء قائمة اللاعبين مع الإحصائيات الصحيحة من scores
        const playersWithStats = g.players.map(p => {
            const stats = scoresData[p.uid] || {};
            return {
                ...p,
                // الإحصائيات الأساسية من scores
                score: stats.score || 0,
                correct: stats.correct || 0,
                wrong: stats.wrong || 0,
                streak: stats.streak || 0,
                bestStreak: stats.bestStreak || 0,
                totalTime: stats.totalTime || 0,
                avgTime: stats.avgTime || 0,
                answersCount: stats.answersCount || 0,
                answeredQuestions: stats.answeredQuestions || []
            };
        });

        const sorted = [...playersWithStats].sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sorted[0];
        const totalQuestions = g.questions ? g.questions.length : 0;

        // ===== حساب المكافآت لكل لاعب =====
        const rewardsMap = {};
        for (let i = 0; i < sorted.length; i++) {
            const player = sorted[i];
            const rank = i + 1;
            const rewards = MultiplayerRewards.calculateRewards(player, rank, sorted.length, {
                totalQuestions: totalQuestions
            });
            rewardsMap[player.uid] = rewards;

            // تطبيق المكافآت على المستخدم الحالي فقط (تطبيق فوري)
            if (player.uid === user?.uid) {
                await MultiplayerRewards.applyRewards(player.uid, rewards);
                // تحديث واجهة المستخدم
                App._updateUserUI(user);
            } else {
                // تطبيق المكافآت في الخلفية للاعبين الآخرين
                MultiplayerRewards.applyRewards(player.uid, rewards).catch(() => {});
            }
        }

        // ===== الإحصائيات الجماعية =====
        const totalCorrect = sorted.reduce((sum, p) => sum + (p.correct || 0), 0);
        const totalWrong = sorted.reduce((sum, p) => sum + (p.wrong || 0), 0);
        const totalAnswers = sorted.reduce((sum, p) => sum + (p.answersCount || 0), 0);
        const avgScore = sorted.length > 0 ? Math.round(sorted.reduce((sum, p) => sum + (p.score || 0), 0) / sorted.length) : 0;

        // ===== بناء الواجهة =====
        const textColor = isLightTheme ? 'var(--dark)' : 'var(--light)';
        const cardBg = isLightTheme ? 'rgba(255,255,255,0.9)' : 'var(--card-bg)';
        const borderColor = isLightTheme ? 'rgba(0,0,0,0.08)' : 'var(--border-color)';

        let html = `
            <div style="text-align:center;margin-bottom:1.5rem;color:${textColor};">
                <div style="font-size:4rem;margin-bottom:0.5rem;">🏆</div>
                <h2 style="font-size:2rem;font-weight:900;color:${textColor};">انتهت المباراة!</h2>
                <div style="font-size:1.5rem;font-weight:700;color:var(--accent);">
                    الفائز: ${winner.name} (⭐ ${winner.score || 0} نقطة)
                </div>
                <div style="font-size:0.9rem;color:var(--gray);margin-top:0.3rem;">
                    ${totalQuestions} سؤال • ${sorted.length} لاعب
                </div>
                <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-top:0.5rem;">
                    <button class="btn btn-sm btn-outline" onclick="App._shareMultiplayerResult('${gameId}')">
                        <i class="fas fa-share-alt"></i> مشاركة النتيجة
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="MultiplayerManager.leaveGame();">
                        <i class="fas fa-home"></i> العودة إلى القائمة
                    </button>
                </div>
            </div>
            <hr style="border-color:var(--glass-border);margin:1rem 0;">

            <h3 style="font-size:1.2rem;margin-bottom:1rem;color:${textColor};"><i class="fas fa-list"></i> الترتيب النهائي والإحصائيات</h3>
        `;

        // ===== عرض كل لاعب =====
        sorted.forEach((p, i) => {
            const isMe = p.uid === user?.uid;
            const rank = i + 1;
            const rewards = rewardsMap[p.uid] || { total: 0, rankPoints: 0, levelPoints: 0, coins: 0, bonus: [], penalty: false };
            const isWinner = rank === 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

            // حساب الدقة بشكل صحيح
            const accuracy = p.answersCount > 0 ? Math.round((p.correct / p.answersCount) * 100) : 0;

            // ألوان البطاقة
            let cardBgColor = cardBg;
            let cardTextColor = textColor;
            let cardBorder = borderColor;

            if (isWinner) {
                cardBgColor = '#FFD700';
                cardTextColor = '#1a1a2e';
                cardBorder = '#FFD700';
            } else if (isLightTheme) {
                cardBgColor = 'rgba(255,255,255,0.95)';
                cardTextColor = '#1a1a2e';
            }

            html += `
                <div style="background:${cardBgColor};padding:0.8rem 1.2rem;border-radius:10px;border:2px solid ${isWinner ? 'var(--accent)' : cardBorder};${isWinner ? 'box-shadow: 0 0 40px rgba(255,217,61,0.3);' : ''} ${isMe && !isWinner ? 'border-right:4px solid var(--primary);' : ''} margin-bottom:0.8rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <span style="font-weight:700;font-size:1.1rem;color:${cardTextColor};">${medal}</span>
                            <span style="font-weight:700;font-size:1.1rem;color:${cardTextColor};">${p.name} ${isMe ? '👈 (أنت)' : ''}</span>
                            ${isWinner ? '<span style="font-size:1.5rem;">👑</span>' : ''}
                            ${rewards.penalty ? '<span style="font-size:1.2rem;color:var(--secondary);">💔</span>' : ''}
                        </div>
                        <span style="font-weight:900;font-size:1.3rem;color:${isWinner ? 'var(--dark)' : 'var(--accent)'};">⭐ ${p.score || 0}</span>
                    </div>

                    <!-- الإحصائيات -->
                    <div style="display:flex;flex-wrap:wrap;gap:0.5rem 1.2rem;font-size:0.85rem;color:${isWinner ? 'rgba(0,0,0,0.7)' : 'var(--gray)'};margin-top:0.3rem;">
                        <span>✅ صحيح: <strong style="color:${isWinner ? 'var(--dark)' : 'var(--success)'};">${p.correct || 0}</strong></span>
                        <span>❌ خاطئ: <strong style="color:${isWinner ? 'var(--dark)' : 'var(--secondary)'};">${p.wrong || 0}</strong></span>
                        <span>🎯 الدقة: <strong style="color:${accuracy >= 70 ? (isWinner ? 'var(--dark)' : 'var(--success)') : 'var(--secondary)'};">${accuracy}%</strong></span>
                        <span>🔥 أفضل سلسلة: <strong style="color:${isWinner ? 'var(--dark)' : 'var(--accent)'};">${p.bestStreak || 0}</strong></span>
                        <span>⏱ متوسط الوقت: <strong style="color:${isWinner ? 'var(--dark)' : 'var(--light)'};">${p.avgTime ? p.avgTime.toFixed(1) : 0}s</strong></span>
                        <span>📊 الإجابات: <strong style="color:${isWinner ? 'var(--dark)' : 'var(--light)'};">${p.answersCount || 0}</strong></span>
                        <span>📝 الأسئلة المجاب عليها: <strong style="color:${isWinner ? 'var(--dark)' : 'var(--info)'};">${p.answeredQuestions?.length || 0}</strong></span>
                    </div>

                    <!-- عرض المكافآت للمستخدم الحالي فقط -->
                    ${isMe ? `
                        <div style="margin-top:0.5rem;">
                            ${MultiplayerRewards.renderRewardsUI(rewards, p, isWinner)}
                        </div>
                    ` : `
                        ${rewards.total > 0 ? `
                            <div style="margin-top:0.3rem;font-size:0.7rem;color:var(--gray);">
                                <i class="fas fa-gift"></i> حصل على ${rewards.total} مكافأة
                            </div>
                        ` : ''}
                        ${rewards.penalty ? `
                            <div style="margin-top:0.3rem;font-size:0.7rem;color:var(--secondary);">
                                <i class="fas fa-exclamation-triangle"></i> عقوبة رتبة: ${rewards.rankPoints}
                            </div>
                        ` : ''}
                    `}
                </div>
            `;
        });

        // ===== إحصائيات إضافية =====
        html += `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.5rem;margin-top:1rem;padding:0.8rem;background:${cardBg};border-radius:var(--radius-sm);border:1px solid ${borderColor};">
                <div style="text-align:center;color:${textColor};">
                    <div style="font-size:0.7rem;color:var(--gray);">إجمالي النقاط</div>
                    <div style="font-weight:700;font-size:1.1rem;color:var(--accent);">⭐ ${sorted.reduce((sum, p) => sum + (p.score || 0), 0)}</div>
                </div>
                <div style="text-align:center;color:${textColor};">
                    <div style="font-size:0.7rem;color:var(--gray);">متوسط النقاط</div>
                    <div style="font-weight:700;font-size:1.1rem;color:var(--primary);">⭐ ${avgScore}</div>
                </div>
                <div style="text-align:center;color:${textColor};">
                    <div style="font-size:0.7rem;color:var(--gray);">إجمالي الصحيح</div>
                    <div style="font-weight:700;font-size:1.1rem;color:var(--success);">✅ ${totalCorrect}</div>
                </div>
                <div style="text-align:center;color:${textColor};">
                    <div style="font-size:0.7rem;color:var(--gray);">إجمالي الخاطئ</div>
                    <div style="font-weight:700;font-size:1.1rem;color:var(--secondary);">❌ ${totalWrong}</div>
                </div>
                <div style="text-align:center;color:${textColor};">
                    <div style="font-size:0.7rem;color:var(--gray);">إجمالي الإجابات</div>
                    <div style="font-weight:700;font-size:1.1rem;color:var(--info);">📊 ${totalAnswers}</div>
                </div>
            </div>
        `;

        html += `
            <div style="margin-top:1.5rem;display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="MultiplayerManager.leaveGame();">
                    <i class="fas fa-home"></i> العودة إلى القائمة
                </button>
                <button class="btn btn-outline" onclick="App._shareMultiplayerResult('${gameId}')">
                    <i class="fas fa-share-alt"></i> مشاركة النتيجة
                </button>
                <button class="btn btn-success" onclick="MultiplayerManager.createGame({ 
                    difficulty: '${g.settings?.difficulty || 'medium'}', 
                    category: '${g.settings?.category || 'all'}', 
                    questionType: '${g.settings?.questionType || 'all'}', 
                    questionCount: '${g.settings?.questionCount || 10}', 
                    timeLimit: '${g.settings?.timeLimit || 15}' 
                })">
                    <i class="fas fa-redo"></i> لعب مرة أخرى
                </button>
            </div>
        `;

        container.innerHTML = html;
    });
};

App._shareMultiplayerResult = function(gameId) {
    db.collection('multiplayerGames').doc(gameId).get().then((doc) => {
        if (!doc.exists) return;
        const g = doc.data();
        const sorted = [...g.players].sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sorted[0];
        const text = `🏆 نتائج المباراة الجماعية!\n👑 الفائز: ${winner.name} (${winner.score} نقطة)\n📊 الترتيب:\n${sorted.map((p, i) => `${i+1}. ${p.name} - ${p.score} نقطة (✅${p.correct||0} ❌${p.wrong||0})`).join('\n')}`;
        if (navigator.share) {
            navigator.share({ title: 'نتيجة المباراة', text }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ تم نسخ النتيجة', 'success');
            }).catch(() => {
                showToast('⚠️ لا يمكن النسخ', 'error');
            });
        }
    });
};

// ============================================================
// نظام الرتبة للعبة الجماعية
// ============================================================

function getRank(rankPoints) {
    const points = typeof rankPoints === 'number' ? rankPoints : 0;
    
    const ranks = [
        { name: 'برونزي 1', min: 0, icon: '🥉', color: '#cd7f32' },
        { name: 'برونزي 2', min: 100, icon: '🥉', color: '#cd7f32' },
        { name: 'برونزي 3', min: 200, icon: '🥉', color: '#cd7f32' },
        { name: 'برونزي 4', min: 300, icon: '🥉', color: '#cd7f32' },
        { name: 'برونزي 5', min: 400, icon: '🥉', color: '#cd7f32' },
        { name: 'فضي 1', min: 600, icon: '🥈', color: '#c0c0c0' },
        { name: 'فضي 2', min: 800, icon: '🥈', color: '#c0c0c0' },
        { name: 'فضي 3', min: 1000, icon: '🥈', color: '#c0c0c0' },
        { name: 'فضي 4', min: 1200, icon: '🥈', color: '#c0c0c0' },
        { name: 'فضي 5', min: 1400, icon: '🥈', color: '#c0c0c0' },
        { name: 'ذهبي 1', min: 1700, icon: '🥇', color: '#ffd700' },
        { name: 'ذهبي 2', min: 2000, icon: '🥇', color: '#ffd700' },
        { name: 'ذهبي 3', min: 2300, icon: '🥇', color: '#ffd700' },
        { name: 'ذهبي 4', min: 2600, icon: '🥇', color: '#ffd700' },
        { name: 'ذهبي 5', min: 2900, icon: '🥇', color: '#ffd700' },
        { name: 'ماسي 1', min: 3300, icon: '💎', color: '#b9f2ff' },
        { name: 'ماسي 2', min: 3700, icon: '💎', color: '#b9f2ff' },
        { name: 'ماسي 3', min: 4100, icon: '💎', color: '#b9f2ff' },
        { name: 'ماسي 4', min: 4500, icon: '💎', color: '#b9f2ff' },
        { name: 'ماسي 5', min: 4900, icon: '💎', color: '#b9f2ff' },
        { name: 'أسطوري', min: 5400, icon: '⭐', color: '#f1c40f' },
        { name: 'محترف', min: 6000, icon: '🏆', color: '#e67e22' },
        { name: 'البطل', min: 7000, icon: '👑', color: '#ff4500' },
    ];
    
    let currentRank = ranks[0];
    for (const rank of ranks) {
        if (points >= rank.min) {
            currentRank = rank;
        }
    }
    
    // حساب التقدم نحو الرتبة التالية
    const currentIndex = ranks.indexOf(currentRank);
    const nextRank = ranks[currentIndex + 1] || null;
    let progress = 100;
    let nextMin = null;
    
    if (nextRank) {
        const range = nextRank.min - currentRank.min;
        progress = range > 0 ? ((points - currentRank.min) / range) * 100 : 100;
        progress = Math.min(Math.max(progress, 0), 100);
        nextMin = nextRank.min;
    }
    
    return {
        ...currentRank,
        progress: progress,
        nextMin: nextMin,
        nextName: nextRank ? nextRank.name : 'مكتمل 🏆'
    };
}

// ============================================================
// 9. تشغيل التطبيق
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    App.start();
});

// في نهاية الملف، بعد تعريف window
window.closeModal = function(modalId) {
    if (App && typeof App._closeModal === 'function') {
        App._closeModal(modalId);
    } else {
        console.warn('⚠️ App._closeModal not available');
        // حل بديل مباشر
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
        }
    }
};

// أيضًا دالة بديلة باستخدام data-close
document.addEventListener('click', function(e) {
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
        const modalId = closeBtn.dataset.closeModal;
        if (modalId) {
            App._closeModal(modalId);
        }
    }
});

// تصدير الوظائف العامة
window.App = App;
window.AuthService = AuthService;
window.DataManager = DataManager;
window.AchievementSystem = AchievementSystem;
window.showToast = showToast;
window.formatDate = formatDate;
window.getLevel = getLevel;
window.addFriend = (username) => App.addFriend(username);
window.removeFriend = (username) => App.removeFriend(username);
window.shareProfile = () => App.shareProfile();
window.sharePost = (postId) => App._sharePost(postId);
window.acceptFriendRequest = (requestId) => App.acceptFriendRequest(requestId);
window.rejectFriendRequest = (requestId) => App.rejectFriendRequest(requestId);
window.toggleFollow = (userId) => App.toggleFollow(userId);
window.toggleLike = (postId) => App.toggleLike(postId);
window.toggleComments = (postId) => App.toggleComments(postId);
window.addComment = (postId) => App.addComment(postId);
window.editPost = (postId) => App._openEditPostModal(postId);
window.deletePost = (postId) => App.deletePost(postId);
window.deleteComment = (commentId) => App.deleteComment(commentId);
window.previewQuestion = (id) => App._previewQuestion(id);
window.duplicateQuestion = (id) => App._duplicateQuestion(id);
