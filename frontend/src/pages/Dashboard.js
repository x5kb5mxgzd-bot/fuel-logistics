import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  Fuel, 
  Plus, 
  TrendingUp, 
  Package, 
  Truck, 
  CheckCircle,
  Clock,
  ArrowRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  confirmed: { label: "Confirmée", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
  in_delivery: { label: "En livraison", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Truck },
  delivered: { label: "Livrée", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-800 border-red-200", icon: Clock }
};

const Dashboard = () => {
  const { user, getAuthHeader } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          axios.get(`${API}/stats`, { headers: getAuthHeader() }),
          axios.get(`${API}/orders`, { headers: getAuthHeader() })
        ]);
        setStats(statsRes.data);
        setRecentOrders(ordersRes.data.slice(0, 5));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getAuthHeader]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Bonjour, {user?.full_name?.split(" ")[0]} !
          </h1>
          <p className="text-slate-600 mt-1">
            Bienvenue sur votre espace DieselExpress
          </p>
        </div>
        <Link to="/dashboard/new-order">
          <Button 
            className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide"
            data-testid="new-order-btn"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouvelle commande
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Orders */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total commandes</p>
                <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {stats?.total_orders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                <Package className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Liters */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Litres commandés</p>
                <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {stats?.total_liters || 0}L
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                <Fuel className="h-6 w-6 text-slate-900" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total dépensé</p>
                <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {stats?.total_spent?.toFixed(2) || "0.00"}€
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Orders */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">En cours</p>
                <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {(stats?.orders_by_status?.pending || 0) + (stats?.orders_by_status?.confirmed || 0) + (stats?.orders_by_status?.in_delivery || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <Truck className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle 
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            COMMANDES RÉCENTES
          </CardTitle>
          <Link to="/dashboard/orders">
            <Button variant="ghost" className="text-amber-600 hover:text-amber-700">
              Voir tout
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <Fuel className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Aucune commande pour le moment</p>
              <Link to="/dashboard/new-order">
                <Button className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold">
                  Passer ma première commande
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => {
                const status = statusConfig[order.status];
                const StatusIcon = status?.icon || Clock;
                return (
                  <Link 
                    key={order.id} 
                    to={`/dashboard/orders/${order.id}`}
                    className="block"
                    data-testid={`order-item-${order.id}`}
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                          <Fuel className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{order.quantity}L Diesel</p>
                          <p className="text-sm text-slate-500">{order.delivery_city} - {order.delivery_date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={`${status?.color} border`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status?.label}
                        </Badge>
                        <p className="font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                          {order.total_price.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions for Pro users */}
      {user?.user_type === "pro" && (
        <Card className="border-0 shadow-md bg-slate-900 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 
                  className="text-xl font-bold mb-1"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  COMPTE PROFESSIONNEL
                </h3>
                <p className="text-slate-300">
                  {user.company_name} - Facturation entreprise disponible
                </p>
              </div>
              <Link to="/dashboard/new-order">
                <Button className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide">
                  Commander pour la flotte
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
