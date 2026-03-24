import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Globe, 
  Leaf, 
  TrendingUp, 
  Cpu, 
  Trophy, 
  Search, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Bookmark, 
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Mail,
  Award,
  BookCheck,
  LayoutDashboard,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc, 
  setDoc,
  where
} from 'firebase/firestore';
import { fetchDailyNews, NewsItem } from './services/geminiService';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface NewsWithId extends NewsItem {
  id: string;
}

interface UserProfile {
  uid: string;
  email: string;
  bookmarks: string[];
  role?: 'admin' | 'user';
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [news, setNews] = useState<NewsWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'news' | 'quiz' | 'about'>('news');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create user profile
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            bookmarks: [],
            role: u.email === 'examswithshruti@gmail.com' ? 'admin' : 'user'
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // News Listener
  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsWithId[];
      setNews(newsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'news');
    });
    return () => unsubscribe();
  }, []);

  // Filtered News
  const filteredNews = useMemo(() => {
    return news.filter(item => {
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [news, selectedCategory, searchQuery]);

  // Admin: Refresh News
  const handleRefreshNews = async () => {
    if (userProfile?.role !== 'admin') return;
    setIsRefreshing(true);
    try {
      const freshNews = await fetchDailyNews();
      for (const item of freshNews) {
        // Check if news with same title exists to avoid duplicates
        const exists = news.some(n => n.title === item.title);
        if (!exists) {
          await addDoc(collection(db, 'news'), item);
        }
      }
    } catch (error) {
      console.error("Error refreshing news:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in window was closed before completion. Please try again.");
      } else {
        setAuthError("An error occurred during sign-in. Please try again.");
      }
      // Auto-clear error after 5 seconds
      setTimeout(() => setAuthError(null), 5000);
    }
  };

  const toggleBookmark = async (newsId: string) => {
    if (!user || !userProfile) return;
    const isBookmarked = userProfile.bookmarks.includes(newsId);
    const userRef = doc(db, 'users', user.uid);
    
    try {
      if (isBookmarked) {
        await updateDoc(userRef, { bookmarks: arrayRemove(newsId) });
        setUserProfile(prev => prev ? { ...prev, bookmarks: prev.bookmarks.filter(id => id !== newsId) } : null);
      } else {
        await updateDoc(userRef, { bookmarks: arrayUnion(newsId) });
        setUserProfile(prev => prev ? { ...prev, bookmarks: [...prev.bookmarks, newsId] } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const categories = [
    { name: 'Important Editorials', icon: BookOpen, color: 'text-blue-500' },
    { name: 'Environment', icon: Leaf, color: 'text-green-500' },
    { name: 'Economy', icon: TrendingUp, color: 'text-amber-500' },
    { name: 'International Relations', icon: Globe, color: 'text-purple-500' },
    { name: 'Science & Technology', icon: Cpu, color: 'text-cyan-500' },
    { name: 'Sports', icon: Trophy, color: 'text-rose-500' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('news')}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="text-white" size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight hidden sm:block">ExamsWithShruti</h1>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search current affairs..."
                className="w-full bg-gray-100 border-none rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userProfile?.role === 'admin' && (
              <button 
                onClick={handleRefreshNews}
                disabled={isRefreshing}
                className={cn(
                  "p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all",
                  isRefreshing && "animate-spin"
                )}
                title="Refresh Daily News"
              >
                <RefreshCw size={20} />
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveTab('news')}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    activeTab === 'news' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Bookmark size={20} className={userProfile?.bookmarks.length ? "fill-current" : ""} />
                </button>
                <button 
                  onClick={logout}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut size={20} />
                </button>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
                  <span className="text-xs font-bold text-blue-700">{user.email?.[0].toUpperCase()}</span>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Error Toast */}
      <AnimatePresence>
        {authError && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-[100] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-800"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">{authError}</span>
            <button onClick={() => setAuthError(null)} className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-8">
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Categories</h3>
            <div className="space-y-1">
              <button 
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  !selectedCategory ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:bg-gray-200"
                )}
              >
                <LayoutDashboard size={18} />
                All News
              </button>
              {categories.map((cat) => (
                <button 
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    selectedCategory === cat.name ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <cat.icon size={18} className={cat.color} />
                  {cat.name}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold mb-2">Daily Quiz</h3>
            <p className="text-xs text-gray-500 mb-4">Test your knowledge with today's current affairs MCQs.</p>
            <button 
              onClick={() => setActiveTab('quiz')}
              className="w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-black transition-all"
            >
              Start Quiz
            </button>
          </section>

          <section className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <ShoppingBag size={18} />
              <h3 className="text-sm font-bold">Purchase Notes</h3>
            </div>
            <p className="text-xs text-amber-700 mb-4">Get comprehensive UPSC & SSC notes curated by Shruti.</p>
            <a 
              href="https://forms.gle/Sjnow5A3EPQYaNhP7" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full text-center bg-amber-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-amber-700 transition-all"
            >
              Order Now
            </a>
          </section>

          <section className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl text-white shadow-lg overflow-hidden relative">
            <div className="relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Advertisement</span>
              <h4 className="text-lg font-bold mt-1 leading-tight">Pegasus Immigration</h4>
              <p className="text-xs mt-2 opacity-90">Expert guidance for study abroad & work visas.</p>
              <a 
                href="https://pegasus-wings-global.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-white text-blue-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all"
              >
                Apply Now <ExternalLink size={12} />
              </a>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12">
              <Globe size={100} />
            </div>
          </section>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveTab('news')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-bold transition-all",
                  activeTab === 'news' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                Daily News
              </button>
              <button 
                onClick={() => setActiveTab('quiz')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-bold transition-all",
                  activeTab === 'quiz' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                Quizzes
              </button>
              <button 
                onClick={() => setActiveTab('about')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-bold transition-all",
                  activeTab === 'about' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                About
              </button>
            </div>
            <div className="text-xs font-medium text-gray-400">
              {format(new Date(), 'EEEE, MMMM do')}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'news' && (
              <motion.div 
                key="news"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-gray-500">Curating exam-relevant news...</p>
                  </div>
                ) : filteredNews.length > 0 ? (
                  filteredNews.map((item) => (
                    <NewsCard 
                      key={item.id} 
                      item={item} 
                      isBookmarked={userProfile?.bookmarks.includes(item.id) || false}
                      onBookmark={() => toggleBookmark(item.id)}
                    />
                  ))
                ) : (
                  <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-300 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="text-gray-400" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No news found</h3>
                    <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or check back later for updates.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'quiz' && (
              <motion.div 
                key="quiz"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <QuizSection news={news} />
              </motion.div>
            )}

            {activeTab === 'about' && (
              <motion.div 
                key="about"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AboutSection />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-[70] p-6 lg:hidden shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold">Menu</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-6">
                <section>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Categories</h3>
                  <div className="space-y-1">
                    <button 
                      onClick={() => { setSelectedCategory(null); setIsSidebarOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        !selectedCategory ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      <LayoutDashboard size={18} />
                      All News
                    </button>
                    {categories.map((cat) => (
                      <button 
                        key={cat.name}
                        onClick={() => { setSelectedCategory(cat.name); setIsSidebarOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          selectedCategory === cat.name ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        <cat.icon size={18} className={cat.color} />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="bg-blue-600 p-5 rounded-2xl text-white">
                  <h4 className="font-bold">Pegasus Immigration</h4>
                  <p className="text-xs mt-1 opacity-90">Study abroad expert guidance.</p>
                  <a href="https://pegasus-wings-global.vercel.app/" className="inline-block mt-4 bg-white text-blue-600 px-4 py-2 rounded-lg text-xs font-bold">Apply Now</a>
                </section>

                <section className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                  <h4 className="font-bold text-amber-900">Purchase Notes</h4>
                  <p className="text-xs mt-1 text-amber-700">Comprehensive exam notes by Shruti.</p>
                  <a 
                    href="https://forms.gle/Sjnow5A3EPQYaNhP7" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block mt-4 bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    Order Now
                  </a>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function NewsCard({ item, isBookmarked, onBookmark }: { item: NewsWithId, isBookmarked: boolean, onBookmark: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.article 
      layout
      className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
              item.category === 'Environment' ? "bg-green-50 text-green-600" :
              item.category === 'Economy' ? "bg-amber-50 text-amber-600" :
              item.category === 'Science & Technology' ? "bg-cyan-50 text-cyan-600" :
              item.category === 'International Relations' ? "bg-purple-50 text-purple-600" :
              item.category === 'Sports' ? "bg-rose-50 text-rose-600" :
              "bg-blue-50 text-blue-600"
            )}>
              {item.category}
            </span>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {format(new Date(item.date), 'MMM dd, yyyy')}
            </span>
          </div>
          <button 
            onClick={onBookmark}
            className={cn(
              "p-2 rounded-full transition-colors",
              isBookmarked ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-100"
            )}
          >
            <Bookmark size={18} className={isBookmarked ? "fill-current" : ""} />
          </button>
        </div>

        <h2 className="text-xl font-bold leading-tight mb-3 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          {item.title}
        </h2>
        
        <p className="text-gray-600 text-sm leading-relaxed mb-4">
          {item.summary}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {item.tags?.map(tag => (
            <span key={tag} className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 border-t border-gray-100 grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Award size={14} className="text-blue-500" /> Key Points for Prelims
                  </h4>
                  <ul className="space-y-2">
                    {item.prelimsPoints?.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BookCheck size={14} className="text-purple-500" /> Analytical Points for Mains
                  </h4>
                  <ul className="space-y-2">
                    {item.mainsPoints?.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-purple-500 font-bold">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Source</p>
                <p className="text-xs font-medium text-gray-600">{item.source}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-6 w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
        >
          {isExpanded ? 'Show Less' : 'Read Full Analysis'}
          <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
        </button>
      </div>
    </motion.article>
  );
}

function QuizSection({ news }: { news: NewsWithId[] }) {
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const newsWithMcqs = useMemo(() => news.filter(n => n.mcqs && n.mcqs.length > 0), [news]);
  
  if (newsWithMcqs.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-300 text-center">
        <h3 className="text-lg font-bold">No quizzes available yet</h3>
        <p className="text-sm text-gray-500 mt-1">Check back later for today's practice questions.</p>
      </div>
    );
  }

  const currentNews = newsWithMcqs[currentNewsIndex];
  const currentMcq = currentNews.mcqs[currentMcqIndex];

  const handleOptionSelect = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);
    setShowExplanation(true);
    if (option === currentMcq.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    setSelectedOption(null);
    setShowExplanation(false);
    if (currentMcqIndex < currentNews.mcqs.length - 1) {
      setCurrentMcqIndex(prev => prev + 1);
    } else if (currentNewsIndex < newsWithMcqs.length - 1) {
      setCurrentNewsIndex(prev => prev + 1);
      setCurrentMcqIndex(0);
    } else {
      // End of quiz
      alert(`Quiz completed! Your score: ${score}`);
      setCurrentNewsIndex(0);
      setCurrentMcqIndex(0);
      setScore(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Daily Practice</span>
            <h3 className="text-sm font-bold mt-1 truncate max-w-[200px]">{currentNews.title}</h3>
          </div>
          <div className="text-xs font-bold text-gray-400">
            Score: <span className="text-blue-600">{score}</span>
          </div>
        </div>
        <div className="p-8">
          <div className="mb-8">
            <span className="text-xs font-bold text-gray-400 mb-2 block">Question {currentMcqIndex + 1} of {currentNews.mcqs.length}</span>
            <h2 className="text-lg font-bold leading-snug">{currentMcq.question}</h2>
          </div>

          <div className="space-y-3">
            {currentMcq.options.map((option, i) => {
              const isCorrect = option === currentMcq.correctAnswer;
              const isSelected = option === selectedOption;
              
              return (
                <button 
                  key={i}
                  onClick={() => handleOptionSelect(option)}
                  disabled={!!selectedOption}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl text-sm font-medium border transition-all flex items-center justify-between",
                    !selectedOption && "hover:border-blue-500 hover:bg-blue-50 border-gray-200",
                    selectedOption && isCorrect && "bg-green-50 border-green-500 text-green-700",
                    selectedOption && isSelected && !isCorrect && "bg-red-50 border-red-500 text-red-700",
                    selectedOption && !isSelected && !isCorrect && "opacity-50 border-gray-100"
                  )}
                >
                  {option}
                  {selectedOption && isCorrect && <Award size={16} className="text-green-500" />}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {showExplanation && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100"
              >
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Explanation</h4>
                <p className="text-sm text-blue-900 leading-relaxed">{currentMcq.explanation}</p>
                <button 
                  onClick={nextQuestion}
                  className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md"
                >
                  Next Question
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700" />
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6">
            <div className="w-32 h-32 rounded-3xl bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-2xl bg-blue-100 flex items-center justify-center">
                <User size={64} className="text-blue-600" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold">Shruti Mishra</h2>
          <p className="text-blue-600 font-medium">UPSC Faculty (Geography, Ethics & Governance)</p>
          
          <div className="mt-8 grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Shruti Mishra specializes in concept clarity, structured answer writing, and exam-oriented teaching. 
                With years of experience in guiding aspirants, she focuses on simplifying complex topics for UPSC and State PSC exams.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Experience</h3>
              <ul className="space-y-2">
                {['Samarthya IAS', 'Civil IAS', 'Saturn IAS'].map(org => (
                  <li key={org} className="text-sm font-medium flex items-center gap-2">
                    <Award size={14} className="text-blue-500" /> {org}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contact</h3>
              <a href="mailto:examswithshruti@gmail.com" className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                <Mail size={16} /> examswithshruti@gmail.com
              </a>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex-1 max-w-sm">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <ShoppingBag size={16} /> Purchase Notes
              </h4>
              <p className="text-[11px] text-amber-700 mt-1 mb-3">Get comprehensive UPSC & SSC notes curated by Shruti.</p>
              <a 
                href="https://forms.gle/Sjnow5A3EPQYaNhP7" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-all"
              >
                Order Now
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Globe className="text-blue-400" size={20} />
            </div>
            <div>
              <h4 className="font-bold">Pegasus Immigration</h4>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Pegasus Wings Global</p>
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Planning to Study or Work Abroad?</h3>
          <p className="text-sm text-gray-400 mb-8 max-w-md">
            Get expert guidance for study abroad, work visas, and global opportunities. Your global dream starts here.
          </p>
          <a 
            href="https://pegasus-wings-global.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-2"
          >
            Apply Now <ChevronRight size={16} />
          </a>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32" />
      </div>
    </div>
  );
}
