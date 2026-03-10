import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  CreditCard, 
  CheckCircle, 
  Loader2,
  ArrowLeft,
  Shield,
  Lock
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [checkoutId, setCheckoutId] = useState(null);
  const [widgetMounted, setWidgetMounted] = useState(false);

  useEffect(() => {
    const fetchOrderAndCreateCheckout = async () => {
      try {
        // Fetch order details
        const orderRes = await axios.get(`${API}/orders/${orderId}`, { headers: getAuthHeader() });
        setOrder(orderRes.data);
        
        // Check if already paid
        if (orderRes.data.payment_status === "paid") {
          setPaymentSuccess(true);
          setLoading(false);
          return;
        }
        
        // Check if returning from payment
        const status = searchParams.get('status');
        if (status === 'success') {
          await confirmPayment();
          setLoading(false);
          return;
        }
        
        // Create SumUp checkout
        const returnUrl = `${window.location.origin}/dashboard/payment/${orderId}?status=success`;
        const checkoutRes = await axios.post(
          `${API}/payments/create-checkout?order_id=${orderId}&return_url=${encodeURIComponent(returnUrl)}`,
          {},
          { headers: getAuthHeader() }
        );
        
        setCheckoutId(checkoutRes.data.checkout_id);
        
      } catch (error) {
        console.error("Error:", error);
        toast.error("Erreur lors du chargement de la commande");
        navigate("/dashboard/orders");
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrderAndCreateCheckout();
  }, [orderId, getAuthHeader, navigate, searchParams]);

  useEffect(() => {
    // Load SumUp Card Widget script
    if (!document.getElementById('sumup-card-sdk')) {
      const script = document.createElement('script');
      script.id = 'sumup-card-sdk';
      script.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Mount SumUp widget when checkout is ready
    if (checkoutId && order && !paymentSuccess && !widgetMounted && window.SumUpCard) {
      mountSumUpWidget();
    }
  }, [checkoutId, order, paymentSuccess, widgetMounted]);

  // Retry mounting widget if SDK loads after checkout
  useEffect(() => {
    const interval = setInterval(() => {
      if (checkoutId && order && !paymentSuccess && !widgetMounted && window.SumUpCard) {
        mountSumUpWidget();
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [checkoutId, order, paymentSuccess, widgetMounted]);

  const mountSumUpWidget = () => {
    try {
      const container = document.getElementById('sumup-card-widget');
      if (!container || widgetMounted) return;
      
      window.SumUpCard.mount({
        id: 'sumup-card-widget',
        checkoutId: checkoutId,
        onResponse: async (type, body) => {
          console.log('SumUp response:', type, body);
          if (type === 'success') {
            await confirmPayment(checkoutId);
          } else if (type === 'error') {
            toast.error(body?.message || 'Erreur de paiement');
          }
        },
        onLoad: () => {
          console.log('SumUp widget loaded');
          setWidgetMounted(true);
        }
      });
    } catch (error) {
      console.error('Error mounting SumUp widget:', error);
    }
  };

  const confirmPayment = async (checkoutIdParam = null) => {
    setProcessing(true);
    try {
      await axios.post(
        `${API}/payments/confirm/${orderId}?checkout_id=${checkoutIdParam || checkoutId || ''}`,
        {},
        { headers: getAuthHeader() }
      );
      setPaymentSuccess(true);
      toast.success("Paiement effectué avec succès !");
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Erreur lors de la confirmation du paiement");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
          <p className="text-slate-600">Préparation du paiement...</p>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h1 
              className="text-3xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              PAIEMENT RÉUSSI !
            </h1>
            <p className="text-slate-600 mb-6">
              Votre commande de {order?.quantity}L de diesel a été confirmée.
              <br />Vous allez recevoir un email de confirmation.
            </p>
            <p className="text-2xl font-bold text-green-600 mb-8">
              {order?.total_price?.toFixed(2)}€
            </p>
            <Button
              onClick={() => navigate("/dashboard/orders")}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold"
            >
              Voir mes commandes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto" data-testid="payment-page">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(`/dashboard/orders/${orderId}`)}
        className="mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Retour à la commande
      </Button>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="h-10 w-10 text-slate-900" />
        </div>
        <h1 
          className="text-3xl font-bold text-slate-900 mb-2"
          style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
        >
          PAIEMENT SÉCURISÉ
        </h1>
        <p className="text-slate-600">Finalisez votre commande de {order?.quantity}L de diesel</p>
      </div>

      {/* Order Summary */}
      <Card className="border-0 shadow-md mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-600">Diesel ({order?.quantity}L × 1,80€)</span>
              <span className="font-semibold">{order?.price_fuel?.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Livraison</span>
              <span className="font-semibold text-green-600">Gratuite</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="text-lg font-bold">Total à payer</span>
              <span 
                className="text-2xl font-bold text-amber-500"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                {order?.total_price?.toFixed(2)}€
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Widget */}
      <Card className="border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-600" />
            Paiement par carte bancaire
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* SumUp Card Widget Container */}
          <div id="sumup-card-widget" className="min-h-[350px]">
            {!widgetMounted && (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-4" />
                <p className="text-slate-500">Chargement du formulaire de paiement...</p>
              </div>
            )}
          </div>

          {/* Security Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500">
            <Shield className="h-4 w-4" />
            <span className="text-sm">Paiement 100% sécurisé par SumUp</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentPage;
