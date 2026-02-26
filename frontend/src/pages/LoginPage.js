import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Fuel, Mail, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(formData.email, formData.password);
      toast.success("Connexion réussie !");
      navigate("/dashboard");
    } catch (error) {
      const message = error.response?.data?.detail || "Erreur de connexion";
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
            backgroundImage: 'url(https://images.unsplash.com/photo-1660316806126-ec9a53892bde?q=85&w=1200&auto=format&fit=crop)',
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
            VOTRE CARBURANT,<br />
            <span className="text-amber-500">LIVRÉ À DOMICILE</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Connectez-vous pour gérer vos commandes et suivre vos livraisons en temps réel.
          </p>
        </div>
        <div className="relative text-slate-400 text-sm">
          &copy; 2024 Alia Refuel. Tous droits réservés.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2 text-slate-900">
              <ArrowLeft className="h-5 w-5" />
              <span>Retour</span>
            </Link>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-6">
              <div className="flex items-center gap-2 lg:hidden mb-4">
                <Fuel className="h-8 w-8 text-amber-500" />
                <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  ALIA REFUEL
                </span>
              </div>
              <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                CONNEXION
              </CardTitle>
              <CardDescription className="text-slate-600">
                Entrez vos identifiants pour accéder à votre espace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500 focus:ring-amber-500"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

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
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:border-amber-500 focus:ring-amber-500"
                      required
                      data-testid="login-password-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide text-base"
                  data-testid="login-submit-btn"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent"></div>
                      <span>Connexion...</span>
                    </div>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-slate-600">
                  Pas encore de compte ?{" "}
                  <Link to="/register" className="text-amber-600 hover:text-amber-700 font-semibold" data-testid="login-register-link">
                    S'inscrire
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

export default LoginPage;
