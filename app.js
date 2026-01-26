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
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        switchTab(tabId);
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
            mainContentWrapper.classList.remove('sidebar-active');
        }
    });
}); // إضافة الإغلاق هنا

// إغلاق القائمة الجانبية بالنقر على أيقونة الإغلاق
document.querySelector('.close-sidebar')?.addEventListener('click', () => {
    sidebar.classList.remove('active');
    mainContentWrapper.classList.remove('sidebar-active');
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
        section.style.display = 'none';
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
        
        console.log('✅ تم إظهار القسم:', tabId);
        
        // معالجة خاصة لكل تبويب
        switch (tabId) {
            case 'statistics':
                setTimeout(updateCharts, 100);
                break;
                
            case 'courses':
                setTimeout(() => {
                    // تحميل البيانات أولاً إذا لم تكن محملة
                    if (userData.userType === 'student' && !userData.studyPlan) {
                        loadStudentStudyPlan().then(() => {
                            updateAllCoursesView();
                            updateCourseForm();
                        });
                    } else {
                        updateAllCoursesView();
                        updateCourseForm();
                    }
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
                
            case 'profile':
                setTimeout(() => {
                    // تحديث قوائم الكليات والتخصصات
                    updateProfileUI();
                }, 50);
                break;
        }
    } else {
        console.error('❌ القسم غير موجود:', `${tabId}Section`);
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
    console.log('🔄 تبديل تبويب الإشراف إلى:', tabId);
    
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // تنشيط التبويب المحدد
    const activeTab = document.querySelector(`.admin-tab[data-admin-tab="${tabId}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // إظهار المحتوى
    const targetContent = document.getElementById(`${tabId}Tab`);
    if (targetContent) {
        targetContent.style.display = 'block';
        
        // تحميل البيانات الخاصة بكل تبويب
        switch (tabId) {
            case 'colleges':
                updateCollegesList();
                break;
                
            case 'majors':
                updateMajorsList();
                break;
                
            case 'coursesAdmin':
                updateCoursesAdminList();
                break;
                
            case 'plan':
                // التأكد من تحميل البيانات
                if (colleges.length === 0 || majors.length === 0 || allCourses.length === 0) {
                    showNotification('جاري تحميل البيانات...', 'info');
                    loadSystemData().then(() => {
                        if (colleges.length > 0) {
                            loadAvailableCourses();
                        }
                    });
                } else {
                    loadAvailableCourses();
                }
                break;
                
            case 'publishedPlans':
                loadStudyPlans();
                break;
                
            case 'users':
                updateUsersList();
                break;
        }
    }
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
                
                // تحميل بيانات النظام
                await loadSystemData();
                
                // إذا كان المستخدم طالباً، تحميل خطة الدراسة بعد تحميل البيانات
                if (userData.userType === 'student' && userData.college && userData.major) {
                    setTimeout(async () => {
                        await loadStudentStudyPlan();
                        updateDashboard();
                        updateCourseForm();
                    }, 1000);
                }
                
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
                courseRatings: data.courseRatings || {},
                studyPlanId: data.studyPlanId || '' // إضافة خطة الدراسة
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
                studyPlanId: '',
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
        
        // إذا كان المستخدم طالباً وله تخصص، تحميل خطة الدراسة
        if (userData.userType === 'student' && userData.college && userData.major) {
            await loadStudentStudyPlan();
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

// دالة لتحميل خطة الدراسة للطالب
async function loadStudentStudyPlan() {
    console.log('📘 جاري تحميل خطة الدراسة للطالب...');
    
    // التحقق من البيانات الأساسية
    if (!userData.college) {
        console.error('❌ لا توجد كلية محددة');
        showNotification('يرجى تحديد الكلية في إعدادات الحساب', 'warning');
        return false;
    }
    
    if (!userData.major) {
        console.error('❌ لا يوجد تخصص محدد');
        showNotification('يرجى تحديد التخصص في إعدادات الحساب', 'warning');
        return false;
    }
    
    // الحصول على أسماء الكلية والتخصص لعرضها
    const collegeName = getCollegeName(userData.college);
    const majorName = getMajorName(userData.major);
    
    console.log(`🔍 البحث عن خطة لـ: ${collegeName} - ${majorName}`);
    
    try {
        if (!db) {
            console.error('❌ Firestore غير متاح');
            showNotification('لا يمكن الاتصال بقاعدة البيانات حالياً', 'error');
            return false;
        }
        
        showNotification(`جاري البحث عن خطة دراسية لـ ${majorName}...`, 'info');
        
        // البحث عن خطة الدراسة بنمط أكثر مرونة
        let plansQuery;
        
        try {
            plansQuery = await db.collection('studyPlans')
                .where('majorId', '==', userData.major)
                .where('collegeId', '==', userData.college)
                .where('status', '==', 'active')
                .limit(1)
                .get();
        } catch (queryError) {
            console.log('⚠️ خطأ في البحث، جاري البحث بدون فلتر النشاط...');
            // البحث بدون فلتر النشاط
            plansQuery = await db.collection('studyPlans')
                .where('majorId', '==', userData.major)
                .where('collegeId', '==', userData.college)
                .limit(1)
                .get();
        }
        
        if (plansQuery.empty) {
            console.log('⚠️ لم يتم العثور على خطط مطابقة، جاري البحث بأي خطة...');
            
            // البحث عن أي خطة للتخصص
            const backupQuery = await db.collection('studyPlans')
                .where('majorId', '==', userData.major)
                .limit(1)
                .get();
            
            if (!backupQuery.empty) {
                const planDoc = backupQuery.docs[0];
                const planData = planDoc.data();
                
                console.log('✅ تم العثور على خطة احتياطية:', planData.name);
                
                userData.studyPlanId = planDoc.id;
                userData.studyPlan = {
                    ...planData,
                    id: planDoc.id
                };
                
                showNotification(`تم تحميل خطة دراسية احتياطية: ${planData.name}`, 'warning');
                return true;
            } else {
                console.log('❌ لا توجد خطط دراسية لهذا التخصص');
                
                // إنشاء خطة افتراضية مؤقتة
                userData.studyPlanId = 'temp_plan_' + Date.now();
                userData.studyPlan = createDefaultStudyPlan();
                
                showNotification('لم يتم العثور على خطة دراسية. سيتم استخدام قائمة المواد العامة', 'info');
                return true;
            }
        }
        
        // إذا وجدنا خطة
        const planDoc = plansQuery.docs[0];
        const planData = planDoc.data();
        
        console.log('✅ تم العثور على خطة دراسية:', planData.name);
        console.log('- عدد المواد:', planData.courses?.length || 0);
        console.log('- إجمالي الساعات:', planData.totalCredits || 0);
        
        userData.studyPlanId = planDoc.id;
        userData.studyPlan = {
            ...planData,
            id: planDoc.id
        };
        
        // تحديث المستخدم
        if (currentUser) {
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    studyPlanId: userData.studyPlanId,
                    lastUpdated: new Date()
                });
            } catch (error) {
                console.error('⚠️ خطأ في تحديث المستخدم:', error);
            }
        }
        
        saveToLocalStorage();
        showNotification(`تم تحميل خطة الدراسة: ${planData.name}`, 'success');
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تحميل خطة الدراسة:', error);
        
        // محاولة تحميل من التخزين المحلي
        const savedData = localStorage.getItem('gpaCalculatorData');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.studyPlan) {
                    userData.studyPlanId = parsed.studyPlanId || 'local_plan';
                    userData.studyPlan = parsed.studyPlan;
                    console.log('✅ تم تحميل الخطة من التخزين المحلي');
                    showNotification('تم تحميل الخطة من الذاكرة المحلية', 'info');
                    return true;
                }
            } catch (e) {
                console.error('❌ خطأ في تحميل البيانات المحلية:', e);
            }
        }
        
        // خطة افتراضية
        userData.studyPlanId = 'default_plan';
        userData.studyPlan = createDefaultStudyPlan();
        showNotification('تم تحميل قائمة المواد العامة', 'info');
        return true;
    }
}

// دوال مساعدة
function getCollegeName(collegeId) {
    if (!colleges || colleges.length === 0) return 'كلية';
    const college = colleges.find(c => c.id === collegeId);
    return college ? college.name : 'كلية';
}

function getMajorName(majorId) {
    if (!majors || majors.length === 0) return 'تخصص';
    const major = majors.find(m => m.id === majorId);
    return major ? major.name : 'تخصص';
}

function createDefaultStudyPlan() {
    return {
        id: 'default_plan',
        name: 'قائمة المواد العامة',
        collegeId: userData.college,
        collegeName: getCollegeName(userData.college),
        majorId: userData.major,
        majorName: getMajorName(userData.major),
        courses: allCourses.slice(0, 20).map(course => ({
            courseId: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits || 3,
            type: 'required-major',
            year: course.year || '1'
        })),
        totalCourses: Math.min(allCourses.length, 20),
        totalCredits: Math.min(allCourses.length, 20) * 3,
        isDefault: true
    };
}

function buildCourseForm(availableCourses) {
    let html = `
        <form id="addCourseForm" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
            <div class="form-group">
                <label for="courseName">اسم المادة</label>
                <select id="courseName" class="form-control" required>
                    <option value="">اختر المادة</option>
    `;
    
    availableCourses.forEach(course => {
        // البحث عن نوع المادة من الخطة الدراسية
        let courseType = 'required-major';
        let typeName = '';
        
        if (userData.studyPlan && userData.studyPlan.courses) {
            const planCourse = userData.studyPlan.courses.find(pc => 
                pc.courseId === course.id || pc.id === course.id
            );
            
            if (planCourse) {
                courseType = planCourse.type || planCourse.courseType || 'required-major';
                const typeInfo = courseTypes[courseType] || { name: '' };
                typeName = typeInfo.name;
            }
        } else {
            const typeInfo = courseTypes[course.type] || { name: '' };
            typeName = typeInfo.name;
        }
        
        // عرض اسم المادة مع الكود فقط (بدون النوع)
        const code = course.code || '';
        const name = course.name || '';
        const displayName = code ? `${code} - ${name}` : name;
        
        html += `<option value="${course.id}" data-type="${courseType}">${displayName}</option>`;
    });
    
    html += `
                </select>
                <small id="courseTypeHint" style="color: var(--primary-color); margin-top: 5px; display: block;">
                    اختر مادة لعرض نوعها
                </small>
            </div>
            
            <div class="form-group">
                <label for="courseFinalGrade">العلامة الكاملة (0-100)</label>
                <input type="number" id="courseFinalGrade" min="0" max="100" step="0.1" placeholder="اترك فارغاً إذا لم تحصل على العلامة">
                <small>يمكن تركها فارغة للفصول الحالية</small>
            </div>
            
            <div class="form-group">
                <label for="courseCredits">الساعات المعتمدة</label>
                <select id="courseCredits" class="form-control">
                    <option value="1">1 ساعة</option>
                    <option value="2">2 ساعة</option>
                    <option value="3" selected>3 ساعات</option>
                    <option value="4">4 ساعات</option>
                    <option value="6">6 ساعات</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="courseSemester">الفصل الدراسي</label>
                <select id="courseSemester" class="form-control" required>
                    <option value="">اختر الفصل</option>
    `;
    
    if (userData.semesters && userData.semesters.length > 0) {
        userData.semesters.forEach((semester, index) => {
            html += `<option value="${index}" ${index === selectedSemesterIndex ? 'selected' : ''}>${semester.name} (${semester.year})</option>`;
        });
    }
    
    html += `
                </select>
            </div>
            
            <!-- قسم معلومات نوع المادة -->
            <div class="form-group" style="grid-column: 1 / -1; background: #f8fafc; padding: 15px; border-radius: 8px; display: none;" id="courseTypeInfo">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-info-circle" style="color: var(--primary-color);"></i>
                    <div>
                        <strong>نوع المادة في الخطة:</strong>
                        <span id="selectedCourseType" style="margin-right: 10px; font-weight: bold;"></span>
                    </div>
                </div>
            </div>
            
            <div class="form-group" style="grid-column: 1 / -1;">
                <button type="button" class="btn btn-primary" onclick="addCourse()" style="width: 100%; padding: 12px;">
                    <i class="fas fa-plus"></i> إضافة المادة
                </button>
            </div>
        </form>
    `;
    
    return html;
}

function setupCourseFormEventListeners() {
    const courseNameSelect = document.getElementById('courseName');
    const courseTypeHint = document.getElementById('courseTypeHint');
    
    if (courseNameSelect) {
        courseNameSelect.addEventListener('change', function() {
            const courseId = this.value;
            
            if (!courseId) {
                if (courseTypeHint) {
                    courseTypeHint.textContent = 'سيتم استخدام نوع المادة من الخطة الدراسية';
                    courseTypeHint.style.color = 'var(--primary-color)';
                }
                return;
            }
            
            const selectedOption = this.options[this.selectedIndex];
            const courseType = selectedOption.getAttribute('data-type');
            const typeInfo = courseTypes[courseType] || { name: 'إجباري تخصص' };
            
            // تحديث تلميح النوع
            if (courseTypeHint) {
                courseTypeHint.innerHTML = `<i class="fas fa-info-circle"></i> نوع المادة في الخطة: <strong>${typeInfo.name}</strong>`;
                courseTypeHint.style.color = 'var(--success-color)';
            }
            
            // تحديث الساعات إذا كانت موجودة في المادة
            const course = allCourses.find(c => c.id === courseId);
            if (course && course.credits) {
                const creditsSelect = document.getElementById('courseCredits');
                if (creditsSelect) {
                    creditsSelect.value = course.credits;
                }
            }
        });
    }
}
async function loadSystemData() {
    if (!db) {
        console.error('❌ Firestore غير متاح!');
        return false;
    }
    
    try {
        console.log('📥 جاري تحميل بيانات النظام من Firestore...');
        
        // استخدام Promise.all لتحميل البيانات بشكل متوازي
        const [collegesSnapshot, majorsSnapshot, coursesSnapshot, studyPlansSnapshot] = await Promise.all([
            db.collection('colleges').get(),
            db.collection('majors').get(),
            db.collection('courses').get(),
            db.collection('studyPlans').get()
        ]);
        
        // تحميل الكليات
        colleges = [];
        collegesSnapshot.forEach(doc => {
            colleges.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ تم تحميل ${colleges.length} كلية`);
        
        // تحميل التخصصات
        majors = [];
        majorsSnapshot.forEach(doc => {
            majors.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ تم تحميل ${majors.length} تخصص`);
        
        // تحميل المواد
        allCourses = [];
        coursesSnapshot.forEach(doc => {
            const courseData = { id: doc.id, ...doc.data() };
            console.log(`📖 المادة: ${courseData.code || 'بدون كود'} - ${courseData.name}`);
            allCourses.push(courseData);
        });
        console.log(`✅ تم تحميل ${allCourses.length} مادة`);
        
        // تحميل الخطط الدراسية
        studyPlans = [];
        studyPlansSnapshot.forEach(doc => {
            studyPlans.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ تم تحميل ${studyPlans.length} خطة دراسية`);
        
        console.log('🎉 تم تحميل جميع بيانات النظام بنجاح');
        
        // تحديث قوائم الاختيار
        updateCollegeSelects();
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تحميل بيانات النظام:', error);
        console.error('تفاصيل الخطأ:', error.message);
        return false;
    }
}

// دالة لتحديث جميع قوائم اختيار الكليات
function updateCollegeSelects() {
    const collegeSelects = [
        'majorCollege',        // في إضافة تخصص
        'planCollege',         // في إنشاء خطة
        'profileCollege',      // في الملف الشخصي
        'assignCollege'        // في توزيع المواد (القديم)
    ];
    
    collegeSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            // حفظ القيمة الحالية
            const currentValue = select.value;
            
            // إعادة تعيين القائمة
            select.innerHTML = '<option value="">اختر الكلية</option>';
            
            // إضافة الكليات
            colleges.forEach(college => {
                const option = document.createElement('option');
                option.value = college.id;
                option.textContent = college.name;
                select.appendChild(option);
            });
            
            // استعادة القيمة إذا كانت موجودة
            if (currentValue && colleges.some(c => c.id === currentValue)) {
                select.value = currentValue;
            }
        }
    });
}

