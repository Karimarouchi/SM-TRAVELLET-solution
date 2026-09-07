/**
 * Informations légales centralisées — SM Travel
 * Compatible file:// et serveur (pas de modules ES).
 */
(function (global) {
  var companyLegalInfo = {
    brandName: 'SM Travel',
    legalName: 'SM services & consulting',
    legalForm: 'SARL',
    taxId: '1915331L',
    administrativeEmail: 'sahbimars3@gmail.com',
    contactEmail: 'services@smtravel.fr',
    phone: '+216 56 819 899',
    phoneHref: '+21656819899',
    address:
      '4 Bis Rue du Mali, 4e étage, bureau n°4, Jeanne d’Arc, Tunis 1002, Tunisie',
    country: 'Tunisie',
    siteUrl: 'https://www.smtravel.fr',
    siteDisplay: 'www.smtravel.fr',
    publicationResponsible: 'Direction de SM services & consulting',
    hosting: {
      name: 'Hostinger International Limited',
      address: '61 Lordou Vironos Street, 6023 Larnaca, Chypre',
      website: 'https://www.hostinger.com',
      email: 'compliance@hostinger.com',
    },
    legalUpdatedAt: '26 août 2026',
  };

  // Chemins relatifs depuis une page légale (dossier enfant)
  var legalRoutes = [
    {
      href: '../conditions-generales-de-vente/index.html',
      label: 'Conditions générales de vente',
    },
    {
      href: '../politique-annulation-remboursement/index.html',
      label: 'Politique d’annulation et de remboursement',
    },
    {
      href: '../mentions-legales/index.html',
      label: 'Mentions légales',
    },
    {
      href: '../politique-confidentialite/index.html',
      label: 'Politique de confidentialité',
    },
    {
      href: '../politique-cookies/index.html',
      label: 'Politique relative aux cookies',
    },
  ];

  // Chemins depuis la page d’accueil (racine)
  var legalRoutesFromHome = [
    {
      href: 'conditions-generales-de-vente/index.html',
      label: 'Conditions générales de vente',
    },
    {
      href: 'politique-annulation-remboursement/index.html',
      label: 'Politique d’annulation et de remboursement',
    },
    {
      href: 'mentions-legales/index.html',
      label: 'Mentions légales',
    },
    {
      href: 'politique-confidentialite/index.html',
      label: 'Politique de confidentialité',
    },
    {
      href: 'politique-cookies/index.html',
      label: 'Politique relative aux cookies',
    },
  ];

  global.companyLegalInfo = companyLegalInfo;
  global.legalRoutes = legalRoutes;
  global.legalRoutesFromHome = legalRoutesFromHome;
})(typeof window !== 'undefined' ? window : this);
