import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ordersAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { RefreshCw, Edit, Clock } from "lucide-react";
import RestaurantTableIcon from "../components/RestaurantTableIcon";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";

export default function MyTablesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  // Admins and moderators see all open orders (all tables); servers see only their tables
  const showAllTables = hasRole("admin") || hasRole("moderator");

  const fetchMyOrders = useCallback(async () => {
    try {
      const params = { status: "open" };
      if (!showAllTables && user?.id) params.server_id = user.id;
      const res = await ordersAPI.getAll(params);
      setOrders(res.data.data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, showAllTables]);

  useEffect(() => {
    fetchMyOrders();
    const interval = setInterval(fetchMyOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchMyOrders]);

  const handleOpenOrder = (order) => {
    if (order.table_id != null) {
      navigate(`/order/${order.table_id}`);
    } else {
      navigate(`/order/takeaway/${order.id}`);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-surface-800">
            {showAllTables ? "All Tables" : "My Tables"}
          </h1>
          <p className="text-surface-500">
            {showAllTables
              ? "All active tables — tap to update order"
              : "Tables you are serving — tap to update order"}
          </p>
        </div>
        <button
          onClick={fetchMyOrders}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner w-8 h-8" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-8 text-center text-surface-500">
          <p className="text-lg">
            {showAllTables ? "No active tables." : "You have no active tables."}
          </p>
          <p className="text-sm mt-2">
            Create a new order and assign it to a table.
          </p>
          <button
            onClick={() => navigate("/new-order")}
            className="btn btn-primary mt-4"
          >
            New Order
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => handleOpenOrder(order)}
              className="card p-4 text-left hover:border-primary-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RestaurantTableIcon className="w-7 h-7 text-surface-600 shrink-0" />
                  <span className="text-2xl font-bold text-surface-800">
                    {order.table_number != null
                      ? `Table ${order.table_number}`
                      : "Takeaway"}
                  </span>
                </div>
                <span className="text-lg font-bold text-primary-600">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-surface-500 mb-2">
                <Clock className="w-4 h-4" />
                {formatDistanceToNow(new Date(order.opened_at))} ago
              </div>
              <div className="text-sm text-surface-500">
                {order.order_number} · {order.item_count || 0} items
              </div>
              <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-2 text-primary-600 font-medium">
                <Edit className="w-4 h-4" />
                Update order
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
