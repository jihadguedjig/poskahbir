import { forwardRef } from "react";
import { formatCurrency } from "../utils/currency";
import { format } from "date-fns";

const RESTAURANT_NAME = import.meta.env.VITE_RESTAURANT_NAME || "Showaya";
const RESTAURANT_ADDRESS = import.meta.env.VITE_RESTAURANT_ADDRESS || "";
const RESTAURANT_PHONE = import.meta.env.VITE_RESTAURANT_PHONE || "";
const RESTAURANT_LOGO_URL = import.meta.env.VITE_RESTAURANT_LOGO_URL || "";

/**
 * Printable payment receipt for 80mm thermal printer.
 * Top: logo + contact info. Content: receipt details.
 */
const PaymentTicket = forwardRef(({ data }, ref) => {
  if (!data) return null;
  const { payment, change, tableNumber, order, paymentMethodName } = data;
  const items = order?.items?.filter((i) => i.status !== "cancelled") || [];

  return (
    <div
      ref={ref}
      className="bg-white text-black mx-auto print:mx-0"
      style={{
        width: "80mm",
        maxWidth: "80mm",
        minHeight: "100mm",
        padding: "4mm 5mm",
        fontSize: "11px",
        lineHeight: 1.3,
      }}
    >
      {/* Top: Logo + Contact (80mm receipt header) */}
      <div
        className="text-center border-b border-black pb-3 mb-3"
        style={{ borderBottomWidth: "1px" }}
      >
        {RESTAURANT_LOGO_URL ? (
          <img
            src={RESTAURANT_LOGO_URL}
            alt={RESTAURANT_NAME}
            className="mx-auto block object-contain"
            style={{ maxHeight: "20mm", maxWidth: "60mm" }}
          />
        ) : (
          <h1 className="font-bold" style={{ fontSize: "14px" }}>
            {RESTAURANT_NAME}
          </h1>
        )}
        {(RESTAURANT_ADDRESS || RESTAURANT_PHONE) && (
          <div className="mt-2 text-center" style={{ fontSize: "9px" }}>
            {RESTAURANT_ADDRESS && (
              <p className="leading-tight">{RESTAURANT_ADDRESS}</p>
            )}
            {RESTAURANT_PHONE && <p className="mt-0.5">{RESTAURANT_PHONE}</p>}
          </div>
        )}
        <p className="text-xs mt-2 font-medium">Payment Receipt</p>
      </div>

      {/* Receipt details */}
      <div className="space-y-0.5 mb-2" style={{ fontSize: "10px" }}>
        <p>
          Date:{" "}
          {format(new Date(payment?.paid_at || Date.now()), "dd/MM/yyyy HH:mm")}
        </p>
        <p>{tableNumber != null ? `Table: ${tableNumber}` : "Takeaway"}</p>
        <p>Order: {payment?.order_id || order?.order_number}</p>
        <p>
          Payment: {paymentMethodName || payment?.payment_method_name || "-"}
        </p>
      </div>

      <table
        className="w-full border-collapse border-b border-black mb-2"
        style={{ fontSize: "10px" }}
      >
        <thead>
          <tr
            className="border-b border-black"
            style={{ borderBottomWidth: "1px" }}
          >
            <th className="text-left py-1 pr-1">Item</th>
            <th className="text-center py-1 w-8">Qty</th>
            <th className="text-right py-1 pl-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-gray-300"
              style={{ borderBottomWidth: "0.5px" }}
            >
              <td className="py-0.5 pr-1 break-words">{item.product_name}</td>
              <td className="text-center py-0.5">{item.quantity}</td>
              <td className="text-right py-0.5 pl-1">
                {formatCurrency(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-0.5 mb-2" style={{ fontSize: "10px" }}>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(order?.subtotal ?? payment?.amount_due)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(payment?.amount_due)}</span>
        </div>
        <div className="flex justify-between">
          <span>Amount paid</span>
          <span>{formatCurrency(payment?.amount_paid)}</span>
        </div>
        {parseFloat(payment?.tip_amount) > 0 && (
          <div className="flex justify-between">
            <span>Tip</span>
            <span>{formatCurrency(payment?.tip_amount)}</span>
          </div>
        )}
        <div
          className="flex justify-between font-bold pt-2 border-t border-black mt-2"
          style={{ borderTopWidth: "1px", fontSize: "11px" }}
        >
          <span>Change</span>
          <span>{formatCurrency(change)}</span>
        </div>
      </div>

      <p className="text-center mt-3" style={{ fontSize: "10px" }}>
        Thank you
      </p>
    </div>
  );
});

PaymentTicket.displayName = "PaymentTicket";
export default PaymentTicket;
