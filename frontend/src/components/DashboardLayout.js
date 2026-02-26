import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { 
  Fuel, 
  LayoutDashboard, 
  Plus, 
  History, 
  LogOut, 
  Menu, 
  X,
  User,
  Building
} from "lucide-react";

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
    { path: "/dashboard/new-order", icon: Plus, label: "Nouvelle commande" },
    { path: "/dashboard/orders", icon: History, label: "Mes commandes" },
  ];

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel className="h-7 w-7 text-amber-500" />
            <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              ALIA REFUEL
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-transform lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100">
            <Link to="/" className="flex items-center gap-2">
              <Fuel className="h-8 w-8 text-amber-500" />
              <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                ALIA REFUEL
              </span>
            </Link>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                user?.user_type === "pro" ? "bg-slate-900" : "bg-amber-500"
              }`}>
                {user?.user_type === "pro" ? (
                  <Building className="h-5 w-5 text-amber-500" />
                ) : (
                  <User className="h-5 w-5 text-slate-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-500 uppercase">
                  {user?.user_type === "pro" ? "Professionnel" : "Particulier"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive(item.path)
                        ? "bg-amber-500 text-slate-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    data-testid={`nav-${item.path.split("/").pop() || "dashboard"}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-slate-600 hover:text-red-600 hover:bg-red-50"
              data-testid="logout-btn"
            >
              <LogOut className="h-5 w-5" />
              <span>Déconnexion</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
