import { useState, useEffect, useCallback } from "react";
import { ordersAPI, paymentsAPI, tablesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  CheckCircle,
  X,
  Receipt,
  Printer,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow, format } from "date-fns";
import PaymentTicket from "../components/PaymentTicket";

export default function CashierPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [tablesError, setTablesError] = useState(null);
  const [takeawayOrders, setTakeawayOrders] = useState([]);

  // Fetch occupied tables (no permission required on backend – any authenticated user)
  const fetchTables = useCallback(async () => {
    setTablesError(null);
    try {
      const res = await tablesAPI.getAll({ status: "occupied" });
      const data = res?.data?.data;
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Cashier: failed to load occupied tables", err);
      setTables([]);
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        "Could not load tables";
      setTablesError(msg);
      toast.error(`Occupied tables: ${msg}`);
    }
  }, []);

  // Fetch open takeaway orders (table_id null) so cashier can process payment
  const fetchTakeawayOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getActive();
      const data = res?.data?.data ?? [];
      const takeaway = Array.isArray(data)
        ? data.filter((o) => o.table_id == null || o.table_number == null)
        : [];
      setTakeawayOrders(takeaway);
    } catch (err) {
      console.error("Cashier: failed to load takeaway orders", err);
      setTakeawayOrders([]);
    }
  }, []);

  // Fetch payment methods and daily summary (separate so tables always load first)
  const fetchPaymentData = useCallback(async () => {
    try {
      const [methodsRes, summaryRes] = await Promise.allSettled([
        paymentsAPI.getMethods(),
        paymentsAPI.getDailySummary(),
      ]);
      if (methodsRes.status === "fulfilled") {
        const methods = methodsRes.value?.data?.data ?? [];
        setPaymentMethods(methods);
        if (methods.length > 0 && !selectedPaymentMethod) {
          setSelectedPaymentMethod(methods[0].id);
        }
      }
      if (summaryRes.status === "fulfilled") {
        setDailySummary(summaryRes.value?.data?.data ?? null);
      }
    } catch (e) {
      console.error("Cashier: payment data fetch error", e);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchTables(),
      fetchTakeawayOrders(),
      fetchPaymentData(),
    ]);
    setLoading(false);
  }, [fetchTables, fetchTakeawayOrders, fetchPaymentData]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Select table or takeaway and load order details
  const handleSelectTable = async (table) => {
    const orderId = table.current_order_id;
    if (!orderId) {
      toast.error("No active order");
      return;
    }

    setSelectedTable(table);
    setLoading(true);

    try {
      const response = await ordersAPI.getById(orderId);
      const order = response.data.data;
      setOrderDetails(order);
      setAmountPaid(order.total_amount.toString());
    } catch (error) {
      toast.error("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  // Process payment
  const handleProcessPayment = async () => {
    if (!orderDetails || !selectedPaymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    const amountNum = parseFloat(amountPaid) || 0;
    const tipNum = parseFloat(tipAmount) || 0;
    const totalRequired = parseFloat(orderDetails.total_amount) + tipNum;

    if (amountNum < totalRequired) {
      toast.error(
        `Insufficient amount. Required: ${formatCurrency(totalRequired)}`
      );
      return;
    }

    setProcessing(true);

    try {
      const response = await paymentsAPI.process({
        order_id: orderDetails.id,
        payment_method_id: selectedPaymentMethod,
        amount_paid: amountNum,
        tip_amount: tipNum,
      });

      const { payment, change } = response.data.data;
      const paymentMethodName =
        paymentMethods.find((m) => m.id === selectedPaymentMethod)?.name || "";

      setPaymentSuccess({
        payment,
        change,
        tableNumber: selectedTable.table_number,
        order: orderDetails,
        paymentMethodName,
      });

      // Reset state
      setSelectedTable(null);
      setOrderDetails(null);
      setAmountPaid("");
      setTipAmount("");

      // Refresh tables
      fetchData();
    } catch (error) {
      toast.error("Payment processing failed");
    } finally {
      setProcessing(false);
    }
  };

  // Quick amount buttons
  const handleQuickAmount = (amount) => {
    setAmountPaid(amount.toString());
  };

  // Filter tables by search
  const filteredTables = tables.filter((table) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      table.table_number.toString().includes(query) ||
      table.server_name?.toLowerCase().includes(query)
    );
  });

  // Filter takeaway orders by search
  const filteredTakeaways = takeawayOrders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (order.order_number || "").toString().toLowerCase().includes(query) ||
      order.server_name?.toLowerCase().includes(query)
    );
  });

  // Calculate change
  const calculateChange = () => {
    if (!orderDetails) return 0;
    const total =
      parseFloat(orderDetails.total_amount) + (parseFloat(tipAmount) || 0);
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - total);
  };

  const paymentMethodIcons = {
    cash: Banknote,
    card: CreditCard,
    mobile: Smartphone,
  };

  // Payment success modal + printable ticket
  if (paymentSuccess) {
    return (
      <>
        {/* Hidden area for printing - 80mm receipt, centered */}
        <div
          id="payment-ticket-print"
          className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:flex print:items-start print:justify-center"
        >
          <PaymentTicket data={paymentSuccess} />
        </div>

        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-100 print:hidden">
          <div className="card p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>

            <h2 className="text-2xl font-bold text-surface-800 mb-2">
              Payment Successful!
            </h2>

            <p className="text-surface-500 mb-6">
              {paymentSuccess.tableNumber != null
                ? `Table ${paymentSuccess.tableNumber}`
                : "Takeaway"}{" "}
              - {paymentSuccess.payment.payment_number}
            </p>

            <div className="bg-surface-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-surface-500">Amount Paid</span>
                <span className="font-semibold">
                  {formatCurrency(paymentSuccess.payment.amount_paid)}
                </span>
              </div>
              {parseFloat(paymentSuccess.payment.tip_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Tip</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(paymentSuccess.payment.tip_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-surface-200">
                <span className="text-surface-700 font-medium">Change</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(paymentSuccess.change)}
                </span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="btn btn-secondary w-full mb-3 flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Print Ticket
            </button>
            <button
              onClick={() => setPaymentSuccess(null)}
              className="btn btn-primary w-full btn-lg"
            >
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Tables List */}
      <div className="w-full lg:w-96 bg-white border-r border-surface-200 flex flex-col">
        <div className="p-4 border-b border-surface-200">
          <h1 className="text-xl font-bold text-surface-800 mb-4">
            Cashier Station
          </h1>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              placeholder="Search table number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Daily Summary */}
        {dailySummary && (
          <div className="p-4 bg-primary-50 border-b border-primary-100">
            <h3 className="text-sm font-medium text-primary-700 mb-2">
              Today's Sales
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-surface-500">Orders</div>
                <div className="font-bold text-surface-800">
                  {dailySummary.summary.totalOrders}
                </div>
              </div>
              <div>
                <div className="text-surface-500">Revenue</div>
                <div className="font-bold text-green-600">
                  {formatCurrency(dailySummary.summary.grossSales)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tables List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : tablesError ? (
            <div className="text-center py-8 px-4">
              <p className="text-surface-600 mb-2">{tablesError}</p>
              <button
                type="button"
                onClick={() => fetchTables()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Retry loading tables
              </button>
            </div>
          ) : filteredTables.length === 0 && filteredTakeaways.length === 0 ? (
            <div className="text-center py-8 text-surface-500">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No occupied tables or takeaway orders
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => handleSelectTable(table)}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    selectedTable?.id === table.id && !selectedTable?.isTakeaway
                      ? "bg-primary-100 border-2 border-primary-500"
                      : "bg-surface-50 hover:bg-surface-100 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-surface-800">
                      Table {table.table_number}
                    </span>
                    <span className="text-lg font-bold text-primary-600">
                      {formatCurrency(table.current_total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-surface-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {table.order_opened_at
                        ? formatDistanceToNow(new Date(table.order_opened_at))
                        : "-"}
                    </span>
                  </div>
                  {table.server_name && (
                    <div className="text-sm text-surface-500 mt-1">
                      Server: {table.server_name}
                    </div>
                  )}
                </button>
              ))}
              {filteredTakeaways.map((order) => {
                const row = {
                  isTakeaway: true,
                  id: `takeaway-${order.id}`,
                  current_order_id: order.id,
                  table_number: null,
                  current_total: order.total_amount,
                  order_opened_at: order.opened_at,
                  server_name: order.server_name,
                };
                return (
                  <button
                    key={row.id}
                    onClick={() => handleSelectTable(row)}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      selectedTable?.id === row.id
                        ? "bg-primary-100 border-2 border-primary-500"
                        : "bg-amber-50 hover:bg-amber-100 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-surface-800">
                        Takeaway
                      </span>
                      <span className="text-lg font-bold text-primary-600">
                        {formatCurrency(row.current_total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-surface-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {row.order_opened_at
                          ? formatDistanceToNow(new Date(row.order_opened_at))
                          : "-"}
                      </span>
                      {order.order_number && <span>#{order.order_number}</span>}
                    </div>
                    {row.server_name && (
                      <div className="text-sm text-surface-500 mt-1">
                        Server: {row.server_name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment Panel */}
      <div className="flex-1 bg-surface-100 flex flex-col">
        {!orderDetails ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-surface-500">
              <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a table to process payment</p>
            </div>
          </div>
        ) : (
          <>
            {/* Order Details */}
            <div className="bg-white border-b border-surface-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-surface-800">
                    {selectedTable.table_number != null
                      ? `Table ${selectedTable.table_number}`
                      : "Takeaway"}
                  </h2>
                  <p className="text-surface-500">
                    Order #{orderDetails.order_number}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedTable(null);
                    setOrderDetails(null);
                  }}
                  className="text-surface-400 hover:text-surface-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Order Items */}
              <div className="max-h-60 overflow-auto space-y-2 mb-4">
                {orderDetails.items
                  .filter((i) => i.status !== "cancelled")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 border-b border-surface-100"
                    >
                      <div className="flex-1">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-surface-500 ml-2">
                          x{item.quantity}
                        </span>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Totals */}
              <div className="border-t border-surface-200 pt-4">
                <div className="flex justify-between text-lg mb-2">
                  <span className="text-surface-600">Subtotal</span>
                  <span className="font-semibold">
                    {formatCurrency(orderDetails.subtotal)}
                  </span>
                </div>
                {parseFloat(orderDetails.tax_amount) > 0 && (
                  <div className="flex justify-between text-lg mb-2">
                    <span className="text-surface-600">Tax</span>
                    <span className="font-semibold">
                      {formatCurrency(orderDetails.tax_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span className="text-primary-600">
                    {formatCurrency(orderDetails.total_amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="flex-1 p-4 overflow-auto">
              {/* Payment Methods */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-surface-600 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {paymentMethods.map((method) => {
                    const Icon = paymentMethodIcons[method.name] || CreditCard;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedPaymentMethod === method.id
                            ? "border-primary-500 bg-primary-50"
                            : "border-surface-200 hover:border-surface-300"
                        }`}
                      >
                        <Icon
                          className={`w-8 h-8 mx-auto mb-2 ${
                            selectedPaymentMethod === method.id
                              ? "text-primary-500"
                              : "text-surface-400"
                          }`}
                        />
                        <span className="block text-sm font-medium capitalize">
                          {method.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Paid */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-surface-600 mb-2">
                  Amount Paid
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="input text-2xl font-bold text-center"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />

                {/* Quick amount buttons */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[20, 50, 100, parseFloat(orderDetails.total_amount)].map(
                    (amount, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickAmount(amount)}
                        className="btn btn-secondary py-3"
                      >
                        {i === 3 ? "Exact" : `${amount} DH`}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tip */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-surface-600 mb-2">
                  Tip (Optional)
                </label>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="input text-center"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Change */}
              <div className="bg-green-50 rounded-xl p-4 mb-6">
                <div className="text-center">
                  <span className="text-sm text-green-600 font-medium">
                    Change to Return
                  </span>
                  <div className="text-3xl font-bold text-green-700">
                    {formatCurrency(calculateChange())}
                  </div>
                </div>
              </div>
            </div>

            {/* Process Button */}
            <div className="p-4 bg-white border-t border-surface-200">
              <button
                onClick={handleProcessPayment}
                disabled={processing || !selectedPaymentMethod || !amountPaid}
                className="btn btn-success w-full btn-lg text-lg"
              >
                {processing ? (
                  <span className="spinner mx-auto"></span>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6 mr-2" />
                    Complete Payment
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
