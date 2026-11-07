import React from 'react';
import { Minus, Printer, FileText, Check, MessageCircle, X, Sparkles, Edit3, PlusCircle, CheckCircle } from 'lucide-react';
import { parseItemPrice } from '../../utils/priceUtils';
import { TableOrder, WaiterItemRecord } from '../../utils/tableMerge';

export interface OrderDrawerProps {
  activeTable: string;
  serverName: string;
  currentOrder: TableOrder;
  setIsOrderDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentItemsList: WaiterItemRecord[];
  setIsCustomModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newItemsToFire: { name: string; quantity: number; notes?: string; }[];
  openNoteEditor: (itemId: string, itemName: string, currentNotes?: string) => void;
  handleRemoveItem: (itemId: string) => void;
  handleFireKOT: () => Promise<void>;
  alreadyFiredItems: { name: string; quantity: number; notes: string | undefined; }[];
  applyGst: boolean;
  setApplyGst: React.Dispatch<React.SetStateAction<boolean>>;
  totalItemsCount: number;
  subtotalPrice: number;
  gstAmount: number;
  grandTotal: number;
  handlePrintBill: () => Promise<void>;
  handleSendWhatsApp: () => void;
  handleOpenSettleModal: () => void;
}

export const OrderDrawer: React.FC<OrderDrawerProps> = ({
  activeTable,
  serverName,
  currentOrder,
  setIsOrderDrawerOpen,
  currentItemsList,
  setIsCustomModalOpen,
  newItemsToFire,
  openNoteEditor,
  handleRemoveItem,
  handleFireKOT,
  alreadyFiredItems,
  applyGst,
  setApplyGst,
  totalItemsCount,
  subtotalPrice,
  gstAmount,
  grandTotal,
  handlePrintBill,
  handleSendWhatsApp,
  handleOpenSettleModal,
}) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
    <div className="w-full max-w-lg max-h-[92vh] bg-[#0e1017] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
      {/* Modal Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#131622]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold text-xs">
            {activeTable}
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-white">
              {activeTable} Order Sheet
            </h3>
            <span className="text-[10px] text-sand-400">
              Server: {serverName} • KOT #{currentOrder.kotNumber}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOrderDrawerOpen(false)}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sand-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        {currentItemsList.length === 0 ? (
          <div className="py-10 text-center text-sand-400 space-y-3">
            <p className="text-sm font-medium">{activeTable} is empty.</p>
            <p className="text-xs">Tap dishes on the menu or add a custom service below.</p>
            <button
              type="button"
              onClick={() => setIsCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs font-bold shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add Custom Service / Chicken Prep</span>
            </button>
          </div>
        ) : (
          <>
            {/* Wave 1: NEW ITEMS TO FIRE */}
            {newItemsToFire.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>New Items to Cook</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-black font-bold">
                    KOT #{currentOrder.kotNumber}
                  </span>
                </div>

                <div className="divide-y divide-white/5">
                  {currentItemsList
                    .filter((ci) => ci.quantity > ci.firedCount)
                    .map((ci) => {
                      const unfiredQty = ci.quantity - ci.firedCount;
                      const price = parseItemPrice(ci.item.price);

                      return (
                        <div key={ci.item.id} className="py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">
                              {unfiredQty}x {ci.item.name}
                            </div>
                            {/* Note Button */}
                            <button
                              type="button"
                              onClick={() => openNoteEditor(ci.item.id, ci.item.name, ci.notes)}
                              className="text-[10px] text-amber-300 italic hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>{ci.notes ? ci.notes : '+ Add note (Spicy / Jain...)'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono text-sand-300">
                              ₹{price * unfiredQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(ci.item.id)}
                              className="p-1 rounded bg-white/5 hover:bg-white/10 text-rose-400"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={handleFireKOT}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print & Fire KOT #{currentOrder.kotNumber}</span>
                </button>
              </div>
            )}

            {/* Wave 2: ALREADY COOKING IN KITCHEN */}
            {alreadyFiredItems.length > 0 && (
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Already Cooking in Kitchen</span>
                </span>

                <div className="divide-y divide-white/5 text-xs text-sand-300">
                  {alreadyFiredItems.map((it, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between">
                      <span>
                        {it.quantity}x {it.name}
                      </span>
                      {it.notes && (
                        <span className="text-[10px] text-amber-300 italic">
                          [{it.notes}]
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Custom Item / Service Charge Button */}
            <button
              type="button"
              onClick={() => setIsCustomModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-2xl bg-amber-400/10 hover:bg-amber-400/20 border border-dashed border-amber-400/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add Custom Dish / Chicken Making Charge</span>
            </button>

            {/* Tax / GST Selection Radio Option */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sand-400">
                  Tax Option (GST):
                </span>
                <span className="text-[9.5px] font-mono text-sand-500">
                  GSTIN: 20BGPPJ2962J1ZA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                    applyGst
                      ? 'bg-amber-400/15 border-amber-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="gstOptionRadio"
                    checked={applyGst}
                    onChange={() => setApplyGst(true)}
                    className="accent-amber-400 w-3.5 h-3.5"
                  />
                  <span>With 5% GST</span>
                </label>

                <label
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                    !applyGst
                      ? 'bg-amber-400/15 border-amber-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-sand-300 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="gstOptionRadio"
                    checked={!applyGst}
                    onChange={() => setApplyGst(false)}
                    className="accent-amber-400 w-3.5 h-3.5"
                  />
                  <span>Without GST (0%)</span>
                </label>
              </div>
            </div>

            {/* Bill Total Summary */}
            <div className="p-3.5 rounded-2xl bg-[#131622] border border-white/10 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-sand-300">
                <span>Subtotal ({totalItemsCount} items):</span>
                <span className="font-mono">₹{subtotalPrice.toFixed(2)}</span>
              </div>
              {applyGst ? (
                <div className="flex items-center justify-between text-sand-300">
                  <span>GST (5%):</span>
                  <span className="font-mono text-amber-300">₹{gstAmount.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sand-400 text-[11px]">
                  <span>GST (0%):</span>
                  <span className="font-mono text-emerald-400">Not Added (₹0.00)</span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between font-bold text-sm">
                <span className="text-white">Grand Total:</span>
                <span className="font-mono text-amber-300 text-base">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Footer Actions */}
      {currentItemsList.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-[#131622] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrintBill}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Print Bill</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Bill</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleOpenSettleModal}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 active:scale-95 transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Settle & Mark Vacant</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOrderDrawerOpen(false)}
              className="text-[11px] text-sand-400 hover:text-white"
            >
              + Add More Dishes
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);
