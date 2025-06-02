    import React, { useState, useEffect } from 'react';
    import { initializeApp } from 'firebase/app';
    import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
    import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

    // Tailwind CSS is assumed to be available

    function App() {
        // Firebase variables will be initialized in useEffect
        const [db, setDb] = useState(null);
        const [auth, setAuth] = useState(null);
        const [userId, setUserId] = useState(null);
        const [isAuthenticated, setIsAuthenticated] = useState(false);
        const [isAdmin, setIsAdmin] = useState(false); // To distinguish admin from regular authenticated users
        const [loadingFirebase, setLoadingFirebase] = useState(true);
        const [authError, setAuthError] = useState('');

        // State for public site content
        const [posts, setPosts] = useState([]);
        const [loadingPosts, setLoadingPosts] = useState(true);

        // State for admin panel forms
        const [newPostTitle, setNewPostTitle] = useState('');
        const [newPostContent, setNewPostContent] = useState('');
        const [editingPost, setEditingPost] = useState(null); // Stores the post being edited

        // Admin credentials (for demonstration purposes only)
        // In a real application, you would manage this more securely.
        // Make sure to create this user in Firebase Authentication manually.
        const ADMIN_EMAIL = 'abdulrgeb0@gmail.com';
        const ADMIN_PASSWORD = 'abdulrgeb0@gmail.com'; // **Change this to a strong password!**

        useEffect(() => {
            // Initialize Firebase
            try {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestore);
                setAuth(firebaseAuth);

                // Set up authentication state listener
                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setIsAuthenticated(true);
                        // Check if the authenticated user is the admin
                        setIsAdmin(user.email === ADMIN_EMAIL);
                    } else {
                        setUserId(null);
                        setIsAuthenticated(false);
                        setIsAdmin(false);
                        // Sign in anonymously if no initial token is provided (for public access)
                        if (typeof __initial_auth_token === 'undefined') {
                            await signInAnonymously(firebaseAuth);
                        }
                    }
                    setLoadingFirebase(false);
                });

                // Handle initial custom token sign-in if available
                const initialSignIn = async () => {
                    if (typeof __initial_auth_token !== 'undefined' && firebaseAuth && !firebaseAuth.currentUser) {
                        try {
                            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                        } catch (error) {
                            console.error("Error signing in with custom token:", error);
                            // Optionally, sign in anonymously if custom token fails
                            await signInAnonymously(firebaseAuth);
                        }
                    }
                };
                initialSignIn();

                return () => unsubscribe(); // Cleanup auth listener
            } catch (error) {
                console.error("Failed to initialize Firebase:", error);
                setLoadingFirebase(false);
            }
        }, []);

        useEffect(() => {
            // Fetch posts when db is ready
            if (db) {
                const postsCollectionRef = collection(db, `artifacts/${userId}/public/data/posts`); // Public content path

                // Use onSnapshot for real-time updates
                const unsubscribe = onSnapshot(postsCollectionRef, (snapshot) => {
                    const fetchedPosts = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    // Sort posts by timestamp in descending order (newest first)
                    fetchedPosts.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
                    setPosts(fetchedPosts);
                    setLoadingPosts(false);
                }, (error) => {
                    console.error("Error fetching posts:", error);
                    setLoadingPosts(false);
                });

                return () => unsubscribe(); // Cleanup snapshot listener
            }
        }, [db, userId]); // Re-run if db or userId changes (userId changes after auth)

        // --- Authentication Functions ---
        const handleLogin = async (email, password) => {
            setAuthError('');
            try {
                await signInWithEmailAndPassword(auth, email, password);
                // setIsAdmin(true) will be handled by onAuthStateChanged listener
            } catch (error) {
                console.error("Login error:", error);
                setAuthError('فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
            }
        };

        const handleLogout = async () => {
            try {
                await signOut(auth);
                // After signOut, onAuthStateChanged will set isAuthenticated/isAdmin to false
            } catch (error) {
                console.error("Logout error:", error);
            }
        };

        // --- Content Management Functions (Admin Only) ---
        const addPost = async () => {
            if (!newPostTitle || !newPostContent) {
                alert('الرجاء إدخال عنوان ومحتوى للمقالة.');
                return;
            }
            if (!db || !userId) {
                alert('خطأ: قاعدة البيانات غير جاهزة أو المستخدم غير معرف.');
                return;
            }
            try {
                await addDoc(collection(db, `artifacts/${userId}/public/data/posts`), {
                    title: newPostTitle,
                    content: newPostContent,
                    timestamp: new Date(),
                    author: auth.currentUser.email // Store author's email
                });
                setNewPostTitle('');
                setNewPostContent('');
                alert('تمت إضافة المقالة بنجاح!');
            } catch (e) {
                console.error("Error adding document: ", e);
                alert('حدث خطأ أثناء إضافة المقالة.');
            }
        };

        const updatePost = async () => {
            if (!editingPost || !editingPost.id || !editingPost.title || !editingPost.content) {
                alert('الرجاء تحديد مقالة للتعديل وإدخال عنوان ومحتوى.');
                return;
            }
            if (!db || !userId) {
                alert('خطأ: قاعدة البيانات غير جاهزة أو المستخدم غير معرف.');
                return;
            }
            try {
                const postRef = doc(db, `artifacts/${userId}/public/data/posts`, editingPost.id);
                await updateDoc(postRef, {
                    title: editingPost.title,
                    content: editingPost.content,
                    // Do not update timestamp here if you want to preserve original creation time
                    // or update it if you want to mark it as last modified
                });
                setEditingPost(null); // Exit editing mode
                alert('تم تحديث المقالة بنجاح!');
            } catch (e) {
                console.error("Error updating document: ", e);
                alert('حدث خطأ أثناء تحديث المقالة.');
            }
        };

        const deletePost = async (id) => {
            if (!db || !userId) {
                alert('خطأ: قاعدة البيانات غير جاهزة أو المستخدم غير معرف.');
                return;
            }
            // Custom confirmation dialog (instead of window.confirm)
            const confirmDelete = window.confirm("هل أنت متأكد أنك تريد حذف هذه المقالة؟");
            if (!confirmDelete) return;

            try {
                await deleteDoc(doc(db, `artifacts/${userId}/public/data/posts`, id));
                alert('تم حذف المقالة بنجاح!');
            } catch (e) {
                console.error("Error deleting document: ", e);
                alert('حدث خطأ أثناء حذف المقالة.');
            }
        };

        // --- Loading State ---
        if (loadingFirebase) {
            return (
                <div className="flex justify-center items-center min-h-screen bg-gray-100">
                    <p className="text-xl text-gray-700">جاري تحميل الموقع...</p>
                </div>
            );
        }

        // --- Admin Login Component ---
        const AdminLogin = () => {
            const [email, setEmail] = useState('');
            const [password, setPassword] = useState('');

            const handleSubmit = (e) => {
                e.preventDefault();
                handleLogin(email, password);
            };

            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 p-4">
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
                        <h2 className="text-3xl font-bold mb-6 text-blue-800">تسجيل دخول المدير</h2>
                        <p className="text-red-500 mb-4">{authError}</p>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-gray-700 text-lg font-bold mb-2 text-right">البريد الإلكتروني:</label>
                                <input
                                    type="email"
                                    id="email"
                                    className="form-input"
                                    placeholder="بريد المدير الإلكتروني"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-gray-700 text-lg font-bold mb-2 text-right">كلمة المرور:</label>
                                <input
                                    type="password"
                                    id="password"
                                    className="form-input"
                                    placeholder="كلمة مرور المدير"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full">تسجيل الدخول</button>
                        </form>
                        <p className="text-sm text-gray-500 mt-6">
                            **ملاحظة هامة:** هذا النموذج مخصص للمدير فقط. يرجى التأكد من إنشاء حساب المدير في Firebase Authentication باستخدام البريد الإلكتروني: <span className="font-semibold text-blue-600">{ADMIN_EMAIL}</span> وكلمة المرور التي اخترتها.
                        </p>
                    </div>
                </div>
            );
        };

        // --- Admin Panel Component ---
        const AdminPanel = () => {
            return (
                <div className="min-h-screen bg-gray-100 p-6 md:p-12 text-right">
                    <header className="bg-white shadow-lg py-4 px-6 rounded-xl flex justify-between items-center mb-12">
                        <h1 className="text-3xl font-bold text-blue-800">لوحة تحكم المدير</h1>
                        <button onClick={handleLogout} className="btn btn-secondary bg-red-500 text-white hover:bg-red-600">تسجيل الخروج</button>
                    </header>

                    <div className="container mx-auto">
                        {/* Add/Edit Post Section */}
                        <div className="bg-white p-8 rounded-xl shadow-xl mb-12">
                            <h2 className="text-2xl font-bold mb-6 text-blue-700">{editingPost ? 'تعديل المقالة' : 'إضافة مقالة جديدة'}</h2>
                            <div className="mb-6">
                                <label htmlFor="postTitle" className="block text-gray-700 text-lg font-bold mb-2">عنوان المقالة:</label>
                                <input
                                    type="text"
                                    id="postTitle"
                                    className="form-input"
                                    placeholder="أدخل عنوان المقالة هنا"
                                    value={editingPost ? editingPost.title : newPostTitle}
                                    onChange={(e) => editingPost ? setEditingPost({ ...editingPost, title: e.target.value }) : setNewPostTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-8">
                                <label htmlFor="postContent" className="block text-gray-700 text-lg font-bold mb-2">محتوى المقالة:</label>
                                <textarea
                                    id="postContent"
                                    className="form-textarea h-48"
                                    placeholder="اكتب محتوى المقالة هنا..."
                                    value={editingPost ? editingPost.content : newPostContent}
                                    onChange={(e) => editingPost ? setEditingPost({ ...editingPost, content: e.target.value }) : setNewPostContent(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <div className="flex justify-end space-x-4 space-x-reverse">
                                {editingPost ? (
                                    <>
                                        <button onClick={updatePost} className="btn btn-primary bg-green-600 hover:bg-green-700">تحديث المقالة</button>
                                        <button onClick={() => setEditingPost(null)} className="btn btn-secondary">إلغاء</button>
                                    </>
                                ) : (
                                    <button onClick={addPost} className="btn btn-primary">إضافة المقالة</button>
                                )}
                            </div>
                        </div>

                        {/* Existing Posts List */}
                        <div className="bg-white p-8 rounded-xl shadow-xl">
                            <h2 className="text-2xl font-bold mb-6 text-blue-700">المقالات المنشورة</h2>
                            {loadingPosts ? (
                                <p className="text-center text-gray-600">جاري تحميل المقالات...</p>
                            ) : posts.length === 0 ? (
                                <p className="text-center text-gray-600">لا توجد مقالات منشورة بعد. ابدأ بإضافة مقالة جديدة!</p>
                            ) : (
                                <div className="space-y-6">
                                    {posts.map(post => (
                                        <div key={post.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-2">{post.title}</h3>
                                            <p className="text-gray-600 text-sm mb-3">
                                                تاريخ النشر: {post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString('ar-EG') : 'غير متوفر'}
                                            </p>
                                            <p className="text-gray-700 leading-relaxed mb-4 line-clamp-3">{post.content}</p>
                                            <div className="flex justify-end space-x-3 space-x-reverse">
                                                <button
                                                    onClick={() => setEditingPost(post)}
                                                    className="btn btn-secondary bg-yellow-500 text-white hover:bg-yellow-600 px-4 py-2 text-sm"
                                                >
                                                    تعديل
                                                </button>
                                                <button
                                                    onClick={() => deletePost(post.id)}
                                                    className="btn btn-secondary bg-red-500 text-white hover:bg-red-600 px-4 py-2 text-sm"
                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        // --- Public Site Component ---
        const PublicSite = () => {
            return (
                <div className="antialiased text-right">
                    {/* شريط التنقل العلوي (Header) */}
                    <header className="bg-white shadow-lg py-4">
                        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
                            <a href="#home" className="text-3xl font-bold text-blue-700 mb-4 md:mb-0" aria-label="الرئيسية">
                                <span className="text-blue-500">نور</span> الهداية <span className="text-amber-500">✨</span>
                            </a>
                            <nav>
                                <ul className="flex flex-wrap justify-center md:space-x-6 md:space-x-reverse space-x-4 text-lg">
                                    <li><a href="#home" className="text-gray-700 hover:text-blue-600 font-medium transition duration-200">الرئيسية</a></li>
                                    <li><a href="#about-islam" className="text-gray-700 hover:text-blue-600 font-medium transition duration-200">عن الإسلام</a></li>
                                    <li><a href="#articles" className="text-gray-700 hover:text-blue-600 font-medium transition duration-200">مقالاتي</a></li>
                                    <li><a href="#resources" className="text-gray-700 hover:text-blue-600 font-medium transition duration-200">مصادر</a></li>
                                    <li><a href="#contact" className="text-gray-700 hover:text-blue-600 font-medium transition duration-200">اتصل بنا</a></li>
                                    {isAdmin && ( // Show Admin Panel link only if admin is logged in
                                        <li><a href="#" onClick={() => setIsAdmin(true)} className="text-blue-600 hover:text-blue-800 font-medium transition duration-220">لوحة المدير</a></li>
                                    )}
                                    {!isAuthenticated && ( // Show Login link if not authenticated
                                        <li><a href="#" onClick={() => setIsAdmin(false)} className="text-green-600 hover:text-green-800 font-medium transition duration-220">تسجيل الدخول</a></li>
                                    )}
                                </ul>
                            </nav>
                        </div>
                    </header>

                    {/* قسم الأبطال (Hero Section) */}
                    <section id="home" className="bg-gradient-to-r from-blue-500 to-blue-700 text-white py-20 md:py-32 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0 20v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 46v-4h-2v4H0v2h2v4h2v-4h4v-2H6zzm0-20v-4h-2v4H0v2h2v4h2v-4h4v-2H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
                        <div className="container mx-auto px-4 relative z-10">
                            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight drop-shadow-lg">
                                "وَمَا أَرْسَلْنَاكَ إِلَّا رَحْمَةً لِّلْعَالَمِينَ"
                            </h1>
                            <p className="text-lg md:text-2xl mb-10 max-w-4xl mx-auto opacity-90">
                                دعوة إلى طريق الحق والنور، لفهم الإسلام بجماله وشموليته، وبناء جسور التفاهم والمحبة.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6 sm:space-x-reverse">
                                <a href="#about-islam" className="btn bg-white text-blue-600 hover:bg-gray-100" aria-label="اكتشف الإسلام">اكتشف الإسلام</a>
                                <a href="#contact" className="btn bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600" aria-label="تواصل معنا">تواصل معنا</a>
                            </div>
                        </div>
                    </section>

                    {/* قسم عن الإسلام (About Islam Section) */}
                    <section id="about-islam" className="py-20 md:py-32 bg-white">
                        <div className="container mx-auto px-4">
                            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-800">عن الإسلام</h2>
                            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-700 w-24 mx-auto my-12 rounded-full"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                                <div className="card">
                                    <h3 className="text-2xl font-semibold mb-4 text-blue-700 flex items-center justify-end">
                                        التوحيد <span className="mr-2 text-amber-500 text-3xl">🕋</span>
                                    </h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        الإسلام دين التوحيد الخالص، يؤمن بإله واحد أحد لا شريك له، هو الله سبحانه وتعالى، خالق الكون ومدبره، وهو المستحق للعبادة وحده.
                                    </p>
                                </div>
                                <div className="card">
                                    <h3 className="text-2xl font-semibold mb-4 text-blue-700 flex items-center justify-end">
                                        القرآن الكريم <span className="mr-2 text-amber-500 text-3xl">📖</span>
                                    </h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        كتاب الله المنزل على النبي محمد صلى الله عليه وسلم، وهو كلام الله المعجز، هداية ونور للبشرية جمعاء، ودستور حياة للمسلمين.
                                    </p>
                                </div>
                                <div className="card">
                                    <h3 className="text-2xl font-semibold mb-4 text-blue-700 flex items-center justify-end">
                                        النبي محمد ﷺ <span className="mr-2 text-amber-500 text-3xl">🕌</span>
                                    </h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        خاتم الأنبياء والمرسلين، أُرسل رحمة للعالمين، وقدوته وسنته هي السبيل لفهم وتطبيق تعاليم الإسلام، ومكارم الأخلاق.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* قسم المقالات (Articles Section) - يعرض المقالات من Firestore */}
                    <section id="articles" className="py-20 md:py-32 bg-blue-50">
                        <div className="container mx-auto px-4 text-center">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-blue-800">مقالاتي</h2>
                            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-700 w-24 mx-auto my-12 rounded-full"></div>
                            {loadingPosts ? (
                                <p className="text-center text-gray-600">جاري تحميل المقالات...</p>
                            ) : posts.length === 0 ? (
                                <p className="text-center text-gray-600">لا توجد مقالات منشورة بعد.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                                    {posts.map(post => (
                                        <div key={post.id} className="card text-right">
                                            <h3 className="text-2xl font-semibold text-blue-700 mb-3">{post.title}</h3>
                                            <p className="text-gray-600 text-sm mb-3">
                                                تاريخ النشر: {post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString('ar-EG') : 'غير متوفر'}
                                            </p>
                                            <p className="text-gray-700 leading-relaxed line-clamp-5">{post.content}</p>
                                            {/* يمكنك إضافة زر "قراءة المزيد" هنا لصفحة مقالة كاملة */}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* قسم المصادر (Resources Section) */}
                    <section id="resources" className="py-20 md:py-32 bg-white">
                        <div className="container mx-auto px-4">
                            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-800">مصادر موثوقة</h2>
                            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-700 w-24 mx-auto my-12 rounded-full"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                                <div className="card">
                                    <h3 className="text-2xl font-semibold mb-3 text-blue-700 flex items-center justify-end">
                                        القرآن الكريم <span className="mr-2 text-amber-500 text-3xl">✨</span>
                                    </h3>
                                    <p className="text-gray-700 mb-4 leading-relaxed">
                                        اكتشف معاني القرآن الكريم، وتدبر آياته العظيمة من خلال نصوص موثوقة وتفاسير معتمدة.
                                    </p>
                                    <a href="https://quran.com/" target="_blank" className="text-blue-600 hover:underline font-medium" aria-label="اقرأ القرآن">اقرأ القرآن الكريم &larr;</a>
                                </div>
                                <div className="card">
                                    <h3 className="text-2xl font-semibold mb-3 text-blue-700 flex items-center justify-end">
                                        السنة النبوية <span className="mr-2 text-amber-500 text-3xl">📚</span>
                                    </h3>
                                    <p className="text-gray-700 mb-4 leading-relaxed">
                                        تعرف على سيرة النبي محمد صلى الله عليه وسلم وأحاديثه الشريفة التي تبين لنا منهج الحياة الإسلامي.
                                    </p>
                                    <a href="https://sunnah.com/" target="_blank" className="text-blue-600 hover:underline font-medium" aria-label="اكتشف السنة">اكتشف السنة النبوية &larr;</a>
                                </div>
                                <div className="card">
                                    <h3 className="text-2xl font-semibold mb-3 text-blue-700 flex items-center justify-end">
                                        مقالات إسلامية <span className="mr-2 text-amber-500 text-3xl">📝</span>
                                    </h3>
                                    <p className="text-gray-700 mb-4 leading-relaxed">
                                        مجموعة من المقالات والبحوث المعمقة التي تتناول جوانب مختلفة من العقيدة، الفقه، والأخلاق الإسلامية.
                                    </p>
                                    <a href="#" className="text-blue-600 hover:underline font-medium" aria-label="المزيد من المقالات">المزيد من المقالات &larr;</a>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* قسم اتصل بنا (Contact Section) */}
                    <section id="contact" className="py-20 md:py-32 bg-blue-50">
                        <div className="container mx-auto px-4">
                            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-800">تواصل معنا</h2>
                            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-700 w-24 mx-auto my-12 rounded-full"></div>
                            <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-xl shadow-2xl mt-12">
                                <p className="text-gray-700 mb-8 text-center text-lg">
                                    إذا كان لديك أي أسئلة، استفسارات، أو ترغب في التحدث عن الإسلام، فلا تتردد في ملء النموذج أدناه. يسعدني التواصل معك.
                                </p>
                                {/* نموذج الاتصال باستخدام Formspree.io - يرجى استبدال الرابط */}
                                <form action="https://formspree.io/f/YOUR_FORMSPREE_ENDPOINT" method="POST">
                                    <div className="mb-6">
                                        <label htmlFor="name" className="block text-gray-700 text-lg font-bold mb-3">الاسم:</label>
                                        <input type="text" id="name" name="الاسم" className="form-input" placeholder="اسمك الكريم" required aria-label="أدخل اسمك" />
                                    </div>
                                    <div className="mb-6">
                                        <label htmlFor="email" className="block text-gray-700 text-lg font-bold mb-3">البريد الإلكتروني:</label>
                                        <input type="email" id="email" name="_replyto" className="form-input" placeholder="بريدك الإلكتروني" required aria-label="أدخل بريدك الإلكتروني" />
                                    </div>
                                    <div className="mb-8">
                                        <label htmlFor="message" className="block text-gray-700 text-lg font-bold mb-3">رسالتك:</label>
                                        <textarea id="message" name="الرسالة" rows="6" className="form-textarea" placeholder="اكتب رسالتك هنا..." required aria-label="اكتب رسالتك"></textarea>
                                    </div>
                                    <div className="text-center">
                                        <button type="submit" className="btn btn-primary" aria-label="إرسال الرسالة">إرسال الرسالة</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </section>

                    {/* تذييل الصفحة (Footer) */}
                    <footer className="bg-gray-900 text-white py-12">
                        <div className="container mx-auto px-4 text-center">
                            <p className="mb-6 text-lg">&copy; 2025 [اسمك هنا]. جميع الحقوق محفوظة.</p>
                            <div className="flex justify-center space-x-6 space-x-reverse">
                                <a href="#" target="_blank" className="text-gray-400 hover:text-blue-400 transition duration-300" aria-label="صفحتنا على فيسبوك">فيسبوك</a>
                                <a href="#" target="_blank" className="text-gray-400 hover:text-blue-400 transition duration-300" aria-label="حسابنا على تويتر">تويتر</a>
                                <a href="#" target="_blank" className="text-gray-400 hover:text-blue-400 transition duration-300" aria-label="حسابنا على انستغرام">انستغرام</a>
                            </div>
                            <p className="mt-6 text-sm text-gray-500">
                                "اللهم اهدنا فيمن هديت، وعافنا فيمن عافيت، وتولنا فيمن توليت."
                            </p>
                        </div>
                    </footer>
                </div>
            );
        };

        // --- Main App Logic ---
        // Conditional rendering based on authentication and admin status
        if (isAuthenticated && isAdmin) {
            return <AdminPanel />;
        } else if (isAuthenticated && !isAdmin) {
            // User is authenticated but not admin (e.g., signed in anonymously)
            // Show public site, but offer admin login option
            return <PublicSite />;
        } else {
            // Not authenticated, show admin login page
            return <AdminLogin />;
        }
    }

    export default App;
    ```

