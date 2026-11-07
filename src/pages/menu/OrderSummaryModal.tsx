import React from 'react';
import { DietaryType, MenuItem, CartItem } from '../../types';
import { parseItemPrice } from '../../utils/priceUtils';
import { X, Check, Plus, Minus, ShoppingBag, Trash2, FileText, Send, MessageCircle, Download } from 'lucide-react';

export interface OrderSummaryModalProps {
  setIsWaiterMode: React.Dispatch<React.SetStateAction<boolean>>;
  isWaiterMode: boolean;
  setIsOrderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableNumber: string;
  setTableNumber: React.Dispatch<React.SetStateAction<string>>;
  totalItemsCount: number;
  handleGeneratePDF: () => Promise<void>;
  isGeneratingPdf: boolean;
  pdfSuccess: boolean;
  cart: { [itemId: string]: CartItem; };
  orderNote: string;
  totalPrice: number;
  renderDietaryBadge: (dietary: DietaryType) => React.JSX.Element;
  removeFromCart: (itemId: string) => void;
  addToCart: (item: MenuItem) => void;
  setOrderNote: React.Dispatch<React.SetStateAction<string>>;
  handleSendWhatsAppOrder: () => void;
  handleCopyOrder: () => void;
  copiedOrder: boolean;
  clearCart: () => void;
}

export const OrderSummaryModal: React.FC<OrderSummaryModalProps> = ({
  setIsWaiterMode,
  isWaiterMode,
  setIsOrderModalOpen,
  tableNumber,
  setTableNumber,
  totalItemsCount,
  handleGeneratePDF,
  isGeneratingPdf,
  pdfSuccess,
  cart,
  orderNote,
  totalPrice,
  renderDietaryBadge,
  removeFromCart,
  addToCart,
  setOrderNote,
  handleSendWhatsAppOrder,
  handleCopyOrder,
  copiedOrder,
  clearCart,
}) => (
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
                const itemPrice = parseItemPrice(ci.item.price);
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
                const itemPrice = parseItemPrice(ci.item.price);
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
);
