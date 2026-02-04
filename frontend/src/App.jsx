import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Pages
import LoginPage from "./pages/LoginPage";
import NewOrderPage from "./pages/NewOrderPage";
import MyTablesPage from "./pages/MyTablesPage";
import OrderPage from "./pages/OrderPage";
import CashierPage from "./pages/CashierPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";

// Components
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";

function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public route */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* Default redirect based on role */}
          <Route
            path="/"
            element={
              user?.role === "cashier" ? (
                <Navigate to="/cashier" replace />
              ) : (
                <Navigate to="/new-order" replace />
              )
            }
          />

          {/* Server/Admin/Moderator routes */}
          <Route path="/new-order" element={<NewOrderPage />} />
          <Route path="/my-tables" element={<MyTablesPage />} />
          <Route path="/order/takeaway/:orderId" element={<OrderPage />} />
          <Route path="/order/:tableId" element={<OrderPage />} />

          {/* Cashier routes */}
          <Route path="/cashier" element={<CashierPage />} />

          {/* Profile (all logged-in users) */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              user?.role === "admin" || user?.role === "moderator" ? (
                <AdminPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
