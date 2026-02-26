import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Fuel, 
  MapPin, 
  Calendar as CalendarIcon, 
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STEPS = [
  { id: 1, title: "Quantité", icon: Fuel },
  { id: 2, title: "Adresse", icon: MapPin },
  { id: 3, title: "Date", icon: CalendarIcon },
  { id: 4, title: "Confirmation", icon: Check }
];

const TIME_SLOTS = [
  { value: "08:00-10:00", label: "08h00 - 10h00" },
  { value: "10:00-12:00", label: "10h00 - 12h00" },
  { value: "14:00-16:00", label: "14h00 - 16h00" },
  { value: "16:00-18:00", label: "16h00 - 18h00" }
];

const NewOrder = () => {
  const navigate = useNavigate();
  const { user, getAuthHeader } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState({ price_per_liter: 1.85, delivery_fee: 15, minimum_quantity: 20 });
  const [formData, setFormData] = useState({
    quantity: 50,
    delivery_address: user?.address || "",
    delivery_city: user?.city || "",
    delivery_postal_code: user?.postal_code || "",
    delivery_date: null,
    delivery_time_slot: "",
    notes: ""
  });

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await axios.get(`${API}/pricing`);
        setPricing(res.data);
      } catch (error) {
        console.error("Error fetching pricing:", error);
      }
    };
    fetchPricing();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        delivery_address: user.address || prev.delivery_address,
        delivery_city: user.city || prev.delivery_city,
        delivery_postal_code: user.postal_code || prev.delivery_postal_code
      }));
    }
  }, [user]);

  const calculatePrice = () => {
    const fuelPrice = formData.quantity * pricing.price_per_liter;
    const total = fuelPrice + pricing.delivery_fee;
    return { fuelPrice, deliveryFee: pricing.delivery_fee, total };
  };

  const prices = calculatePrice();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value) || pricing.minimum_quantity;
    setFormData({ ...formData, quantity: Math.max(pricing.minimum_quantity, value) });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.quantity >= pricing.minimum_quantity;
      case 2:
        return formData.delivery_address && formData.delivery_city && formData.delivery_postal_code;
      case 3:
        return formData.delivery_date && formData.delivery_time_slot;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const orderData = {
        ...formData,
        delivery_date: format(formData.delivery_date, "yyyy-MM-dd")
      };
      
      await axios.post(`${API}/orders`, orderData, { headers: getAuthHeader() });
      toast.success("Commande créée avec succès !");
      navigate("/dashboard/orders");
    } catch (error) {
      const message = error.response?.data?.detail || "Erreur lors de la création de la commande";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Get min date (tomorrow)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  return (
    <div className="max-w-3xl mx-auto" data-testid="new-order-page">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold text-slate-900 mb-2"
          style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
        >
          NOUVELLE COMMANDE
        </h1>
        <p className="text-slate-600">Commandez votre diesel en quelques étapes simples</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    currentStep > step.id 
                      ? "bg-green-500 text-white" 
                      : currentStep === step.id 
                        ? "bg-amber-500 text-slate-900" 
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <step.icon className="h-6 w-6" />
                  )}
                </div>
                <span className={`text-sm mt-2 font-medium ${
                  currentStep >= step.id ? "text-slate-900" : "text-slate-400"
                }`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-1 w-12 sm:w-20 mx-2 rounded ${
                  currentStep > step.id ? "bg-green-500" : "bg-slate-200"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Card */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          {/* Step 1: Quantity */}
          {currentStep === 1 && (
            <div className="space-y-6" data-testid="step-quantity">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Fuel className="h-10 w-10 text-slate-900" />
                </div>
                <h2 
                  className="text-2xl font-bold text-slate-900"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  QUELLE QUANTITÉ ?
                </h2>
                <p className="text-slate-600 mt-2">Minimum {pricing.minimum_quantity} litres</p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="quantity" className="text-slate-700 font-medium text-lg">
                  Quantité de diesel (litres)
                </Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={pricing.minimum_quantity}
                  step="10"
                  value={formData.quantity}
                  onChange={handleQuantityChange}
                  className="h-16 text-2xl text-center font-bold bg-slate-50 border-slate-200 focus:border-amber-500"
                  data-testid="quantity-input"
                />
                
                {/* Quick select buttons */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {[20, 50, 100, 200, 500].map((qty) => (
                    <Button
                      key={qty}
                      type="button"
                      variant={formData.quantity === qty ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, quantity: qty })}
                      className={formData.quantity === qty 
                        ? "bg-amber-500 text-slate-900 hover:bg-amber-400" 
                        : "border-slate-200 hover:border-amber-500"
                      }
                    >
                      {qty}L
                    </Button>
                  ))}
                </div>
              </div>

              {/* Price Preview */}
              <div className="bg-slate-50 rounded-xl p-6 mt-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-600">Prix du carburant ({formData.quantity}L × {pricing.price_per_liter}€)</span>
                  <span className="font-semibold">{prices.fuelPrice.toFixed(2)}€</span>
                </div>
                {prices.deliveryFee > 0 && (
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-600">Frais de livraison</span>
                    <span className="font-semibold">{prices.deliveryFee.toFixed(2)}€</span>
                  </div>
                )}
                {prices.deliveryFee === 0 && (
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-600">Livraison</span>
                    <span className="font-semibold text-green-600">Gratuite</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-900">Total estimé</span>
                    <span 
                      className="text-3xl font-bold text-amber-500"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      {prices.total.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Address */}
          {currentStep === 2 && (
            <div className="space-y-6" data-testid="step-address">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-10 w-10 text-amber-500" />
                </div>
                <h2 
                  className="text-2xl font-bold text-slate-900"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  OÙ LIVRER ?
                </h2>
                <p className="text-slate-600 mt-2">Adresse de livraison du carburant</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery_address" className="text-slate-700 font-medium">
                    Adresse complète
                  </Label>
                  <Input
                    id="delivery_address"
                    name="delivery_address"
                    placeholder="123 Rue de la Paix"
                    value={formData.delivery_address}
                    onChange={handleChange}
                    className="h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                    required
                    data-testid="address-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delivery_city" className="text-slate-700 font-medium">
                      Ville
                    </Label>
                    <Input
                      id="delivery_city"
                      name="delivery_city"
                      placeholder="Paris"
                      value={formData.delivery_city}
                      onChange={handleChange}
                      className="h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="city-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_postal_code" className="text-slate-700 font-medium">
                      Code postal
                    </Label>
                    <Input
                      id="delivery_postal_code"
                      name="delivery_postal_code"
                      placeholder="75001"
                      value={formData.delivery_postal_code}
                      onChange={handleChange}
                      className="h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="postal-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-slate-700 font-medium">
                    Instructions de livraison (optionnel)
                  </Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Ex: Code portail, accès parking, contact sur place..."
                    value={formData.notes}
                    onChange={handleChange}
                    className="min-h-[100px] bg-slate-50 border-slate-200 focus:border-amber-500"
                    data-testid="notes-input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Date */}
          {currentStep === 3 && (
            <div className="space-y-6" data-testid="step-date">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="h-10 w-10 text-slate-900" />
                </div>
                <h2 
                  className="text-2xl font-bold text-slate-900"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  QUAND ?
                </h2>
                <p className="text-slate-600 mt-2">Choisissez la date et le créneau horaire</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Date de livraison</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-12 justify-start text-left font-normal bg-slate-50 border-slate-200 hover:border-amber-500"
                        data-testid="date-picker-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.delivery_date ? (
                          format(formData.delivery_date, "EEEE d MMMM yyyy", { locale: fr })
                        ) : (
                          <span className="text-slate-500">Sélectionner une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.delivery_date}
                        onSelect={(date) => setFormData({ ...formData, delivery_date: date })}
                        disabled={(date) => date < minDate}
                        initialFocus
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Créneau horaire</Label>
                  <Select
                    value={formData.delivery_time_slot}
                    onValueChange={(value) => setFormData({ ...formData, delivery_time_slot: value })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-200" data-testid="time-slot-select">
                      <SelectValue placeholder="Sélectionner un créneau" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot.value} value={slot.value}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-500" />
                            {slot.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-6" data-testid="step-confirmation">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-10 w-10 text-white" />
                </div>
                <h2 
                  className="text-2xl font-bold text-slate-900"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  RÉCAPITULATIF
                </h2>
                <p className="text-slate-600 mt-2">Vérifiez votre commande avant de confirmer</p>
              </div>

              {/* Order Summary */}
              <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-4 pb-4 border-b border-slate-200">
                  <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Fuel className="h-6 w-6 text-slate-900" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Diesel</h4>
                    <p className="text-slate-600">{formData.quantity} litres</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pb-4 border-b border-slate-200">
                  <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Livraison</h4>
                    <p className="text-slate-600">{formData.delivery_address}</p>
                    <p className="text-slate-600">{formData.delivery_postal_code} {formData.delivery_city}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pb-4 border-b border-slate-200">
                  <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="h-6 w-6 text-slate-900" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Date & Heure</h4>
                    <p className="text-slate-600">
                      {formData.delivery_date && format(formData.delivery_date, "EEEE d MMMM yyyy", { locale: fr })}
                    </p>
                    <p className="text-slate-600">{formData.delivery_time_slot?.replace("-", " - ")}</p>
                  </div>
                </div>

                {formData.notes && (
                  <div className="pb-4 border-b border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-1">Instructions</h4>
                    <p className="text-slate-600">{formData.notes}</p>
                  </div>
                )}

                {/* Price Summary */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Carburant ({formData.quantity}L × {pricing.price_per_liter}€)</span>
                    <span className="font-semibold">{prices.fuelPrice.toFixed(2)}€</span>
                  </div>
                  {prices.deliveryFee > 0 && (
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-600">Frais de livraison</span>
                      <span className="font-semibold">{prices.deliveryFee.toFixed(2)}€</span>
                    </div>
                  )}
                  {prices.deliveryFee === 0 && (
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-600">Livraison</span>
                      <span className="font-semibold text-green-600">Gratuite</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-300">
                    <span className="text-xl font-bold text-slate-900">Total à payer</span>
                    <span 
                      className="text-4xl font-bold text-amber-500"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                      data-testid="total-price"
                    >
                      {prices.total.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-slate-500">
                Paiement à la livraison (espèces ou carte bancaire)
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="border-slate-200 hover:border-slate-300"
                data-testid="back-btn"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide"
                data-testid="next-btn"
              >
                Suivant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-green-600 text-white hover:bg-green-500 font-bold uppercase tracking-wide px-8"
                data-testid="confirm-order-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirmation...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmer la commande
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewOrder;
