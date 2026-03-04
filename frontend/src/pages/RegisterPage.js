import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Fuel, Mail, Lock, User, Phone, MapPin, Building, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    user_type: "particulier",
    full_name: "",
    company_name: "",
    phone: "",
    address: "",
    city: "",
    postal_code: ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeChange = (value) => {
    setFormData({ ...formData, user_type: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    
    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      toast.success("Compte créé avec succès !");
      navigate("/dashboard");
    } catch (error) {
      const message = error.response?.data?.detail || "Erreur lors de l'inscription";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Branding */}
      <div 
        className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative overflow-hidden"
      >
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1708008914410-fc368c747e87?q=85&w=1920&auto=format&fit=crop)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="relative">
          <Link to="/" className="flex items-center gap-2">
            <Fuel className="h-10 w-10 text-amber-500" />
            <span className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              ALIA REFUEL
            </span>
          </Link>
        </div>
        <div className="relative">
          <h1 
            className="text-4xl font-bold leading-tight mb-4"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            REJOIGNEZ<br />
            <span className="text-amber-500">ALIA REFUEL</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Créez votre compte et commencez à commander votre carburant en quelques clics.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-amber-500 text-2xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>1,80€</p>
              <p className="text-slate-300 text-sm">par litre</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-amber-500 text-2xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>12H</p>
              <p className="text-slate-300 text-sm">livraison rapide</p>
            </div>
          </div>
        </div>
        <div className="relative text-slate-400 text-sm">
          &copy; 2024 Alia Refuel. Tous droits réservés.
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile Header */}
          <div className="lg:hidden mb-6">
            <Link to="/" className="flex items-center gap-2 text-slate-900">
              <ArrowLeft className="h-5 w-5" />
              <span>Retour</span>
            </Link>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2 lg:hidden mb-4">
                <Fuel className="h-8 w-8 text-amber-500" />
                <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  ALIA REFUEL
                </span>
              </div>
              <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                CRÉER UN COMPTE
              </CardTitle>
              <CardDescription className="text-slate-600">
                Remplissez le formulaire pour commencer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Account Type */}
                <div className="space-y-3">
                  <Label className="text-slate-700 font-medium">Type de compte</Label>
                  <RadioGroup
                    value={formData.user_type}
                    onValueChange={handleTypeChange}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem
                        value="particulier"
                        id="particulier"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="particulier"
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-white p-4 cursor-pointer peer-data-[state=checked]:border-amber-500 peer-data-[state=checked]:bg-amber-50 transition-all"
                        data-testid="register-type-particulier"
                      >
                        <User className="h-6 w-6 mb-2 text-slate-600" />
                        <span className="font-semibold text-slate-900">Particulier</span>
                        <span className="text-xs text-slate-500">Min. 20L</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="pro"
                        id="pro"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="pro"
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-white p-4 cursor-pointer peer-data-[state=checked]:border-amber-500 peer-data-[state=checked]:bg-amber-50 transition-all"
                        data-testid="register-type-pro"
                      >
                        <Building className="h-6 w-6 mb-2 text-slate-600" />
                        <span className="font-semibold text-slate-900">Professionnel</span>
                        <span className="text-xs text-slate-500">Entreprise</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Company Name (only for Pro) */}
                {formData.user_type === "pro" && (
                  <div className="space-y-2">
                    <Label htmlFor="company_name" className="text-slate-700 font-medium">
                      Nom de l'entreprise
                    </Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="company_name"
                        name="company_name"
                        placeholder="Votre entreprise"
                        value={formData.company_name}
                        onChange={handleChange}
                        className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                        required
                        data-testid="register-company-input"
                      />
                    </div>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-slate-700 font-medium">
                    Nom complet
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="full_name"
                      name="full_name"
                      placeholder="Jean Dupont"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-name-input"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-email-input"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700 font-medium">
                    Téléphone
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-phone-input"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-slate-700 font-medium">
                    Adresse
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="address"
                      name="address"
                      placeholder="123 Rue de la Paix"
                      value={formData.address}
                      onChange={handleChange}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-address-input"
                    />
                  </div>
                </div>

                {/* City and Postal Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-slate-700 font-medium">
                      Ville
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="Paris"
                      value={formData.city}
                      onChange={handleChange}
                      className="h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-city-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code" className="text-slate-700 font-medium">
                      Code postal
                    </Label>
                    <Input
                      id="postal_code"
                      name="postal_code"
                      placeholder="75001"
                      value={formData.postal_code}
                      onChange={handleChange}
                      className="h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-postal-input"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-password-input"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
                    Confirmer le mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500"
                      required
                      data-testid="register-confirm-password-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide text-base mt-6"
                  data-testid="register-submit-btn"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent"></div>
                      <span>Création...</span>
                    </div>
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-slate-600">
                  Déjà inscrit ?{" "}
                  <Link to="/login" className="text-amber-600 hover:text-amber-700 font-semibold" data-testid="register-login-link">
                    Se connecter
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
