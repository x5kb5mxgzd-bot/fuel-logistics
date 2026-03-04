import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Fuel, Truck, Clock, Shield, Users, MapPin, Phone, Mail } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Fuel className="h-8 w-8 text-amber-500" />
              <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                ALIA REFUEL
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-white hover:text-amber-500 hover:bg-transparent" data-testid="header-login-btn">
                  Connexion
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold uppercase tracking-wide" data-testid="header-register-btn">
                  S'inscrire
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/11601286/pexels-photo-11601286.jpeg?auto=compress&cs=tinysrgb&w=1920)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                LIVRAISON DE DIESEL<br />
                <span className="text-amber-500">DIRECTEMENT CHEZ VOUS</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-xl">
                Service professionnel de livraison de carburant pour les entreprises et les particuliers sur <span className="text-amber-500 font-semibold">Tours et ses alentours</span>. 
                Minimum 20 litres pour les particuliers, livraison rapide et fiable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register">
                  <Button 
                    size="lg" 
                    className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide px-8 py-6 text-lg shadow-lg transition-transform hover:-translate-y-1"
                    data-testid="hero-order-btn"
                  >
                    Commander maintenant
                  </Button>
                </Link>
                <Link to="/login">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-2 border-white text-white hover:bg-white hover:text-slate-900 font-semibold uppercase tracking-wide px-8 py-6 text-lg"
                    data-testid="hero-login-btn"
                  >
                    Espace client
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-amber-500/20 rounded-2xl blur-2xl"></div>
                <img 
                  src="https://images.pexels.com/photos/11601286/pexels-photo-11601286.jpeg?auto=compress&cs=tinysrgb&w=600"
                  alt="Livraison de carburant"
                  className="relative rounded-xl shadow-2xl w-full max-w-md mx-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 
              className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              POURQUOI CHOISIR ALIA REFUEL ?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Un service de livraison de carburant sur Tours et ses alentours, conçu pour répondre aux besoins des professionnels et particuliers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="border-2 border-slate-100 hover:border-amber-500 transition-all card-hover">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <Truck className="h-8 w-8 text-slate-900" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  LIVRAISON RAPIDE
                </h3>
                <p className="text-slate-600">
                  Recevez votre carburant en moins de 12h suivant votre commande.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-2 border-slate-100 hover:border-amber-500 transition-all card-hover">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  CRÉNEAUX FLEXIBLES
                </h3>
                <p className="text-slate-600">
                  Choisissez le créneau horaire qui vous convient, du lundi au samedi.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-2 border-slate-100 hover:border-amber-500 transition-all card-hover">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-8 w-8 text-slate-900" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  QUALITÉ GARANTIE
                </h3>
                <p className="text-slate-600">
                  Diesel de première qualité, conforme aux normes EN 590.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              TARIFICATION TRANSPARENTE
            </h2>
            <p className="text-lg text-slate-300">
              Des prix compétitifs, sans surprise.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pro Card */}
            <Card className="bg-white text-slate-900 border-0 overflow-hidden">
              <div className="bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-amber-500" />
                  <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                    PROFESSIONNELS
                  </h3>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <span className="text-5xl font-bold text-amber-500 price-display">1,80€</span>
                  <span className="text-slate-600">/litre</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Facturation entreprise
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Livraison sur site
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Commandes récurrentes
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Suivi détaillé
                  </li>
                </ul>
                <p className="text-sm text-green-600 text-center font-semibold">
                  Livraison gratuite
                </p>
              </CardContent>
            </Card>

            {/* Particulier Card */}
            <Card className="bg-amber-500 text-slate-900 border-0 overflow-hidden">
              <div className="bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Fuel className="h-6 w-6 text-amber-500" />
                  <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                    PARTICULIERS
                  </h3>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <span className="text-5xl font-bold text-slate-900 price-display">1,80€</span>
                  <span className="text-slate-800">/litre</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-800">
                    <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
                    <strong>Minimum 20 litres</strong>
                  </li>
                  <li className="flex items-center gap-2 text-slate-800">
                    <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
                    Livraison à domicile
                  </li>
                  <li className="flex items-center gap-2 text-slate-800">
                    <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
                    Paiement à la livraison
                  </li>
                  <li className="flex items-center gap-2 text-slate-800">
                    <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
                    Tours et alentours (37)
                  </li>
                </ul>
                <p className="text-sm text-green-700 text-center font-semibold">
                  Livraison gratuite
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            PRÊT À COMMANDER ?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Créez votre compte en quelques minutes et passez votre première commande dès aujourd'hui.
          </p>
          <Link to="/register">
            <Button 
              size="lg" 
              className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold uppercase tracking-wide px-12 py-6 text-lg shadow-lg"
              data-testid="cta-register-btn"
            >
              Créer mon compte
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Fuel className="h-8 w-8 text-amber-500" />
                <span className="text-2xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  ALIA REFUEL
                </span>
              </div>
              <p className="text-slate-400">
                Votre partenaire de confiance pour la livraison de carburant diesel sur Tours et ses alentours.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-amber-500 mb-4">Contact</h4>
              <div className="space-y-2 text-slate-400">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  06 09 88 32 50
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  aliarefuel@gmail.com
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Tours et alentours (37)
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-amber-500 mb-4">Liens utiles</h4>
              <div className="space-y-2 text-slate-400">
                <p><Link to="/login" className="hover:text-amber-500 transition-colors">Connexion</Link></p>
                <p><Link to="/register" className="hover:text-amber-500 transition-colors">Inscription</Link></p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-500">
            <p>&copy; 2024 Alia Refuel. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
