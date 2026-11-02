import React, { useState, useMemo, useEffect } from 'react';
import { MENU_CATEGORIES, TOTAL_MENU_ITEMS_COUNT } from '../data/menuData';
import { DietaryType, MenuItem, CartItem } from '../types';
import { HOTEL_INFO } from '../data/hotelData';
import { generateOrderPdf } from '../utils/orderPdfGenerator';
import { InstagramIcon, FacebookIcon } from '../components/SocialIcons';
import {
  Search,
  X,
  Phone,
  Sparkles,
  ArrowLeft,
  Sun,
  Moon,
  Star,
  LayoutGrid,
  List,
  Utensils,
  Share2,
  Check,
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  FileText,
  ChevronRight,
  Send,
  MessageCircle,
  Download,
} from 'lucide-react';

interface DigitalMenuPageProps {
  onOpenPosMode?: () => void;
  onBackToHotel: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const DigitalMenuPage: React.FC<DigitalMenuPageProps> = ({
  onBackToHotel,
  theme,
  onToggleTheme,
  onOpenPosMode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryType | 'all' | 'popular'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [copiedLink, setCopiedLink] = useState(false);

  // Cart / Order Selection State
  const [cart, setCart] = useState<{ [itemId: string]: CartItem }>(() => {
    try {
      const saved = localStorage.getItem('hotel_rj_cart');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string>(() => {
    return localStorage.getItem('hotel_rj_table_num') || '';
  });
  const [orderNote, setOrderNote] = useState<string>('');
  const [isWaiterMode, setIsWaiterMode] = useState<boolean>(false);
  const [copiedOrder, setCopiedOrder] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccess, setPdfSuccess] = useState<boolean>(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Save Cart & Table to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('hotel_rj_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('hotel_rj_table_num', tableNumber);
    } catch {
      // ignore
    }
  }, [tableNumber]);

  // Cart mutation helpers
  const addToCart = (item: MenuItem) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          item,
          quantity: (existing?.quantity || 0) + 1,
        },
      };
    });
  };

  const removeFromCart = (itemId: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: {
          ...existing,
          quantity: existing.quantity - 1,
        },
      };
    });
  };

  const clearCart = () => {
    if (window.confirm('Clear all selected items from your order?')) {
      setCart({});
    }
  };

  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, ci) => sum + ci.quantity, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return Object.values(cart).reduce((sum, ci) => {
      const p = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;
      return sum + p * ci.quantity;
    }, 0);
  }, [cart]);

  // Filter items
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return MENU_CATEGORIES.map((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
        return null;
      }

      const items = cat.items.filter((item) => {
        if (selectedDietary === 'popular') {
          if (!item.popular) return false;
        } else if (selectedDietary !== 'all') {
          if (item.dietary !== selectedDietary) return false;
        }

        if (query) {
          const matchName = item.name.toLowerCase().includes(query);
          const matchPrice = String(item.price).includes(query);
          const acronym = item.name.split(/\s+/).map((w: string) => w[0]).join('').toLowerCase();
          const matchAcronym = acronym.includes(query);
          if (!matchName && !matchPrice && !matchAcronym) return false;
        }

        return true;
      });

      if (items.length === 0) return null;

      return {
        ...cat,
        items,
      };
    }).filter(Boolean) as typeof MENU_CATEGORIES;
  }, [selectedCategory, selectedDietary, searchQuery]);

  const totalFilteredCount = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [filteredCategories]);

  // Share digital menu link
  const handleShareMenu = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Hotel RJ Restaurant - Digital Food Menu',
        text: 'Browse 270+ fresh multi-cuisine dishes at Hotel RJ, Bagodar.',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Generate plain text summary for WhatsApp or Clipboard
  const generateOrderText = () => {
    const tableHeader = tableNumber ? `*TABLE / ROOM:* ${tableNumber}\n` : '';
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const itemsList = Object.values(cart)
      .map((ci) => {
        const itemTotal = (typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0) * ci.quantity;
        return `• ${ci.quantity}x ${ci.item.name} - ₹${itemTotal}`;
      })
      .join('\n');

    const noteText = orderNote.trim() ? `\n*Note:* ${orderNote.trim()}` : '';

    return `*HOTEL RJ RESTAURANT ORDER*\n${tableHeader}Time: ${dateStr}\n--------------------------\n${itemsList}\n--------------------------\n*Total Items:* ${totalItemsCount}\n*Estimated Bill:* ₹${totalPrice}${noteText}\n_Prepared fresh to order_`;
  };

  const handleCopyOrder = () => {
    navigator.clipboard.writeText(generateOrderText());
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2500);
  };

  const handleSendWhatsAppOrder = () => {
    const rawMsg = generateOrderText();
    const encoded = encodeURIComponent(rawMsg);
    const phone = '917004865824';
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  // Generate and download Kitchen Order Ticket (KOT) PDF
  const handleGeneratePDF = async () => {
    if (totalItemsCount === 0 || isGeneratingPdf) return;
    try {
      setIsGeneratingPdf(true);
      await generateOrderPdf({
        cart,
        tableNumber,
        orderNote,
        totalItemsCount,
        totalPrice,
        hotelName: HOTEL_INFO.name,
        phone: HOTEL_INFO.phone,
        address: HOTEL_INFO.location,
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // FSSAI Dietary Standard Icon
  const renderDietaryBadge = (dietary: DietaryType) => {
    if (dietary === 'veg') {
      return (
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 border-emerald-600 bg-white p-0.5 shrink-0 shadow-xs"
          title="Pure Vegetarian"
        >
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-600" />
        </span>
      );
    }
    if (dietary === 'egg') {
      return (
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 border-amber-500 bg-white p-0.5 shrink-0 shadow-xs"
          title="Contains Egg"
        >
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 border-rose-600 bg-white p-0.5 shrink-0 shadow-xs"
        title="Non-Vegetarian"
      >
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-600" />
      </span>
    );
  };

  return (
    <div id="digital-menu-container" className="min-h-screen bg-[#07080c] text-sand-50 selection:bg-gold-500 selection:text-black pb-28">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0c12]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 py-2.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand Logo & Back Action */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onBackToHotel}
              className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/10 text-sand-300 hover:text-white transition-colors border border-white/10 shrink-0"
              title="Return to Hotel RJ Main Website"
              aria-label="Back to Hotel Website"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0 shadow-md ring-1 ring-gold-400/40">
                <img
                  src="./icons/hotel-rj-emblem.png"
                  alt="Hotel RJ Emblem"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-serif text-sm sm:text-lg font-bold tracking-[0.12em] text-white leading-none truncate">
                    HOTEL RJ
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] uppercase font-bold tracking-wider bg-gold-400 text-black shrink-0">
                    Menu
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] text-gold-400 tracking-wide font-sans mt-0.5 truncate hidden xs:inline">
                  {tableNumber ? `Table: ${tableNumber}` : 'Where Comfort Meets Great Taste'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Quick Order Cart Button */}
            <button
              onClick={() => setIsOrderModalOpen(true)}
              className={`relative px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95 border ${
                totalItemsCount > 0
                  ? 'bg-gold-400 text-black border-gold-300 shadow-md animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 text-sand-300 hover:text-white border-white/10'
              }`}
              title="View your selected items to show waiter"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Order</span>
              {totalItemsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-black text-gold-400 text-[10px] font-bold">
                  {totalItemsCount}
                </span>
              )}
            </button>

            
            {/* Instagram Social Pill */}
            <a
              href={HOTEL_INFO.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-sand-300 hover:text-pink-400 flex items-center gap-1.5 border border-white/10 transition-colors"
              title="Tag Hotel RJ on Instagram"
              aria-label="Hotel RJ Instagram"
            >
              <InstagramIcon className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden md:inline font-mono text-[11px]">@hotelrj.info</span>
            </a>
            {/* Share / Copy Menu Link */}
            <button
              onClick={handleShareMenu}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-sand-300 hover:text-white flex items-center gap-1.5 border border-white/10 transition-colors"
              title="Share Menu Link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-gold-400" />}
              <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

                        {/* Switch to Waiter POS */}
            {onOpenPosMode && (
              <button
                type="button"
                onClick={onOpenPosMode}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-md active:scale-95 transition-all shrink-0"
                title="Switch to Staff Waiter POS"
              >
                <span>👨‍🍳 Waiter POS</span>
              </button>
            )}
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-full border border-white/15 hover:border-gold-400/50 bg-white/5 flex items-center justify-center text-sand-200 hover:text-gold-300 transition-all shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-gold-300" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-gold-600" />
              )}
            </button>

            {/* Back to Website Button (Desktop) */}
            <button
              onClick={onBackToHotel}
              className="hidden lg:inline-flex px-3.5 py-1.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold text-xs uppercase tracking-wider shadow-sm hover:from-gold-300 hover:to-gold-400 transition-all"
            >
              Hotel Website
            </button>
          </div>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <div className="relative py-6 sm:py-10 bg-gradient-to-b from-[#11131c] to-[#07080c] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Table Digital Tariff Card</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl text-white font-medium">
                Hotel RJ Restaurant
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-sand-300/80 max-w-xl font-light leading-relaxed">
                Tap <strong>+ Add</strong> on dishes you like to build your order sheet. When your waiter arrives, tap <strong>Show Waiter</strong> to present your order instantly.
              </p>
            </div>

            {/* Quick Contact & Quick Table Number */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={`tel:${HOTEL_INFO.phone}`}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition-colors shadow-sm"
              >
                <Phone className="w-3.5 h-3.5 text-gold-400" />
                <span>Call Waiter: {HOTEL_INFO.phone}</span>
              </a>

              <div className="px-3 py-2 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-300 text-xs font-medium">
                <span>{TOTAL_MENU_ITEMS_COUNT} Dishes Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Menu Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        {/* Sticky Search and Filter Controls */}
        <div className="sticky top-[52px] sm:top-[57px] z-30 bg-[#07080c]/95 backdrop-blur-md py-3 sm:py-4 space-y-3 border-b border-white/10">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-sand-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish (e.g. Paneer Butter Masala, Chicken Tikka, Biryani)..."
                className="w-full bg-zinc-900/90 text-xs sm:text-sm text-white pl-10 pr-9 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-white/10 focus:outline-none focus:border-gold-400 placeholder:text-sand-400/60 transition-colors shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400 hover:text-white p-1"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dietary Type Pills & View Mode Toggle */}
            <div className="flex items-center justify-between md:justify-end gap-2 overflow-x-auto pb-1 no-scrollbar">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={() => setSelectedDietary('all')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedDietary === 'all'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  All
                </button>

                <button
                  onClick={() => setSelectedDietary('veg')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedDietary === 'veg'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Veg</span>
                </button>

                <button
                  onClick={() => setSelectedDietary('non-veg')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedDietary === 'non-veg'
                      ? 'bg-rose-700 text-white shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>Non-Veg</span>
                </button>

                <button
                  onClick={() => setSelectedDietary('popular')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedDietary === 'popular'
                      ? 'bg-gold-500 text-black shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  <Star className="w-3 h-3 text-gold-400 fill-gold-400" />
                  <span>Popular</span>
                </button>
              </div>

              {/* View Switcher: Photo Cards vs Compact List */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 shrink-0 ml-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'cards' ? 'bg-gold-400 text-black' : 'text-sand-400 hover:text-white'
                  }`}
                  title="3-in-a-row Photo Grid"
                  aria-label="Photo Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'compact' ? 'bg-gold-400 text-black' : 'text-sand-400 hover:text-white'
                  }`}
                  title="Compact List View"
                  aria-label="Compact List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Category Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold shadow-sm'
                  : 'bg-zinc-900/80 text-sand-300 hover:text-white hover:bg-zinc-800 border border-white/5'
              }`}
            >
              All ({TOTAL_MENU_ITEMS_COUNT})
            </button>

            {MENU_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold shadow-sm'
                      : 'bg-zinc-900/80 text-sand-300 hover:text-white hover:bg-zinc-800 border border-white/5'
                  }`}
                >
                  {cat.title} ({cat.items.length})
                </button>
              );
            })}
          </div>
        </div>

        {/* Dish Count Header */}
        <div className="flex items-center justify-between text-xs text-sand-400 my-4 sm:my-6">
          <span>
            Showing <strong className="text-white font-mono">{totalFilteredCount}</strong> items
            {searchQuery && <span> matching "{searchQuery}"</span>}
          </span>
          {(searchQuery || selectedCategory !== 'all' || selectedDietary !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDietary('all');
              }}
              className="text-gold-400 hover:underline text-xs flex items-center gap-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Empty Search Result */}
        {filteredCategories.length === 0 ? (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-zinc-950/40">
            <p className="text-sand-300 text-base font-serif">No dishes found matching your search.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDietary('all');
              }}
              className="mt-4 px-6 py-2 rounded-full bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider"
            >
              Show All Dishes
            </button>
          </div>
        ) : (
          /* Category Sections */
          <div className="space-y-10 sm:space-y-14">
            {filteredCategories.map((category) => (
              <div key={category.id} className="scroll-mt-36" id={`category-${category.id}`}>
                {/* Category Header with Hero Image Banner */}
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mb-4 sm:mb-6 border border-white/10 bg-zinc-950">
                  {category.heroImage && (
                    <div className="relative h-20 sm:h-32 w-full overflow-hidden">
                      <img
                        src={category.heroImage}
                        alt={category.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = './images/food/hero-veg-starters.jpg';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
                    </div>
                  )}

                  <div className="p-3 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-1.5">
                    <div>
                      <h2 className="font-serif text-xl sm:text-3xl text-white font-semibold tracking-wide">
                        {category.title}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-sand-300/80 font-light mt-0.5 max-w-xl">
                        {category.description}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-gold-400 uppercase tracking-widest shrink-0">
                      {category.items.length} Dishes
                    </span>
                  </div>
                </div>

                {/* Items Presentation */}
                {viewMode === 'cards' ? (
                  /* 3-in-a-row on mobile, 4 on tablet, 6 on desktop */
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3.5">
                    {category.items.map((item) => {
                      const cartItem = cart[item.id];
                      const qty = cartItem ? cartItem.quantity : 0;

                      return (
                        <div
                          key={item.id}
                          className="group rounded-xl sm:rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-gold-400/40 transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md p-1.5 sm:p-2.5"
                        >
                          {/* Square Thumbnail with overlays */}
                          <div className="relative aspect-square w-full rounded-lg sm:rounded-xl overflow-hidden bg-zinc-950">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    category.heroImage || './images/food/hero-veg-starters.jpg';
                                }}
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                            {/* Dietary Badge */}
                            <div className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5">
                              {renderDietaryBadge(item.dietary)}
                            </div>

                            {/* Popular / Chef Special Badge */}
                            {item.popular && (
                              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 px-1 py-0.5 rounded-md text-[7px] sm:text-[8px] font-bold bg-gold-400 text-black flex items-center gap-0.5 shadow-sm">
                                <Star className="w-2 h-2 fill-black" />
                                <span className="hidden sm:inline">Special</span>
                              </span>
                            )}
                          </div>

                          {/* Info & Price */}
                          <div className="flex flex-col justify-between flex-1 mt-1.5">
                            <div>
                              <h3
                                className="font-medium text-[11px] sm:text-xs text-white group-hover:text-gold-200 transition-colors leading-tight line-clamp-2 min-h-[26px] sm:min-h-[30px]"
                                title={item.name}
                              >
                                {item.name}
                              </h3>
                              <div className="mt-1 flex items-baseline justify-between">
                                <span className="font-mono text-xs sm:text-sm font-bold text-gold-300">
                                  ₹{item.price}
                                </span>
                              </div>
                            </div>

                            {/* Add to Order / Stepper Button */}
                            <div className="mt-1.5">
                              {qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="w-full py-1 sm:py-1.5 px-2 rounded-lg sm:rounded-xl bg-white/10 hover:bg-gold-400 text-sand-200 hover:text-black text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 border border-white/10 hover:border-gold-400 transition-all duration-150 active:scale-95 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </button>
                              ) : (
                                <div className="w-full py-0.5 px-1 rounded-lg sm:rounded-xl bg-gold-400 text-black flex items-center justify-between text-xs font-bold shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(item.id)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 active:scale-90 cursor-pointer"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="font-mono text-[11px] sm:text-xs font-bold">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => addToCart(item)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 active:scale-90 cursor-pointer"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Compact Classic Menu List View with Add Stepper */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {category.items.map((item) => {
                      const cartItem = cart[item.id];
                      const qty = cartItem ? cartItem.quantity : 0;

                      return (
                        <div
                          key={item.id}
                          className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/70 border border-white/5 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                loading="lazy"
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0 bg-zinc-950"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    category.heroImage || './images/food/hero-veg-starters.jpg';
                                }}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {renderDietaryBadge(item.dietary)}
                                <span className="text-xs sm:text-sm font-medium text-white truncate">
                                  {item.name}
                                </span>
                                {item.popular && (
                                  <span className="px-1 py-0.2 rounded text-[8px] uppercase font-bold bg-gold-400/20 text-gold-300 shrink-0">
                                    ★
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs sm:text-sm font-bold text-gold-300 block mt-0.5">
                                ₹{item.price}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 w-20">
                            {qty === 0 ? (
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="w-full py-1 px-2 rounded-lg bg-white/10 hover:bg-gold-400 text-sand-200 hover:text-black text-xs font-semibold flex items-center justify-center gap-1 border border-white/10 hover:border-gold-400 transition-colors active:scale-95 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            ) : (
                              <div className="w-full py-1 px-1 rounded-lg bg-gold-400 text-black flex items-center justify-between text-xs font-bold shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 active:scale-90 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-mono text-xs font-bold">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 active:scale-90 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center pb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Utensils className="w-4 h-4 text-gold-400" />
            <span className="font-serif text-lg text-white font-medium">Hotel RJ Restaurant</span>
          </div>
          <p className="text-xs text-sand-300/80 max-w-md mx-auto leading-relaxed">
            All dishes prepared fresh to order using quality ingredients. Tap <strong>Show Waiter</strong> at the bottom when you're ready to place your order.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onBackToHotel}
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              ← Back to Hotel Website
            </button>
            <a
              href={`tel:${HOTEL_INFO.phone}`}
              className="px-5 py-2 rounded-full bg-gold-400 hover:bg-gold-300 text-black text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Call Front Desk
            </a>
          </div>

          {/* Social Tagging Invite Card */}
          <div className="mt-8 p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 via-zinc-900/60 to-blue-950/30 border border-white/10 max-w-lg mx-auto text-center">
            <span className="text-[10px] uppercase font-semibold text-gold-400 tracking-widest block mb-1">
              Share Your Food Moments
            </span>
            <p className="text-xs text-sand-300 mb-3">
              Enjoying your meal? Tag <strong>{HOTEL_INFO.social.instagramHandle}</strong> on your stories and posts!
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href={HOTEL_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 text-white text-xs font-semibold hover:opacity-95 shadow-sm transition-all"
              >
                <InstagramIcon className="w-3.5 h-3.5" />
                <span>Follow Instagram</span>
              </a>
              <a
                href={HOTEL_INFO.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <FacebookIcon className="w-3.5 h-3.5" />
                <span>Facebook Page</span>
              </a>
            </div>
          </div>

        </div>
      </main>

      {/* Persistent Floating Bottom Order Bar */}
      {totalItemsCount > 0 && !isOrderModalOpen && (
        <div className="fixed bottom-3 left-3 right-3 z-40 max-w-lg mx-auto">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#11131c]/95 border border-gold-400/50 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ring-2 ring-gold-400/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gold-400 text-black flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                {totalItemsCount}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>₹{totalPrice}</span>
                  <span className="text-[10px] font-normal text-sand-400">
                    ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})
                  </span>
                </div>
                <span className="text-[10px] text-gold-300 truncate block">
                  {tableNumber ? `Table: ${tableNumber} • Ready to show waiter` : 'Ready to show waiter'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOrderModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-black text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer"
            >
              <span>Show Waiter</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* "Show to Waiter" Modal / Order Sheet Drawer */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[92vh] bg-[#0d0f17] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-[#131622]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm ring-1 ring-gold-400">
                  <img
                    src="./icons/hotel-rj-emblem.png"
                    alt="Hotel RJ"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-white leading-tight">
                    Order Selection
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gold-300">
                    दिखाएं वेटर को • Show to server to place order
                  </p>
                </div>
              </div>

              {/* View toggle (Standard vs Waiter KOT Glance View) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWaiterMode(!isWaiterMode)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition-colors ${
                    isWaiterMode
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-white/10 text-sand-300 hover:text-white border-white/10'
                  }`}
                  title="Toggle Waiter High-Contrast Glance Mode"
                >
                  <FileText className="w-3 h-3" />
                  <span>{isWaiterMode ? 'Edit Items' : 'Waiter View'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sand-300 hover:text-white transition-colors"
                  aria-label="Close Order Sheet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table / Room Number Quick Bar */}
            <div className="px-4 py-2.5 bg-black/40 border-b border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-semibold text-sand-400 tracking-wider">
                  Table / Room No:
                </span>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. Table 4 or Room 201"
                  className="px-2.5 py-1 text-xs bg-zinc-900 text-white rounded-lg border border-white/10 focus:border-gold-400 focus:outline-none w-44 text-right"
                />
              </div>

              {/* Quick Table Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8', 'Room'].map((tbl) => (
                  <button
                    key={tbl}
                    type="button"
                    onClick={() => setTableNumber(tbl)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors shrink-0 ${
                      tableNumber === tbl
                        ? 'bg-gold-400 text-black'
                        : 'bg-zinc-800 text-sand-300 hover:bg-zinc-700'
                    }`}
                  >
                    {tbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {totalItemsCount === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingBag className="w-12 h-12 text-sand-500 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-sand-300 font-medium">Your order sheet is currently empty.</p>
                  <p className="text-xs text-sand-400 mt-1">Tap <strong>+ Add</strong> on any dish in the menu to add it here.</p>
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(false)}
                    className="mt-4 px-5 py-2 rounded-full bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : isWaiterMode ? (
                /* WAITER QUICK-GLANCE RECEIPT MODE (High Contrast KOT ticket) */
                <div className="p-4 sm:p-5 rounded-2xl bg-white text-black shadow-xl font-mono space-y-3 border-2 border-stone-300">
                  <div className="pb-2 border-b-2 border-dashed border-stone-400 space-y-2">
                    {/* Top Action Bar in Waiter View with Table Badge & Small PDF Generator Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          Table: {tableNumber || 'Walk-In'}
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Small Button to Generate PDF of Food Items */}
                      <button
                        type="button"
                        onClick={handleGeneratePDF}
                        disabled={isGeneratingPdf}
                        className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-black text-white text-[11px] font-sans font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                        title="Generate and download PDF receipt of food items"
                      >
                        {pdfSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">PDF Ready!</span>
                          </>
                        ) : isGeneratingPdf ? (
                          <>
                            <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-amber-400" />
                            <span>Generate PDF</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-center pt-1">
                      <h4 className="font-serif font-black text-base tracking-wider uppercase">
                        HOTEL RJ - KITCHEN ORDER
                      </h4>
                      <p className="text-[10px] text-stone-600 mt-0.5">
                        Where Comfort Meets Great Taste • Suriya Road, Bagodar
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 py-1 text-xs sm:text-sm">
                    {Object.values(cart).map((ci) => {
                      const itemPrice = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;
                      return (
                        <div key={ci.item.id} className="flex items-start justify-between gap-2 border-b border-stone-200 pb-1">
                          <span className="font-black text-black">
                            {ci.quantity}x {ci.item.name}
                          </span>
                          <span className="font-bold text-stone-700 shrink-0">
                            ₹{itemPrice * ci.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {orderNote.trim() && (
                    <div className="p-2 rounded bg-stone-100 text-[11px] font-sans border border-stone-300">
                      <strong>Cooking Note:</strong> {orderNote}
                    </div>
                  )}

                  <div className="pt-2 border-t-2 border-dashed border-stone-400 flex items-center justify-between font-black text-sm sm:text-base">
                    <span>TOTAL ({totalItemsCount} ITEMS):</span>
                    <span className="text-amber-700">₹{totalPrice}</span>
                  </div>

                  <p className="text-[9px] text-center text-stone-500 pt-1">
                    Present this screen directly to your server
                  </p>
                </div>
              ) : (
                /* INTERACTIVE ORDER SHEET VIEW */
                <div className="space-y-3">
                  <div className="divide-y divide-white/5">
                    {Object.values(cart).map((ci) => {
                      const itemPrice = typeof ci.item.price === 'number' ? ci.item.price : parseInt(String(ci.item.price).replace(/\D/g, ''), 10) || 0;
                      return (
                        <div key={ci.item.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {ci.item.image && (
                              <img
                                src={ci.item.image}
                                alt={ci.item.name}
                                className="w-11 h-11 rounded-lg object-cover shrink-0 bg-zinc-950"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = './images/food/hero-veg-starters.jpg';
                                }}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {renderDietaryBadge(ci.item.dietary)}
                                <span className="text-xs sm:text-sm font-medium text-white truncate">
                                  {ci.item.name}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-sand-400">
                                ₹{itemPrice} each
                              </span>
                            </div>
                          </div>

                          {/* Stepper & Total */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="py-1 px-1.5 rounded-lg bg-zinc-800 border border-white/10 text-white flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeFromCart(ci.item.id)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 active:scale-90"
                              >
                                <Minus className="w-3 h-3 text-sand-300" />
                              </button>
                              <span className="font-mono text-xs font-bold w-4 text-center">
                                {ci.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(ci.item)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 active:scale-90"
                              >
                                <Plus className="w-3 h-3 text-gold-400" />
                              </button>
                            </div>

                            <span className="font-mono text-xs sm:text-sm font-bold text-gold-300 w-14 text-right">
                              ₹{itemPrice * ci.quantity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  
                  {/* Quick Preset Tags for Waiters */}
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-semibold text-sand-400 tracking-wider block mb-1.5">
                      Quick Tags:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {['Less Spicy', 'Extra Spicy', 'No Onion Garlic', 'Crispy', 'Extra Gravy', 'Packing / Parcel'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setOrderNote((prev) => {
                              if (prev.includes(tag)) return prev;
                              return prev ? `${prev}, ${tag}` : tag;
                            });
                          }}
                          className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 hover:bg-gold-400/20 text-sand-300 hover:text-gold-300 border border-white/10 active:scale-95 transition-all"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Special Cooking Note Input */}
                  <div className="pt-2">
                    <label className="text-[10px] uppercase font-semibold text-sand-400 tracking-wider block mb-1">
                      Cooking Notes / Special Request:
                    </label>
                    <textarea
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      rows={2}
                      placeholder="e.g. Make less spicy, extra green chutney, bring drinks first..."
                      className="w-full bg-zinc-900/90 text-xs text-white p-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-gold-400 placeholder:text-sand-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            {totalItemsCount > 0 && (
              <div className="p-4 border-t border-white/10 bg-[#131622] space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-sand-300">
                    Total Estimated Bill ({totalItemsCount} items):
                  </span>
                  <span className="font-mono text-lg sm:text-xl font-bold text-gold-300">
                    ₹{totalPrice}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSendWhatsAppOrder}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Order</span>
                  </button>

                  {isWaiterMode ? (
                    <button
                      type="button"
                      onClick={handleGeneratePDF}
                      disabled={isGeneratingPdf}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                      title="Download PDF Kitchen Order Ticket"
                    >
                      {pdfSuccess ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-950" />
                          <span className="font-bold">PDF Ready!</span>
                        </>
                      ) : isGeneratingPdf ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 text-black" />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCopyOrder}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
                    >
                      {copiedOrder ? <Check className="w-4 h-4 text-emerald-400" /> : <Send className="w-4 h-4 text-gold-400" />}
                      <span>{copiedOrder ? 'Copied!' : 'Copy Summary'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All Items</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(false)}
                    className="text-[11px] text-sand-400 hover:text-white"
                  >
                    + Add More Items
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
