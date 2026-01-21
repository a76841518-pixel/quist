// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA7ob2UGfoF_WwN-Ishexk_JxbuUoAmV7g",
  authDomain: "avargeqq.firebaseapp.com",
  projectId: "avargeqq",
  storageBucket: "avargeqq.firebasestorage.app",
  messagingSenderId: "419865018343",
  appId: "1:419865018343:web:e2cd538c8d1ad402c84742",
  measurementId: "G-SNJF5CZR9G"
};
        // تهيئة Firebase
        let auth, db;
        try {
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            console.log('✅ Firebase تم تهيئته بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تهيئة Firebase:', error);
            // وضع الزوار بدون Firebase
            showNotification('تم تحميل التطبيق في وضع الزوار', 'info');
        }

        // متغيرات التطبيق
        let currentUser = null;
        let userData = {
            semesters: [],
            profile: {},
            cumulativeGPA: 0,
            totalCredits: 0,
            currentMarkType: 1,
            gradeHistory: [],
            userType: 'student',
            college: '',
            major: '',
            courseRatings: {}
        };
        let autoSaveTimeout = null;
        let charts = {};
        let isOfflineMode = false;
        let selectedSemesterIndex = -1;
        let selectedRating = null;
        let allCourses = [];
        let colleges = [];
        let majors = [];
        let assignedCourses = [];

        // كود المشرف
        const ADMIN_CODE = "admin2024";

        // تعريف أنواع العلامات
        const markTypes = {
            1: { 
                name: "نصفي + نهائي", 
                fields: ["نصفي", "نهائي"],
                percentages: [50, 50]
            },
            2: { 
                name: "نصفي + نهائي + نشاط", 
                fields: ["نصفي", "نهائي", "نشاط"],
                percentages: [45, 45, 10]
            },
            3: { 
                name: "نهائي + عملي", 
                fields: ["نهائي", "عملي"],
                percentages: [50, 50]
            },
            4: { 
                name: "نهائي 60% + عملي 40%", 
                fields: ["نهائي", "عملي"],
                percentages: [60, 40]
            },
            5: { 
                name: "نهائي 40% + عملي 60%", 
                fields: ["نهائي", "عملي"],
                percentages: [40, 60]
            },
            6: { 
                name: "نصفي + نهائي + عملي", 
                fields: ["نصفي", "نهائي", "عملي"],
                percentages: [35, 35, 30]
            }
        };

        // تعريف أنواع المواد
        const courseTypes = {
            'required-university': { name: 'إجباري جامعة', class: 'type-required-university' },
            'elective-university': { name: 'اختياري جامعة', class: 'type-elective-university' },
            'required-college': { name: 'إجباري كلية', class: 'type-required-college' },
            'required-major': { name: 'إجباري تخصص', class: 'type-required-major' },
            'elective-major': { name: 'اختياري تخصص', class: 'type-elective-major' }
        };

        // عناصر DOM
        const loadingOverlay = document.getElementById('loadingOverlay');
        const authModal = document.getElementById('authModal');
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mainContentWrapper = document.getElementById('mainContentWrapper');

        // تهيئة التطبيق
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 بدء تحميل التطبيق...');
            
            // إعداد مستمعي الأحداث
            setupEventListeners();
            
            // التحقق من حالة المصادقة
            checkAuthState();
            
            // تهيئة الرسوم البيانية
            initCharts();
        });

        // إعداد مستمعي الأحداث
        function setupEventListeners() {
            console.log('🔧 إعداد مستمعي الأحداث...');
            
            // القائمة الجانبية
            sidebarToggle.addEventListener('click', toggleSidebar);
            
            // عناصر القائمة الجانبية
            document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
                item.addEventListener('click', () => {
                    const tabId = item.getAttribute('data-tab');
                    switchTab(tabId);
                    if (window.innerWidth <= 768) {
                        sidebar.classList.remove('active');
                        mainContentWrapper.classList.remove('sidebar-active');
                    }
                });
            });
            
            // أحداث تسجيل الدخول
            document.getElementById('loginBtn').addEventListener('click', showAuthModal);
            
            // أحداث النماذج
            document.getElementById('loginForm').addEventListener('submit', function(e) {
                e.preventDefault();
                handleLogin();
            });
            
            document.getElementById('registerForm').addEventListener('submit', function(e) {
                e.preventDefault();
                handleRegister();
            });
            
            // تبديل نوع المستخدم في التسجيل
            document.getElementById('userType').addEventListener('change', function() {
                const adminCodeGroup = document.getElementById('adminCodeGroup');
                adminCodeGroup.style.display = this.value === 'admin' ? 'block' : 'none';
            });
            
            // أحداث إدارة الفصول
            document.getElementById('addSemesterBtn').addEventListener('click', addNewSemester);
            document.getElementById('addCourseBtn').addEventListener('click', addCourse);
            
            // أحداث تبويبات إدارة المواد
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.getAttribute('data-tab');
                    switchCourseTab(tab);
                });
            });
            
            // أحداث إعدادات الحساب
            document.getElementById('updateProfileBtn').addEventListener('click', updateProfile);
            document.getElementById('logoutBtn').addEventListener('click', handleLogout);
            document.getElementById('exportDataBtn').addEventListener('click', exportData);
            document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);
            document.getElementById('importDataBtn').addEventListener('click', importData);
            
            // أحداث القائمة الجانبية
            document.getElementById('exportDataSidebar').addEventListener('click', exportData);
            document.getElementById('importDataSidebar').addEventListener('click', importData);
            document.getElementById('logoutSidebar').addEventListener('click', handleLogout);
            
            // أحداث تبويبات المصادقة
            document.querySelectorAll('.auth-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.getAttribute('data-tab');
                    switchAuthTab(tabName);
                });
            });
            
            // أحداث تقييم المواد
            document.addEventListener('click', function(e) {
                if (e.target.closest('.rating-option')) {
                    const option = e.target.closest('.rating-option');
                    document.querySelectorAll('.rating-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    option.classList.add('selected');
                    selectedRating = option.getAttribute('data-rating');
                }
            });
            
            // أحداث البحث
            document.getElementById('courseSearchBtn').addEventListener('click', searchCourses);
            document.getElementById('courseSearchInput').addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    searchCourses();
                }
            });
            
            // أحداث لوحة الإشراف
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-admin-tab');
                    switchAdminTab(tabId);
                });
            });
            
            // أحداث إدارة الكليات والتخصصات
            document.getElementById('addCollegeBtn').addEventListener('click', addCollege);
            document.getElementById('addMajorBtn').addEventListener('click', addMajor);
            document.getElementById('addCourseAdminBtn').addEventListener('click', addCourseAdmin);
            document.getElementById('assignCourseBtn').addEventListener('click', assignCourseToMajors);
            
            // إغلاق نافذة المصادقة بالنقر خارجها
            authModal.addEventListener('click', (e) => {
                if (e.target === authModal) {
                    hideAuthModal();
                }
            });
            
            // استعادة البيانات من التخزين المحلي
            window.addEventListener('beforeunload', function() {
                saveToLocalStorage();
            });
            
            console.log('✅ تم إعداد مستمعي الأحداث');
        }

        // تبديل القائمة الجانبية
        function toggleSidebar() {
            sidebar.classList.toggle('active');
            mainContentWrapper.classList.toggle('sidebar-active');
        }