// تحديث دالة إنشاء خطة جديدة

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
                <button class="btn btn-light btn-sm toggle-courses-btn" data-index="${index}">
                    <i class="fas fa-eye"></i> إظهار/إخفاء المواد
                </button>
                <button class="btn btn-primary btn-sm calculate-gpa-btn" data-index="${index}">
                    <i class="fas fa-calculator"></i> حساب المعدل
                </button>
                <button class="btn btn-info btn-sm details-btn" data-index="${index}">
                    <i class="fas fa-info-circle"></i> تفاصيل
                </button>
                <button class="btn btn-success btn-sm add-course-btn" data-index="${index}">
                    <i class="fas fa-book"></i> إضافة مواد
                </button>
                <button class="btn btn-light btn-sm edit-semester-btn" data-index="${index}">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn btn-danger btn-sm delete-semester-btn" data-index="${index}">
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
    
    // إضافة حدث التبديل
    element.querySelector('.toggle-courses-btn')?.addEventListener('click', function() {
        const container = document.getElementById(`courses-container-${index}`);
        if (container.style.display === 'none') {
            container.style.display = 'block';
            this.innerHTML = '<i class="fas fa-eye-slash"></i> إخفاء المواد';
        } else {
            container.style.display = 'none';
            this.innerHTML = '<i class="fas fa-eye"></i> إظهار المواد';
        }
    });

    // ربط الأحداث بعد إنشاء العنصر
    setTimeout(() => {
        element.querySelector('.add-course-btn')?.addEventListener('click', function() {
            const idx = this.getAttribute('data-index');
            setSelectedSemester(parseInt(idx));
        });
        
        element.querySelector('.calculate-gpa-btn')?.addEventListener('click', function() {
            const idx = this.getAttribute('data-index');
            calculateSemesterGPA(parseInt(idx));
        });
        
        element.querySelector('.details-btn')?.addEventListener('click', function() {
            const idx = this.getAttribute('data-index');
            showCalculationDetails(parseInt(idx));
        });
        
        element.querySelector('.edit-semester-btn')?.addEventListener('click', function() {
            const idx = this.getAttribute('data-index');
            editSemester(parseInt(idx));
        });
        
        element.querySelector('.delete-semester-btn')?.addEventListener('click', function() {
            const idx = this.getAttribute('data-index');
            deleteSemester(parseInt(idx));
        });
    }, 100);
    
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
        // تنظيف اسم المادة من الفواصل الأسطر والأسطر الجديدة
        const cleanCourseName = cleanText(course.name || '');
        const typeInfo = courseTypes[course.type] || { name: '', class: '' };
        const typeBadge = course.type ? `<span class="course-type ${typeInfo.class}">${typeInfo.name}</span>` : '';
        
        html += `
            <div class="course-row" id="course-${semesterIndex}-${courseIndex}">
                <div class="course-input">
                    <label>اسم المادة</label>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                            ${cleanCourseName}
                        </span>
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
                
                <button class="btn btn-info btn-sm" onclick="editCourseGrade(${semesterIndex}, ${courseIndex})">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                
                <button class="btn btn-danger btn-sm" onclick="deleteCourse(${semesterIndex}, ${courseIndex})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    return html;
}

// دالة مساعدة لتنظيف النص
function cleanText(text) {
    if (!text) return '';
    
    // إزالة الفواصل الأسطر والأسطر الجديدة
    let cleaned = text
        .replace(/\n/g, ' ')          // استبدال الأسطر الجديدة بمسافات
        .replace(/\r/g, ' ')          // استبدال الإرجاع بمسافات
        .replace(/\t/g, ' ')          // استبدال التبويبات بمسافات
        .replace(/  +/g, ' ')         // إزالة المسافات المزدوجة
        .trim();                      // إزالة المسافات من البداية والنهاية
    
    // معالجة خاصة للعربية
    cleaned = cleaned
        .replace(/،/g, ' ')          // استبدال الفاصلة العربية بمسافة
        .replace(/؛/g, ' ')          // استبدال الفاصلة المنقوطة بمسافة
        .trim();
    
    return cleaned;
}
// دالة تعديل العلامة
window.editCourseGrade = function(semesterIndex, courseIndex) {
    const course = userData.semesters[semesterIndex].courses[courseIndex];
    const newGrade = prompt(`أدخل العلامة الجديدة للمادة "${course.name}" (0-100):`, course.finalGrade || '');
    
    if (newGrade !== null && newGrade !== '') {
        const gradeValue = parseFloat(newGrade);
        if (!isNaN(gradeValue) && gradeValue >= 0 && gradeValue <= 100) {
            course.finalGrade = gradeValue;
            autoSave();
            renderSemesters();
            updateDashboard();
            updateCharts();
            showNotification('تم تعديل العلامة بنجاح', 'success');
        } else {
            showNotification('العلامة يجب أن تكون بين 0 و 100', 'warning');
        }
    }
};

        // ============ إضافة المواد مع الخيارات الجديدة ============


function addCourse() {
    // 1. الحصول على القيم من النموذج
    const courseSelect = document.getElementById('courseName');
    const courseId = courseSelect.value;
    
    if (!courseId) {
        showNotification('يرجى اختيار المادة', 'warning');
        return;
    }
    
    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    const courseName = selectedOption.text;
    
    // 2. الحصول على العلامة (تسمح بالقيمة الفارغة)
    const finalGradeInput = document.getElementById('courseFinalGrade');
    let finalGrade = null;
    
    if (finalGradeInput && finalGradeInput.value && finalGradeInput.value.trim() !== '') {
        const gradeValue = parseFloat(finalGradeInput.value);
        
        if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100) {
            showNotification('علامة المادة يجب أن تكون بين 0 و 100 أو فارغة', 'warning');
            return;
        }
        
        finalGrade = gradeValue;
    }
    
    // 3. الحصول على الساعات
    const creditsSelect = document.getElementById('courseCredits');
    const credits = creditsSelect ? parseInt(creditsSelect.value) || 3 : 3;
    
    // 4. الحصول على الفصل الدراسي
    const semesterSelect = document.getElementById('courseSemester');
    let semesterIndex = -1;
    
    if (semesterSelect) {
        semesterIndex = parseInt(semesterSelect.value);
    } else {
        semesterIndex = selectedSemesterIndex;
    }
    
    if (semesterIndex === -1) {
        showNotification('يرجى اختيار الفصل الدراسي', 'warning');
        return;
    }
    
    if (!userData.semesters[semesterIndex]) {
        showNotification('الفصل الدراسي غير موجود', 'error');
        return;
    }
    
    // 5. البحث عن معلومات المادة من قاعدة البيانات
    const courseInfo = allCourses.find(c => c.id === courseId);
    
    // 6. البحث عن نوع المادة من الخطة الدراسية (الجديد)
    let courseType = 'required-major'; // قيمة افتراضية
    
    if (userData.studyPlan && userData.studyPlan.courses) {
        const planCourse = userData.studyPlan.courses.find(pc => 
            pc.courseId === courseId || pc.id === courseId
        );
        
        if (planCourse && planCourse.type) {
            courseType = planCourse.type;
            console.log(`✅ تم تحديد نوع المادة من الخطة: ${courseType}`);
        } else if (planCourse && planCourse.courseType) {
            courseType = planCourse.courseType; // حالات قديمة
            console.log(`✅ تم تحديد نوع المادة من الخطة (courseType): ${courseType}`);
        } else {
            console.log('⚠️ لم يتم العثور على نوع المادة في الخطة، استخدام افتراضي');
        }
    } else {
        console.log('⚠️ لا توجد خطة دراسية، استخدام نوع افتراضي');
    }
    
    // 7. إنشاء كائن المادة الجديد مع النوع من الخطة
    const newCourse = {
        id: courseId,
        name: courseName,
        finalGrade: finalGrade,
        credits: credits,
        markType: userData.currentMarkType || 1,
        type: courseType, // استخدام النوع من الخطة الدراسية
        code: courseInfo?.code || '',
        addedAt: new Date().toISOString(),
        source: 'study_plan' // علامة أن المأخوذة من الخطة
    };
    
    // 8. التحقق من عدم تكرار المادة في نفس الفصل
    if (!userData.semesters[semesterIndex].courses) {
        userData.semesters[semesterIndex].courses = [];
    }
    
    const existingCourseIndex = userData.semesters[semesterIndex].courses.findIndex(
        course => course.id === courseId
    );
    
    // 9. التعامل مع المادة الموجودة (استبدال أو إضافة)
    if (existingCourseIndex !== -1) {
        // الاحتفاظ بنوع المادة الحالي إذا كان موجوداً ومخصصاً
        const existingType = userData.semesters[semesterIndex].courses[existingCourseIndex].type;
        newCourse.type = existingType && existingType !== 'required-major' ? existingType : courseType;
        
        userData.semesters[semesterIndex].courses[existingCourseIndex] = newCourse;
        showNotification('تم تحديث المادة بنجاح', 'success');
    } else {
        userData.semesters[semesterIndex].courses.push(newCourse);
        showNotification('تم إضافة المادة بنجاح', 'success');
    }
    
    // 10. إعادة تعيين النموذج
    if (courseSelect) courseSelect.value = '';
    if (finalGradeInput) finalGradeInput.value = '';
    if (semesterSelect) semesterSelect.value = '-1';
    
    // 11. حفظ البيانات
    autoSave();
    
    // 12. تحديث الواجهة
    renderSemesters();
    updateAllCoursesView();
    updateDashboard();
    updateCharts();
    
    const semester = userData.semesters[semesterIndex];
    showNotification(
        `تم ${existingCourseIndex !== -1 ? 'تحديث' : 'إضافة'} المادة في الفصل: ${semester.name}`,
        'success'
    );
}
// 18. دالة مساعدة للتحقق من صحة البيانات
function validateCourseInputs(courseName, finalGrade, credits, semesterIndex) {
    const errors = [];
    
    if (!courseName || courseName.trim() === '') {
        errors.push('يرجى اختيار المادة');
    }
    
    if (finalGrade !== null && (finalGrade < 0 || finalGrade > 100)) {
        errors.push('علامة المادة يجب أن تكون بين 0 و 100');
    }
    
    if (credits < 1 || credits > 6) {
        errors.push('الساعات يجب أن تكون بين 1 و 6');
    }
    
    if (semesterIndex === -1 || !userData.semesters[semesterIndex]) {
        errors.push('يرجى اختيار فصل دراسي صحيح');
    }
    
    return errors;
}

// 19. دالة لتحديث نموذج إضافة المادة بناءً على نوع المستخدم
function updateCourseForm() {
    const container = document.getElementById('courseFormContainer');
    
    // التحقق من وجود فصول دراسية
    if (!userData.semesters || userData.semesters.length === 0) {
        container.innerHTML = getNoSemestersMessage();
        return;
    }
    
    // التحقق من حالة الخطة الدراسية
    const planStatus = checkStudyPlanStatus();
    
    // للطلاب: التأكد من وجود خطة دراسة
    if (userData.userType === 'student') {
        if (!planStatus.hasCollege || !planStatus.hasMajor) {
            container.innerHTML = getNoCollegeMajorMessage();
            return;
        }
        
        if (!planStatus.hasPlan) {
            container.innerHTML = getNoStudyPlanMessage();
            
            // محاولة تحميل الخطة تلقائياً إذا لم تكن محملة
            setTimeout(async () => {
                await loadStudentStudyPlan();
                updateCourseForm(); // إعادة تحميل النموذج بعد تحميل الخطة
            }, 500);
            return;
        }
        
        if (!planStatus.hasCourses) {
            container.innerHTML = getNoCoursesInPlanMessage();
            return;
        }
    }
    
    // الحصول على المواد المتاحة
    let availableCourses = [];
    
    if (userData.userType === 'admin') {
        // المشرف يرى جميع المواد
        availableCourses = allCourses;
    } else {
        // الطالب يرى المواد المتاحة لتخصصه بناءً على الخطة الدراسية
        availableCourses = getStudentAvailableCourses();
        
        // إضافة معلومات للمستخدم إذا لم يكن هناك مواد
        if (availableCourses.length === 0) {
            container.innerHTML = getNoAvailableCoursesMessage();
            return;
        }
    }
    
    // بناء النموذج
    container.innerHTML = buildCourseForm(availableCourses);
    
    // إضافة مستمعات الأحداث
    setupCourseFormEventListeners();
}

// دوال مساعدة لعرض الرسائل
function getNoSemestersMessage() {
    return `
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
}

