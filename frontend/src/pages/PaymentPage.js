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
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axios.get(`${API}/orders/${orderId}`, { headers: getAuthHeader() });
        setOrder(res.data);
        
        // Check if returning from payment
        const status = searchParams.get('status');
        if (status === 'success') {
          await confirmPayment();
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        toast.error("Commande non trouvée");
        navigate("/dashboard/orders");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, getAuthHeader, navigate, searchParams]);

  useEffect(() => {
    // Load SumUp Card Widget script
    if (!document.getElementById('sumup-card-sdk')) {
      const script = document.createElement('script');
      script.id = 'sumup-card-sdk';
      script.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
      script.async = true;
      script.onload = () => setWidgetLoaded(true);
      document.body.appendChild(script);
    } else {
      setWidgetLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (widgetLoaded && order && !paymentSuccess && window.SumUpCard) {
      initializeSumUpWidget();
    }
  }, [widgetLoaded, order, paymentSuccess]);

  const initializeSumUpWidget = async () => {
    try {
      // Get payment config
      const configRes = await axios.get(`${API}/payments/config`);
      const config = configRes.data;

      // Create checkout
      const checkoutRes = await axios.post(
        `${API}/payments/create-checkout?order_id=${orderId}`,
        {},
        { headers: getAuthHeader() }
      );

      const checkoutData = checkoutRes.data;

      // Mount SumUp widget
      if (window.SumUpCard && document.getElementById('sumup-card-widget')) {
        window.SumUpCard.mount({
          id: 'sumup-card-widget',
          checkoutId: orderId,
          merchantCode: config.merchant_code,
          amount: checkoutData.amount,
          currency: checkoutData.currency,
          locale: 'fr-FR',
          onResponse: async (type, body) => {
            console.log('SumUp response:', type, body);
            if (type === 'success') {
              await confirmPayment(body.checkout_id);
            } else if (type === 'error') {
              toast.error(body.message || 'Erreur de paiement');
            }
          }
        });
      }
    } catch (error) {
      console.error('Error initializing SumUp:', error);
    }
  };

  const confirmPayment = async (checkoutId = null) => {
    setProcessing(true);
    try {
      await axios.post(
        `${API}/payments/confirm/${orderId}?checkout_id=${checkoutId || ''}`,
        {},
        { headers: getAuthHeader() }
      );
      setPaymentSuccess(true);
      toast.success("Paiement effectué avec succès !");
      setTimeout(() => navigate("/dashboard/orders"), 3000);
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Erreur lors de la confirmation du paiement");
    } finally {
      setProcessing(false);
    }
  };

  const handleSimulatePayment = async () => {
    // For testing - simulate successful payment
    setProcessing(true);
    await confirmPayment('test_checkout');
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse"></div>
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
              <span className="text-slate-600">Diesel ({order?.quantity}L)</span>
              <span className="font-semibold">{order?.price_fuel?.toFixed(2)}€</span>
            </div>
            {order?.delivery_fee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Livraison</span>
                <span className="font-semibold">{order?.delivery_fee?.toFixed(2)}€</span>
              </div>
            )}
            {order?.delivery_fee === 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Livraison</span>
                <span className="font-semibold text-green-600">Gratuite</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between">
              <span className="text-lg font-bold">Total</span>
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
            Paiement par carte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* SumUp Card Widget Container */}
          <div id="sumup-card-widget" className="min-h-[300px]">
            {!widgetLoaded && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            )}
          </div>

          {/* Alternative: Manual Payment Button (for testing) */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-slate-500 text-center mb-4">
              Ou payez directement via SumUp
            </p>
            <Button
              onClick={handleSimulatePayment}
              disabled={processing}
              className="w-full h-14 bg-green-600 text-white hover:bg-green-500 font-bold text-lg"
              data-testid="pay-button"
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Traitement...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payer {order?.total_price?.toFixed(2)}€
                </div>
              )}
            </Button>
          </div>

          {/* Security Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500">
            <Shield className="h-4 w-4" />
            <span className="text-sm">Paiement sécurisé par SumUp</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentPage;
