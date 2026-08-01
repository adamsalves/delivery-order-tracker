import { Navigate, Route, Routes } from "react-router";
import { LoginPage } from "@/pages/LoginPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AppLayout } from "@/routes/AppLayout";
import { AuthLayout } from "@/routes/AuthLayout";
import { RequireAuth } from "@/routes/RequireAuth";

/** Anything unrecognised lands on the listing, which sends a stranger on to /login. */
function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}

export default App;
