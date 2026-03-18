import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  Fuel, 
  Lock,
  MapPin,
  Phone,
  User,
  Clock,
  CheckCircle,
  Truck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DriverPage = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markingDelivered, setMarkingDelivered] = useState(null);

  const storedCode = localStorage.getItem("driver_code");

  useEffect(() => {
    if (storedCode) {
      setCode(storedCode);
      setAuthenticated(true);
      fetchPlanning(storedCode, selectedDate);
    }
  }, []);

  useEffect(() => {
    if (authenticated && code) {
      fetchPlanning(code, selectedDate);
    }
  }, [selectedDate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/driver/login?code=${code}`);
      localStorage.setItem("driver_code", code);
      setAuthenticated(true);
      fetchPlanning(code, selectedDate);
      toast.success("Accès autorisé !");
    } catch (error) {
      toast.error("Code incorrect");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("driver_code");
    setAuthenticated(false);
    setCode("");
    setPlanning(null);
  };

  const fetchPlanning = async (accessCode, date) => {
    setLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await axios.get(`${API}/driver/planning?code=${accessCode}&date=${dateStr}`);
      setPlanning(res.data);
    } catch (error) {
      toast.error("Erreur lors du chargement du planning");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async (orderId) => {
    setMarkingDelivered(orderId);
    try {
      await axios.post(`${API}/driver/mark-delivered/${orderId}?code=${code}`);
      toast.success("Commande marquée comme livrée !");
      fetchPlanning(code, selectedDate);
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setMarkingDelivered(null);
    }
  };

  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Generate Google Maps route URL with all addresses
  const generateMapsRoute = () => {
    if (!planning || !planning.orders || planning.orders.length === 0) return null;
    
    // Filter only undelivered orders and sort by time slot
    const pendingOrders = planning.orders
      .filter(o => o.status !== 'delivered')
      .sort((a, b) => a.delivery_time_slot.localeCompare(b.delivery_time_slot));
    
    if (pendingOrders.length === 0) return null;
    
    // Build addresses array
    const addresses = pendingOrders.map(order => 
      `${order.delivery_address}, ${order.delivery_postal_code} ${order.delivery_city}`
    );
    
    // Google Maps URL with waypoints
    // Format: origin -> waypoints -> destination
    const origin = encodeURIComponent("130 rue Francis Perrin, 37260 MONTS"); // Départ entreprise
    const destination = encodeURIComponent(addresses[addresses.length - 1]);
    
    if (addresses.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    }
    
    const waypoints = addresses.slice(0, -1).map(a => encodeURIComponent(a)).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Fuel className="h-8 w-8 text-slate-900" />
            </div>
            <CardTitle 
              className="text-2xl font-bold text-slate-900"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              ESPACE LIVREUR
            </CardTitle>
            <p className="text-slate-500">Alia Refuel</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Code d'accès"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="pl-10 h-12 text-center text-lg tracking-widest"
                  data-testid="driver-code-input"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !code}
                className="w-full h-12 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold"
                data-testid="driver-login-btn"
              >
                {loading ? "Vérification..." : "Accéder au planning"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Planning screen
  return (
    <div className="min-h-screen bg-slate-100" data-testid="driver-planning">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Fuel className="h-6 w-6 text-amber-500" />
              <span className="font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                ALIA REFUEL
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center justify-between bg-slate-800 rounded-lg p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousDay}
              className="text-white hover:bg-slate-700"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="text-center">
              <p className="text-amber-500 font-bold text-lg">
                {format(selectedDate, "EEEE", { locale: fr })}
              </p>
              <p className="text-white text-sm">
                {format(selectedDate, "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextDay}
              className="text-white hover:bg-slate-700"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="w-full mt-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-slate-900"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Aujourd'hui
          </Button>
        </div>
      </div>

      {/* Stats */}
      {planning && (
        <div className="bg-amber-500 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-3xl font-bold text-slate-900">{planning.total_orders}</p>
                <p className="text-sm text-slate-700">Livraisons</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{planning.total_liters}L</p>
                <p className="text-sm text-slate-700">Total</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{planning.delivered_count}/{planning.total_orders}</p>
                <p className="text-sm text-slate-700">Livrées</p>
              </div>
            </div>
            
            {/* Google Maps Route Button */}
            {generateMapsRoute() && (
              <a
                href={generateMapsRoute()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors"
              >
                <MapPin className="h-5 w-5 text-amber-500" />
                OUVRIR L'ITINÉRAIRE ({planning.pending_count} adresses)
              </a>
            )}
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement...</p>
          </div>
        ) : planning && planning.total_orders === 0 ? (
          <Card className="border-0 shadow">
            <CardContent className="py-12 text-center">
              <Truck className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">Aucune livraison prévue</p>
              <p className="text-slate-400">pour cette date</p>
            </CardContent>
          </Card>
        ) : planning && Object.entries(planning.orders_by_slot).sort().map(([slot, orders]) => (
          <div key={slot}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                {slot.replace("-", "h - ")}h
              </h2>
              <Badge className="bg-slate-900 text-white">
                {orders.length} livraison{orders.length > 1 ? "s" : ""}
              </Badge>
            </div>
            
            {orders.map((order, index) => (
              <Card 
                key={order.id} 
                className={`border-0 shadow mb-3 ${order.status === 'delivered' ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`}
              >
                <CardContent className="p-4">
                  {/* Status & Quantity */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={order.status === 'delivered' ? 'bg-green-500 text-white' : 'bg-amber-500 text-slate-900'}>
                        {order.status === 'delivered' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Livrée</>
                        ) : (
                          <><Truck className="h-3 w-3 mr-1" /> À livrer</>
                        )}
                      </Badge>
                      <Badge variant="outline" className={order.customer_type === 'PRO' ? 'border-blue-500 text-blue-500' : 'border-green-500 text-green-500'}>
                        {order.customer_type}
                      </Badge>
                    </div>
                    <span className="text-2xl font-bold text-amber-500" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {order.quantity}L
                    </span>
                  </div>
                  
                  {/* Customer Info */}
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="font-semibold text-slate-900">{order.customer_name}</span>
                      {order.company_name && (
                        <span className="text-slate-500">({order.company_name})</span>
                      )}
                    </div>
                    <a 
                      href={`tel:${order.customer_phone}`}
                      className="flex items-center gap-2 text-lg font-bold text-green-600 mb-2"
                    >
                      <Phone className="h-5 w-5" />
                      {order.customer_phone}
                    </a>
                  </div>
                  
                  {/* Address */}
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(order.delivery_address + ' ' + order.delivery_postal_code + ' ' + order.delivery_city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 bg-slate-900 text-white rounded-lg p-3 mb-3"
                  >
                    <MapPin className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{order.delivery_address}</p>
                      <p>{order.delivery_postal_code} {order.delivery_city}</p>
                    </div>
                  </a>
                  
                  {/* Notes */}
                  {order.notes && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mb-3 rounded-r">
                      <p className="text-sm font-semibold text-amber-800">📝 Instructions :</p>
                      <p className="text-amber-900">{order.notes}</p>
                    </div>
                  )}
                  
                  {/* Price & Action */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-xl font-bold text-slate-900">
                      {order.total_price.toFixed(2)}€
                    </span>
                    
                    {order.status !== 'delivered' && (
                      <Button
                        onClick={() => handleMarkDelivered(order.id)}
                        disabled={markingDelivered === order.id}
                        className="bg-green-600 text-white hover:bg-green-500 font-bold"
                        data-testid={`deliver-btn-${order.id}`}
                      >
                        {markingDelivered === order.id ? (
                          "..."
                        ) : (
                          <><CheckCircle className="h-4 w-4 mr-2" /> Marquer livrée</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriverPage;
