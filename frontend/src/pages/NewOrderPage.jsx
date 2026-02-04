import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  tablesAPI,
  productsAPI,
  ordersAPI,
  getProductImageUrl,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  X,
  ShoppingCart,
  Image as ImageIcon,
  Check,
  Delete,
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import RestaurantTableIcon from "../components/RestaurantTableIcon";

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftItems, setDraftItems] = useState([]); // { productId, product: { id, name, price, image_url }, quantity }
  const [showCart, setShowCart] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [availableTables, setAvailableTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState(null);
  const [priceModalValue, setPriceModalValue] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await productsAPI.getByCategory();
        setCategories(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedCategory(res.data.data[0].id);
        }
      } catch (error) {
        toast.error("Failed to load products");
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, []);

  const getFilteredProducts = useCallback(() => {
    if (!searchQuery) {
      const cat = categories.find((c) => c.id === selectedCategory);
      return cat?.products || [];
    }
    const q = searchQuery.toLowerCase();
    return categories
      .flatMap((c) => c.products || [])
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
  }, [categories, selectedCategory, searchQuery]);

  const addToDraft = (product, unitPrice) => {
    if (!product.is_available) return;
    setDraftItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const item = {
        productId: product.id,
        product: { ...product },
        quantity: 1,
      };
      if (unitPrice != null && product.variable_price) {
        item.unitPrice = parseFloat(unitPrice);
      }
      return [...prev, item];
    });
  };

  const handleProductClick = (product) => {
    if (!product.is_available) return;
    const existing = draftItems.find((i) => i.productId === product.id);
    if (product.variable_price && !existing) {
      setPriceModalProduct(product);
      const initial = parseFloat(product.price);
      setPriceModalValue(!Number.isNaN(initial) ? String(initial) : "");
      setShowPriceModal(true);
    } else {
      addToDraft(product, existing?.unitPrice);
    }
  };

  const confirmVariablePrice = () => {
    if (!priceModalProduct) return;
    const num = parseFloat(priceModalValue);
    if (isNaN(num) || num < 0) {
      toast.error("Enter a valid price");
      return;
    }
    addToDraft(priceModalProduct, num);
    setShowPriceModal(false);
    setPriceModalProduct(null);
    setPriceModalValue("");
  };

  const updateDraftQuantity = (productId, delta) => {
    setDraftItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: newQty } : i
      );
    });
  };

  const removeFromDraft = (productId) => {
    setDraftItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const getItemUnitPrice = (item) =>
    item.unitPrice != null ? item.unitPrice : parseFloat(item.product.price);
  const draftTotal = draftItems.reduce(
    (sum, i) => sum + getItemUnitPrice(i) * i.quantity,
    0
  );

  const handleSaveAndClose = () => {
    if (draftItems.length === 0) {
      toast.error("Add products before saving");
      return;
    }
    setShowTableModal(true);
    setLoadingTables(true);
    tablesAPI
      .getAll({ status: "available" })
      .then((res) => setAvailableTables(res.data.data))
      .catch(() => toast.error("Failed to load tables"))
      .finally(() => setLoadingTables(false));
  };

  const handleSelectTableAndSave = async (table) => {
    if (saving) return;
    setSaving(true);
    try {
      const orderRes = await ordersAPI.create({
        table_id: table.id,
        guest_count: 1,
      });
      const orderId = orderRes.data.data.id;
      for (const item of draftItems) {
        const payload = {
          product_id: item.productId,
          quantity: item.quantity,
        };
        if (item.unitPrice != null) payload.unit_price = item.unitPrice;
        await ordersAPI.addItem(orderId, payload);
      }
      setDraftItems([]);
      setShowTableModal(false);
      toast.success(`Order saved for Table ${table.table_number}`);
      navigate("/my-tables");
    } catch (error) {
      toast.error("Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const handleTakeawaySave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const orderRes = await ordersAPI.create({ guest_count: 1 });
      const orderId = orderRes.data.data.id;
      for (const item of draftItems) {
        const payload = {
          product_id: item.productId,
          quantity: item.quantity,
        };
        if (item.unitPrice != null) payload.unit_price = item.unitPrice;
        await ordersAPI.addItem(orderId, payload);
      }
      setDraftItems([]);
      setShowTableModal(false);
      toast.success("Takeaway order saved");
      navigate(`/order/takeaway/${orderId}`);
    } catch (error) {
      toast.error("Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Products */}
      <div className="flex-1 flex flex-col bg-surface-100">
        <header className="bg-white border-b border-surface-200 p-4">
          <h1 className="text-xl font-bold text-surface-800">New Order</h1>
          <p className="text-sm text-surface-500">
            Add products, then Save & Close and choose a table
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {!searchQuery && (
          <div className="bg-white border-b border-surface-200 px-4 py-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap font-medium transition-all shrink-0 ${
                    selectedCategory === cat.id
                      ? "text-white shadow-md"
                      : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  }`}
                  style={
                    selectedCategory === cat.id
                      ? { backgroundColor: cat.color }
                      : {}
                  }
                >
                  {cat.image_url && (
                    <span className="w-9 h-9 rounded-lg overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                      <img
                        src={getProductImageUrl(cat.image_url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </span>
                  )}
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 p-4 overflow-auto">
          {loadingProducts ? (
            <div className="flex justify-center py-12">
              <div className="spinner w-8 h-8" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`product-card flex flex-col ${
                    !product.is_available ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="aspect-square rounded-lg bg-surface-100 overflow-hidden mb-2 flex items-center justify-center">
                    {product.image_url ? (
                      <img
                        src={getProductImageUrl(product.image_url)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-surface-400" />
                    )}
                  </div>
                  <h3 className="font-semibold text-surface-800 mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs text-surface-500 mb-2 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-lg font-bold text-primary-600">
                      {product.variable_price
                        ? "Set price"
                        : formatCurrency(product.price)}
                    </span>
                    {product.is_available && (
                      <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-8 text-surface-500">
                  No products found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Draft Cart */}
      <aside
        className={`fixed lg:static inset-0 z-50 ${
          showCart ? "block" : "hidden"
        } lg:block w-full lg:w-96 bg-white border-l border-surface-200 flex flex-col`}
      >
        <div
          className="absolute inset-0 bg-black/50 lg:hidden"
          onClick={() => setShowCart(false)}
        />
        <div className="relative z-10 flex flex-col h-full bg-white lg:bg-transparent">
          <div className="p-4 border-b border-surface-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-surface-800">Draft Order</h2>
            <button
              onClick={() => setShowCart(false)}
              className="lg:hidden text-surface-500"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {draftItems.length === 0 ? (
              <div className="text-center py-8 text-surface-500">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Add products from the menu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {draftItems.map((item) => (
                  <div key={item.productId} className="order-item">
                    <div className="flex-1">
                      <h4 className="font-medium text-surface-800">
                        {item.product.name}
                      </h4>
                      <p className="text-sm text-surface-500">
                        {formatCurrency(getItemUnitPrice(item))} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateDraftQuantity(item.productId, -1)}
                        className="w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center"
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateDraftQuantity(item.productId, 1)}
                        className="w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="w-20 text-right font-semibold text-surface-800">
                      {formatCurrency(getItemUnitPrice(item) * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-surface-200 p-4">
            <div className="flex items-center justify-between text-lg mb-4">
              <span className="font-medium text-surface-600">Total</span>
              <span className="text-2xl font-bold text-surface-800">
                {formatCurrency(draftTotal)}
              </span>
            </div>
            <button
              onClick={handleSaveAndClose}
              disabled={draftItems.length === 0}
              className="btn btn-success w-full btn-lg flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Save & Close
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile cart toggle */}
      <button
        onClick={() => setShowCart(!showCart)}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg flex items-center justify-center z-40"
      >
        <ShoppingCart className="w-6 h-6" />
        {draftItems.length > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {draftItems.length}
          </span>
        )}
      </button>

      {/* Variable price modal with keypad */}
      {showPriceModal && priceModalProduct && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPriceModal(false);
              setPriceModalProduct(null);
              setPriceModalValue("");
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-surface-800 mb-0.5">
              Set price
            </h3>
            <p className="text-sm text-surface-500 mb-3 truncate">
              {priceModalProduct.name}
            </p>
            <div className="bg-surface-100 rounded-lg px-4 py-3 mb-4 text-right">
              <span className="text-2xl font-bold text-surface-800 tabular-nums">
                {priceModalValue || "0"}
              </span>
              <span className="text-surface-500 ml-1">DH</span>
            </div>
            <div
              className="grid grid-cols-3 gap-2 mb-4"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (key === ".") {
                        setPriceModalValue((v) => {
                          const s = String(v ?? "");
                          return s.includes(".") ? s : s ? s + "." : "0.";
                        });
                      } else {
                        setPriceModalValue((v) => {
                          const s = String(v ?? "");
                          if (s.includes(".")) {
                            const [, after] = s.split(".");
                            if (after.length >= 2) return s;
                          }
                          return s === "0" ? key : s + key;
                        });
                      }
                    }}
                    className="h-12 rounded-xl text-lg font-semibold bg-surface-100 text-surface-800 hover:bg-surface-200 active:bg-surface-300 transition-colors cursor-pointer touch-manipulation select-none"
                  >
                    {key}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPriceModalValue((v) => String(v ?? "").slice(0, -1));
                }}
                className="h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors cursor-pointer touch-manipulation select-none"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPriceModalValue("");
              }}
              className="w-full py-2 mb-3 text-sm font-medium text-surface-600 hover:text-surface-800 bg-surface-100 hover:bg-surface-200 rounded-lg cursor-pointer touch-manipulation"
            >
              Clear
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPriceModal(false);
                  setPriceModalProduct(null);
                  setPriceModalValue("");
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmVariablePrice();
                }}
                className="btn btn-primary flex-1"
              >
                Add to order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table selection modal (only when Save & Close with items) */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-surface-800 mb-2">
              Select table
            </h3>
            <p className="text-sm text-surface-500 mb-4">
              Choose an available table or takeaway (no table).
            </p>
            <button
              type="button"
              onClick={handleTakeawaySave}
              disabled={saving}
              className="w-full p-4 rounded-xl bg-amber-50 border-2 border-amber-200 hover:border-amber-500 font-bold text-lg text-surface-800 disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
            >
              <span>Takeaway</span>
              <span className="text-sm font-normal text-surface-500">
                (no table)
              </span>
            </button>
            {loadingTables ? (
              <div className="flex justify-center py-8">
                <div className="spinner w-8 h-8" />
              </div>
            ) : availableTables.length === 0 ? (
              <p className="text-surface-500 py-4">No available tables</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 max-h-64 overflow-auto">
                {availableTables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleSelectTableAndSave(table)}
                    disabled={saving}
                    className="p-4 rounded-xl bg-green-50 border-2 border-green-200 hover:border-green-500 font-bold text-lg text-surface-800 disabled:opacity-50 flex flex-col items-center justify-center gap-2"
                  >
                    <RestaurantTableIcon className="w-8 h-8 text-green-600" />
                    {table.table_number}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowTableModal(false)}
              className="btn btn-secondary w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
