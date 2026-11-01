import React, { useState, useMemo } from 'react';
import { MENU_CATEGORIES, TOTAL_MENU_ITEMS_COUNT } from '../data/menuData';
import { DietaryType } from '../types';
import { Search, X, Sparkles, Utensils, QrCode, Star } from 'lucide-react';
import { MenuQRCode } from './MenuQRCode';

interface FoodMenuSectionProps {
  onOpenQRModal?: () => void;
}

export const FoodMenuSection: React.FC<FoodMenuSectionProps> = ({ onOpenQRModal: _onOpenQRModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryType | 'all' | 'popular'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showQRCard, setShowQRCard] = useState<boolean>(false);

  // Filtered menu items
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return MENU_CATEGORIES.map((cat) => {
      // Check category match
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
        return null;
      }

      const items = cat.items.filter((item) => {
        // Dietary filter
        if (selectedDietary === 'popular') {
          if (!item.popular) return false;
        } else if (selectedDietary !== 'all') {
          if (item.dietary !== selectedDietary) return false;
        }

        // Search query filter
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

  const totalFilteredItems = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [filteredCategories]);

  // Dietary symbol component (Universal Indian FSSAI Food Standard)
  const renderDietaryBadge = (dietary: DietaryType) => {
    if (dietary === 'veg') {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-emerald-600 bg-white p-0.5 shrink-0"
          title="Pure Vegetarian"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
        </span>
      );
    }
    if (dietary === 'egg') {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-amber-500 bg-white p-0.5 shrink-0"
          title="Contains Egg"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded border-2 border-rose-600 bg-white p-0.5 shrink-0"
        title="Non-Vegetarian"
      >
        <span className="w-2 h-2 rounded-full bg-rose-600" />
      </span>
    );
  };

  return (
    <section id="menu" className="py-24 relative bg-[#090b10] border-t border-b border-white/5 scroll-mt-20">
      {/* Decorative ambient background glow */}
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-8 border-b border-white/10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400 mb-3">
              <Utensils className="w-3.5 h-3.5" />
              <span>Multi-Cuisine Dining</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-medium">
              Hotel RJ Food Menu
            </h2>
            <p className="mt-3 text-sand-300/80 text-sm max-w-xl">
              Authentic restaurant tariff card featuring over {TOTAL_MENU_ITEMS_COUNT} freshly prepared dishes. North Indian curries, tandoori starters, slow-cooked biryanis, Chinese wok specialties, and refreshing mocktails.
            </p>
          </div>

          {/* Quick Table QR Code Toggle Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQRCard(!showQRCard)}
              className="py-2.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-gold-400/30 text-white text-xs font-semibold flex items-center gap-2 shadow-lg hover:border-gold-400 transition-all"
            >
              <QrCode className="w-4 h-4 text-gold-400" />
              <span>{showQRCard ? 'Hide Table QR Code' : 'Show Table QR Code'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Table QR Code Banner */}
        {showQRCard && (
          <div className="mb-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-gold-400/40 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-lg text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-400/10 text-gold-300 border border-gold-400/30 text-[10px] uppercase tracking-wider font-semibold mb-3">
                  <Sparkles className="w-3 h-3" />
                  <span>Physical Dining Table QR Code</span>
                </div>
                <h3 className="font-serif text-2xl text-white font-semibold">
                  Scan to View Menu on Mobile
                </h3>
                <p className="mt-2 text-xs text-sand-300 leading-relaxed">
                  Guests sitting at Hotel RJ can point their mobile camera at this QR code to browse the full food menu instantly in their phone browser without installing any app.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-sand-400">
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">100% Mobile Optimized</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">Instant Search & Filters</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">Print Ready for Acrylic Stands</span>
                </div>
              </div>

              {/* QR Code Stand */}
              <div className="shrink-0">
                <MenuQRCode size={180} showDownload={true} />
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="space-y-4 mb-10">
          {/* Search Input & Dietary Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Live Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-sand-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish (e.g. Paneer Butter Masala, Chicken Lollipop, Biryani)..."
                className="w-full bg-zinc-900/90 text-xs sm:text-sm text-white pl-10 pr-9 py-2.5 rounded-2xl border border-white/10 focus:outline-none focus:border-gold-400 placeholder:text-sand-400/60 transition-colors"
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

            {/* Dietary Type Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedDietary('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedDietary === 'all'
                    ? 'bg-white text-black shadow-md'
                    : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                }`}
              >
                All Items
              </button>

              <button
                onClick={() => setSelectedDietary('veg')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  selectedDietary === 'veg'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>Pure Veg</span>
              </button>

              <button
                onClick={() => setSelectedDietary('non-veg')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  selectedDietary === 'non-veg'
                    ? 'bg-rose-700 text-white shadow-md'
                    : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span>Non-Veg</span>
              </button>

              <button
                onClick={() => setSelectedDietary('egg')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  selectedDietary === 'egg'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>Egg</span>
              </button>

              <button
                onClick={() => setSelectedDietary('popular')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  selectedDietary === 'popular'
                    ? 'bg-gold-500 text-black shadow-md'
                    : 'bg-zinc-900 text-sand-300 hover:bg-zinc-800 border border-white/10'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />
                <span>Popular Picks</span>
              </button>
            </div>
          </div>

          {/* Category Tabs (Scrollable Horizontal Carousel) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 no-scrollbar border-b border-white/5">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-xs font-medium tracking-wider uppercase whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold shadow-md shadow-gold-500/20'
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
                  className={`px-4 py-2 rounded-full text-xs font-medium tracking-wider whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-black font-semibold shadow-md shadow-gold-500/20'
                      : 'bg-zinc-900/80 text-sand-300 hover:text-white hover:bg-zinc-800 border border-white/5'
                  }`}
                >
                  {cat.title} ({cat.items.length})
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Items Count Status */}
        <div className="flex items-center justify-between text-xs text-sand-400 mb-6">
          <span>
            Showing <strong className="text-white font-mono">{totalFilteredItems}</strong> dishes
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

        {/* Menu Display by Categories */}
        {filteredCategories.length === 0 ? (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-zinc-950/40">
            <p className="text-sand-300 text-base font-serif">No dishes found matching your current filter.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDietary('all');
              }}
              className="mt-4 px-6 py-2.5 rounded-full bg-gold-400 text-black text-xs font-semibold uppercase tracking-wider"
            >
              Show All Dishes
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredCategories.map((category) => (
              <div key={category.id} className="scroll-mt-24" id={`category-${category.id}`}>
                {/* Category Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between pb-3 mb-6 border-b border-gold-400/20 gap-2">
                  <div>
                    <h3 className="font-serif text-xl sm:text-2xl text-white font-semibold tracking-wide">
                      {category.title}
                    </h3>
                    <p className="text-xs text-sand-400 font-light mt-0.5">
                      {category.description}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-gold-400/80 uppercase tracking-widest shrink-0">
                    {category.items.length} {category.items.length === 1 ? 'Dish' : 'Dishes'}
                  </span>
                </div>

                {/* 2-Column Responsive Item Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {category.items.map((item) => (
                    <div
                      key={item.id}
                      className="group p-3.5 sm:p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-gold-400/30 transition-all duration-200 flex items-center justify-between gap-3 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderDietaryBadge(item.dietary)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white tracking-wide group-hover:text-gold-200 transition-colors">
                              {item.name}
                            </span>
                            {item.popular && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-gold-400/20 text-gold-300 border border-gold-400/40">
                                Popular
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price Tag with Dot Leader */}
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-mono text-sm sm:text-base font-bold text-gold-300">
                          {typeof item.price === 'number' ? `₹${item.price}` : `₹${item.price}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="text-xs text-sand-400">
            * All dishes are prepared fresh to order using premium ingredients. Government taxes (GST) applicable as per regulations.
          </p>
          <p className="text-[11px] text-sand-400/80 mt-1">
            For party orders, banquet catering, or special dietary requirements, contact Hotel RJ reception at <strong>+91 7004865824</strong>.
          </p>
        </div>
      </div>
    </section>
  );
};
