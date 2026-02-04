import { createContext, useContext, useState, useCallback } from "react";
import { ordersAPI, tablesAPI } from "../services/api";
import toast from "react-hot-toast";

const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const [currentOrder, setCurrentOrder] = useState(null);
  const [currentTable, setCurrentTable] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load table and its active order
  const loadTable = useCallback(async (tableId) => {
    setLoading(true);
    try {
      const response = await tablesAPI.getById(tableId);
      const table = response.data.data;

      setCurrentTable(table);

      // If table has an active order, set it
      if (table.order_id) {
        setCurrentOrder({
          id: table.order_id,
          order_number: table.order_number,
          table_id: table.id,
          table_number: table.table_number,
          total_amount: table.total_amount || 0,
          subtotal: table.subtotal || 0,
          guest_count: table.guest_count || 1,
          opened_at: table.opened_at,
          status: table.order_status,
          items: table.order_items || [],
          server_name: table.server_name,
          server_id: table.server_id,
        });
      } else {
        setCurrentOrder(null);
      }

      return table;
    } catch (error) {
      toast.error("Failed to load table");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load order by id (for takeaway – no table)
  const loadOrder = useCallback(async (orderId) => {
    setLoading(true);
    try {
      const response = await ordersAPI.getById(orderId);
      const order = response.data.data;

      setCurrentTable(null); // takeaway has no table
      setCurrentOrder({
        id: order.id,
        order_number: order.order_number,
        table_id: order.table_id,
        table_number: order.table_number,
        total_amount: order.total_amount || 0,
        subtotal: order.subtotal || 0,
        guest_count: order.guest_count || 1,
        opened_at: order.opened_at,
        status: order.status,
        items: order.items || [],
        server_name: order.server_name,
        server_id: order.server_id,
      });

      return order;
    } catch (error) {
      toast.error("Failed to load order");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new order for table
  const createOrder = useCallback(async (tableId, guestCount = 1) => {
    setLoading(true);
    try {
      const response = await ordersAPI.create({
        table_id: tableId,
        guest_count: guestCount,
      });

      const order = response.data.data;

      setCurrentOrder({
        id: order.id,
        order_number: order.order_number,
        table_id: order.table_id,
        table_number: order.table_number,
        total_amount: 0,
        subtotal: 0,
        guest_count: guestCount,
        opened_at: order.opened_at,
        status: "open",
        items: [],
        server_name: order.server_name,
      });

      toast.success(`Order ${order.order_number} created`);
      return order;
    } catch (error) {
      toast.error("Failed to create order");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Add item to current order (unitPrice optional for variable-price products)
  const addItem = useCallback(
    async (productId, quantity = 1, notes = "", unitPrice = undefined) => {
      if (!currentOrder) {
        toast.error("No active order");
        return;
      }

      setLoading(true);
      try {
        const payload = { product_id: productId, quantity, notes };
        if (unitPrice != null) payload.unit_price = unitPrice;
        const response = await ordersAPI.addItem(currentOrder.id, payload);

        // Reload order/table to get updated items
        if (currentTable?.id) await loadTable(currentTable.id);
        else await loadOrder(currentOrder.id);

        toast.success("Item added");
        return response.data.data;
      } catch (error) {
        toast.error("Failed to add item");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [currentOrder, currentTable, loadTable, loadOrder]
  );

  // Update item quantity
  const updateItem = useCallback(
    async (itemId, quantity, notes) => {
      if (!currentOrder) return;

      setLoading(true);
      try {
        await ordersAPI.updateItem(currentOrder.id, itemId, {
          quantity,
          notes,
        });
        if (currentTable?.id) await loadTable(currentTable.id);
        else await loadOrder(currentOrder.id);
        toast.success("Item updated");
      } catch (error) {
        toast.error("Failed to update item");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [currentOrder, currentTable, loadTable, loadOrder]
  );

  // Remove item from order
  const removeItem = useCallback(
    async (itemId) => {
      if (!currentOrder) return;

      setLoading(true);
      try {
        await ordersAPI.removeItem(currentOrder.id, itemId);
        if (currentTable?.id) await loadTable(currentTable.id);
        else await loadOrder(currentOrder.id);
        toast.success("Item removed");
      } catch (error) {
        toast.error("Failed to remove item");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [currentOrder, currentTable, loadTable, loadOrder]
  );

  // Update order details
  const updateOrder = useCallback(
    async (data) => {
      if (!currentOrder) return;

      try {
        await ordersAPI.update(currentOrder.id, data);
        if (currentTable?.id) await loadTable(currentTable.id);
        else await loadOrder(currentOrder.id);
      } catch (error) {
        toast.error("Failed to update order");
        throw error;
      }
    },
    [currentOrder, currentTable, loadTable, loadOrder]
  );

  // Clear current order/table state
  const clearOrder = useCallback(() => {
    setCurrentOrder(null);
    setCurrentTable(null);
  }, []);

  // Calculate order totals locally
  const calculateTotal = useCallback(() => {
    if (!currentOrder?.items) return 0;
    return currentOrder.items
      .filter((item) => item.status !== "cancelled")
      .reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
  }, [currentOrder]);

  const value = {
    currentOrder,
    currentTable,
    loading,
    loadTable,
    loadOrder,
    createOrder,
    addItem,
    updateItem,
    removeItem,
    updateOrder,
    clearOrder,
    calculateTotal,
    hasActiveOrder: !!currentOrder,
  };

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrder must be used within an OrderProvider");
  }
  return context;
}
