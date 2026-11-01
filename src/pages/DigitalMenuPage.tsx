import React, { useState, useMemo, useEffect } from 'react';
import { MENU_CATEGORIES, TOTAL_MENU_ITEMS_COUNT } from '../data/menuData';
import { DietaryType } from '../types';
import { HOTEL_INFO } from '../data/hotelData';
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
} from 'lucide-react';

interface DigitalMenuPageProps {
  onBackToHotel: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const DigitalMenuPage: React.FC<DigitalMenuPageProps> = ({
  onBackToHotel,
  theme,
  onToggleTheme,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryType | 'all' | 'popular'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [copiedLink, setCopiedLink] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          if (!matchName && !matchPrice) return false;
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

  // FSSAI Dietary Standard Icon
  const renderDietaryBadge = (dietary: DietaryType) => {
    if (dietary === 'veg') {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-emerald-600 bg-white p-0.5 shrink-0 shadow-xs"
          title="Pure Vegetarian"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
        </span>
      );
    }
    if (dietary === 'egg') {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-amber-500 bg-white p-0.5 shrink-0 shadow-xs"
          title="Contains Egg"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-rose-600 bg-white p-0.5 shrink-0 shadow-xs"
        title="Non-Vegetarian"
      >
        <span className="w-2 h-2 rounded-full bg-rose-600" />
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-sand-50 selection:bg-gold-500 selection:text-black">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0c12]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Back Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHotel}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-sand-300 hover:text-white transition-colors border border-white/10"
              title="Return to Hotel RJ Main Website"
              aria-label="Back to Hotel Website"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md ring-1 ring-gold-400/40">
                <img
                  src="./icons/hotel-rj-emblem.png"
                  alt="Hotel RJ Emblem"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-base sm:text-lg font-bold tracking-[0.15em] text-white leading-none">
                    HOTEL RJ
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-gold-400 text-black">
                    Restaurant Menu
                  </span>
                </div>
                <span className="text-[9px] text-gold-400 tracking-wide font-sans mt-0.5 hidden sm:inline">
                  Where Comfort Meets Great Taste
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Share / Copy Menu Link */}
            <button
              onClick={handleShareMenu}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-sand-300 hover:text-white flex items-center gap-1.5 border border-white/10 transition-colors"
              title="Share Menu Link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-gold-400" />}
              <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share Menu'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-full border border-white/15 hover:border-gold-400/50 bg-white/5 flex items-center justify-center text-sand-200 hover:text-gold-300 transition-all"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-gold-300" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-gold-600" />
              )}
            </button>

            {/* Back to Website Button */}
            <button
              onClick={onBackToHotel}
              className="hidden md:inline-flex px-4 py-1.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold text-xs uppercase tracking-wider shadow-sm hover:from-gold-300 hover:to-gold-400 transition-all"
            >
              Hotel Website
            </button>
          </div>
        </div>
      </header>

      {/* Hero Welcome Banner */}
      <div className="relative py-8 sm:py-12 bg-gradient-to-b from-[#11131c] to-[#07080c] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Table Digital Tariff Card</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white font-medium">
                Hotel RJ Restaurant
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-sand-300/80 max-w-xl font-light leading-relaxed">
                Freshly prepared North Indian, Tandoori, Chinese, Biryanis, and handcrafted mocktails. Point your mobile camera at our table QR code anytime to reopen this menu.
              </p>
            </div>

            {/* Quick Contact & Table Badge */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <a
                href={`tel:${HOTEL_INFO.phone}`}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition-colors shadow-sm"
              >
                <Phone className="w-3.5 h-3.5 text-gold-400" />
                <span>Call Waiter: {HOTEL_INFO.phone}</span>
              </a>

              <div className="px-3 py-2 rounded-2xl bg-gold-400/10 border border-gold-400/20 text-gold-300 text-xs font-medium">
                <span>{TOTAL_MENU_ITEMS_COUNT} Dishes Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Menu Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sticky Search and Filter Controls */}
        <div className="sticky top-[57px] z-30 bg-[#07080c]/95 backdrop-blur-md py-4 space-y-3.5 border-b border-white/10">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-sand-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish (e.g. Paneer Butter Masala, Chicken Tikka, Biryani)..."
                className="w-full bg-zinc-900/90 text-xs sm:text-sm text-white pl-10 pr-9 py-2.5 rounded-2xl border border-white/10 focus:outline-none focus:border-gold-400 placeholder:text-sand-400/60 transition-colors shadow-inner"
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedDietary('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedDietary === 'all'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  All
                </button>

                <button
                  onClick={() => setSelectedDietary('veg')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedDietary === 'veg'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Pure Veg</span>
                </button>

                <button
                  onClick={() => setSelectedDietary('non-veg')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedDietary === 'popular'
                      ? 'bg-gold-500 text-black shadow-sm'
                      : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />
                  <span>Popular</span>
                </button>
              </div>

              {/* View Switcher: Photo Cards vs Compact List */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 shrink-0 ml-2">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'cards' ? 'bg-gold-400 text-black' : 'text-sand-400 hover:text-white'
                  }`}
                  title="Photo Card View"
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
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold shadow-sm'
                  : 'bg-zinc-900/80 text-sand-300 hover:text-white hover:bg-zinc-800 border border-white/5'
              }`}
            >
              All Categories ({TOTAL_MENU_ITEMS_COUNT})
            </button>

            {MENU_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
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
        <div className="flex items-center justify-between text-xs text-sand-400 my-6">
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
          <div className="space-y-14">
            {filteredCategories.map((category) => (
              <div key={category.id} className="scroll-mt-36" id={`category-${category.id}`}>
                {/* Category Header with Hero Image Banner */}
                <div className="relative rounded-3xl overflow-hidden mb-6 border border-white/10 bg-zinc-950">
                  {category.heroImage && (
                    <div className="relative h-28 sm:h-36 w-full overflow-hidden">
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

                  <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                    <div>
                      <h2 className="font-serif text-2xl sm:text-3xl text-white font-semibold tracking-wide">
                        {category.title}
                      </h2>
                      <p className="text-xs text-sand-300/80 font-light mt-1 max-w-xl">
                        {category.description}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-gold-400 uppercase tracking-widest shrink-0">
                      {category.items.length} Dishes
                    </span>
                  </div>
                </div>

                {/* Items Presentation */}
                {viewMode === 'cards' ? (
                  /* Visual Photo Cards Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="group rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-gold-400/40 transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl"
                      >
                        {item.image && (
                          <div className="relative aspect-[16/10] overflow-hidden bg-zinc-950">
                            <img
                              src={item.image}
                              alt={item.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = category.heroImage || './images/food/hero-veg-starters.jpg';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            {item.popular && (
                              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-gold-400 text-black shadow-md flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-black" />
                                <span>Chef's Special</span>
                              </span>
                            )}
                          </div>
                        )}

                        <div className="p-4 flex flex-col justify-between flex-1">
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {renderDietaryBadge(item.dietary)}
                                <h3 className="font-medium text-sm text-white group-hover:text-gold-200 transition-colors leading-snug">
                                  {item.name}
                                </h3>
                              </div>
                              <span className="font-mono text-sm sm:text-base font-bold text-gold-300 shrink-0">
                                {typeof item.price === 'number' ? `₹${item.price}` : `₹${item.price}`}
                              </span>
                            </div>

                            {item.popular && !item.image && (
                              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-gold-400/20 text-gold-300 border border-gold-400/40">
                                Popular Pick
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Compact Classic Menu List View */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/70 border border-white/5 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderDietaryBadge(item.dietary)}
                          <span className="text-xs sm:text-sm font-medium text-white truncate">
                            {item.name}
                          </span>
                          {item.popular && (
                            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[8px] uppercase font-bold bg-gold-400/20 text-gold-300">
                              ★
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs sm:text-sm font-bold text-gold-300 shrink-0">
                          {typeof item.price === 'number' ? `₹${item.price}` : `₹${item.price}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-20 pt-10 border-t border-white/10 text-center pb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Utensils className="w-4 h-4 text-gold-400" />
            <span className="font-serif text-lg text-white font-medium">Hotel RJ Restaurant</span>
          </div>
          <p className="text-xs text-sand-300/80 max-w-md mx-auto leading-relaxed">
            All dishes prepared fresh to order using quality ingredients. For room service or banquet catering inquiries, please speak to your server or call reception.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onBackToHotel}
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              ← Back to Hotel Website
            </button>
            <a
              href={`tel:${HOTEL_INFO.phone}`}
              className="px-6 py-2.5 rounded-full bg-gold-400 hover:bg-gold-300 text-black text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Call Front Desk
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