function getNoCollegeMajorMessage() {
    return `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-university fa-2x" style="color: var(--warning-color); margin-bottom: 15px;"></i>
            <h4 style="color: var(--dark-color); margin-bottom: 10px;">يرجى تحديد الكلية والتخصص</h4>
            <p style="color: var(--gray-medium); margin-bottom: 20px;">
                انتقل إلى إعدادات الحساب واختر كليتك وتخصصك لعرض المواد المتاحة
            </p>
            <button class="btn btn-primary" onclick="switchTab('profile')">
                <i class="fas fa-user-cog"></i> الذهاب إلى إعدادات الحساب
            </button>
        </div>
    `;
}

function getNoStudyPlanMessage() {
    return `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-calendar-times fa-2x" style="color: var(--warning-color); margin-bottom: 15px;"></i>
            <h4 style="color: var(--dark-color); margin-bottom: 10px;">لا توجد خطة دراسية</h4>
            <p style="color: var(--gray-medium); margin-bottom: 15px;">
                لم يتم العثور على خطة دراسية لتخصصك
            </p>
            <p style="color: var(--gray-medium); margin-bottom: 20px;">
                جاري البحث عن خطة دراسية...
            </p>
            <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 20px;"></div>
        </div>
    `;
}

function getNoCoursesInPlanMessage() {
    return `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-book fa-2x" style="color: var(--warning-color); margin-bottom: 15px;"></i>
            <h4 style="color: var(--dark-color); margin-bottom: 10px;">الخطة لا تحتوي على مواد</h4>
            <p style="color: var(--gray-medium); margin-bottom: 20px;">
                خطة الدراسة الحالية لا تحتوي على أي مواد. يرجى التواصل مع المشرف.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-primary" onclick="refreshStudyPlan()">
                    <i class="fas fa-redo"></i> تحديث الخطة
                </button>
                <button class="btn btn-light" onclick="switchTab('profile')">
                    <i class="fas fa-user-cog"></i> الإعدادات
                </button>
            </div>
        </div>
    `;
}

function getNoAvailableCoursesMessage() {
    return `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-book fa-2x" style="color: var(--warning-color); margin-bottom: 15px;"></i>
            <h4 style="color: var(--dark-color); margin-bottom: 10px;">لا توجد مواد متاحة</h4>
            <p style="color: var(--gray-medium); margin-bottom: 20px;">
                لا توجد مواد متاحة في خطة الدراسة الحالية.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-primary" onclick="refreshStudyPlan()">
                    <i class="fas fa-redo"></i> تحديث الخطة
                </button>
                <button class="btn btn-light" onclick="viewStudentStudyPlan()">
                    <i class="fas fa-eye"></i> عرض الخطة
                </button>
            </div>
        </div>
    `;
}

// 20. دالة مساعدة للحصول على المواد المتاحة للطالب
function getStudentAvailableCourses() {
    console.log('📚 جاري تحميل المواد المتاحة للطالب...');
    
    if (!userData.major) {
        console.log('⚠️ لا يوجد تخصص محدد للطالب');
        return [];
    }
    
    if (!allCourses || allCourses.length === 0) {
        console.log('⚠️ لا توجد مواد في النظام');
        return [];
    }
    
    if (userData.studyPlan && userData.studyPlan.courses) {
        console.log('✅ استخدام مواد من خطة الدراسة:', userData.studyPlan.name);
        
        // الحصول على المواد من الخطة الدراسية
        const planCourseIds = userData.studyPlan.courses.map(course => course.courseId || course.id);
        
        // تصفية المواد بناءً على الخطة
        const availableCourses = allCourses.filter(course => {
            return planCourseIds.includes(course.id);
        });
        
        console.log('✅ عدد المواد المتاحة بعد الفلترة:', availableCourses.length);
        
        // إضافة معلومات نوع المادة من الخطة
        return availableCourses.map(course => {
            const planCourse = userData.studyPlan.courses.find(pc => 
                pc.courseId === course.id || pc.id === course.id
            );
            
            return {
                ...course,
                type: planCourse ? (planCourse.type || planCourse.courseType || 'required-major') : 'required-major'
            };
        });
    }
    
    console.log('⚠️ لا توجد خطة دراسة، عرض جميع المواد');
    return allCourses.map(course => ({
        ...course,
        type: course.type || 'required-major'
    }));
}

// دالة للتحقق من حالة الخطة الدراسية
function checkStudyPlanStatus() {
    console.log('🔍 التحقق من حالة الخطة الدراسية...');
    console.log('المستخدم:', userData.userType);
    console.log('الكلية:', userData.college);
    console.log('التخصص:', userData.major);
    console.log('معرف الخطة:', userData.studyPlanId);
    console.log('الخطة:', userData.studyPlan);
    
    if (userData.userType === 'student') {
        if (!userData.college || !userData.major) {
            console.log('❌ يجب تحديد الكلية والتخصص أولاً');
            return {
                hasCollege: false,
                hasMajor: false,
                hasPlan: false,
                message: 'يرجى تحديد الكلية والتخصص أولاً'
            };
        }
        
        if (!userData.studyPlanId || !userData.studyPlan) {
            console.log('❌ لا توجد خطة دراسية');
            return {
                hasCollege: true,
                hasMajor: true,
                hasPlan: false,
                message: 'لم يتم العثور على خطة دراسية'
            };
        }
        
        if (!userData.studyPlan.courses || userData.studyPlan.courses.length === 0) {
            console.log('❌ الخطة لا تحتوي على مواد');
            return {
                hasCollege: true,
                hasMajor: true,
                hasPlan: true,
                hasCourses: false,
                message: 'الخطة لا تحتوي على مواد'
            };
        }
        
        console.log('✅ الخطة الدراسية جاهزة');
        return {
            hasCollege: true,
            hasMajor: true,
            hasPlan: true,
            hasCourses: true,
            message: 'الخطة جاهزة'
        };
    }
    
    return {
        isAdmin: true,
        message: 'المشرف يرى جميع المواد'
    };
}

// 21. دالة لتعديل المادة (مضافة بناءً على التعديل 3 و6)
window.editCourseGrade = function(semesterIndex, courseIndex) {
    const semester = userData.semesters[semesterIndex];
    const course = semester.courses[courseIndex];
    
    // إنشاء نموذج تعديل
    const modalHTML = `
        <div class="edit-course-modal">
            <h3>تعديل المادة: ${course.name}</h3>
            <div class="form-group">
                <label for="editFinalGrade">العلامة الكاملة (0-100)</label>
                <input type="number" 
                       id="editFinalGrade" 
                       value="${course.finalGrade || ''}" 
                       min="0" 
                       max="100" 
                       step="0.1"
                       placeholder="اتركه فارغاً">
                <small>اترك الحقل فارغاً إذا لم تحصل على العلامة بعد</small>
            </div>
            <div class="form-group">
                <label for="editCredits">الساعات المعتمدة</label>
                <input type="number" 
                       id="editCredits" 
                       value="${course.credits || 3}" 
                       min="1" 
                       max="6">
            </div>
            <div class="modal-actions">
                <button class="btn btn-success" onclick="saveCourseEdit(${semesterIndex}, ${courseIndex})">
                    <i class="fas fa-save"></i> حفظ
                </button>
                <button class="btn btn-light" onclick="closeEditModal()">
                    <i class="fas fa-times"></i> إلغاء
                </button>
            </div>
        </div>
    `;
    
    // إنشاء وعرض النافذة المنبثقة
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    // إضافة الأنماط
    const style = document.createElement('style');
    style.textContent = `
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        
        .edit-course-modal {
            background: white;
            padding: 25px;
            border-radius: var(--border-radius);
            max-width: 400px;
            width: 90%;
            box-shadow: var(--box-shadow-lg);
        }
        
        .modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            justify-content: flex-end;
        }
    `;
    document.head.appendChild(style);
};

// 22. دالة حفظ التعديلات
window.saveCourseEdit = function(semesterIndex, courseIndex) {
    const finalGradeInput = document.getElementById('editFinalGrade');
    const creditsInput = document.getElementById('editCredits');
    
    let finalGrade = null;
    if (finalGradeInput.value && finalGradeInput.value.trim() !== '') {
        const gradeValue = parseFloat(finalGradeInput.value);
        if (!isNaN(gradeValue) && gradeValue >= 0 && gradeValue <= 100) {
            finalGrade = gradeValue;
        } else {
            showNotification('العلامة يجب أن تكون بين 0 و 100', 'warning');
            return;
        }
    }
    
    const credits = parseInt(creditsInput.value) || 3;
    
    if (credits < 1 || credits > 6) {
        showNotification('الساعات يجب أن تكون بين 1 و 6', 'warning');
        return;
    }
    
    // تحديث البيانات
    userData.semesters[semesterIndex].courses[courseIndex].finalGrade = finalGrade;
    userData.semesters[semesterIndex].courses[courseIndex].credits = credits;
    
    // إغلاق النافذة المنبثقة
    closeEditModal();
    
    // حفظ وتحديث الواجهة
    autoSave();
    renderSemesters();
    updateAllCoursesView();
    updateDashboard();
    updateCharts();
    
    showNotification('تم تعديل المادة بنجاح', 'success');
};

// 23. دالة إغلاق النافذة المنبثقة
window.closeEditModal = function() {
    const modal = document.querySelector('.modal-overlay');
    const style = document.querySelector('style[data-modal-style]');
    
    if (modal) modal.remove();
    if (style) style.remove();
};

// 24. دالة لحذف المادة (محدثة)
window.deleteCourse = function(semesterIndex, courseIndex) {
    const course = userData.semesters[semesterIndex].courses[courseIndex];
    
    if (confirm(`هل أنت متأكد من حذف المادة "${course.name}"؟`)) {
        userData.semesters[semesterIndex].courses.splice(courseIndex, 1);
        
        autoSave();
        renderSemesters();
        updateAllCoursesView();
        updateDashboard();
        updateCharts();
        
        showNotification('تم حذف المادة بنجاح', 'success');
    }
};
        // ============ البحث عن المواد ============
