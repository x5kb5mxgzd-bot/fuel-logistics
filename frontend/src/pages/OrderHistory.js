import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Fuel, 
  Search, 
  Filter,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Plus,
  ChevronRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  confirmed: { label: "Confirmée", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
  in_delivery: { label: "En livraison", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Truck },
  delivered: { label: "Livrée", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle }
};

const OrderHistory = () => {
  const { getAuthHeader } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get(`${API}/orders`, { headers: getAuthHeader() });
        setOrders(res.data);
        setFilteredOrders(res.data);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [getAuthHeader]);

  useEffect(() => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.delivery_city.toLowerCase().includes(term) ||
        order.delivery_address.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term)
      );
    }

    setFilteredOrders(filtered);
  }, [orders, statusFilter, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="order-history-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            MES COMMANDES
          </h1>
          <p className="text-slate-600 mt-1">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} au total
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

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Rechercher par ville, adresse ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-amber-500"
                data-testid="search-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-slate-50 border-slate-200" data-testid="status-filter">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                  <SelectItem value="in_delivery">En livraison</SelectItem>
                  <SelectItem value="delivered">Livrée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center">
            <Fuel className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            {orders.length === 0 ? (
              <>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Aucune commande</h3>
                <p className="text-slate-500 mb-6">Vous n'avez pas encore passé de commande</p>
                <Link to="/dashboard/new-order">
                  <Button className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold">
                    Passer ma première commande
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun résultat</h3>
                <p className="text-slate-500">Aucune commande ne correspond à vos critères</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status];
            const StatusIcon = status?.icon || Clock;
            const createdDate = new Date(order.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric"
            });
            
            return (
              <Link 
                key={order.id} 
                to={`/dashboard/orders/${order.id}`}
                data-testid={`order-card-${order.id}`}
              >
                <Card className="border-0 shadow-md hover:shadow-lg transition-all card-hover">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Fuel className="h-7 w-7 text-amber-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-slate-900 text-lg">
                              {order.quantity}L Diesel
                            </h3>
                            <Badge className={`${status?.color} border`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status?.label}
                            </Badge>
                          </div>
                          <p className="text-slate-600">
                            {order.delivery_address}, {order.delivery_city}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            Commandé le {createdDate} • Livraison prévue le {order.delivery_date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <p 
                            className="text-2xl font-bold text-amber-500"
                            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                          >
                            {order.total_price.toFixed(2)}€
                          </p>
                          <p className="text-sm text-slate-500">
                            {order.delivery_time_slot?.replace("-", " - ")}
                          </p>
                        </div>
                        <ChevronRight className="h-6 w-6 text-slate-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