function switchTab(tabId) {
    console.log('🔄 تبديل التبويب إلى:', tabId);
    
    // إخفاء جميع الأقسام أولاً
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        // إعادة تعيين الأنماط
        section.style.display = 'none';
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
        section.style.position = 'absolute';
    });
    
    // تحديث القائمة الجانبية
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (navItem) navItem.classList.add('active');
    
    // إظهار القسم المطلوب
    const targetSection = document.getElementById(`${tabId}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        targetSection.style.opacity = '1';
        targetSection.style.visibility = 'visible';
        targetSection.style.position = 'relative';
        
        console.log('✅ تم إظهار القسم:', tabId);
    }
    
    // معالجة خاصة لكل تبويب
    switch (tabId) {
        case 'statistics':
            setTimeout(updateCharts, 100);
            break;
            
        case 'courses':
            setTimeout(() => {
                updateAllCoursesView();
                updateCourseForm();
            }, 50);
            break;
            
        case 'gradeCalc':
            setTimeout(() => {
                updateGradeCalcForm();
                updateGradeCalcHistory();
            }, 50);
            break;
            
        case 'search':
            setTimeout(() => {
                loadAllCoursesForSearch();
            }, 50);
            break;
            
        case 'adminPanel':
            if (userData.userType === 'admin') {
                setTimeout(() => {
                    loadAdminData();
                }, 100);
            } else {
                showNotification('ليس لديك صلاحية للوصول إلى لوحة الإشراف', 'warning');
                setTimeout(() => switchTab('dashboard'), 300);
            }
            break;
    }
}
        // تبديل تبويبات إدارة المواد
        function switchCourseTab(tab) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
            document.getElementById(`${tab}Tab`).style.display = 'block';
        }

        // تبديل تبويبات المصادقة
        function switchAuthTab(tabName) {
            document.querySelectorAll('.auth-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.remove('active');
            });
            
            document.querySelector(`.auth-tab[data-tab="${tabName}"]`).classList.add('active');
            document.getElementById(`${tabName}Form`).classList.add('active');
            
            // إخفاء رسائل الخطأ
            document.getElementById('authError').classList.remove('active');
        }

        // تبديل تبويبات لوحة الإشراف
        function switchAdminTab(tabId) {
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            document.querySelector(`.admin-tab[data-admin-tab="${tabId}"]`).classList.add('active');
            document.getElementById(`${tabId}Tab`).style.display = 'block';
        }

        // ============ دوال المصادقة ============
        function checkAuthState() {
            console.log('🔐 التحقق من حالة المصادقة...');
            
            if (!auth) {
                console.log('⚠️ Firebase غير متاح، تحميل وضع الزوار');
                loadFromLocalStorage();
                updateUIForGuest();
                setTimeout(hideLoading, 500);
                return;
            }
            
            auth.onAuthStateChanged(async (user) => {
                console.log('📊 حالة المصادقة:', user ? 'مستخدم مسجل' : 'زائر');
                
                if (user) {
                    currentUser = user;
                    try {
                        await loadUserData();
                        updateUIForLoggedInUser();
                        await loadSystemData();
                        showNotification('مرحباً بعودتك!', 'success');
                    } catch (error) {
                        console.error('❌ خطأ في تحميل بيانات المستخدم:', error);
                        loadFromLocalStorage();
                        updateUIForGuest();
                        showNotification('تم تحميل البيانات المحلية', 'info');
                    }
                } else {
                    currentUser = null;
                    loadFromLocalStorage();
                    updateUIForGuest();
                }
                
                hideLoading();
            }, (error) => {
                console.error('❌ خطأ في مستمع حالة المصادقة:', error);
                loadFromLocalStorage();
                updateUIForGuest();
                hideLoading();
            });
        }


function handleLogin() {
    // تحقق من وجود auth
    if (!auth) {
        showAuthError('خدمة المصادقة غير متاحة حالياً. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
        console.error('❌ auth غير معرف في تسجيل الدخول:', auth);
        return;
    }
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showAuthError('يرجى ملء جميع الحقول');
        return;
    }
    
    // عرض مؤشر التحميل
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';
    loginBtn.disabled = true;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            // إعادة تعيين الزر
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
            
            hideAuthModal();
            showNotification('تم تسجيل الدخول بنجاح!', 'success');
        })
        .catch(error => {
            // إعادة تعيين الزر
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
            
            console.error('❌ خطأ في تسجيل الدخول:', error);
            
            // عرض رسالة خطأ مناسبة
            let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'هذا الحساب تم تعطيله';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'لا يوجد حساب بهذا البريد الإلكتروني';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'كلمة المرور غير صحيحة';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'خطأ في الشبكة. يرجى التحقق من اتصال الإنترنت';
                    break;
                default:
                    errorMessage = error.message || 'حدث خطأ غير معروف';
            }
            
            showAuthError(errorMessage);
        });
}
        function handleRegister() {
            if (!auth) {
                showAuthError('خدمة المصادقة غير متاحة حالياً');
                return;
            }
            
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;
            const userType = document.getElementById('userType').value;
            const adminCode = document.getElementById('adminCode').value;
            
            if (!name || !email || !password || !confirmPassword) {
                showAuthError('يرجى ملء جميع الحقول');
                return;
            }
            
            if (password !== confirmPassword) {
                showAuthError('كلمات المرور غير متطابقة');
                return;
            }
            
            if (password.length < 6) {
                showAuthError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }
            
            if (userType === 'admin' && adminCode !== ADMIN_CODE) {
                showAuthError('كود المشرف غير صحيح');
                return;
            }
            
            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    return user.updateProfile({
                        displayName: name
                    }).then(() => {
                        const userDataToSave = {
                            name: name,
                            email: email,
                            userType: userType,
                            college: '',
                            major: '',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            semesters: [],
                            cumulativeGPA: 0,
                            totalCredits: 0,
                            currentMarkType: 1,
                            gradeHistory: [],
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        
                        return db.collection('users').doc(user.uid).set(userDataToSave);
                    });
                })
                .then(() => {
                    hideAuthModal();
                    showNotification('تم إنشاء الحساب بنجاح!', 'success');
                })
                .catch(error => {
                    console.error('❌ خطأ في إنشاء الحساب:', error);
                    showAuthError(error.message);
                });
        }

        // ============ إدارة البيانات ============
        async function loadUserData() {
            if (!currentUser || !db) {
                throw new Error('لا يوجد اتصال بقاعدة البيانات');
            }
            
            try {
                const userDoc = await db.collection('users').doc(currentUser.uid).get();
                
                if (userDoc.exists) {
                    const data = userDoc.data();
                    userData = {
                        ...data,
                        semesters: data.semesters || [],
                        profile: data.profile || {},
                        cumulativeGPA: data.cumulativeGPA || 0,
                        totalCredits: data.totalCredits || 0,
                        currentMarkType: data.currentMarkType || 1,
                        gradeHistory: data.gradeHistory || [],
                        userType: data.userType || 'student',
                        college: data.college || '',
                        major: data.major || '',
                        courseRatings: data.courseRatings || {}
                    };
                    console.log('✅ بيانات المستخدم محملة من Firebase');
                } else {
                    // إنشاء بيانات افتراضية
                    userData = {
                        name: currentUser.displayName || currentUser.email.split('@')[0] || 'مستخدم',
                        email: currentUser.email,
                        userType: 'student',
                        college: '',
                        major: '',
                        createdAt: new Date(),
                        semesters: [],
                        cumulativeGPA: 0,
                        totalCredits: 0,
                        currentMarkType: 1,
                        gradeHistory: [],
                        courseRatings: {},
                        lastUpdated: new Date()
                    };
                    await saveUserData();
                    console.log('✅ تم إنشاء بيانات جديدة للمستخدم');
                }
                
                updateDashboard();
                renderSemesters();
                updateCharts();
                updateProfileUI();
                updateCourseForm();
                updateGradeCalcForm();
                updateGradeCalcHistory();
                return true;
            } catch (error) {
                console.error('❌ خطأ في تحميل البيانات:', error);
                throw error;
            }
        }

        async function loadSystemData() {
            if (!db) return;
            
            try {
                // تحميل الكليات
                const collegesSnapshot = await db.collection('colleges').get();
                colleges = [];
                collegesSnapshot.forEach(doc => {
                    colleges.push({ id: doc.id, ...doc.data() });
                });
                
                // تحميل التخصصات
                const majorsSnapshot = await db.collection('majors').get();
                majors = [];
                majorsSnapshot.forEach(doc => {
                    majors.push({ id: doc.id, ...doc.data() });
                });
                
                // تحميل المواد
                const coursesSnapshot = await db.collection('courses').get();
                allCourses = [];
                coursesSnapshot.forEach(doc => {
                    allCourses.push({ id: doc.id, ...doc.data() });
                });
                
                // تحميل توزيع المواد
                const assignedSnapshot = await db.collection('assignedCourses').get();
                assignedCourses = [];
                assignedSnapshot.forEach(doc => {
                    assignedCourses.push({ id: doc.id, ...doc.data() });
                });
                
                console.log('✅ بيانات النظام محملة');
                
                // تحديث واجهة المستخدم
                updateProfileUI();
                updateCourseForm();
                
            } catch (error) {
                console.error('❌ خطأ في تحميل بيانات النظام:', error);
            }
        }

        async function saveUserData() {
            if (!currentUser || !db || isOfflineMode) {
                saveToLocalStorage();
                return;
            }
            
            try {
                userData.lastUpdated = new Date();
                await db.collection('users').doc(currentUser.uid).set(userData, { merge: true });
                console.log('✅ تم حفظ البيانات في Firebase');
            } catch (error) {
                console.error('❌ خطأ في حفظ البيانات:', error);
                saveToLocalStorage();
                isOfflineMode = true;
                showNotification('تم حفظ البيانات محلياً', 'warning');
            }
        }

        function saveToLocalStorage() {
            try {
                const dataToSave = {
                    ...userData,
                    savedAt: new Date().toISOString()
                };
                localStorage.setItem('gpaCalculatorData', JSON.stringify(dataToSave));
                console.log('💾 تم حفظ البيانات محلياً');
            } catch (error) {
                console.error('❌ خطأ في الحفظ المحلي:', error);
            }
        }

        function loadFromLocalStorage() {
            try {
                const savedData = localStorage.getItem('gpaCalculatorData');
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    userData = {
                        ...parsedData,
                        semesters: parsedData.semesters || [],
                        profile: parsedData.profile || {},
                        cumulativeGPA: parsedData.cumulativeGPA || 0,
                        totalCredits: parsedData.totalCredits || 0,
                        currentMarkType: parsedData.currentMarkType || 1,
                        gradeHistory: parsedData.gradeHistory || [],
                        userType: parsedData.userType || 'student',
                        college: parsedData.college || '',
                        major: parsedData.major || '',
                        courseRatings: parsedData.courseRatings || {}
                    };
                    console.log('📂 تم تحميل البيانات المحلية');
                    
                    updateDashboard();
                    renderSemesters();
                    updateCharts();
                    updateProfileUI();
                    updateCourseForm();
                    updateGradeCalcForm();
                    updateGradeCalcHistory();
                }
            } catch (error) {
                console.error('❌ خطأ في تحميل البيانات المحلية:', error);
            }
        }

        // ============ إدارة الفصول والمواد ============
        function addNewSemester() {
            if (!currentUser && !confirm('أنت تستخدم التطبيق كزائر. البيانات ستخزن على جهازك فقط. هل تريد المتابعة؟')) {
                return;
            }
            
            const semesterName = prompt('أدخل اسم الفصل الدراسي (مثال: الفصل الأول 2024):');
            if (!semesterName) return;
            
            const semesterYear = prompt('أدخل السنة الدراسية:');
            if (!semesterYear) return;
            
            const newSemester = {
                id: Date.now(),
                name: semesterName,
                year: semesterYear,
                courses: [],
                gpa: 0,
                totalCredits: 0
            };
            
            if (!userData.semesters) userData.semesters = [];
            userData.semesters.push(newSemester);
            
            autoSave();
            renderSemesters();
            updateDashboard();
            updateCharts();
            
            showNotification('تم إضافة الفصل الدراسي بنجاح', 'success');
        }

        function renderSemesters() {
            const container = document.getElementById('semestersContainer');
            if (!container) return;
            
            if (!userData.semesters || userData.semesters.length === 0) {
                container.innerHTML = `
                    <div class="semester-card" style="text-align: center; padding: 50px;">
                        <i class="fas fa-calendar-plus fa-3x" style="color: var(--gray-medium); margin-bottom: 20px;"></i>
                        <h3 style="margin-bottom: 15px;">لا توجد فصول دراسية</h3>
                        <p style="color: var(--gray-medium); margin-bottom: 25px;">
                            ابدأ بإضافة فصل دراسي جديد لإدخال موادك وحساب معدلك
                        </p>
                        <button class="btn btn-primary" id="firstSemesterBtn">
                            <i class="fas fa-plus"></i> إضافة أول فصل دراسي
                        </button>
                    </div>
                `;
                
                document.getElementById('firstSemesterBtn')?.addEventListener('click', addNewSemester);
                return;
            }
            
            container.innerHTML = '';
            
            userData.semesters.forEach((semester, index) => {
                const semesterElement = createSemesterElement(semester, index);
                container.appendChild(semesterElement);
            });
        }

        function createSemesterElement(semester, index) {
            const element = document.createElement('div');
            element.className = 'semester-card';
            element.innerHTML = `
                <div class="semester-header">
                    <div class="semester-title">
                        <i class="fas fa-calendar"></i>
                        <span>${semester.name}</span>
                        <span style="color: var(--gray-medium); font-size: 0.9rem; margin-right: 10px;">
                            (${semester.year})
                        </span>
                    </div>
                    <div class="semester-actions">
                        <button class="btn btn-primary btn-sm" onclick="calculateSemesterGPA(${index})">
                            <i class="fas fa-calculator"></i> حساب المعدل
                        </button>
                        <button class="btn btn-info btn-sm" onclick="showCalculationDetails(${index})">
                            <i class="fas fa-info-circle"></i> تفاصيل
                        </button>
                        <button class="btn btn-success btn-sm" onclick="setSelectedSemester(${index})">
                            <i class="fas fa-book"></i> إضافة مواد
                        </button>
                        <button class="btn btn-light btn-sm" onclick="editSemester(${index})">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSemester(${index})">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </div>
                
                <div class="semester-gpa" style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 600;">المعدل الفصلي:</span>
                        <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">
                            ${semester.gpa?.toFixed(2) || '0.00'}%
                        </span>
                        <span style="background: #f0f9ff; padding: 2px 10px; border-radius: 12px; font-size: 0.9rem;">
                            ${getGradeLetter(semester.gpa || 0)}
                        </span>
                    </div>
                    <div style="margin-top: 10px; color: var(--gray-medium); font-size: 0.9rem;">
                        الساعات: ${semester.totalCredits || 0} ساعة | المواد: ${semester.courses?.length || 0} مادة
                    </div>
                </div>
                
                <div id="courses-${index}">
                    ${renderCourses(semester.courses || [], index)}
                </div>
            `;
            
            return element;
        }

        function renderCourses(courses, semesterIndex) {
            if (!courses || courses.length === 0) {
                return `
                    <div style="text-align: center; padding: 30px; color: var(--gray-medium);">
                        <i class="fas fa-book fa-2x" style="margin-bottom: 10px;"></i>
                        <p>لم تتم إضافة أي مواد بعد</p>
                    </div>
                `;
            }
            
            let html = '<h4 style="margin-bottom: 15px;">المواد الدراسية:</h4>';
            
            courses.forEach((course, courseIndex) => {
                // عرض نوع المادة
                const typeInfo = courseTypes[course.type] || { name: '', class: '' };
                const typeBadge = course.type ? `<span class="course-type ${typeInfo.class}">${typeInfo.name}</span>` : '';
                
                html += `
                    <div class="course-row" id="course-${semesterIndex}-${courseIndex}">
                        <div class="course-input">
                            <label>اسم المادة</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span>${course.name || ''}</span>
                                ${typeBadge}
                            </div>
                        </div>
                        
                        <div class="course-input">
                            <label>العلامة الكاملة</label>
                            <input type="number" value="${course.finalGrade || 0}" disabled style="font-weight: bold;">
                        </div>
                        
                        <div class="course-input">
                            <label>الساعات</label>
                            <input type="number" value="${course.credits || 3}" disabled>
                        </div>
                        
                        <div class="course-input" style="flex: 0.5;">
                            <label>العلامة × الساعات</label>
                            <input type="number" value="${(course.finalGrade || 0) * (course.credits || 3)}" disabled style="background: #f0f9ff;">
                        </div>
                        
                        <button class="btn btn-danger btn-sm" onclick="deleteCourse(${semesterIndex}, ${courseIndex})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });
            
            return html;
        }

        // ============ إضافة المواد مع الخيارات الجديدة ============
        function updateCourseForm() {
            const container = document.getElementById('courseFormContainer');
            const ratingSection = document.getElementById('courseRatingSection');
            
            if (!userData.semesters || userData.semesters.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <i class="fas fa-calendar-plus fa-2x" style="color: var(--warning-color); margin-bottom: 15px;"></i>
                        <p style="color: var(--dark-color); font-weight: 600; margin-bottom: 10px;">
                            يجب إضافة فصل دراسي أولاً
                        </p>
                        <p style="color: var(--gray-medium); margin-bottom: 20px;">
                            انتقل إلى قسم "الفصول الدراسية" وأضف فصل دراسي جديد
                        </p>
                        <button class="btn btn-primary" onclick="switchTab('semesters')">
                            <i class="fas fa-calendar-alt"></i> الانتقال إلى الفصول الدراسية
                        </button>
                    </div>
                `;
                ratingSection.style.display = 'none';
                return;
            }
            
            // تصفية المواد المتاحة للطالب حسب كليته وتخصصه
            let availableCourses = [];
            if (userData.userType === 'student' && userData.college && userData.major) {
                availableCourses = allCourses.filter(course => {
                    // التحقق مما إذا كانت المادة مخصصة لكليته/تخصصه
                    const assigned = assignedCourses.find(a => 
                        a.courseId === course.id && 
                        (a.colleges.includes(userData.college) || a.majors.includes(userData.major))
                    );
                    return assigned;
                });
            } else {
                availableCourses = allCourses;
            }
            
            let html = `
                <div class="form-group">
                    <label for="courseName">اسم المادة</label>
                    <select id="courseName" class="course-form-input">
                        <option value="">اختر المادة</option>
                        ${availableCourses.map(course => `
                            <option value="${course.id}" data-credits="${course.credits || 3}">
                                ${course.code ? `${course.code} - ` : ''}${course.name}
                                ${courseTypes[course.type] ? `(${courseTypes[course.type].name})` : ''}
                            </option>
                        `).join('')}
                    </select>
                    <small style="color: var(--gray-medium); display: block; margin-top: 5px;">
                        اختر من المواد المتاحة لتخصصك
                    </small>
                </div>
                
                <div class="form-group">
                    <label for="courseFinalGrade">العلامة الكاملة للمادة (%)</label>
                    <input type="number" min="0" max="100" id="courseFinalGrade" 
                           placeholder="0-100" class="course-form-input">
                    <small style="color: var(--gray-medium); display: block; margin-top: 5px;">
                        علامة المادة الكاملة النهائية التي تريد تحقيقها (من 100)
                    </small>
                </div>
                
                <div class="form-group">
                    <label for="courseCredits">الساعات المعتمدة</label>
                    <select id="courseCredits" class="course-form-input">
                        <option value="1">1 ساعة</option>
                        <option value="2">2 ساعات</option>
                        <option value="3" selected>3 ساعات</option>
                        <option value="4">4 ساعات</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="courseSemester">الفصل الدراسي</label>
                    <select id="courseSemester" class="course-form-input">
                        <option value="-1">اختر الفصل الدراسي</option>
                        ${userData.semesters.map((semester, index) => `
                            <option value="${index}" ${selectedSemesterIndex === index ? 'selected' : ''}>
                                ${semester.name} (${semester.year})
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
            
            container.innerHTML = html;
            
            // تحديث عدد الساعات عند اختيار المادة
            document.getElementById('courseName').addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const credits = selectedOption.getAttribute('data-credits');
                if (credits) {
                    document.getElementById('courseCredits').value = credits;
                }
            });
            
            document.getElementById('courseSemester').addEventListener('change', function() {
                selectedSemesterIndex = parseInt(this.value);
            });
            
            // إظهار قسم التقييم
            ratingSection.style.display = 'block';
            selectedRating = null;
            document.querySelectorAll('.rating-option').forEach(opt => {
                opt.classList.remove('selected');
            });
        }

        function addCourse() {
            const courseSelect = document.getElementById('courseName');
            const courseId = courseSelect.value;
            const selectedOption = courseSelect.options[courseSelect.selectedIndex];
            const courseName = selectedOption.text;
            const finalGrade = parseFloat(document.getElementById('courseFinalGrade')?.value) || 0;
            const credits = parseInt(document.getElementById('courseCredits')?.value) || 3;
            const semesterSelect = document.getElementById('courseSemester');
            const semesterIndex = semesterSelect ? parseInt(semesterSelect.value) : -1;
            
            if (!courseId) {
                showNotification('يرجى اختيار المادة', 'warning');
                return;
            }
            
            if (semesterIndex === -1) {
                showNotification('يرجى اختيار الفصل الدراسي', 'warning');
                return;
            }
            
            if (finalGrade < 0 || finalGrade > 100) {
                showNotification('علامة المادة يجب أن تكون بين 0 و 100', 'warning');
                return;
            }
            
            // العثور على معلومات المادة الكاملة
            const courseInfo = allCourses.find(c => c.id === courseId);
            
            const newCourse = {
                id: courseId,
                name: courseName,
                finalGrade: finalGrade,
                credits: credits,
                markType: userData.currentMarkType,
                type: courseInfo?.type || 'required-university',
                code: courseInfo?.code || ''
            };
            
            if (!userData.semesters[semesterIndex]) {
                showNotification('الفصل الدراسي غير موجود', 'error');
                return;
            }
            
            if (!userData.semesters[semesterIndex].courses) {
                userData.semesters[semesterIndex].courses = [];
            }
            
            userData.semesters[semesterIndex].courses.push(newCourse);
            
            // حفظ التقييم إذا كان موجوداً
            if (selectedRating && courseId) {
                if (!userData.courseRatings) userData.courseRatings = {};
                userData.courseRatings[courseId] = selectedRating;
            }
            
            // إعادة تعيين النموذج
            document.getElementById('courseName').value = '';
            document.getElementById('courseFinalGrade').value = '';
            selectedRating = null;
            document.querySelectorAll('.rating-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            autoSave();
            renderSemesters();
            updateAllCoursesView();
            updateDashboard();
            
            showNotification('تم إضافة المادة بنجاح', 'success');
        }

        // ============ البحث عن المواد ============
        function loadAllCoursesForSearch() {
            const container = document.getElementById('searchResultsContainer');
            container.innerHTML = '';
            
            if (allCourses.length === 0) {
                container.innerHTML = `
                    <div class="semester-card" style="text-align: center; padding: 50px;">
                        <i class="fas fa-book fa-3x" style="color: var(--gray-medium); margin-bottom: 20px;"></i>
                        <h3 style="margin-bottom: 15px;">لا توجد مواد في النظام</h3>
                        <p style="color: var(--gray-medium); margin-bottom: 25px;">
                            يرجى الانتظار حتى يقوم المشرف بإضافة المواد
                        </p>
                    </div>
                `;
                return;
            }
            
            allCourses.forEach(course => {
                const typeInfo = courseTypes[course.type] || { name: '', class: '' };
                const rating = userData.courseRatings?.[course.id];
                let ratingText = '';
                let ratingClass = '';
                
                if (rating === 'easy') {
                    ratingText = 'سهلة';
                    ratingClass = 'rating-easy';
                } else if (rating === 'medium') {
                    ratingText = 'متوسطة';
                    ratingClass = 'rating-medium';
                } else if (rating === 'hard') {
                    ratingText = 'صعبة';
                    ratingClass = 'rating-hard';
                }
                
                const card = document.createElement('div');
                card.className = 'semester-card';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin-bottom: 10px;">
                                ${course.code ? `${course.code} - ` : ''}${course.name}
                            </h4>
                            <p style="color: var(--gray-medium); margin-bottom: 10px;">
                                <span class="course-type ${typeInfo.class}">${typeInfo.name}</span>
                                <span style="margin-right: 15px;">الساعات: ${course.credits || 3}</span>
                            </p>
                        </div>
                        ${rating ? `
                            <div class="${ratingClass}" style="padding: 5px 10px; border-radius: 15px; font-weight: 600;">
                                ${ratingText}
                            </div>
                        ` : ''}
                    </div>
                    
                    ${course.description ? `<p style="margin-top: 15px;">${course.description}</p>` : ''}
                    
                    <div style="margin-top: 15px;">
                        <button class="btn btn-sm btn-light" onclick="rateCourse('${course.id}', 'easy')">
                            <i class="fas fa-thumbs-up"></i> سهلة
                        </button>
                        <button class="btn btn-sm btn-light" onclick="rateCourse('${course.id}', 'medium')">
                            <i class="fas fa-balance-scale"></i> متوسطة
                        </button>
                        <button class="btn btn-sm btn-light" onclick="rateCourse('${course.id}', 'hard')">
                            <i class="fas fa-exclamation-triangle"></i> صعبة
                        </button>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }

        function searchCourses() {
            const searchTerm = document.getElementById('courseSearchInput').value.toLowerCase();
            const container = document.getElementById('searchResultsContainer');
            
            if (!searchTerm.trim()) {
                loadAllCoursesForSearch();
                return;
            }
            
            const filteredCourses = allCourses.filter(course => 
                course.name.toLowerCase().includes(searchTerm) ||
                (course.code && course.code.toLowerCase().includes(searchTerm)) ||
                (course.description && course.description.toLowerCase().includes(searchTerm))
            );
            
            container.innerHTML = '';
            
            if (filteredCourses.length === 0) {
                container.innerHTML = `
                    <div class="semester-card" style="text-align: center; padding: 50px;">
                        <i class="fas fa-search fa-3x" style="color: var(--gray-medium); margin-bottom: 20px;"></i>
                        <h3 style="margin-bottom: 15px;">لا توجد نتائج</h3>
                        <p style="color: var(--gray-medium); margin-bottom: 25px;">
                            لم يتم العثور على مواد تطابق البحث
                        </p>
                    </div>
                `;
                return;
            }
            
            filteredCourses.forEach(course => {
                const typeInfo = courseTypes[course.type] || { name: '', class: '' };
                const rating = userData.courseRatings?.[course.id];
                let ratingText = '';
                let ratingClass = '';
                
                if (rating === 'easy') {
                    ratingText = 'سهلة';
                    ratingClass = 'rating-easy';
                } else if (rating === 'medium') {
                    ratingText = 'متوسطة';
                    ratingClass = 'rating-medium';
                } else if (rating === 'hard') {
                    ratingText = 'صعبة';
                    ratingClass = 'rating-hard';
                }
                
                const card = document.createElement('div');
                card.className = 'semester-card';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin-bottom: 10px;">
                                ${course.code ? `${course.code} - ` : ''}${course.name}
                            </h4>
                            <p style="color: var(--gray-medium); margin-bottom: 10px;">
                                <span class="course-type ${typeInfo.class}">${typeInfo.name}</span>
                                <span style="margin-right: 15px;">الساعات: ${course.credits || 3}</span>
                            </p>
                        </div>
                        ${rating ? `
                            <div class="${ratingClass}" style="padding: 5px 10px; border-radius: 15px; font-weight: 600;">
                                ${ratingText}
                            </div>
                        ` : ''}
                    </div>
                    
                    ${course.description ? `<p style="margin-top: 15px;">${course.description}</p>` : ''}
                    
                    <div style="margin-top: 15px;">
                        <button class="btn btn-sm btn-light" onclick="rateCourse('${course.id}', 'easy')">
                            <i class="fas fa-thumbs-up"></i> سهلة
                        </button>
                        <button class="btn btn-sm btn-light" onclick="rateCourse('${course.id}', 'medium')">
                            <i class="fas fa-balance-scale"></i> متوسطة
                        </button>
                        <button class="btn btn-sm btn-light" onclick="rateCourse('${course.id}', 'hard')">
                            <i class="fas fa-exclamation-triangle"></i> صعبة
                        </button>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }

        // تقييم المادة
        window.rateCourse = async function(courseId, rating) {
            if (!currentUser) {
                showNotification('يجب تسجيل الدخول لتقييم المواد', 'warning');
                return;
            }
            
            if (!userData.courseRatings) userData.courseRatings = {};
            userData.courseRatings[courseId] = rating;
            
            await autoSave();
            
            showNotification('تم تسجيل تقييمك للمادة', 'success');
            
            // تحديث العرض
            searchCourses();
        };

        // ============ لوحة الإشراف ============
        async function loadAdminData() {
            if (userData.userType !== 'admin') return;
            
            try {
                await loadSystemData();
                
                // تحديث قائمة الكليات
                updateCollegesList();
                
                // تحديث قائمة التخصصات
                updateMajorsList();
                
                // تحديث قائمة المواد
                updateCoursesAdminList();
                
                // تحديث خيارات توزيع المواد
                updateAssignForm();
                
                // تحديث قائمة المستخدمين
                updateUsersList();
                
            } catch (error) {
                console.error('❌ خطأ في تحميل بيانات الإشراف:', error);
            }
        }

        async function addCollege() {
            const name = document.getElementById('newCollegeName').value.trim();
            if (!name) {
                showNotification('يرجى إدخال اسم الكلية', 'warning');
                return;
            }
            
            try {
                await db.collection('colleges').add({
                    name: name,
                    createdAt: new Date()
                });
                
                document.getElementById('newCollegeName').value = '';
                await loadSystemData();
                updateCollegesList();
                
                showNotification('تم إضافة الكلية بنجاح', 'success');
            } catch (error) {
                console.error('❌ خطأ في إضافة الكلية:', error);
                showNotification('حدث خطأ أثناء إضافة الكلية', 'error');
            }
        }

        async function addMajor() {
            const name = document.getElementById('newMajorName').value.trim();
            const collegeId = document.getElementById('majorCollege').value;
            
            if (!name) {
                showNotification('يرجى إدخال اسم التخصص', 'warning');
                return;
            }
            
            if (!collegeId) {
                showNotification('يرجى اختيار الكلية', 'warning');
                return;
            }
            
            try {
                await db.collection('majors').add({
                    name: name,
                    collegeId: collegeId,
                    createdAt: new Date()
                });
                
                document.getElementById('newMajorName').value = '';
                await loadSystemData();
                updateMajorsList();
                
                showNotification('تم إضافة التخصص بنجاح', 'success');
            } catch (error) {
                console.error('❌ خطأ في إضافة التخصص:', error);
                showNotification('حدث خطأ أثناء إضافة التخصص', 'error');
            }
        }

        async function addCourseAdmin() {
            const code = document.getElementById('newCourseCode').value.trim();
            const name = document.getElementById('newCourseName').value.trim();
            const credits = parseInt(document.getElementById('newCourseCredits').value) || 3;
            const type = document.getElementById('newCourseType').value;
            
            if (!code || !name) {
                showNotification('يرجى إدخال كود واسم المادة', 'warning');
                return;
            }
            
            try {
                await db.collection('courses').add({
                    code: code,
                    name: name,
                    credits: credits,
                    type: type,
                    createdAt: new Date()
                });
                
                document.getElementById('newCourseCode').value = '';
                document.getElementById('newCourseName').value = '';
                await loadSystemData();
                updateCoursesAdminList();
                
                showNotification('تم إضافة المادة بنجاح', 'success');
            } catch (error) {
                console.error('❌ خطأ في إضافة المادة:', error);
                showNotification('حدث خطأ أثناء إضافة المادة', 'error');
            }
        }

        async function assignCourseToMajors() {
            const courseId = document.getElementById('assignCourse').value;
            const collegeSelect = document.getElementById('assignCollege');
            const majorSelect = document.getElementById('assignMajor');
            
            const selectedColleges = Array.from(collegeSelect.selectedOptions).map(opt => opt.value);
            const selectedMajors = Array.from(majorSelect.selectedOptions).map(opt => opt.value);
            
            if (!courseId) {
                showNotification('يرجى اختيار المادة', 'warning');
                return;
            }
            
            if (selectedColleges.length === 0 && selectedMajors.length === 0) {
                showNotification('يرجى اختيار كليات أو تخصصات', 'warning');
                return;
            }
            
            try {
                await db.collection('assignedCourses').add({
                    courseId: courseId,
                    colleges: selectedColleges,
                    majors: selectedMajors,
                    assignedAt: new Date()
                });
                
                await loadSystemData();
                updateAssignForm();
                
                showNotification('تم توزيع المادة بنجاح', 'success');
            } catch (error) {
                console.error('❌ خطأ في توزيع المادة:', error);
                showNotification('حدث خطأ أثناء توزيع المادة', 'error');
            }
        }

        function updateCollegesList() {
            const container = document.getElementById('collegesList');
            const collegeSelect = document.getElementById('majorCollege');
            const assignCollegeSelect = document.getElementById('assignCollege');
            
            collegeSelect.innerHTML = '<option value="">اختر الكلية</option>';
            assignCollegeSelect.innerHTML = '';
            
            if (colleges.length === 0) {
                container.innerHTML = '<p>لا توجد كليات مضافة بعد</p>';
                return;
            }
            
            let html = '<h4>الكليات المضافة:</h4><ul style="list-style: none; padding-right: 0;">';
            
            colleges.forEach(college => {
                html += `
                    <li style="padding: 10px; border-bottom: 1px solid var(--gray-light);">
                        ${college.name}
                        <button class="btn btn-sm btn-danger" style="float: left;" onclick="deleteCollege('${college.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                `;
                
                // إضافة للاختيار في النماذج
                const option1 = document.createElement('option');
                option1.value = college.id;
                option1.textContent = college.name;
                collegeSelect.appendChild(option1.cloneNode(true));
                
                const option2 = document.createElement('option');
                option2.value = college.id;
                option2.textContent = college.name;
                assignCollegeSelect.appendChild(option2);
            });
            
            html += '</ul>';
            container.innerHTML = html;
        }

        function updateMajorsList() {
            const container = document.getElementById('majorsList');
            const assignMajorSelect = document.getElementById('assignMajor');
            
            assignMajorSelect.innerHTML = '';
            
            if (majors.length === 0) {
                container.innerHTML = '<p>لا توجد تخصصات مضافة بعد</p>';
                return;
            }
            
            let html = '<h4>التخصصات المضافة:</h4><ul style="list-style: none; padding-right: 0;">';
            
            majors.forEach(major => {
                const college = colleges.find(c => c.id === major.collegeId);
                const collegeName = college ? college.name : 'غير معروف';
                
                html += `
                    <li style="padding: 10px; border-bottom: 1px solid var(--gray-light);">
                        ${major.name} - ${collegeName}
                        <button class="btn btn-sm btn-danger" style="float: left;" onclick="deleteMajor('${major.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                `;
                
                // إضافة للاختيار في النماذج
                const option = document.createElement('option');
                option.value = major.id;
                option.textContent = `${major.name} - ${collegeName}`;
                assignMajorSelect.appendChild(option);
            });
            
            html += '</ul>';
            container.innerHTML = html;
        }

        function updateCoursesAdminList() {
            const container = document.getElementById('coursesAdminList');
            const assignCourseSelect = document.getElementById('assignCourse');
            
            assignCourseSelect.innerHTML = '<option value="">اختر المادة</option>';
            
            if (allCourses.length === 0) {
                container.innerHTML = '<p>لا توجد مواد مضافة بعد</p>';
                return;
            }
            
            let html = '<h4>المواد المضافة:</h4><ul style="list-style: none; padding-right: 0;">';
            
            allCourses.forEach(course => {
                const typeInfo = courseTypes[course.type] || { name: '', class: '' };
                
                html += `
                    <li style="padding: 10px; border-bottom: 1px solid var(--gray-light);">
                        <strong>${course.code ? `${course.code} - ` : ''}${course.name}</strong>
                        <br>
                        <small>
                            الساعات: ${course.credits} | النوع: ${typeInfo.name}
                        </small>
                        <button class="btn btn-sm btn-danger" style="float: left;" onclick="deleteCourseAdmin('${course.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                `;
                
                // إضافة للاختيار في النماذج
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = `${course.code ? `${course.code} - ` : ''}${course.name} (${typeInfo.name})`;
                assignCourseSelect.appendChild(option);
            });
            
            html += '</ul>';
            container.innerHTML = html;
        }

        function updateAssignForm() {
            const container = document.getElementById('assignedCoursesList');
            
            if (assignedCourses.length === 0) {
                container.innerHTML = '<p>لا توجد مواد موزعة بعد</p>';
                return;
            }
            
            let html = '<h4>المواد الموزعة:</h4><ul style="list-style: none; padding-right: 0;">';
            
            assignedCourses.forEach(assigned => {
                const course = allCourses.find(c => c.id === assigned.courseId);
                const courseName = course ? `${course.code ? `${course.code} - ` : ''}${course.name}` : 'غير معروف';
                
                const assignedColleges = assigned.colleges.map(collegeId => {
                    const college = colleges.find(c => c.id === collegeId);
                    return college ? college.name : collegeId;
                }).join(', ');
                
                const assignedMajors = assigned.majors.map(majorId => {
                    const major = majors.find(m => m.id === majorId);
                    return major ? major.name : majorId;
                }).join(', ');
                
                html += `
                    <li style="padding: 10px; border-bottom: 1px solid var(--gray-light);">
                        <strong>${courseName}</strong>
                        <br>
                        <small>
                            الكليات: ${assignedColleges || 'جميع الكليات'}
                            <br>
                            التخصصات: ${assignedMajors || 'جميع التخصصات'}
                        </small>
                        <button class="btn btn-sm btn-danger" style="float: left;" onclick="deleteAssignedCourse('${assigned.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                `;
            });
            
            html += '</ul>';
            container.innerHTML = html;
        }

        async function updateUsersList() {
            const container = document.getElementById('usersList');
            
            try {
                const usersSnapshot = await db.collection('users').get();
                const users = [];
                usersSnapshot.forEach(doc => {
                    users.push({ id: doc.id, ...doc.data() });
                });
                
                if (users.length === 0) {
                    container.innerHTML = '<p>لا يوجد مستخدمون بعد</p>';
                    return;
                }
                
                let html = '<table style="width: 100%; border-collapse: collapse;">';
                html += `
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 15px; text-align: right;">الاسم</th>
                            <th style="padding: 15px; text-align: right;">البريد الإلكتروني</th>
                            <th style="padding: 15px; text-align: right;">النوع</th>
                            <th style="padding: 15px; text-align: right;">تاريخ التسجيل</th>
                            <th style="padding: 15px; text-align: right;">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                users.forEach(user => {
                    const date = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                    const dateStr = date.toLocaleDateString('ar-SA');
                    
                    html += `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 15px;">${user.name || '-'}</td>
                            <td style="padding: 15px;">${user.email || '-'}</td>
                            <td style="padding: 15px;">
                                <span class="user-badge ${user.userType === 'admin' ? 'badge-admin' : 'badge-student'}">
                                    ${user.userType === 'admin' ? 'مشرف' : 'طالب'}
                                </span>
                            </td>
                            <td style="padding: 15px;">${dateStr}</td>
                            <td style="padding: 15px;">
                                ${user.id !== currentUser.uid ? `
                                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : 'الحساب الحالي'}
                            </td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
                
            } catch (error) {
                console.error('❌ خطأ في تحميل المستخدمين:', error);
                container.innerHTML = '<p>حدث خطأ في تحميل بيانات المستخدمين</p>';
            }
        }

        // دوال حذف العناصر (يتم استدعاؤها من واجهة المستخدم)
        window.deleteCollege = async function(collegeId) {
            if (confirm('هل أنت متأكد من حذف هذه الكلية؟')) {
                try {
                    await db.collection('colleges').doc(collegeId).delete();
                    await loadSystemData();
                    updateCollegesList();
                    showNotification('تم حذف الكلية بنجاح', 'success');
                } catch (error) {
                    console.error('❌ خطأ في حذف الكلية:', error);
                    showNotification('حدث خطأ أثناء حذف الكلية', 'error');
                }
            }
        };

        window.deleteMajor = async function(majorId) {
            if (confirm('هل أنت متأكد من حذف هذا التخصص؟')) {
                try {
                    await db.collection('majors').doc(majorId).delete();
                    await loadSystemData();
                    updateMajorsList();
                    showNotification('تم حذف التخصص بنجاح', 'success');
                } catch (error) {
                    console.error('❌ خطأ في حذف التخصص:', error);
                    showNotification('حدث خطأ أثناء حذف التخصص', 'error');
                }
            }
        };

        window.deleteCourseAdmin = async function(courseId) {
            if (confirm('هل أنت متأكد من حذف هذه المادة؟')) {
                try {
                    await db.collection('courses').doc(courseId).delete();
                    await loadSystemData();
                    updateCoursesAdminList();
                    showNotification('تم حذف المادة بنجاح', 'success');
                } catch (error) {
                    console.error('❌ خطأ في حذف المادة:', error);
                    showNotification('حدث خطأ أثناء حذف المادة', 'error');
                }
            }
        };

        window.deleteAssignedCourse = async function(assignedId) {
            if (confirm('هل أنت متأكد من إلغاء توزيع هذه المادة؟')) {
                try {
                    await db.collection('assignedCourses').doc(assignedId).delete();
                    await loadSystemData();
                    updateAssignForm();
                    showNotification('تم إلغاء توزيع المادة بنجاح', 'success');
                } catch (error) {
                    console.error('❌ خطأ في إلغاء توزيع المادة:', error);
                    showNotification('حدث خطأ أثناء إلغاء توزيع المادة', 'error');
                }
            }
        };

        window.deleteUser = async function(userId) {
            if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
                try {
                    await db.collection('users').doc(userId).delete();
                    await updateUsersList();
                    showNotification('تم حذف المستخدم بنجاح', 'success');
                } catch (error) {
                    console.error('❌ خطأ في حذف المستخدم:', error);
                    showNotification('حدث خطأ أثناء حذف المستخدم', 'error');
                }
            }
        };

        // ============ تحديث واجهة المستخدم ============
        function updateUIForLoggedInUser() {
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('authButtons').style.display = 'none';
            
            const userName = userData.name || currentUser.displayName || 
                            currentUser.email.split('@')[0] || 'مستخدم';
            
            document.getElementById('userName').textContent = userName;
            document.getElementById('userAvatar').textContent = getInitials(userName);
            
            // إظهار/إخفاء عناصر لوحة الإشراف
            const adminDivider = document.getElementById('adminDivider');
            const adminNavItem = document.getElementById('adminNavItem');
            const userBadge = document.getElementById('userBadge');
            
            if (userData.userType === 'admin') {
                adminDivider.style.display = 'block';
                adminNavItem.style.display = 'block';
                userBadge.innerHTML = '<span class="user-badge badge-admin">مشرف</span>';
                userBadge.style.display = 'inline';
            } else {
                adminDivider.style.display = 'none';
                adminNavItem.style.display = 'none';
                userBadge.innerHTML = '<span class="user-badge badge-student">طالب</span>';
                userBadge.style.display = 'inline';
            }
            
            updateDashboard();
            updateProfileUI();
        }

function updateUIForLoggedInUser() {
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('authButtons').style.display = 'none';
    
    const userName = userData.name || currentUser.displayName || 
                    currentUser.email.split('@')[0] || 'مستخدم';
    
    document.getElementById('userName').textContent = userName;
    document.getElementById('userAvatar').textContent = getInitials(userName);
    
    // إظهار/إخفاء عناصر لوحة الإشراف
    const adminDivider = document.getElementById('adminDivider');
    const adminNavItem = document.getElementById('adminNavItem');
    const userBadge = document.getElementById('userBadge');
    const adminPanelSection = document.getElementById('adminPanelSection'); // أضف هذا السطر
    
    if (userData.userType === 'admin') {
        adminDivider.style.display = 'block';
        adminNavItem.style.display = 'block';
        userBadge.innerHTML = '<span class="user-badge badge-admin">مشرف</span>';
        userBadge.style.display = 'inline';
        adminPanelSection.style.display = 'block'; // أضف هذا السطر - إظهار قسم لوحة الإشراف
    } else {
        adminDivider.style.display = 'none';
        adminNavItem.style.display = 'none';
        adminPanelSection.style.display = 'none'; // أضف هذا السطر - إخفاء قسم لوحة الإشراف للطلاب
        userBadge.innerHTML = '<span class="user-badge badge-student">طالب</span>';
        userBadge.style.display = 'inline';
    }
    
    updateDashboard();
    updateProfileUI();
}

        function updateProfileUI() {
            const profileName = document.getElementById('profileName');
            const profileEmail = document.getElementById('profileEmail');
            const profileAvatar = document.getElementById('profileAvatar');
            const joinDate = document.getElementById('joinDate');
            const profileNameInput = document.getElementById('profileNameInput');
            const profileEmailInput = document.getElementById('profileEmailInput');
            const profileRole = document.getElementById('profileRole');
            const studentFields = document.getElementById('studentFields');
            const profileCollege = document.getElementById('profileCollege');
            const profileMajor = document.getElementById('profileMajor');
            const userCollegeInfo = document.getElementById('userCollegeInfo');
            const currentCollege = document.getElementById('currentCollege');
            const currentMajor = document.getElementById('currentMajor');
            
            if (profileName) profileName.textContent = userData.name || 'مستخدم';
            if (profileEmail) profileEmail.textContent = currentUser?.email || userData.email || 'example@email.com';
            if (profileAvatar) profileAvatar.textContent = getInitials(userData.name || 'مستخدم');
            
            if (joinDate) {
                if (userData.createdAt) {
                    const date = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
                    joinDate.textContent = date.toLocaleDateString('ar-SA');
                } else {
                    joinDate.textContent = '-';
                }
            }
            
            if (profileNameInput) profileNameInput.value = userData.name || '';
            if (profileEmailInput) profileEmailInput.value = currentUser?.email || userData.email || '';
            
            // تحديث نوع الحساب
            if (profileRole) {
                profileRole.textContent = userData.userType === 'admin' ? 'مشرف' : 'طالب';
            }
            
            // تحديث الكليات والتخصصات
            if (profileCollege && colleges.length > 0) {
                profileCollege.innerHTML = '<option value="">اختر كليتك</option>';
                colleges.forEach(college => {
                    const option = document.createElement('option');
                    option.value = college.id;
                    option.textContent = college.name;
                    if (college.id === userData.college) option.selected = true;
                    profileCollege.appendChild(option);
                });
            }
            
            if (profileMajor && majors.length > 0) {
                profileMajor.innerHTML = '<option value="">اختر تخصصك</option>';
                const filteredMajors = majors.filter(major => 
                    !userData.college || major.collegeId === userData.college
                );
                filteredMajors.forEach(major => {
                    const college = colleges.find(c => c.id === major.collegeId);
                    const option = document.createElement('option');
                    option.value = major.id;
                    option.textContent = `${major.name} - ${college?.name || ''}`;
                    if (major.id === userData.major) option.selected = true;
                    profileMajor.appendChild(option);
                });
            }
            
            // إظهار/إخفاء حقول الكلية والتخصص للطلاب
            if (studentFields) {
                studentFields.style.display = userData.userType === 'student' ? 'block' : 'none';
            }
            
            // تحديث معلومات الكلية والتخصص في لوحة التحكم
            if (userCollegeInfo) {
                if (userData.college && userData.major) {
                    const college = colleges.find(c => c.id === userData.college);
                    const major = majors.find(m => m.id === userData.major);
                    
                    if (college && major) {
                        currentCollege.textContent = college.name;
                        currentMajor.textContent = major.name;
                        userCollegeInfo.style.display = 'block';
                    } else {
                        userCollegeInfo.style.display = 'none';
                    }
                } else {
                    userCollegeInfo.style.display = 'none';
                }
            }
            
            // تحديث اختيار الكلية في نموذج التخصص
            if (profileCollege) {
                profileCollege.addEventListener('change', function() {
                    if (profileMajor) {
                        profileMajor.innerHTML = '<option value="">اختر تخصصك</option>';
                        const filteredMajors = majors.filter(major => major.collegeId === this.value);
                        filteredMajors.forEach(major => {
                            const college = colleges.find(c => c.id === major.collegeId);
                            const option = document.createElement('option');
                            option.value = major.id;
                            option.textContent = `${major.name} - ${college?.name || ''}`;
                            profileMajor.appendChild(option);
                        });
                    }
                });
            }
        }

        async function updateProfile() {
            const newName = document.getElementById('profileNameInput').value.trim();
            const college = document.getElementById('profileCollege')?.value || '';
            const major = document.getElementById('profileMajor')?.value || '';
            
            if (!newName) {
                showNotification('يرجى إدخال الاسم', 'warning');
                return;
            }
            
            userData.name = newName;
            
            if (userData.userType === 'student') {
                userData.college = college;
                userData.major = major;
            }
            
            await autoSave();
            updateUIForLoggedInUser();
            updateProfileUI();
            
            showNotification('تم تحديث الملف الشخصي بنجاح', 'success');
        }

// ============ دوال تسجيل الخروج وإدارة البيانات ============
async function handleLogout() {
    if (!currentUser) {
        localStorage.removeItem('gpaCalculatorData');
        userData = { 
            semesters: [], 
            profile: {}, 
            cumulativeGPA: 0, 
            totalCredits: 0, 
            currentMarkType: 1, 
            gradeHistory: [],
            userType: 'student',
            college: '',
            major: '',
            courseRatings: {}
        };
        updateUIForGuest();
        showNotification('تم تسجيل الخروج ومسح البيانات المحلية', 'info');
        return;
    }
    
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            await auth.signOut();
            showNotification('تم تسجيل الخروج بنجاح', 'info');
        } catch (error) {
            console.error('خطأ في تسجيل الخروج:', error);
            showNotification('حدث خطأ أثناء تسجيل الخروج', 'error');
        }
    }
}

function exportData() {
    try {
        const dataToExport = {
            userData: userData,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gpa-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('تم تصدير البيانات بنجاح', 'success');
    } catch (error) {
        console.error('❌ خطأ في تصدير البيانات:', error);
        showNotification('حدث خطأ أثناء تصدير البيانات', 'error');
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                
                // التحقق من بنية البيانات
                if (!importedData.userData || !Array.isArray(importedData.userData.semesters)) {
                    throw new Error('صيغة البيانات غير صحيحة');
                }
                
                if (confirm('سيتم استبدال جميع البيانات الحالية. هل تريد المتابعة؟')) {
                    userData = {
                        ...importedData.userData,
                        semesters: importedData.userData.semesters || [],
                        profile: importedData.userData.profile || {},
                        cumulativeGPA: importedData.userData.cumulativeGPA || 0,
                        totalCredits: importedData.userData.totalCredits || 0,
                        currentMarkType: importedData.userData.currentMarkType || 1,
                        gradeHistory: importedData.userData.gradeHistory || [],
                        userType: importedData.userData.userType || 'student',
                        college: importedData.userData.college || '',
                        major: importedData.userData.major || '',
                        courseRatings: importedData.userData.courseRatings || {}
                    };
                    
                    autoSave();
                    renderSemesters();
                    updateDashboard();
                    updateCharts();
                    updateProfileUI();
                    updateCourseForm();
                    updateGradeCalcForm();
                    updateGradeCalcHistory();
                    updateAllCoursesView();
                    
                    showNotification('تم استيراد البيانات بنجاح', 'success');
                }
            } catch (error) {
                console.error('❌ خطأ في استيراد البيانات:', error);
                showNotification('فشل استيراد البيانات. تأكد من صحة الملف', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

async function deleteAccount() {
    if (!currentUser) {
        if (confirm('سيتم حذف جميع البيانات المحلية. هل أنت متأكد؟')) {
            localStorage.removeItem('gpaCalculatorData');
            userData = { 
                semesters: [], 
                profile: {}, 
                cumulativeGPA: 0, 
                totalCredits: 0, 
                currentMarkType: 1, 
                gradeHistory: [],
                userType: 'student',
                college: '',
                major: '',
                courseRatings: {}
            };
            updateUIForGuest();
            showNotification('تم حذف البيانات المحلية', 'info');
        }
        return;
    }
    
    if (confirm('⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك بشكل نهائي. هل أنت متأكد؟')) {
        const confirmation = prompt('اكتب "نعم" للتأكيد:');
        if (confirmation === 'نعم') {
            try {
                // حذف بيانات المستخدم من Firestore
                await db.collection('users').doc(currentUser.uid).delete();
                
                // حذف الحساب من Authentication
                await currentUser.delete();
                
                showNotification('تم حذف الحساب بنجاح', 'info');
            } catch (error) {
                console.error('❌ خطأ في حذف الحساب:', error);
                showNotification('حدث خطأ أثناء حذف الحساب', 'error');
            }
        }
    }
}

// ============ دوال حساب المعدل الفصلي ============
window.calculateSemesterGPA = function(semesterIndex) {
    const semester = userData.semesters[semesterIndex];
    if (!semester.courses || semester.courses.length === 0) {
        alert('لا توجد مواد في هذا الفصل');
        return;
    }
    
    let totalWeightedMarks = 0;
    let totalCredits = 0;
    let hasErrors = false;
    
    semester.courses.forEach((course) => {
        const finalGrade = course.finalGrade || 0;
        const credits = course.credits || 3;
        
        if (finalGrade < 0 || finalGrade > 100) {
            hasErrors = true;
            return;
        }
        
        // حساب العلامة الموزونة: العلامة × الساعات
        totalWeightedMarks += finalGrade * credits;
        totalCredits += credits;
    });
    
    if (hasErrors) {
        alert('يرجى التأكد من صحة جميع العلامات (يجب أن تكون بين 0 و 100)');
        return;
    }
    
    // المعدل الفصلي = مجموع (العلامة × الساعات) ÷ مجموع الساعات
    semester.gpa = totalCredits > 0 ? (totalWeightedMarks / totalCredits) : 0;
    semester.totalCredits = totalCredits;
    
    // تحديث المعدل التراكمي
    calculateCumulativeGPA();
    
    autoSave();
    renderSemesters();
    updateDashboard();
    updateCharts();
    
    showNotification(`تم حساب المعدل الفصلي: ${semester.gpa.toFixed(2)}%`, 'success');
};

window.showCalculationDetails = function(semesterIndex) {
    const semester = userData.semesters[semesterIndex];
    if (!semester.courses || semester.courses.length === 0) {
        alert('لا توجد مواد في هذا الفصل');
        return;
    }
    
    let details = "🔢 تفاصيل حساب المعدل الفصلي:\n\n";
    details += "📊 المعادلة: المعدل = مجموع (العلامة × الساعات) ÷ مجموع الساعات\n\n";
    
    let totalWeightedMarks = 0;
    let totalCredits = 0;
    
    semester.courses.forEach((course, index) => {
        const finalGrade = course.finalGrade || 0;
        const credits = course.credits || 3;
        const weightedMark = finalGrade * credits;
        
        totalWeightedMarks += weightedMark;
        totalCredits += credits;
        
        details += `${index + 1}. ${course.name}:\n`;
        details += `   العلامة: ${finalGrade}%\n`;
        details += `   الساعات: ${credits}\n`;
        details += `   (${finalGrade} × ${credits}) = ${weightedMark.toFixed(2)}\n\n`;
    });
    
    const gpa = totalCredits > 0 ? (totalWeightedMarks / totalCredits) : 0;
    details += "══════════════════════════════\n";
    details += `📈 المجموع:\n`;
    details += `مجموع (العلامة × الساعات): ${totalWeightedMarks.toFixed(2)}\n`;
    details += `مجموع الساعات: ${totalCredits}\n`;
    details += `📊 المعدل الفصلي: ${gpa.toFixed(2)}%\n`;
    details += `🧮 الصيغة: ${totalWeightedMarks.toFixed(2)} ÷ ${totalCredits} = ${gpa.toFixed(2)}%`;
    
    alert(details);
};

// ============ دوال إدارة المواد والفصول ============
window.deleteCourse = function(semesterIndex, courseIndex) {
    if (confirm('هل أنت متأكد من حذف هذه المادة؟')) {
        userData.semesters[semesterIndex].courses.splice(courseIndex, 1);
        autoSave();
        renderSemesters();
        updateAllCoursesView();
        updateDashboard();
        showNotification('تم حذف المادة بنجاح', 'success');
    }
};

window.deleteSemester = function(semesterIndex) {
    if (confirm('هل أنت متأكد من حذف هذا الفصل الدراسي؟ سيتم حذف جميع المواد المرتبطة به.')) {
        userData.semesters.splice(semesterIndex, 1);
        autoSave();
        renderSemesters();
        updateDashboard();
        updateCharts();
        updateAllCoursesView();
        showNotification('تم حذف الفصل الدراسي بنجاح', 'success');
    }
};

window.editSemester = function(semesterIndex) {
    const semester = userData.semesters[semesterIndex];
    const newName = prompt('اسم الفصل الجديد:', semester.name);
    if (newName) {
        semester.name = newName;
        const newYear = prompt('السنة الدراسية الجديدة:', semester.year);
        if (newYear) {
            semester.year = newYear;
            autoSave();
            renderSemesters();
            showNotification('تم تعديل الفصل الدراسي', 'success');
        }
    }
};

function updateAllCoursesView() {
    const container = document.getElementById('allCoursesContainer');
    if (!container) return;
    
    let allCoursesList = [];
    userData.semesters.forEach((semester, semIndex) => {
        if (semester.courses && semester.courses.length > 0) {
            semester.courses.forEach((course, courseIndex) => {
                course.semesterIndex = semIndex;
                course.courseIndex = courseIndex;
                course.semesterName = semester.name;
                allCoursesList.push(course);
            });
        }
    });
    
    if (allCoursesList.length === 0) {
        container.innerHTML = `
            <div class="semester-card" style="text-align: center; padding: 50px;">
                <i class="fas fa-book fa-3x" style="color: var(--gray-medium); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px;">لا توجد مواد بعد</h3>
                <p style="color: var(--gray-medium); margin-bottom: 25px;">
                    ابدأ بإضافة مواد جديدة من تبويب "إضافة مادة"
                </p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="semester-card">
            <h3 style="margin-bottom: 20px;">جميع المواد (${allCoursesList.length})</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 15px; text-align: right;">المادة</th>
                            <th style="padding: 15px; text-align: right;">الفصل</th>
                            <th style="padding: 15px; text-align: right;">العلامة الكاملة</th>
                            <th style="padding: 15px; text-align: right;">الساعات</th>
                            <th style="padding: 15px; text-align: right;">علامة × ساعات</th>
                            <th style="padding: 15px; text-align: right;">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    allCoursesList.forEach(course => {
        const weightedMark = (course.finalGrade || 0) * (course.credits || 3);
        const typeInfo = courseTypes[course.type] || { name: '', class: '' };
        
        html += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 15px;">
                    <div>${course.name}</div>
                    ${course.type ? `<small><span class="course-type ${typeInfo.class}">${typeInfo.name}</span></small>` : ''}
                </td>
                <td style="padding: 15px;">${course.semesterName}</td>
                <td style="padding: 15px; font-weight: bold; color: var(--primary-color);">
                    ${course.finalGrade || 0}%
                </td>
                <td style="padding: 15px;">${course.credits}</td>
                <td style="padding: 15px; background: #f0f9ff;">${weightedMark.toFixed(2)}</td>
                <td style="padding: 15px;">
                    <button class="btn btn-danger btn-sm" onclick="deleteCourse(${course.semesterIndex}, ${course.courseIndex})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ============ دوال حساب العلامات ============
function calculateCumulativeGPA() {
    let totalWeightedMarks = 0;
    let totalCredits = 0;
    
    userData.semesters.forEach(semester => {
        if (semester.gpa > 0 && semester.totalCredits > 0) {
            totalWeightedMarks += semester.gpa * semester.totalCredits;
            totalCredits += semester.totalCredits;
        }
    });
    
    userData.cumulativeGPA = totalCredits > 0 ? (totalWeightedMarks / totalCredits) : 0;
    userData.totalCredits = totalCredits;
}

function updateGradeCalcForm() {
    const container = document.getElementById('gradeCalcForm');
    
    let html = `
        <div class="form-group">
            <label for="markTypeSelect">نوع العلامات</label>
            <select id="markTypeSelect" class="grade-input" onchange="updateGradeCalcFields()">
                ${Object.entries(markTypes).map(([key, type]) => `
                    <option value="${key}" ${userData.currentMarkType == key ? 'selected' : ''}>
                        ${type.name}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
    
    // إضافة حقول إدخال حسب نوع العلامات المحدد
    const selectedType = markTypes[userData.currentMarkType];
    selectedType.fields.forEach((field, index) => {
        if (field === 'نهائي') {
            html += `
                <div class="form-group">
                    <label>${field} (سيتم حسابه)</label>
                    <input type="number" id="finalGrade" disabled style="background: #f0f9ff;">
                    <small style="color: var(--gray-medium); display: block; margin-top: 5px;">
                        ${selectedType.percentages[index]}% - سيتم حسابه تلقائياً
                    </small>
                </div>
            `;
        } else {
            html += `
                <div class="form-group">
                    <label for="${field.toLowerCase()}Grade">${field} (${selectedType.percentages[index]}%)</label>
                    <input type="number" min="0" max="100" id="${field.toLowerCase()}Grade" 
                           placeholder="0-100" class="grade-input" oninput="calculateFinalGrade()">
                    <small style="color: var(--gray-medium); display: block; margin-top: 5px;">
                        أدخل علامة ${field} التي حصلت عليها
                    </small>
                </div>
            `;
        }
    });
    
    html += `
        <div class="form-group">
            <label for="totalGrade">العلامة الكاملة المطلوبة (%)</label>
            <input type="number" min="0" max="100" id="totalGrade" 
                   placeholder="0-100" class="grade-input" oninput="calculateFinalGrade()">
            <small style="color: var(--gray-medium); display: block; margin-top: 5px;">
                العلامة النهائية الكاملة التي تريد تحقيقها في المادة
            </small>
        </div>
        
        <div class="form-group" style="grid-column: 1 / -1;">
            <button type="button" class="btn btn-primary" onclick="calculateAndSaveGrade()" style="width: 100%;">
                <i class="fas fa-calculator"></i> حساب علامة النهائي
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    
    // إضافة مستمع حدث لتحديث الحقول عند تغيير نوع العلامات
    document.getElementById('markTypeSelect').addEventListener('change', function() {
        userData.currentMarkType = parseInt(this.value);
        updateGradeCalcForm();
        calculateFinalGrade();
    });
}

window.updateGradeCalcFields = function() {
    const markType = parseInt(document.getElementById('markTypeSelect').value);
    userData.currentMarkType = markType;
    updateGradeCalcForm();
    calculateFinalGrade();
};

window.calculateFinalGrade = function() {
    const markType = userData.currentMarkType;
    const typeInfo = markTypes[markType];
    const fields = typeInfo.fields;
    const percentages = typeInfo.percentages;
    
    let totalOtherMarks = 0;
    let finalPercentage = 0;
    
    fields.forEach((field, index) => {
        if (field === 'نهائي') {
            finalPercentage = percentages[index];
        } else {
            const input = document.getElementById(`${field.toLowerCase()}Grade`);
            const value = parseFloat(input?.value) || 0;
            if (value >= 0 && value <= 100) {
                totalOtherMarks += (value * percentages[index]) / 100;
            }
        }
    });
    
    const totalGrade = parseFloat(document.getElementById('totalGrade')?.value) || 0;
    
    let requiredFinal = 0;
    
    if (totalGrade > 0 && finalPercentage > 0) {
        requiredFinal = (totalGrade - totalOtherMarks) / (finalPercentage / 100);
        requiredFinal = Math.max(0, Math.min(100, requiredFinal));
        
        const finalInput = document.getElementById('finalGrade');
        if (finalInput) {
            finalInput.value = requiredFinal.toFixed(2);
        }
        
        const resultDiv = document.getElementById('gradeCalcResult');
        const resultValue = document.getElementById('finalGradeResult');
        const resultMessage = document.getElementById('finalGradeMessage');
        
        if (resultDiv && resultValue && resultMessage) {
            resultValue.textContent = requiredFinal.toFixed(2);
            
            if (requiredFinal > 100) {
                resultMessage.textContent = '⚠️ العلامة المطلوبة غير ممكنة';
                resultValue.style.color = 'var(--danger-color)';
            } else if (requiredFinal > 70) {
                resultMessage.textContent = '📚 تحتاج لمجهود إضافي';
                resultValue.style.color = 'var(--warning-color)';
            } else if (requiredFinal > 50) {
                resultMessage.textContent = '✅ يمكن تحقيقها بالمذاكرة الجيدة';
                resultValue.style.color = 'var(--success-color)';
            } else {
                resultMessage.textContent = '🎉 سهلة التحقيق';
                resultValue.style.color = 'var(--success-color)';
            }
            
            resultDiv.style.display = 'block';
        }
    }
    
    return requiredFinal;
};

window.calculateAndSaveGrade = function() {
    const markType = userData.currentMarkType;
    const typeInfo = markTypes[markType];
    const fields = typeInfo.fields;
    
    const gradeData = {
        id: Date.now(),
        date: new Date().toLocaleString('ar-SA'),
        type: markType,
        typeName: typeInfo.name
    };
    
    let isValid = true;
    
    fields.forEach((field, index) => {
        if (field === 'نهائي') {
            gradeData.final = parseFloat(document.getElementById('finalGrade')?.value) || 0;
        } else {
            const input = document.getElementById(`${field.toLowerCase()}Grade`);
            const value = parseFloat(input?.value) || 0;
            if (value < 0 || value > 100) {
                showNotification(`علامة ${field} يجب أن تكون بين 0 و 100`, 'warning');
                input.style.borderColor = 'var(--danger-color)';
                isValid = false;
            } else {
                gradeData[field.toLowerCase()] = value;
                if (input) input.style.borderColor = '';
            }
        }
    });
    
    const totalGrade = parseFloat(document.getElementById('totalGrade')?.value) || 0;
    if (totalGrade < 0 || totalGrade > 100) {
        showNotification('العلامة الكاملة يجب أن تكون بين 0 و 100', 'warning');
        isValid = false;
    } else {
        gradeData.total = totalGrade;
    }
    
    if (!isValid) return;
    
    const finalGrade = calculateFinalGrade();
    gradeData.final = finalGrade;
    
    if (!userData.gradeHistory) {
        userData.gradeHistory = [];
    }
    
    userData.gradeHistory.unshift(gradeData);
    
    // حفظ آخر 10 حسابات فقط
    if (userData.gradeHistory.length > 10) {
        userData.gradeHistory = userData.gradeHistory.slice(0, 10);
    }
    
    autoSave();
    updateGradeCalcHistory();
    
    showNotification('تم حفظ الحساب في السجل', 'success');
};

function updateGradeCalcHistory() {
    const container = document.getElementById('gradeCalcHistory');
    const tbody = document.getElementById('historyTableBody');
    
    if (!userData.gradeHistory || userData.gradeHistory.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    tbody.innerHTML = '';
    
    userData.gradeHistory.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        let otherMarks = '';
        const typeInfo = markTypes[item.type];
        typeInfo.fields.forEach((field, i) => {
            if (field !== 'نهائي') {
                const value = item[field.toLowerCase()] || 0;
                otherMarks += `${field}: ${value}%<br>`;
            }
        });
        
        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${item.typeName}</td>
            <td>${item.total || 0}%</td>
            <td>${otherMarks}</td>
            <td style="font-weight: bold; color: ${item.final > 70 ? 'var(--warning-color)' : 'var(--success-color)'}">
                ${item.final.toFixed(2)}%
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteGradeHistory(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

window.deleteGradeHistory = function(index) {
    if (confirm('هل تريد حذف هذا الحساب من السجل؟')) {
        userData.gradeHistory.splice(index, 1);
        autoSave();
        updateGradeCalcHistory();
        showNotification('تم حذف الحساب من السجل', 'success');
    }
};

// ============ الرسوم البيانية ============
function initCharts() {
    const ctx1 = document.getElementById('cumulativeChart');
    const ctx2 = document.getElementById('semesterChart');
    const ctx3 = document.getElementById('creditsChart');
    
    if (ctx1) {
        charts.cumulative = new Chart(ctx1.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'المعدل التراكمي',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        rtl: true,
                        labels: {
                            font: {
                                family: 'Cairo'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `المعدل: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    if (ctx2) {
        charts.semester = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'المعدل الفصلي',
                    data: [],
                    backgroundColor: 'rgba(139, 92, 246, 0.5)',
                    borderColor: 'rgb(139, 92, 246)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        rtl: true,
                        labels: {
                            font: {
                                family: 'Cairo'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `المعدل: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    if (ctx3) {
        charts.credits = new Chart(ctx3.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'الساعات المعتمدة',
                    data: [],
                    backgroundColor: 'rgba(16, 185, 129, 0.5)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        rtl: true,
                        labels: {
                            font: {
                                family: 'Cairo'
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' ساعة';
                            }
                        }
                    }
                }
            }
        });
    }
}

function updateCharts() {
    if (!userData.semesters || userData.semesters.length === 0) {
        return;
    }
    
    // تحديث مخطط المعدل التراكمي
    if (charts.cumulative) {
        const cumulativeData = [];
        let runningTotal = 0;
        let runningCredits = 0;
        
        userData.semesters.forEach((semester, index) => {
            if (semester.gpa > 0) {
                runningTotal += semester.gpa * semester.totalCredits;
                runningCredits += semester.totalCredits;
                cumulativeData.push({
                    semester: `فصل ${index + 1}`,
                    gpa: runningCredits > 0 ? (runningTotal / runningCredits) : 0
                });
            }
        });
        
        charts.cumulative.data.labels = cumulativeData.map(d => d.semester);
        charts.cumulative.data.datasets[0].data = cumulativeData.map(d => d.gpa);
        charts.cumulative.update();
    }
    
    // تحديث مخطط المعدل الفصلي
    if (charts.semester) {
        const semestersWithGPA = userData.semesters.filter(s => s.gpa > 0);
        charts.semester.data.labels = semestersWithGPA.map((s, i) => s.name || `فصل ${i + 1}`);
        charts.semester.data.datasets[0].data = semestersWithGPA.map(s => s.gpa);
        charts.semester.update();
    }
    
    // تحديث مخطط الساعات المعتمدة
    if (charts.credits) {
        const semestersWithCredits = userData.semesters.filter(s => s.totalCredits > 0);
        charts.credits.data.labels = semestersWithCredits.map((s, i) => s.name || `فصل ${i + 1}`);
        charts.credits.data.datasets[0].data = semestersWithCredits.map(s => s.totalCredits);
        charts.credits.update();
    }
}

// ============ دوال المساعدة ============
function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        try {
            await saveUserData();
            showSaveNotification();
        } catch (error) {
            console.error('❌ خطأ في الحفظ التلقائي:', error);
        }
    }, 1500);
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }, 500);
    }
}

function showAuthModal() {
    authModal.classList.add('active');
    switchAuthTab('login');
}

function hideAuthModal() {
    authModal.classList.remove('active');
    const errorElement = document.getElementById('authError');
    if (errorElement) errorElement.classList.remove('active');
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    document.getElementById('userType').value = 'student';
    document.getElementById('adminCodeGroup').style.display = 'none';
}

function showAuthError(message) {
    const errorElement = document.getElementById('authError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('active');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    else if (type === 'warning') icon = 'exclamation-triangle';
    else if (type === 'error') icon = 'times-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function showSaveNotification() {
    const saveNotification = document.getElementById('saveNotification');
    if (saveNotification) {
        saveNotification.style.display = 'flex';
        setTimeout(() => {
            saveNotification.style.display = 'none';
        }, 3000);
    }
}

function getInitials(name) {
    if (!name) return 'م';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function getGradeLetter(grade) {
    if (grade >= 95) return "امتياز";
    if (grade >= 90) return "ممتاز";
    if (grade >= 85) return "جيد جداً";
    if (grade >= 80) return "جيد";
    if (grade >= 75) return "جيد مرتفع";
    if (grade >= 70) return "مقبول";
    if (grade >= 65) return "مقبول مرتفع";
    if (grade >= 60) return "مقبول منخفض";
    return "راسب";
}

function updateDashboard() {
    const totalGPASpan = document.getElementById('totalGPA');
    const totalCreditsSpan = document.getElementById('totalCredits');
    const totalSemestersSpan = document.getElementById('totalSemesters');
    const totalCoursesSpan = document.getElementById('totalCourses');
    
    if (totalGPASpan) totalGPASpan.textContent = userData.cumulativeGPA?.toFixed(2) || '0.00';
    if (totalCreditsSpan) totalCreditsSpan.textContent = userData.totalCredits || 0;
    if (totalSemestersSpan) totalSemestersSpan.textContent = userData.semesters?.length || 0;
    
    let totalCourses = 0;
    userData.semesters?.forEach(semester => {
        totalCourses += semester.courses?.length || 0;
    });
    if (totalCoursesSpan) totalCoursesSpan.textContent = totalCourses;
}

function updateUIForGuest() {
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('authButtons').style.display = 'flex';
    
    // إخفاء عناصر المشرف
    document.getElementById('adminDivider').style.display = 'none';
    document.getElementById('adminNavItem').style.display = 'none';
    document.getElementById('adminPanelSection').style.display = 'none';
    
    // عرض رسالة الترحيب
    const container = document.getElementById('semestersContainer');
    if (container) {
        container.innerHTML = `
            <div class="semester-card" style="text-align: center; padding: 50px;">
                <i class="fas fa-user-lock fa-3x" style="color: var(--gray-medium); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px;">مرحباً بك!</h3>
                <p style="color: var(--gray-medium); margin-bottom: 15px;">
                    يمكنك استخدام التطبيق كزائر، ولكن لن يتم حفظ بياناتك عند إغلاق الصفحة
                </p>
                <p style="color: var(--gray-medium); margin-bottom: 25px;">
                    للتخزين السحابي وحفظ بياناتك، يرجى تسجيل الدخول
                </p>
                <button class="btn btn-primary" id="guestLoginBtn">
                    <i class="fas fa-sign-in-alt"></i> تسجيل الدخول لحفظ البيانات
                </button>
                <button class="btn btn-light" style="margin-top: 15px;" id="continueAsGuestBtn">
                    <i class="fas fa-user"></i> الاستمرار كزائر
                </button>
            </div>
        `;
        
        document.getElementById('guestLoginBtn')?.addEventListener('click', showAuthModal);
        document.getElementById('continueAsGuestBtn')?.addEventListener('click', () => {
            showNotification('يمكنك الآن إضافة فصول ومواد، سيتم حفظها على جهازك فقط', 'info');
        });
    }
}

// تهيئة الأحداث عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 بدء تحميل التطبيق...');
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // التحقق من حالة المصادقة
    checkAuthState();
    
    // تهيئة الرسوم البيانية
    initCharts();
});