function loadAllCoursesForSearch() {
    const container = document.getElementById('searchResultsContainer');
    const searchInput = document.getElementById('courseSearchInput');
    
    // إذا كان حقل البحث فارغًا، اعرض رسالة
    if (!searchInput || searchInput.value.trim() === '') {
        container.innerHTML = `
            <div class="semester-card" style="text-align: center; padding: 50px;">
                <i class="fas fa-search fa-3x" style="color: var(--gray-medium); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px;">ابحث عن المواد</h3>
                <p style="color: var(--gray-medium); margin-bottom: 25px;">
                    اكتب في شريط البحث للعثور على المواد
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
// دالة لتحديث تقييم المادة
window.rateCourse = async function(courseId, rating) {
    if (!currentUser) {
        showNotification('يجب تسجيل الدخول لتقييم المواد', 'warning');
        return;
    }
    
    try {
        // تحديث في Firestore
        const courseRef = db.collection('courses').doc(courseId);
        const courseDoc = await courseRef.get();
        
        if (courseDoc.exists) {
            const courseData = courseDoc.data();
            const ratings = courseData.ratings || {};
            const totalRatings = courseData.totalRatings || 0;
            const averageRating = courseData.averageRating || 0;
            
            // احسب المعدل الجديد
            const newTotalRatings = totalRatings + 1;
            const newAverage = ((averageRating * totalRatings) + 
                (rating === 'easy' ? 1 : rating === 'medium' ? 2 : 3)) / newTotalRatings;
            
            await courseRef.update({
                ratings: {
                    ...ratings,
                    [currentUser.uid]: rating
                },
                totalRatings: newTotalRatings,
                averageRating: newAverage
            });
            
            // تحديث البيانات المحلية
            const courseIndex = allCourses.findIndex(c => c.id === courseId);
            if (courseIndex !== -1) {
                allCourses[courseIndex].totalRatings = newTotalRatings;
                allCourses[courseIndex].averageRating = newAverage;
            }
            
            showNotification('تم تسجيل تقييمك للمادة', 'success');
            searchCourses(); // تحديث العرض
        }
    } catch (error) {
        console.error('خطأ في تقييم المادة:', error);
        showNotification('حدث خطأ أثناء التقييم', 'error');
    }
};

// في دالة عرض المواد في البحث، عدل العرض ليشمل التقييمات
function updateCourseDisplayInSearch(course) {
    const average = course.averageRating || 0;
    const total = course.totalRatings || 0;
    
    let ratingHTML = '';
    if (total > 0) {
        const stars = Math.round(average);
        ratingHTML = `
            <div style="margin-top: 10px;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="color: #f59e0b;">
                        ${'★'.repeat(stars)}${'☆'.repeat(3-stars)}
                    </span>
                    <span style="font-size: 0.9rem; color: var(--gray-medium);">
                        (${average.toFixed(1)} من ${total} تقييم)
                    </span>
                </div>
            </div>
        `;
    }
    
    return ratingHTML;
}
        // ============ لوحة الإشراف ============
  async function loadAdminData() {
    if (userData.userType !== 'admin') {
        console.log('❌ ليس مشرفاً - لا يمكن تحميل لوحة الإشراف');
        return;
    }
    
    console.log('👑 بدء تحميل بيانات لوحة الإشراف...');
    console.log('المستخدم الحالي:', currentUser?.uid);
    console.log('Firestore متاح:', !!db);
    
    try {
        // 1. تحميل بيانات النظام
        console.log('📥 جاري تحميل بيانات النظام...');
        await loadSystemData();
        
        // 2. التحقق من البيانات المحملة
        console.log('📊 البيانات المحملة:');
        console.log('- عدد الكليات:', colleges.length);
        console.log('- عدد التخصصات:', majors.length);
        console.log('- عدد المواد:', allCourses.length);
        console.log('- عدد المواد الموزعة:', assignedCourses.length);
        
        // 3. تحديث جميع القوائم
        console.log('🔄 تحديث واجهة لوحة الإشراف...');
        
        // تحديث قائمة الكليات
        updateCollegesList();
        console.log('✅ تم تحديث قائمة الكليات');
        
        // تحديث قائمة التخصصات
        updateMajorsList();
        console.log('✅ تم تحديث قائمة التخصصات');
        
        // تحديث قائمة المواد (هذه هي المشكلة الرئيسية)
        console.log('📚 جاري تحديث قائمة المواد...');
        updateCoursesAdminList();
        
        // تحديث خيارات توزيع المواد
        updateAssignForm();
        console.log('✅ تم تحديث خيارات توزيع المواد');
        
        // تحديث قائمة المستخدمين
        updateUsersList();
        console.log('✅ تم تحديث قائمة المستخدمين');
        
        console.log('🎉 تم تحميل لوحة الإشراف بنجاح!');
        
    } catch (error) {
        console.error('❌ خطأ في تحميل بيانات الإشراف:', error);
        showNotification('حدث خطأ في تحميل لوحة الإشراف', 'error');
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
    const year = document.getElementById('newCourseYear').value;
    const semester = document.getElementById('newCourseSemester').value;
    const hasPractical = document.getElementById('newCourseHasPractical').checked;
    
    if (!code || !name) {
        showNotification('يرجى إدخال كود واسم المادة', 'warning');
        return;
    }
    
    try {
        await db.collection('courses').add({
            code: code,
            name: name,
            credits: credits,
            year: year,
            semester: semester,
            hasPractical: hasPractical,
            createdAt: new Date()
        });
        
        document.getElementById('newCourseCode').value = '';
        document.getElementById('newCourseName').value = '';
        document.getElementById('newCourseYear').value = '';
        document.getElementById('newCourseSemester').value = '1';
        document.getElementById('newCourseHasPractical').checked = false;
        
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

// في دالة updateCoursesAdminList - استبدل جدول العرض بالكامل
function updateCoursesAdminList() {
    console.log('🔄 جاري تحديث قائمة المواد في لوحة الإشراف...');
    
    const container = document.getElementById('coursesAdminList');
    const assignCourseSelect = document.getElementById('assignCourse');
    
    if (!container) {
        console.error('❌ عنصر coursesAdminList غير موجود');
        return;
    }
    
    if (!assignCourseSelect) {
        console.error('❌ عنصر assignCourse غير موجود');
    }
    
    // مسح وتهيئة القوائم
    if (assignCourseSelect) {
        assignCourseSelect.innerHTML = '<option value="">اختر المادة</option>';
    }
    
    // التحقق إذا كانت هناك مواد
    if (!allCourses || allCourses.length === 0) {
        console.log('⚠️ لا توجد مواد لعرضها');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-medium);">
                <i class="fas fa-book fa-3x" style="margin-bottom: 15px;"></i>
                <h4 style="margin-bottom: 10px;">لا توجد مواد مضافة بعد</h4>
                <p>استخدم نموذج إضافة المادة لإضافة مواد جديدة</p>
                <button class="btn btn-primary" onclick="switchAdminTab('coursesAdmin')" style="margin-top: 15px;">
                    <i class="fas fa-plus"></i> إضافة مادة
                </button>
            </div>
        `;
        return;
    }
    
    console.log(`📋 عرض ${allCourses.length} مادة في القائمة`);
    
    // بناء HTML لقائمة المواد
    let html = `
        <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0;">
                <i class="fas fa-book"></i> المواد المضافة (${allCourses.length})
            </h4>
        </div>
        <div style="overflow-x: auto; border: 1px solid var(--gray-light); border-radius: var(--border-radius);">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">كود المادة</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">اسم المادة</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">الساعات</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">النوع</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">السنة</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">الفصل</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">عملي</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">تاريخ الإضافة</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid var(--gray-light);">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    allCourses.forEach(course => {
        const typeInfo = courseTypes[course.type] || { name: 'غير محدد' };
        const courseCode = course.code || 'بدون كود';
        const courseName = course.name || 'بدون اسم';
        const credits = course.credits || 3;
        
        // تحويل الفصل الدراسي إلى نص مقروء
        let semesterText = '';
        switch(course.semester) {
            case '1': semesterText = 'الفصل الأول والثاني والصيفي'; break;
            case '2': semesterText = 'الفصل الأول والثاني'; break;
            case '3': semesterText = 'الفصل الأول والصيفي'; break;
            case '4': semesterText = 'الفصل الثاني والصيفي'; break;
            case '5': semesterText = 'الفصل الأول'; break;
            case '6': semesterText = 'الفصل الثاني'; break;
            default: semesterText = course.semester || 'غير محدد';
        }
        
        html += `
            <tr style="border-bottom: 1px solid var(--gray-light);" id="course-row-${course.id}">
                <td style="padding: 15px; font-weight: 600;">${courseCode}</td>
                <td style="padding: 15px;">${courseName}</td>
                <td style="padding: 15px;">${credits}</td>
                <td style="padding: 15px;">${typeInfo.name}</td>
                <td style="padding: 15px;">${course.year ? 'السنة ' + course.year : '-'}</td>
                <td style="padding: 15px;">${semesterText}</td>
                <td style="padding: 15px;">${course.hasPractical ? '✅ نعم' : '❌ لا'}</td>
                <td style="padding: 15px;">${course.createdAt ? new Date(course.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : '-'}</td>
                <td style="padding: 15px;">
                    <button class="btn btn-info btn-sm" onclick="editAdminCourse('${course.id}')" style="margin-left: 5px;">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCourseAdmin('${course.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>
        `;
        
        // إضافة للاختيار في النماذج
        if (assignCourseSelect) {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = `${courseCode} - ${courseName} (${typeInfo.name})`;
            assignCourseSelect.appendChild(option);
        }
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    console.log('✅ تم تحديث قائمة المواد بنجاح');
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

window.editAdminCourse = async function(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    
    // إنشاء نموذج تعديل
    const newName = prompt('اسم المادة:', course.name);
    if (!newName) return;
    
    const newCode = prompt('كود المادة:', course.code || '');
    const newCredits = prompt('الساعات المعتمدة:', course.credits || '3');
    
    try {
        await db.collection('courses').doc(courseId).update({
            name: newName,
            code: newCode,
            credits: parseInt(newCredits) || 3
        });
        
        await loadSystemData();
        updateCoursesAdminList();
        showNotification('تم تعديل المادة بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تعديل المادة:', error);
        showNotification('حدث خطأ أثناء التعديل', 'error');
    }
};

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
    console.log('👤 تحديث واجهة المستخدم للمستخدم المسجل');
    
    // إظهار قسم معلومات المستخدم وإخفاء أزرار المصادقة
    const userInfo = document.getElementById('userInfo');
    const authButtons = document.getElementById('authButtons');
    
    if (userInfo) {
        userInfo.style.display = 'flex';
        console.log('✅ تم إظهار قسم معلومات المستخدم');
    }
    
    if (authButtons) {
        authButtons.style.display = 'none';
        console.log('✅ تم إخفاء أزرار المصادقة');
    }
    
    // تحديث اسم المستخدم والصورة
    const userName = userData.name || currentUser?.displayName || 
                    currentUser?.email?.split('@')[0] || 'مستخدم';
    
    const userNameElement = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userNameElement) {
        userNameElement.textContent = userName;
        console.log('✅ تم تحديث اسم المستخدم:', userName);
    }
    
    if (userAvatar) {
        userAvatar.textContent = getInitials(userName);
        console.log('✅ تم تحديث الصورة الرمزية');
    }
    
    // التحقق من نوع المستخدم وعرض/إخفاء عناصر المشرف
    console.log('🔍 التحقق من نوع المستخدم:', userData.userType);
    
    const adminDivider = document.getElementById('adminDivider');
    const adminNavItem = document.getElementById('adminNavItem');
    const userBadge = document.getElementById('userBadge');
    
    if (userData.userType === 'admin') {
        console.log('👑 المستخدم هو مشرف - إظهار عناصر المشرف');
        
        // إظهار عناصر المشرف
        if (adminDivider) {
            adminDivider.style.display = 'block';
            console.log('✅ تم إظهار الفاصل الإداري');
        }
        
        if (adminNavItem) {
            adminNavItem.style.display = 'block';
            console.log('✅ تم إظهار عنصر لوحة الإشراف');
        }
        
        // تحديث شارة المستخدم
        if (userBadge) {
            userBadge.innerHTML = '<span class="user-badge badge-admin">مشرف</span>';
            userBadge.style.display = 'inline';
            console.log('✅ تم تحديث الشارة إلى مشرف');
        }
    } else {
        console.log('🎓 المستخدم هو طالب - إخفاء عناصر المشرف');
        
        // إخفاء عناصر المشرف
        if (adminDivider) {
            adminDivider.style.display = 'none';
        }
        
        if (adminNavItem) {
            adminNavItem.style.display = 'none';
        }
        
        // تحديث شارة المستخدم
        if (userBadge) {
            userBadge.innerHTML = '<span class="user-badge badge-student">طالب</span>';
            userBadge.style.display = 'inline';
        }
    }
    
    // تحديث لوحة التحكم
    updateDashboard();
    updateProfileUI();
    
    console.log('✅ تم تحديث واجهة المستخدم بنجاح');
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
    updateCollegeAndMajorSelects(profileCollege, profileMajor);
    
    // إظهار/إخفاء حقول الكلية والتخصص للطلاب
    if (studentFields) {
        studentFields.style.display = userData.userType === 'student' ? 'block' : 'none';
    }
    
    // تحديث معلومات الكلية والتخصص في لوحة التحكم
    updateCollegeInfo(userCollegeInfo, currentCollege, currentMajor);
    
    // إضافة معلومات الخطة الدراسية للطلاب
    addStudyPlanInfo();
}

// دالة منفصلة لتحديث قوائم الكليات والتخصصات
function updateCollegeAndMajorSelects(collegeSelect, majorSelect) {
    if (collegeSelect) {
        const currentCollegeValue = collegeSelect.value || userData.college;
        
        // إعادة بناء القائمة
        collegeSelect.innerHTML = '<option value="">اختر كليتك</option>';
        
        if (colleges && colleges.length > 0) {
            colleges.forEach(college => {
                const option = document.createElement('option');
                option.value = college.id;
                option.textContent = college.name;
                
                // تحديد القيمة الحالية
                if (college.id === currentCollegeValue) {
                    option.selected = true;
                }
                
                collegeSelect.appendChild(option);
            });
        } else if (userData.college) {
            // إذا لم تكن الكليات محملة، إضافة الكلية الحالية
            const option = document.createElement('option');
            option.value = userData.college;
            option.textContent = userData.collegeName || 'كليتك';
            option.selected = true;
            collegeSelect.appendChild(option);
        }
        
        // إضافة مستمع الحدث
        collegeSelect.onchange = function() {
            updateMajorSelectBasedOnCollege(majorSelect, this.value);
        };
        
        // تحديث قائمة التخصصات بناءً على الكلية المختارة
        updateMajorSelectBasedOnCollege(majorSelect, currentCollegeValue);
    }
}

// دالة لتحديث قائمة التخصصات بناءً على الكلية
function updateMajorSelectBasedOnCollege(majorSelect, collegeId) {
    if (!majorSelect) return;
    
    const currentMajorValue = majorSelect.value || userData.major;
    
    // إعادة بناء القائمة
    majorSelect.innerHTML = '<option value="">اختر تخصصك</option>';
    
    if (majors && majors.length > 0 && collegeId) {
        const filteredMajors = majors.filter(major => major.collegeId === collegeId);
        
        filteredMajors.forEach(major => {
            const college = colleges.find(c => c.id === major.collegeId);
            const option = document.createElement('option');
            option.value = major.id;
            option.textContent = `${major.name} - ${college?.name || ''}`;
            
            // تحديد القيمة الحالية
            if (major.id === currentMajorValue) {
                option.selected = true;
            }
            
            majorSelect.appendChild(option);
        });
    } else if (userData.major && collegeId === userData.college) {
        // إذا لم تكن التخصصات محملة، إضافة التخصص الحالي
        const option = document.createElement('option');
        option.value = userData.major;
        option.textContent = userData.majorName || 'تخصصك';
        option.selected = true;
        majorSelect.appendChild(option);
    }
}

// دالة لتحديث معلومات الكلية والتخصص
function updateCollegeInfo(userCollegeInfo, currentCollege, currentMajor) {
    if (userCollegeInfo && currentCollege && currentMajor) {
        if (userData.college && userData.major) {
            const college = colleges.find(c => c.id === userData.college);
            const major = majors.find(m => m.id === userData.major);
            
            if (college && major) {
                currentCollege.textContent = college.name;
                currentMajor.textContent = major.name;
                userCollegeInfo.style.display = 'block';
            } else if (userData.studyPlan) {
                // استخدام بيانات من الخطة الدراسية
                currentCollege.textContent = userData.studyPlan.collegeName || 'كلية';
                currentMajor.textContent = userData.studyPlan.majorName || 'تخصص';
                userCollegeInfo.style.display = 'block';
            } else {
                userCollegeInfo.style.display = 'none';
            }
        } else {
            userCollegeInfo.style.display = 'none';
        }
    }
}

// دالة لإضافة معلومات الخطة الدراسية
function addStudyPlanInfo() {
    // إزالة معلومات الخطة القديمة
    const oldPlanInfo = document.querySelector('.plan-info-section');
    if (oldPlanInfo) {
        oldPlanInfo.remove();
    }
    
    // إضافة معلومات الخطة الدراسية للطلاب
    if (userData.userType === 'student' && userData.studyPlanId && userData.studyPlan) {
        const planInfoDiv = document.createElement('div');
        planInfoDiv.className = 'plan-info-section';
        planInfoDiv.style.cssText = 'margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: var(--border-radius); border-right: 4px solid var(--primary-color);';
        planInfoDiv.innerHTML = `
            <h5 style="margin-bottom: 10px; color: var(--primary-color);">
                <i class="fas fa-calendar-check"></i> معلومات الخطة الدراسية
            </h5>
            <p style="margin-bottom: 5px;">
                <strong>اسم الخطة:</strong> ${userData.studyPlan.name || 'غير محدد'}
            </p>
            <p style="margin-bottom: 5px;">
                <strong>عدد المواد:</strong> ${userData.studyPlan.totalCourses || 0} مادة
            </p>
            <p style="margin-bottom: 5px;">
                <strong>إجمالي الساعات:</strong> ${userData.studyPlan.totalCredits || 0} ساعة
            </p>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="btn btn-sm btn-info" onclick="viewStudentStudyPlan()">
                    <i class="fas fa-eye"></i> عرض تفاصيل الخطة
                </button>
                <button class="btn btn-sm btn-light" onclick="refreshStudyPlan()">
                    <i class="fas fa-redo"></i> تحديث الخطة
                </button>
            </div>
        `;
        
        // إضافة إلى قسم معلومات الحساب
        const profileCard = document.querySelector('#profileSection .semester-card');
        if (profileCard) {
            profileCard.appendChild(planInfoDiv);
        }
    }
}

// دالة لعرض خطة الدراسة للطالب
async function viewStudentStudyPlan() {
    if (!userData.studyPlan) {
        showNotification('لا توجد خطة دراسية متاحة', 'warning');
        return;
    }
    
    let detailsHTML = `
        <div style="background: white; padding: 25px; border-radius: var(--border-radius); max-width: 800px; max-height: 80vh; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-color);">
                    <i class="fas fa-calendar-check"></i> ${userData.studyPlan.name}
                </h3>
                <button onclick="closePlanDetailsModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-medium);">&times;</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">الكلية</div>
                    <div style="font-weight: 600; margin-top: 5px;">${userData.studyPlan.collegeName || 'غير معروف'}</div>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">التخصص</div>
                    <div style="font-weight: 600; margin-top: 5px;">${userData.studyPlan.majorName || 'غير معروف'}</div>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">إجمالي الساعات</div>
                    <div style="font-weight: 600; margin-top: 5px; color: var(--primary-color);">${userData.studyPlan.totalCredits || 0} ساعة</div>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">عدد المواد</div>
                    <div style="font-weight: 600; margin-top: 5px; color: var(--success-color);">${userData.studyPlan.totalCourses || 0} مادة</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-book" style="color: var(--primary-color);"></i>
                    المواد في خطتك الدراسية
                </h4>
                
                <div style="max-height: 300px; overflow-y: auto;">
    `;
    
    if (userData.studyPlan.courses && userData.studyPlan.courses.length > 0) {
        // تجميع المواد حسب السنة
        const coursesByYear = {};
        userData.studyPlan.courses.forEach(course => {
            const year = course.year || 'غير محدد';
            if (!coursesByYear[year]) {
                coursesByYear[year] = [];
            }
            coursesByYear[year].push(course);
        });
        
        // عرض المواد حسب السنة
        Object.keys(coursesByYear).sort().forEach(year => {
            detailsHTML += `
                <div style="margin-bottom: 20px;">
                    <h5 style="background: var(--primary-color); color: white; padding: 8px 15px; border-radius: 6px; margin-bottom: 10px;">
                        السنة ${year}
                    </h5>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 10px; text-align: right;">المادة</th>
                                <th style="padding: 10px; text-align: right;">النوع</th>
                                <th style="padding: 10px; text-align: right;">الساعات</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            coursesByYear[year].forEach(course => {
                const typeInfo = courseTypes[course.type] || { name: 'غير محدد' };
                detailsHTML += `
                    <tr style="border-bottom: 1px solid var(--gray-light);">
                        <td style="padding: 10px;">
                            <strong style="color: var(--primary-color);">${course.code || '-'}</strong><br>
                            ${course.name}
                        </td>
                        <td style="padding: 10px;">
                            <span class="course-type type-${course.type}" style="font-size: 0.8rem;">
                                ${typeInfo.name}
                            </span>
                        </td>
                        <td style="padding: 10px; text-align: center;">${course.credits || 3}</td>
                    </tr>
                `;
            });
            
            detailsHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        });
    } else {
        detailsHTML += `
            <div style="text-align: center; padding: 30px; color: var(--gray-medium);">
                <i class="fas fa-book fa-2x" style="margin-bottom: 15px;"></i>
                <p>لا توجد مواد في هذه الخطة</p>
            </div>
        `;
    }
    
    detailsHTML += `
                </div>
            </div>
            
            <div style="text-align: left; margin-top: 20px;">
                <button onclick="closePlanDetailsModal()" class="btn btn-light">
                    <i class="fas fa-times"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    showPlanDetailsModal(detailsHTML);
}

async function updateProfile() {
    const newName = document.getElementById('profileNameInput').value.trim();
    const college = document.getElementById('profileCollege')?.value || '';
    const major = document.getElementById('profileMajor')?.value || '';
    
    if (!newName) {
        showNotification('يرجى إدخال الاسم', 'warning');
        return;
    }
    
    const oldCollege = userData.college;
    const oldMajor = userData.major;
    
    userData.name = newName;
    
    if (userData.userType === 'student') {
        userData.college = college;
        userData.major = major;
        
        // التحقق من صحة القيم
        if (!college || !major) {
            showNotification('يرجى اختيار الكلية والتخصص', 'warning');
            return;
        }
        
        // إذا تغير التخصص أو الكلية، إعادة تحميل خطة الدراسة
        if (oldCollege !== college || oldMajor !== major) {
            userData.studyPlanId = '';
            userData.studyPlan = null;
            
            // إظهار رسالة تحميل
            showNotification('جاري تحديث خطة الدراسة...', 'info');
            
            // تحميل الخطة الجديدة
            await loadStudentStudyPlan();
            
            // إذا لم يتم العثور على خطة
            if (!userData.studyPlanId) {
                showNotification('لم يتم العثور على خطة دراسية لهذا التخصص', 'warning');
            }
        }
    }
    
    // حفظ البيانات
    await autoSave();
    
    // تحديث الواجهة
    updateUIForLoggedInUser();
    updateProfileUI(); // هذا سيحدث القوائم المنسدلة
    updateDashboard();
    updateCourseForm(); // تحديث قائمة المواد المتاحة
    
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

window.setSelectedSemester = function(semesterIndex) {
    console.log('🎯 تحديد الفصل الدراسي:', semesterIndex);
    
    if (semesterIndex < 0 || semesterIndex >= userData.semesters.length) {
        console.error('❌ فهرس الفصل غير صحيح:', semesterIndex);
        showNotification('الفصل الدراسي غير موجود', 'error');
        return;
    }
    
    selectedSemesterIndex = semesterIndex;
    
    // التبديل إلى تبويب إضافة المواد
    switchTab('courses');
    
    // تأخير بسيط ثم تحديث النموذج
    setTimeout(() => {
        // تبديل إلى تبويب إضافة مادة
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const addCourseTabBtn = document.querySelector('.tab-btn[data-tab="addCourse"]');
        if (addCourseTabBtn) {
            addCourseTabBtn.classList.add('active');
        }
        
        const addCourseTab = document.getElementById('addCourseTab');
        if (addCourseTab) {
            addCourseTab.style.display = 'block';
        }
        
        // تحديث نموذج إضافة المادة
        updateCourseForm();
        
        // تحديد الفصل الدراسي في القائمة المنسدلة
        const semesterSelect = document.getElementById('courseSemester');
        if (semesterSelect) {
            semesterSelect.value = semesterIndex;
        }
        
        // عرض رسالة تأكيد
        const semester = userData.semesters[semesterIndex];
        showNotification(`تم تحديد الفصل الدراسي: ${semester.name} (${semester.year})`, 'success');
        
        // تمرير التركيز إلى حقل اسم المادة
        setTimeout(() => {
            const courseNameSelect = document.getElementById('courseName');
            if (courseNameSelect) {
                courseNameSelect.focus();
            }
        }, 300);
    }, 200);
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
        const cleanCourseName = cleanText(course.name || '');
        const weightedMark = (course.finalGrade || 0) * (course.credits || 3);
        const typeInfo = courseTypes[course.type] || { name: '', class: '' };
        
        html += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 15px; min-width: 150px;">
                    <div style="font-weight: 500; margin-bottom: 5px;">${cleanCourseName}</div>
                    ${course.type ? `<small><span class="course-type ${typeInfo.class}">${typeInfo.name}</span></small>` : ''}
                </td>
                <td style="padding: 15px;">${course.semesterName}</td>
                <td style="padding: 15px; font-weight: bold; color: var(--primary-color);">
                    ${course.finalGrade || 0}%
                </td>
                <td style="padding: 15px;">${course.credits}</td>
                <td style="padding: 15px; background: #f0f9ff;">${weightedMark.toFixed(2)}</td>
                <td style="padding: 15px;">
                    <button class="btn btn-info btn-sm" onclick="editCourseInAllView(${course.semesterIndex}, ${course.courseIndex})">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
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
    
    // إضافة معلومات الخطة الدراسية للطلاب
    if (userData.userType === 'student' && userData.studyPlanId) {
        const planInfoDiv = document.getElementById('planDashboardInfo');
        
        if (!planInfoDiv) {
            // إنشاء عنصر جديد إذا لم يكن موجوداً
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection) {
                const newPlanInfo = document.createElement('div');
                newPlanInfo.id = 'planDashboardInfo';
                newPlanInfo.style.cssText = 'background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 20px; border-radius: var(--border-radius); margin-top: 20px; border-right: 4px solid var(--primary-color);';
                newPlanInfo.innerHTML = `
                    <h4 style="margin-bottom: 10px; color: var(--primary-color);">
                        <i class="fas fa-calendar-check"></i> خطة الدراسة الحالية
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                        <div>
                            <div style="color: var(--gray-medium); font-size: 0.9rem;">اسم الخطة</div>
                            <div style="font-weight: 600;">${userData.studyPlan?.name || 'غير محدد'}</div>
                        </div>
                        <div>
                            <div style="color: var(--gray-medium); font-size: 0.9rem;">المواد المتبقية</div>
                            <div style="font-weight: 600; color: var(--warning-color);">
                                ${Math.max(0, (userData.studyPlan?.totalCourses || 0) - totalCourses)} مادة
                            </div>
                        </div>
                        <div>
                            <div style="color: var(--gray-medium); font-size: 0.9rem;">الساعات المتبقية</div>
                            <div style="font-weight: 600; color: var(--warning-color);">
                                ${Math.max(0, (userData.studyPlan?.totalCredits || 0) - userData.totalCredits)} ساعة
                            </div>
                        </div>
                        <div>
                            <div style="color: var(--gray-medium); font-size: 0.9rem;">نسبة الإنجاز</div>
                            <div style="font-weight: 600; color: var(--success-color);">
                                ${userData.studyPlan?.totalCourses ? 
                                    Math.round((totalCourses / userData.studyPlan.totalCourses) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-info" onclick="viewStudentStudyPlan()" style="margin-top: 15px;">
                        <i class="fas fa-eye"></i> عرض تفاصيل الخطة
                    </button>
                `;
                
                // إضافة بعد مخطط المعدل التراكمي
                const chartSection = dashboardSection.querySelector('.chart-section');
                if (chartSection) {
                    chartSection.after(newPlanInfo);
                }
            }
        } else {
            // تحديث العنصر الموجود
            planInfoDiv.querySelector('div:first-child div:last-child').innerHTML = `
                <div style="color: var(--gray-medium); font-size: 0.9rem;">نسبة الإنجاز</div>
                <div style="font-weight: 600; color: var(--success-color);">
                    ${userData.studyPlan?.totalCourses ? 
                        Math.round((totalCourses / userData.studyPlan.totalCourses) * 100) : 0}%
                </div>
            `;
        }
    }
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

async function loadSystemDataForUser() {
    if (!db) {
        console.log('⚠️ Firestore غير متاح للمستخدم العادي');
        return;
    }
    
    try {
        console.log('📥 جاري تحميل بيانات النظام للمستخدم العادي...');
        
        // تحميل الكليات فقط إذا لم تكن محملة مسبقاً
        if (!colleges || colleges.length === 0) {
            console.log('🏛️ جاري تحميل الكليات للمستخدم...');
            const collegesSnapshot = await db.collection('colleges').get();
            colleges = [];
            collegesSnapshot.forEach(doc => {
                colleges.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✅ تم تحميل ${colleges.length} كلية للمستخدم`);
        }
        
        // تحميل التخصصات فقط إذا لم تكن محملة مسبقاً
        if (!majors || majors.length === 0) {
            console.log('🎓 جاري تحميل التخصصات للمستخدم...');
            const majorsSnapshot = await db.collection('majors').get();
            majors = [];
            majorsSnapshot.forEach(doc => {
                majors.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✅ تم تحميل ${majors.length} تخصص للمستخدم`);
        }
        
        // للمستخدم العادي، لا نحتاج لتحميل جميع المواد والتوزيعات إلا عند الحاجة
        console.log('✅ تم تحميل بيانات النظام للمستخدم العادي بنجاح');
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تحميل بيانات النظام للمستخدم:', error);
        // عدم عرض إشعار خطأ للمستخدم حتى لا يقلقه
        return false;
    }
}

// دالة البحث عن المستخدمين
function searchUsers() {
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#usersList tbody tr');
    
    rows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const email = row.cells[1].textContent.toLowerCase();
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// إضافة أزرار التحكم
function addUserControls(user, row) {
    const actionsCell = row.cells[4];
    
    // زر الترقية
    if (user.userType !== 'admin') {
        actionsCell.innerHTML += `
            <button class="btn btn-success btn-sm" onclick="promoteUser('${user.id}')" style="margin-left: 5px;">
                <i class="fas fa-user-shield"></i> ترقية
            </button>
        `;
    }
    
    // زر الحظر
    actionsCell.innerHTML += `
        <button class="btn btn-warning btn-sm" onclick="temporaryBanUser('${user.id}')" style="margin-left: 5px;">
            <i class="fas fa-ban"></i> حظر مؤقت
        </button>
    `;
    
    // زر التنبيه
    actionsCell.innerHTML += `
        <button class="btn btn-danger btn-sm" onclick="warnUser('${user.id}')" style="margin-left: 5px;">
            <i class="fas fa-exclamation-triangle"></i> تنبيه
        </button>
    `;
}

// دوال التحكم
window.promoteUser = async function(userId) {
    if (confirm('هل تريد ترقية هذا المستخدم إلى مشرف؟')) {
        try {
            await db.collection('users').doc(userId).update({
                userType: 'admin'
            });
            showNotification('تم ترقية المستخدم بنجاح', 'success');
            updateUsersList();
        } catch (error) {
            console.error('خطأ في الترقية:', error);
            showNotification('حدث خطأ أثناء الترقية', 'error');
        }
    }
};

window.temporaryBanUser = async function(userId) {
    const duration = prompt('مدة الحظر بالأيام:', '7');
    if (duration) {
        try {
            const banUntil = new Date();
            banUntil.setDate(banUntil.getDate() + parseInt(duration));
            
            await db.collection('users').doc(userId).update({
                bannedUntil: banUntil
            });
            
            showNotification(`تم حظر المستخدم حتى ${banUntil.toLocaleDateString('ar-SA')}`, 'success');
        } catch (error) {
            console.error('خطأ في الحظر:', error);
            showNotification('حدث خطأ أثناء الحظر', 'error');
        }
    }
};

window.warnUser = async function(userId) {
    const reason = prompt('سبب التنبيه:', '');
    if (reason) {
        try {
            await db.collection('users').doc(userId).update({
                warnings: firebase.firestore.FieldValue.arrayUnion({
                    reason: reason,
                    date: new Date(),
                    by: currentUser.uid
                })
            });
            
            showNotification('تم إرسال تنبيه للمستخدم', 'success');
        } catch (error) {
            console.error('خطأ في إرسال التنبيه:', error);
            showNotification('حدث خطأ أثناء إرسال التنبيه', 'error');
        }
    }
};

// دوال إدارة الخطة الدراسية
let selectedCoursesForPlan = [];

function updatePlanMajors() {
    const collegeId = document.getElementById('planCollege').value;
    const majorSelect = document.getElementById('planMajor');
    
    majorSelect.innerHTML = '<option value="">اختر التخصص</option>';
    
    if (!collegeId) return;
    
    const filteredMajors = majors.filter(major => major.collegeId === collegeId);
    filteredMajors.forEach(major => {
        const option = document.createElement('option');
        option.value = major.id;
        option.textContent = major.name;
        majorSelect.appendChild(option);
    });
}

function loadAvailableCourses() {
    const majorId = document.getElementById('planMajor').value;
    const container = document.getElementById('availableCoursesList');
    
    if (!majorId) {
        container.innerHTML = `
            <p style="text-align: center; color: var(--gray-medium); padding: 20px;">
                اختر تخصصاً أولاً لعرض المواد المتاحة
            </p>
        `;
        return;
    }
    
    // عرض جميع المواد
    if (allCourses.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: var(--gray-medium); padding: 20px;">
                لا توجد مواد مضافة بعد
            </p>
        `;
        return;
    }
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">';
    
    allCourses.forEach(course => {
        const isSelected = selectedCoursesForPlan.some(c => c.courseId === course.id && c.majorId === majorId);
        
        html += `
            <div class="course-card ${isSelected ? 'selected' : ''}" 
                 style="border: 2px solid ${isSelected ? 'var(--success-color)' : 'var(--gray-light)'}; 
                        border-radius: var(--border-radius); 
                        padding: 15px; 
                        background: ${isSelected ? '#f0f9ff' : 'white'}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong style="color: var(--primary-color);">${course.code || 'بدون كود'}</strong>
                        <div style="font-weight: 600;">${course.name}</div>
                    </div>
                    <div style="text-align: left;">
                        ${isSelected ? 
                            '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>' : 
                            '<i class="fas fa-plus-circle" style="color: var(--gray-medium);"></i>'}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--gray-medium); margin-bottom: 10px;">
                    <div>
                        <strong>الساعات:</strong> ${course.credits || 3} ساعة
                    </div>
                    ${course.year ? `<div><strong>السنة:</strong> ${course.year}</div>` : ''}
                </div>
                
                ${course.hasPractical ? `
                    <div style="color: var(--primary-color); font-size: 0.9rem; margin-bottom: 10px;">
                        <i class="fas fa-flask"></i> تحتوي على عملي
                    </div>
                ` : ''}
                
                <!-- اختيار نوع المادة للتخصص الحالي -->
                <div class="form-group" style="margin-bottom: 10px;">
                    <label for="courseType-${course.id}">نوع المادة للتخصص</label>
                    <select id="courseType-${course.id}" class="course-type-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--gray-light);">
                        <option value="">اختر النوع</option>
                        <option value="required-university">إجباري جامعة</option>
                        <option value="elective-university">اختياري جامعة</option>
                        <option value="required-college">إجباري كلية</option>
                        <option value="required-major">إجباري تخصص</option>
                        <option value="elective-major">اختياري تخصص</option>
                    </select>
                </div>
                
                <button class="btn btn-sm ${isSelected ? 'btn-danger' : 'btn-primary'}" 
                        style="width: 100%;"
                        onclick="${isSelected ? `removeCourseFromPlan('${course.id}')` : `addCourseToPlan('${course.id}')`}">
                    <i class="fas ${isSelected ? 'fa-trash' : 'fa-plus'}"></i> 
                    ${isSelected ? 'إزالة من الخطة' : 'إضافة للخطة'}
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function filterAvailableCourses() {
    const searchTerm = document.getElementById('courseFilter').value.toLowerCase();
    const courseCards = document.querySelectorAll('#availableCoursesList .course-card');
    
    courseCards.forEach(card => {
        const courseCode = card.querySelector('strong').textContent.toLowerCase();
        const courseName = card.querySelector('div[style*="font-weight: 600"]').textContent.toLowerCase();
        
        if (courseCode.includes(searchTerm) || courseName.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function addCourseToPlan(courseId) {
    const majorId = document.getElementById('planMajor').value;
    if (!majorId) {
        showNotification('يرجى اختيار التخصص أولاً', 'warning');
        return;
    }
    
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    
    const courseTypeSelect = document.getElementById(`courseType-${courseId}`);
    const courseType = courseTypeSelect ? courseTypeSelect.value : '';
    
    if (!courseType) {
        showNotification('يرجى اختيار نوع المادة للتخصص', 'warning');
        return;
    }
    
    // التحقق إذا كانت المادة مضافة بالفعل لهذا التخصص
    const existingIndex = selectedCoursesForPlan.findIndex(c => 
        c.courseId === courseId && c.majorId === majorId
    );
    
    if (existingIndex >= 0) {
        // تحديث نوع المادة إذا كانت موجودة
        selectedCoursesForPlan[existingIndex].courseType = courseType;
        showNotification('تم تحديث نوع المادة', 'info');
    } else {
        // إضافة المادة للخطة
        selectedCoursesForPlan.push({
            courseId: course.id,
            majorId: majorId,
            code: course.code,
            name: course.name,
            credits: course.credits || 3,
            courseType: courseType, // نوع المادة للتخصص
            year: course.year,
            hasPractical: course.hasPractical || false
        });
        showNotification('تم إضافة المادة للخطة', 'success');
    }
    
    // تحديث العرض
    loadAvailableCourses();
    updateSelectedCoursesList();
}

function removeCourseFromPlan(courseId) {
    const majorId = document.getElementById('planMajor').value;
    const index = selectedCoursesForPlan.findIndex(c => 
        c.courseId === courseId && c.majorId === majorId
    );
    
    if (index >= 0) {
        selectedCoursesForPlan.splice(index, 1);
        showNotification('تم إزالة المادة من الخطة', 'success');
        loadAvailableCourses();
        updateSelectedCoursesList();
    }
}

function toggleCourseForPlan(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    
    const existingIndex = selectedCoursesForPlan.findIndex(c => c.id === courseId);
    
    if (existingIndex >= 0) {
        // إزالة المادة إذا كانت مختارة
        selectedCoursesForPlan.splice(existingIndex, 1);
    } else {
        // إضافة المادة إذا لم تكن مختارة
        selectedCoursesForPlan.push({
            id: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits || 3,
            type: course.type,
            year: course.year,
            hasPractical: course.hasPractical || false
        });
    }
    
    // تحديث العرض
    loadAvailableCourses();
    updateSelectedCoursesList();
}

function updateSelectedCoursesList() {
    const container = document.getElementById('selectedCoursesList');
    const totalCredits = document.getElementById('totalPlanCredits');
    const totalCourses = document.getElementById('totalPlanCourses');
    
    if (selectedCoursesForPlan.length === 0) {
        container.innerHTML = `
            <i class="fas fa-book fa-2x" style="margin-bottom: 10px;"></i>
            <p>لم يتم اختيار أي مواد بعد</p>
        `;
        totalCredits.textContent = '0';
        totalCourses.textContent = '0';
        return;
    }
    
    // حساب إجمالي الساعات
    const total = selectedCoursesForPlan.reduce((sum, course) => sum + (course.credits || 3), 0);
    
    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 10px; text-align: right;">المادة</th>
                        <th style="padding: 10px; text-align: right;">النوع</th>
                        <th style="padding: 10px; text-align: right;">الساعات</th>
                        <th style="padding: 10px; text-align: right;">الإجراء</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    selectedCoursesForPlan.forEach((course, index) => {
        const typeInfo = courseTypes[course.type] || { name: 'غير محدد', class: '' };
        
        html += `
            <tr style="border-bottom: 1px solid var(--gray-light);">
                <td style="padding: 10px;">
                    <strong>${course.code || ''}</strong><br>
                    ${course.name}
                </td>
                <td style="padding: 10px;">
                    <span class="course-type ${typeInfo.class}">${typeInfo.name}</span>
                </td>
                <td style="padding: 10px;">${course.credits || 3}</td>
                <td style="padding: 10px;">
                    <button class="btn btn-sm btn-danger" onclick="removeCourseFromPlan(${index})">
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
    `;
    
    container.innerHTML = html;
    totalCredits.textContent = total;
    totalCourses.textContent = selectedCoursesForPlan.length;
}

function removeCourseFromPlan(index) {
    selectedCoursesForPlan.splice(index, 1);
    loadAvailableCourses();
    updateSelectedCoursesList();
}

async function createStudyPlan() {
    const planName = document.getElementById('planName').value.trim();
    const majorId = document.getElementById('planMajor').value;
    const collegeId = document.getElementById('planCollege').value;
    
    if (!planName) {
        showNotification('يرجى إدخال اسم الخطة', 'warning');
        return;
    }
    
    if (!majorId) {
        showNotification('يرجى اختيار التخصص', 'warning');
        return;
    }
    
    const filteredCourses = selectedCoursesForPlan.filter(c => c.majorId === majorId);
    
    if (filteredCourses.length === 0) {
        showNotification('يرجى اختيار مواد للخطة', 'warning');
        return;
    }
    
    try {
        const major = majors.find(m => m.id === majorId);
        const college = colleges.find(c => c.id === collegeId);
        
        const planData = {
            name: planName,
            majorId: majorId,
            majorName: major ? major.name : 'غير معروف',
            collegeId: collegeId,
            collegeName: college ? college.name : 'غير معروف',
            courses: filteredCourses.map(course => ({
                courseId: course.courseId,
                code: course.code,
                name: course.name,
                credits: course.credits,
                type: course.courseType, // نوع المادة للتخصص
                year: course.year,
                hasPractical: course.hasPractical
            })),
            totalCredits: filteredCourses.reduce((sum, c) => sum + (c.credits || 3), 0),
            totalCourses: filteredCourses.length,
            createdAt: new Date(),
            createdBy: currentUser.uid,
            status: 'active'
        };
        
        await db.collection('studyPlans').add(planData);
        
        // إعادة تعيين النموذج
        document.getElementById('planName').value = '';
        document.getElementById('planCollege').value = '';
        document.getElementById('planMajor').innerHTML = '<option value="">اختر التخصص</option>';
        selectedCoursesForPlan = selectedCoursesForPlan.filter(c => c.majorId !== majorId);
        loadAvailableCourses();
        updateSelectedCoursesList();
        
        showNotification('تم إنشاء الخطة الدراسية بنجاح', 'success');
        
        // تحميل الخطط المنشورة
        loadStudyPlans();
        
        // التبديل إلى تبويب الخطط المنشورة
        switchAdminTab('publishedPlans');
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الخطة:', error);
        showNotification('حدث خطأ أثناء إنشاء الخطة', 'error');
    }
}

async function loadStudyPlans() {
    const container = document.getElementById('plansList');
    
    try {
        console.log('📘 جاري تحميل الخطط المنشورة...');
        
        // مسح المحتوى الحالي
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-medium);">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p>جاري تحميل الخطط...</p>
            </div>
        `;
        
        const plansSnapshot = await db.collection('studyPlans').orderBy('createdAt', 'desc').get();
        
        // إعادة تهيئة المصفوفة
        studyPlans = [];
        
        if (plansSnapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--gray-medium);">
                    <i class="fas fa-calendar-alt fa-3x" style="margin-bottom: 15px;"></i>
                    <h4 style="margin-bottom: 10px;">لا توجد خطط منشورة بعد</h4>
                    <p>استخدم تبويب "إنشاء خطة" لإنشاء أول خطة دراسية</p>
                    <button class="btn btn-primary" onclick="switchAdminTab('plan')" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> إنشاء خطة جديدة
                    </button>
                </div>
            `;
            console.log('📭 لا توجد خطط منشورة');
            return;
        }
        
        plansSnapshot.forEach(doc => {
            const planData = doc.data();
            studyPlans.push({ 
                id: doc.id, 
                ...planData,
                // معالجة التاريخ
                createdAt: planData.createdAt ? (planData.createdAt.toDate ? planData.createdAt.toDate() : new Date(planData.createdAt)) : new Date()
            });
        });
        
        console.log(`✅ تم تحميل ${studyPlans.length} خطة دراسية`);
        
        // تحديث واجهة المستخدم
        renderStudyPlansList();
        
    } catch (error) {
        console.error('❌ خطأ في تحميل الخطط:', error);
        console.error('تفاصيل الخطأ:', error.message);
        container.innerHTML = `
            <div class="semester-card" style="text-align: center; padding: 40px; color: var(--danger-color);">
                <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px;"></i>
                <h4 style="margin-bottom: 10px;">حدث خطأ في تحميل الخطط</h4>
                <p style="color: var(--gray-medium); margin-bottom: 15px;">${error.message}</p>
                <button class="btn btn-primary" onclick="loadStudyPlans()">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }
}

function renderStudyPlansList() {
    const container = document.getElementById('plansList');
    
    if (!studyPlans || studyPlans.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray-medium);">
                <i class="fas fa-calendar-alt fa-3x" style="margin-bottom: 15px;"></i>
                <h4 style="margin-bottom: 10px;">لا توجد خطط منشورة بعد</h4>
                <p>استخدم تبويب "إنشاء خطة" لإنشاء أول خطة دراسية</p>
                <button class="btn btn-primary" onclick="switchAdminTab('plan')" style="margin-top: 15px;">
                    <i class="fas fa-plus"></i> إنشاء خطة جديدة
                </button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <h4 style="margin: 0;">
                <i class="fas fa-calendar-check"></i> الخطط المنشورة (${studyPlans.length})
            </h4>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
    `;
    
    studyPlans.forEach(plan => {
        // تحويل التاريخ
        const date = plan.createdAt;
        const dateStr = date ? date.toLocaleDateString('ar-SA') : 'غير محدد';
        
        html += `
            <div class="semester-card" style="margin: 0; position: relative;" data-plan-id="${plan.id}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 5px; color: var(--primary-color);">${plan.name || 'بدون اسم'}</h4>
                        <p style="color: var(--gray-medium); font-size: 0.9rem;">
                            <i class="fas fa-university"></i> ${plan.collegeName || 'غير معروف'}
                            <br>
                            <i class="fas fa-graduation-cap"></i> ${plan.majorName || 'غير معروف'}
                        </p>
                    </div>
                    <span class="course-type type-required-major" style="flex-shrink: 0;">خطة دراسية</span>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                        <span><i class="fas fa-book"></i> <strong>المواد:</strong> ${plan.totalCourses || 0}</span>
                        <span><i class="fas fa-clock"></i> <strong>الساعات:</strong> ${plan.totalCredits || 0}</span>
                        <span style="background: #e0f2fe; padding: 3px 10px; border-radius: 15px; font-size: 0.8rem;">
                            <i class="fas fa-calendar"></i> ${dateStr}
                        </span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-start; flex-wrap: wrap;">
                    <button class="btn btn-sm btn-info" onclick="viewPlanDetails('${plan.id}')">
                        <i class="fas fa-eye"></i> عرض التفاصيل
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="editStudyPlan('${plan.id}')">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deletePlan('${plan.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function searchPlans() {
    const searchTerm = document.getElementById('searchPlansInput').value.toLowerCase();
    const containers = document.querySelectorAll('#plansList .semester-card');
    
    containers.forEach(container => {
        const planName = container.querySelector('h4').textContent.toLowerCase();
        const collegeName = container.querySelector('p').textContent.toLowerCase();
        
        if (planName.includes(searchTerm) || collegeName.includes(searchTerm)) {
            container.style.display = '';
        } else {
            container.style.display = 'none';
        }
    });
}

async function deletePlan(planId) {
    if (confirm('هل أنت متأكد من حذف هذه الخطة الدراسية؟')) {
        try {
            await db.collection('studyPlans').doc(planId).delete();
            showNotification('تم حذف الخطة الدراسية بنجاح', 'success');
            loadStudyPlans();
        } catch (error) {
            console.error('❌ خطأ في حذف الخطة:', error);
            showNotification('حدث خطأ أثناء حذف الخطة', 'error');
        }
    }
}

function viewPlanDetails(planId) {
    const plan = studyPlans.find(p => p.id === planId);
    if (!plan) {
        showNotification('الخطة غير موجودة', 'error');
        return;
    }
    
    let detailsHTML = `
        <div style="background: white; padding: 25px; border-radius: var(--border-radius); max-width: 800px; max-height: 80vh; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--primary-color);">${plan.name}</h3>
                <button onclick="closePlanDetailsModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-medium);">&times;</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">الكلية</div>
                    <div style="font-weight: 600; margin-top: 5px;">${plan.collegeName || 'غير معروف'}</div>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">التخصص</div>
                    <div style="font-weight: 600; margin-top: 5px;">${plan.majorName || 'غير معروف'}</div>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">إجمالي الساعات</div>
                    <div style="font-weight: 600; margin-top: 5px; color: var(--primary-color);">${plan.totalCredits || 0} ساعة</div>
                </div>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: var(--border-radius);">
                    <div style="color: var(--gray-medium); font-size: 0.9rem;">عدد المواد</div>
                    <div style="font-weight: 600; margin-top: 5px; color: var(--success-color);">${plan.totalCourses || 0} مادة</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-book" style="color: var(--primary-color);"></i>
                    المواد المضمنة في الخطة
                </h4>
                
                <div style="max-height: 300px; overflow-y: auto;">
    `;
    
    if (plan.courses && plan.courses.length > 0) {
        detailsHTML += `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="background: #f1f5f9; position: sticky; top: 0;">
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-light);">كود المادة</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-light);">اسم المادة</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-light);">النوع</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-light);">الساعات</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid var(--gray-light);">السنة</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // ترتيب المواد حسب السنة أولاً
        const sortedCourses = [...plan.courses].sort((a, b) => {
            const yearA = a.year || 0;
            const yearB = b.year || 0;
            return yearA - yearB;
        });
        
        sortedCourses.forEach(course => {
            const typeInfo = courseTypes[course.type] || { name: 'غير محدد' };
            detailsHTML += `
                <tr style="border-bottom: 1px solid var(--gray-light);">
                    <td style="padding: 12px; font-weight: 600; color: var(--primary-color);">
                        ${course.code || '-'}
                    </td>
                    <td style="padding: 12px;">${course.name}</td>
                    <td style="padding: 12px;">
                        <span class="course-type type-${course.type}" style="font-size: 0.8rem;">
                            ${typeInfo.name}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center;">${course.credits || 3}</td>
                    <td style="padding: 12px; text-align: center;">${course.year ? 'السنة ' + course.year : '-'}</td>
                </tr>
            `;
        });
        
        detailsHTML += `
                </tbody>
            </table>
        `;
    } else {
        detailsHTML += `
            <div style="text-align: center; padding: 30px; color: var(--gray-medium);">
                <i class="fas fa-book fa-2x" style="margin-bottom: 15px;"></i>
                <p>لا توجد مواد في هذه الخطة</p>
            </div>
        `;
    }
    
    detailsHTML += `
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-start; margin-top: 20px;">
                <button onclick="editStudyPlan('${plan.id}')" class="btn btn-warning">
                    <i class="fas fa-edit"></i> تعديل الخطة
                </button>
                <button onclick="closePlanDetailsModal()" class="btn btn-light">
                    <i class="fas fa-times"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    showPlanDetailsModal(detailsHTML);
}
// إضافة مستمعات الأحداث
document.addEventListener('DOMContentLoaded', function() {
    // ... الأحداث الحالية ...
    
    // أحداث الخطة الدراسية
    document.getElementById('planCollege')?.addEventListener('change', updatePlanMajors);
    document.getElementById('planMajor')?.addEventListener('change', loadAvailableCourses);
    
    // أحداث الفلاتر
    ['filterRequiredUni', 'filterElectiveUni', 'filterRequiredCollege', 
     'filterRequiredMajor', 'filterElectiveMajor', 'filterYear'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadAvailableCourses);
    });
    
    document.getElementById('createPlanBtn')?.addEventListener('click', createStudyPlan);
    document.getElementById('clearPlanBtn')?.addEventListener('click', () => {
        if (confirm('هل تريد مسح الخطة الحالية؟')) {
            selectedCoursesForPlan = [];
            loadAvailableCourses();
            updateSelectedCoursesList();
        }
    });
    
});

// متغير لتخزين الخطة الحالية للتعديل
let currentEditingPlan = null;

async function editStudyPlan(planId) {
    console.log('✏️ تعديل الخطة:', planId);
    
    try {
        // إظهار مؤشر التحميل
        showNotification('جاري تحميل بيانات الخطة...', 'info');
        
        // الحصول على بيانات الخطة من Firestore
        const planDoc = await db.collection('studyPlans').doc(planId).get();
        
        if (!planDoc.exists) {
            showNotification('الخطة غير موجودة', 'error');
            return;
        }
        
        const planData = planDoc.data();
        
        // تخزين الخطة الحالية للتعديل
        currentEditingPlan = {
            id: planId,
            ...planData
        };
        
        // التحويل إلى تبويب إنشاء الخطة
        switchAdminTab('plan');
        
        // تأخير لضمان تحميل الصفحة أولاً
        setTimeout(() => {
            // تعبئة النموذج ببيانات الخطة
            document.getElementById('planName').value = planData.name || '';
            
            // اختيار الكلية
            const collegeSelect = document.getElementById('planCollege');
            if (collegeSelect && planData.collegeId) {
                collegeSelect.value = planData.collegeId;
                
                // تشغيل حدث تغيير الكلية لتحميل التخصصات
                const event = new Event('change');
                collegeSelect.dispatchEvent(event);
                
                // بعد تحميل التخصصات، اختيار التخصص
                setTimeout(() => {
                    const majorSelect = document.getElementById('planMajor');
                    if (majorSelect && planData.majorId) {
                        majorSelect.value = planData.majorId;
                        
                        // تشغيل حدث تغيير التخصص لتحميل المواد
                        const majorEvent = new Event('change');
                        majorSelect.dispatchEvent(majorEvent);
                        
                        // بعد تحميل المواد، تحميل المواد المختارة
                        setTimeout(() => {
                            // تحميل المواد المختارة
                            if (planData.courses && Array.isArray(planData.courses)) {
                                // تصفية المواد الخاصة بهذا التخصص فقط
                                selectedCoursesForPlan = selectedCoursesForPlan.filter(c => 
                                    c.majorId !== planData.majorId
                                );
                                
                                // إضافة مواد الخطة إلى القائمة المختارة
                                planData.courses.forEach(course => {
                                    selectedCoursesForPlan.push({
                                        courseId: course.courseId || course.id,
                                        majorId: planData.majorId,
                                        code: course.code,
                                        name: course.name,
                                        credits: course.credits || 3,
                                        courseType: course.type || course.courseType,
                                        year: course.year,
                                        hasPractical: course.hasPractical || false
                                    });
                                });
                                
                                // تحديث العرض
                                loadAvailableCourses();
                                updateSelectedCoursesList();
                            }
                        }, 500);
                    }
                }, 300);
            }
            
            // تغيير زر الإنشاء إلى تحديث
            const createBtn = document.getElementById('createPlanBtn');
            if (createBtn) {
                createBtn.innerHTML = '<i class="fas fa-save"></i> تحديث الخطة';
                createBtn.onclick = () => updateStudyPlan(planId);
                createBtn.className = 'btn btn-warning btn-lg';
            }
            
            // إضافة زر إلغاء التعديل
            const clearBtn = document.getElementById('clearPlanBtn');
            if (clearBtn) {
                clearBtn.innerHTML = '<i class="fas fa-times"></i> إلغاء التعديل';
                clearBtn.onclick = cancelEditPlan;
            }
            
            showNotification('تم تحميل بيانات الخطة للتعديل', 'success');
        }, 500);
        
    } catch (error) {
        console.error('❌ خطأ في تحميل الخصة للتعديل:', error);
        showNotification('حدث خطأ أثناء تحميل الخطة', 'error');
    }
}

async function updateStudyPlan(planId) {
    const planName = document.getElementById('planName').value.trim();
    const majorId = document.getElementById('planMajor').value;
    const collegeId = document.getElementById('planCollege').value;
    
    if (!planName) {
        showNotification('يرجى إدخال اسم الخطة', 'warning');
        return;
    }
    
    if (!majorId) {
        showNotification('يرجى اختيار التخصص', 'warning');
        return;
    }
    
    const filteredCourses = selectedCoursesForPlan.filter(c => c.majorId === majorId);
    
    if (filteredCourses.length === 0) {
        showNotification('يرجى اختيار مواد للخطة', 'warning');
        return;
    }
    
    try {
        const major = majors.find(m => m.id === majorId);
        const college = colleges.find(c => c.id === collegeId);
        
        const updatedPlanData = {
            name: planName,
            majorId: majorId,
            majorName: major ? major.name : 'غير معروف',
            collegeId: collegeId,
            collegeName: college ? college.name : 'غير معروف',
            courses: filteredCourses.map(course => ({
                courseId: course.courseId,
                code: course.code,
                name: course.name,
                credits: course.credits,
                type: course.courseType,
                year: course.year,
                hasPractical: course.hasPractical
            })),
            totalCredits: filteredCourses.reduce((sum, c) => sum + (c.credits || 3), 0),
            totalCourses: filteredCourses.length,
            updatedAt: new Date()
        };
        
        // تحديث الخطة في Firestore
        await db.collection('studyPlans').doc(planId).update(updatedPlanData);
        
        showNotification('تم تحديث الخطة الدراسية بنجاح', 'success');
        
        // إعادة تعيين الواجهة
        resetPlanForm();
        
        // تحميل الخطط المنشورة مجدداً
        loadStudyPlans();
        
        // التبديل إلى تبويب الخطط المنشورة
        switchAdminTab('publishedPlans');
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الخطة:', error);
        showNotification('حدث خطأ أثناء تحديث الخطة', 'error');
    }
}

function cancelEditPlan() {
    if (confirm('هل تريد إلغاء التعديل؟ سيتم فقدان جميع التغييرات.')) {
        resetPlanForm();
        showNotification('تم إلغاء التعديل', 'info');
    }
}

function resetPlanForm() {
    // إعادة تعيين النموذج
    document.getElementById('planName').value = '';
    document.getElementById('planCollege').value = '';
    document.getElementById('planMajor').innerHTML = '<option value="">اختر التخصص</option>';
    
    // إعادة تعيين القائمة المختارة
    if (currentEditingPlan && currentEditingPlan.majorId) {
        selectedCoursesForPlan = selectedCoursesForPlan.filter(c => 
            c.majorId !== currentEditingPlan.majorId
        );
    }
    
    loadAvailableCourses();
    updateSelectedCoursesList();
    
    // إعادة تعيين الأزرار
    const createBtn = document.getElementById('createPlanBtn');
    if (createBtn) {
        createBtn.innerHTML = '<i class="fas fa-save"></i> إنشاء الخطة الدراسية';
        createBtn.onclick = createStudyPlan;
        createBtn.className = 'btn btn-success btn-lg';
    }
    
    const clearBtn = document.getElementById('clearPlanBtn');
    if (clearBtn) {
        clearBtn.innerHTML = '<i class="fas fa-trash"></i> مسح الخطة';
        clearBtn.onclick = () => {
            const majorId = document.getElementById('planMajor').value;
            if (!majorId) {
                showNotification('لم يتم اختيار تخصص', 'warning');
                return;
            }
            if (confirm('هل تريد مسح جميع المواد المختارة لهذا التخصص؟')) {
                selectedCoursesForPlan = selectedCoursesForPlan.filter(c => c.majorId !== majorId);
                loadAvailableCourses();
                updateSelectedCoursesList();
                showNotification('تم مسح الخطة', 'success');
            }
        };
    }
    
    // إعادة تعيين الخطة الحالية
    currentEditingPlan = null;
}

function showPlanDetailsModal(content) {
    // إزالة أي نافذة سابقة
    const existingModal = document.getElementById('planDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // إنشاء النافذة المنبثقة
    const modalHTML = `
        <div class="modal-overlay" id="planDetailsModal">
            ${content}
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // إضافة مستمع لإغلاق النافذة بالنقر خارجها
    const modal = document.getElementById('planDetailsModal');
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closePlanDetailsModal();
        }
    });
    
    // إضافة أنماط إذا لم تكن موجودة
    if (!document.querySelector('#planDetailsStyles')) {
        const styles = `
            <style id="planDetailsStyles">
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    padding: 20px;
                    animation: fadeIn 0.3s ease;
                }
                
                .modal-overlay > div {
                    animation: slideUp 0.3s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

window.closePlanDetailsModal = function() {
    const modal = document.getElementById('planDetailsModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    
    // إضافة الأنماط للخروج
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    setTimeout(() => {
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, 500);
};

async function refreshStudyPlan() {
    if (!userData.college || !userData.major) {
        showNotification('يرجى تحديد الكلية والتخصص أولاً', 'warning');
        return;
    }
    
    showNotification('جاري تحديث خطة الدراسة...', 'info');
    
    try {
        await loadStudentStudyPlan();
        
        if (userData.studyPlan) {
            updateDashboard();
            updateCourseForm();
            showNotification('تم تحديث خطة الدراسة بنجاح', 'success');
        } else {
            showNotification('لم يتم العثور على خطة دراسية جديدة', 'warning');
        }
    } catch (error) {
        console.error('❌ خطأ في تحديث الخطة:', error);
        showNotification('حدث خطأ أثناء تحديث الخطة', 'error');
    }
}

window.viewStudentStudyPlan = viewStudentStudyPlan;

function closePlanDetailsModal() {
    const modal = document.getElementById('planDetailsModal');
    const style = document.querySelector('style:last-child');
    
    if (modal) modal.remove();
    if (style && style.textContent.includes('.modal-overlay')) style.remove();
}

// في مستمعات الأحداث
document.getElementById('clearPlanBtn')?.addEventListener('click', () => {
    const majorId = document.getElementById('planMajor').value;
    
    if (!majorId) {
        showNotification('لم يتم اختيار تخصص', 'warning');
        return;
    }
    
    if (confirm('هل تريد مسح جميع المواد المختارة لهذا التخصص؟')) {
        // إزالة المواد المختارة لهذا التخصص فقط
        selectedCoursesForPlan = selectedCoursesForPlan.filter(c => c.majorId !== majorId);
        loadAvailableCourses();
        updateSelectedCoursesList();
        showNotification('تم مسح الخطة', 'success');
    }
});

// دالة لفحص حالة البيانات
function checkDataStatus() {
    console.log('🔍 فحص حالة البيانات:');
    console.log('- نوع المستخدم:', userData.userType);
    console.log('- الكلية:', userData.college);
    console.log('- التخصص:', userData.major);
    console.log('- معرف الخطة:', userData.studyPlanId);
    console.log('- بيانات الخطة:', userData.studyPlan);
    console.log('- عدد الكليات في النظام:', colleges.length);
    console.log('- عدد التخصصات في النظام:', majors.length);
    console.log('- عدد المواد في النظام:', allCourses.length);
}

// استدعاء عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    // ... الكود الحالي ...
    
    // إضافة فحص بعد التحميل
    setTimeout(checkDataStatus, 2000);
});

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
