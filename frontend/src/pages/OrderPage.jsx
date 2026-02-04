import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOrder } from "../context/OrderContext";
import { useAuth } from "../context/AuthContext";
import { productsAPI, getProductImageUrl } from "../services/api";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Delete,
  Clock,
  ChefHat,
  ShoppingCart,
  Search,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "../utils/currency";

export default function OrderPage() {
  const { tableId, orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTakeaway = !!orderId;
  const {
    currentOrder,
    currentTable,
    loading,
    loadTable,
    loadOrder,
    addItem,
    updateItem,
    removeItem,
    clearOrder,
  } = useOrder();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState(null);
  const [priceModalValue, setPriceModalValue] = useState("");

  // Load order (takeaway) or table and products
  useEffect(() => {
    const init = async () => {
      try {
        if (isTakeaway) {
          await loadOrder(parseInt(orderId));
        } else {
          await loadTable(parseInt(tableId));
        }

        const productsRes = await productsAPI.getByCategory();
        setCategories(productsRes.data.data);

        if (productsRes.data.data.length > 0) {
          setSelectedCategory(productsRes.data.data[0].id);
        }
      } catch (error) {
        toast.error(
          isTakeaway ? "Failed to load order" : "Failed to load table"
        );
        navigate("/my-tables");
      } finally {
        setLoadingProducts(false);
      }
    };

    init();

    return () => clearOrder();
  }, [
    orderId,
    tableId,
    isTakeaway,
    loadTable,
    loadOrder,
    navigate,
    clearOrder,
  ]);

  // Handle back navigation
  const handleBack = () => {
    clearOrder();
    navigate("/my-tables");
  };

  // Add product to order (order must already exist)
  const handleAddProduct = async (product, unitPrice) => {
    if (!currentOrder) return;
    try {
      await addItem(product.id, 1, "", unitPrice);
    } catch (error) {
      // Error already handled in context
    }
  };

  // Click product: open Set price modal for variable-price, else add directly
  const handleProductClick = (product) => {
    if (!product.is_available) return;
    if (product.variable_price) {
      setPriceModalProduct(product);
      const initial = parseFloat(product.price);
      setPriceModalValue(!Number.isNaN(initial) ? String(initial) : "");
      setShowPriceModal(true);
    } else {
      handleAddProduct(product);
    }
  };

  const confirmVariablePrice = async () => {
    if (!priceModalProduct) return;
    const num = parseFloat(priceModalValue);
    if (Number.isNaN(num) || num < 0) {
      toast.error("Enter a valid price");
      return;
    }
    await handleAddProduct(priceModalProduct, num);
    setShowPriceModal(false);
    setPriceModalProduct(null);
    setPriceModalValue("");
  };

  // Update item quantity
  const handleUpdateQuantity = async (item, delta) => {
    const newQuantity = item.quantity + delta;

    if (newQuantity <= 0) {
      await removeItem(item.id);
    } else {
      await updateItem(item.id, newQuantity);
    }
  };

  // Filter products by search
  const getFilteredProducts = () => {
    if (!searchQuery) {
      const category = categories.find((c) => c.id === selectedCategory);
      return category?.products || [];
    }

    const query = searchQuery.toLowerCase();
    const allProducts = categories.flatMap((c) => c.products || []);
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  };

  const filteredProducts = getFilteredProducts();
  const activeItems =
    currentOrder?.items?.filter((i) => i.status !== "cancelled") || [];
  const orderTotal = activeItems.reduce(
    (sum, item) => sum + parseFloat(item.subtotal || 0),
    0
  );

  if (loadingProducts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Products Section */}
      <div className="flex-1 flex flex-col bg-surface-100">
        {/* Header */}
        <header className="bg-white border-b border-surface-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="btn btn-secondary">
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <h1 className="text-xl font-bold text-surface-800">
                  {currentTable?.table_number != null
                    ? `Table ${currentTable.table_number}`
                    : "Takeaway"}
                </h1>
              </div>
            </div>

            {/* Mobile cart toggle */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="lg:hidden btn btn-primary relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {activeItems.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Categories */}
        {!searchQuery && (
          <div className="bg-white border-b border-surface-200 px-4 py-3 overflow-x-auto">
            <div className="flex gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                    selectedCategory === category.id
                      ? "text-white"
                      : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  }`}
                  style={
                    selectedCategory === category.id
                      ? { backgroundColor: category.color }
                      : {}
                  }
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() =>
                  product.is_available && handleProductClick(product)
                }
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
                  {product.is_available ? (
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </span>
                  ) : (
                    <span className="text-xs text-red-500">Unavailable</span>
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
        </div>
      </div>

      {/* Order Cart - Sidebar on desktop, overlay on mobile */}
      <aside
        className={`
        fixed lg:static inset-0 z-50
        ${showCart ? "block" : "hidden"} lg:block
        w-full lg:w-96 bg-white border-l border-surface-200
        flex flex-col
      `}
      >
        {/* Mobile overlay backdrop */}
        <div
          className="absolute inset-0 bg-black/50 lg:hidden"
          onClick={() => setShowCart(false)}
        />

        {/* Cart content */}
        <div className="relative z-10 flex flex-col h-full bg-white lg:bg-transparent">
          {/* Cart Header */}
          <div className="p-4 border-b border-surface-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-800">
                Current Order
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="lg:hidden text-surface-500 hover:text-surface-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {currentOrder ? (
              <div className="mt-2 flex items-center gap-4 text-sm text-surface-500">
                <span className="font-mono">{currentOrder.order_number}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDistanceToNow(new Date(currentOrder.opened_at))}
                </span>
              </div>
            ) : null}
          </div>

          {/* Order Items */}
          <div className="flex-1 overflow-auto p-4">
            {!currentOrder ? (
              <div className="text-center py-8">
                <p className="text-surface-500 mb-4">
                  This table has no order.
                </p>
                <button onClick={handleBack} className="btn btn-secondary">
                  Back to My Tables
                </button>
              </div>
            ) : activeItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-16 h-16 mx-auto text-surface-300 mb-4" />
                <p className="text-surface-500">
                  Order is empty. Add items from the menu.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeItems.map((item) => (
                  <div key={item.id} className="order-item">
                    <div className="flex-1">
                      <h4 className="font-medium text-surface-800">
                        {item.product_name}
                      </h4>
                      <p className="text-sm text-surface-500">
                        {formatCurrency(item.unit_price)} each
                      </p>
                      {item.notes && (
                        <p className="text-xs text-primary-600 mt-1">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item, -1)}
                        className="w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center"
                        disabled={loading}
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
                        onClick={() => handleUpdateQuantity(item, 1)}
                        className="w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center"
                        disabled={loading}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-20 text-right font-semibold text-surface-800">
                      {formatCurrency(item.subtotal)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          {currentOrder && (
            <div className="border-t border-surface-200 p-4">
              <div className="flex items-center justify-between text-lg mb-4">
                <span className="font-medium text-surface-600">Total</span>
                <span className="text-2xl font-bold text-surface-800">
                  {formatCurrency(orderTotal)}
                </span>
              </div>

              <button
                onClick={handleBack}
                className="btn btn-success w-full btn-lg"
              >
                Save & Close
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Variable price modal with keypad (same as New Order page) */}
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
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await confirmVariablePrice();
                }}
                className="btn btn-primary flex-1"
              >
                Add to order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
