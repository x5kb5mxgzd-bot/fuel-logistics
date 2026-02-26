import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  Fuel, 
  MapPin, 
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle,
  Truck,
  XCircle,
  Phone,
  FileText,
  Loader2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  pending: { 
    label: "En attente", 
    color: "bg-amber-100 text-amber-800 border-amber-200", 
    icon: Clock,
    description: "Votre commande est en attente de confirmation"
  },
  confirmed: { 
    label: "Confirmée", 
    color: "bg-blue-100 text-blue-800 border-blue-200", 
    icon: CheckCircle,
    description: "Votre commande a été confirmée et sera livrée à la date prévue"
  },
  in_delivery: { 
    label: "En livraison", 
    color: "bg-purple-100 text-purple-800 border-purple-200", 
    icon: Truck,
    description: "Le livreur est en route vers votre adresse"
  },
  delivered: { 
    label: "Livrée", 
    color: "bg-green-100 text-green-800 border-green-200", 
    icon: CheckCircle,
    description: "Votre commande a été livrée avec succès"
  },
  cancelled: { 
    label: "Annulée", 
    color: "bg-red-100 text-red-800 border-red-200", 
    icon: XCircle,
    description: "Cette commande a été annulée"
  }
};

const statusSteps = ["pending", "confirmed", "in_delivery", "delivered"];

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axios.get(`${API}/orders/${id}`, { headers: getAuthHeader() });
        setOrder(res.data);
      } catch (error) {
        console.error("Error fetching order:", error);
        toast.error("Commande non trouvée");
        navigate("/dashboard/orders");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, getAuthHeader, navigate]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await axios.delete(`${API}/orders/${id}`, { headers: getAuthHeader() });
      toast.success("Commande annulée avec succès");
      navigate("/dashboard/orders");
    } catch (error) {
      const message = error.response?.data?.detail || "Erreur lors de l'annulation";
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (!order) return null;

  const status = statusConfig[order.status];
  const StatusIcon = status?.icon || Clock;
  const currentStepIndex = statusSteps.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const canCancel = ["pending", "confirmed"].includes(order.status);

  const createdDate = new Date(order.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <div className="max-w-3xl mx-auto" data-testid="order-detail-page">
      {/* Back Button */}
      <Link to="/dashboard/orders" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Retour aux commandes
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            COMMANDE #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-slate-600 mt-1">Créée le {createdDate}</p>
        </div>
        <Badge className={`${status?.color} border text-base px-4 py-2`}>
          <StatusIcon className="h-4 w-4 mr-2" />
          {status?.label}
        </Badge>
      </div>

      {/* Status Progress (not for cancelled) */}
      {!isCancelled && (
        <Card className="border-0 shadow-md mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              {statusSteps.map((step, index) => {
                const stepStatus = statusConfig[step];
                const StepIcon = stepStatus.icon;
                const isCompleted = currentStepIndex >= index;
                const isCurrent = currentStepIndex === index;
                
                return (
                  <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isCompleted 
                            ? isCurrent 
                              ? "bg-amber-500 text-slate-900" 
                              : "bg-green-500 text-white"
                            : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs mt-2 font-medium text-center ${
                        isCompleted ? "text-slate-900" : "text-slate-400"
                      }`}>
                        {stepStatus.label}
                      </span>
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div className={`h-1 w-8 sm:w-16 mx-1 rounded ${
                        currentStepIndex > index ? "bg-green-500" : "bg-slate-200"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-slate-600 mt-4">{status?.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Order Details */}
      <Card className="border-0 shadow-md mb-6">
        <CardHeader>
          <CardTitle 
            className="text-xl font-bold"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            DÉTAILS DE LA COMMANDE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product */}
          <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
            <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Fuel className="h-7 w-7 text-slate-900" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 text-lg">Diesel</h4>
              <p className="text-slate-600">{order.quantity} litres</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Prix carburant</p>
              <p className="font-bold text-slate-900">{order.price_fuel.toFixed(2)}€</p>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
            <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Adresse de livraison</h4>
              <p className="text-slate-600">{order.delivery_address}</p>
              <p className="text-slate-600">{order.delivery_postal_code} {order.delivery_city}</p>
            </div>
          </div>

          {/* Delivery Schedule */}
          <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
            <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="h-7 w-7 text-slate-900" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Date de livraison</h4>
              <p className="text-slate-600">{order.delivery_date}</p>
              <p className="text-slate-500">{order.delivery_time_slot?.replace("-", " - ")}</p>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="h-7 w-7 text-slate-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Instructions</h4>
                <p className="text-slate-600">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Price Summary */}
          <div className="bg-slate-50 rounded-xl p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-600">Carburant ({order.quantity}L)</span>
              <span className="font-semibold">{order.price_fuel.toFixed(2)}€</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-600">Frais de livraison</span>
                <span className="font-semibold">{order.delivery_fee.toFixed(2)}€</span>
              </div>
            )}
            {order.delivery_fee === 0 && (
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-600">Livraison</span>
                <span className="font-semibold text-green-600">Gratuite</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <span className="text-xl font-bold text-slate-900">Total</span>
              <span 
                className="text-3xl font-bold text-amber-500"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                data-testid="order-total"
              >
                {order.total_price.toFixed(2)}€
              </span>
            </div>
            <p className="text-sm text-slate-500 text-center mt-4">
              Paiement à la livraison
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="outline"
              className="flex-1 h-12 border-slate-200"
              onClick={() => window.open("tel:+33123456789")}
            >
              <Phone className="h-5 w-5 mr-2" />
              Contacter le support
            </Button>
            
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    data-testid="cancel-order-btn"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Annuler la commande
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Êtes-vous sûr de vouloir annuler cette commande de {order.quantity}L de diesel ?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Non, garder la commande</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      className="bg-red-600 text-white hover:bg-red-700"
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Annulation...
                        </>
                      ) : (
                        "Oui, annuler"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetail;
