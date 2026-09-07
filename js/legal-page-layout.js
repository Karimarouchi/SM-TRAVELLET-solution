/**
 * LegalPageLayout — mise en page des pages légales SM Travel
 * Compatible file:// (scripts classiques, sans import/export).
 */
(function (global) {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function asset(pathFromRoot) {
    return '../' + String(pathFromRoot).replace(/^\//, '');
  }

  function renderHeader() {
    var c = global.companyLegalInfo;
    var home = '../index.html';
    return (
      '<header class="legal-site-header" role="banner">' +
      '<div class="legal-site-header__inner">' +
      '<a href="' +
      home +
      '" class="legal-site-header__brand" aria-label="Retour à l’accueil SM Travel">' +
      '<img src="' +
      asset('IMAGE/Logo blanc.png') +
      '" alt="' +
      escapeHtml(c.brandName) +
      '" class="legal-site-header__logo" width="140" height="32" />' +
      '</a>' +
      '<nav class="legal-site-header__nav" aria-label="Navigation principale">' +
      '<a href="' +
      home +
      '#accueil">Accueil</a>' +
      '<a href="' +
      home +
      '#programmes">Programmes</a>' +
      '<a href="' +
      home +
      '#services">Services</a>' +
      '<a href="' +
      home +
      '#contact">Contact</a>' +
      '</nav>' +
      '<a href="' +
      home +
      '#contact" class="legal-site-header__cta">Commencer</a>' +
      '</div></header>'
    );
  }

  function renderFooter() {
    var c = global.companyLegalInfo;
    var routes = global.legalRoutes || [];
    var links = routes
      .map(function (route) {
        return (
          '<li><a href="' +
          escapeHtml(route.href) +
          '">' +
          escapeHtml(route.label) +
          '</a></li>'
        );
      })
      .join('');

    return (
      '<footer class="legal-site-footer" role="contentinfo">' +
      '<div class="legal-site-footer__inner">' +
      '<div class="legal-site-footer__grid">' +
      '<div><h2 class="legal-site-footer__heading">Informations légales</h2>' +
      '<ul class="legal-site-footer__links">' +
      links +
      '</ul></div>' +
      '<div><h2 class="legal-site-footer__heading">' +
      escapeHtml(c.brandName) +
      '</h2>' +
      '<p class="legal-site-footer__text">' +
      escapeHtml(c.brandName) +
      ' est une marque exploitée par ' +
      escapeHtml(c.legalName) +
      '.</p>' +
      '<p class="legal-site-footer__text">Matricule fiscal : ' +
      escapeHtml(c.taxId) +
      '</p>' +
      '<p class="legal-site-footer__text">' +
      escapeHtml(c.address) +
      '</p></div>' +
      '<div><h2 class="legal-site-footer__heading">Contact</h2>' +
      '<p class="legal-site-footer__text">Téléphone : <a href="tel:' +
      escapeHtml(c.phoneHref) +
      '">' +
      escapeHtml(c.phone) +
      '</a></p>' +
      '<p class="legal-site-footer__text">Email : <a href="mailto:' +
      escapeHtml(c.contactEmail) +
      '">' +
      escapeHtml(c.contactEmail) +
      '</a></p></div>' +
      '</div>' +
      '<div class="legal-site-footer__bottom">' +
      '<p>© ' +
      new Date().getFullYear() +
      ' ' +
      escapeHtml(c.brandName) +
      '. Tous droits réservés.</p>' +
      '<a href="../index.html">Retour à l’accueil</a>' +
      '</div></div></footer>'
    );
  }

  function renderContactBlock() {
    var c = global.companyLegalInfo;
    return (
      '<aside class="legal-contact-card" aria-label="Coordonnées de contact">' +
      '<h2 class="legal-contact-card__title">Nous contacter</h2>' +
      '<ul class="legal-contact-card__list">' +
      '<li><strong>Email :</strong> <a href="mailto:' +
      escapeHtml(c.contactEmail) +
      '">' +
      escapeHtml(c.contactEmail) +
      '</a></li>' +
      '<li><strong>Téléphone :</strong> <a href="tel:' +
      escapeHtml(c.phoneHref) +
      '">' +
      escapeHtml(c.phone) +
      '</a></li>' +
      '<li><strong>Adresse :</strong> ' +
      escapeHtml(c.address) +
      '</li>' +
      '</ul></aside>'
    );
  }

  function mountLegalPageLayout(options) {
    options = options || {};
    var c = global.companyLegalInfo;
    var title = options.title || '';
    var updatedAt = options.updatedAt || (c && c.legalUpdatedAt) || '';
    var showToc = !!options.showToc;
    var contactTargetId = options.contactTargetId || 'legal-contact-block';

    var headerMount = document.getElementById('legal-header-mount');
    var footerMount = document.getElementById('legal-footer-mount');
    var titleEl = document.getElementById('legal-page-title');
    var dateEl = document.getElementById('legal-page-updated');
    var backEl = document.getElementById('legal-back-home');
    var contactEl = document.getElementById(contactTargetId);
    var tocEl = document.getElementById('legal-toc');

    if (headerMount) headerMount.innerHTML = renderHeader();
    if (footerMount) footerMount.innerHTML = renderFooter();
    if (titleEl && !String(titleEl.textContent || '').trim() && title) {
      titleEl.textContent = title;
    }
    if (dateEl && updatedAt) {
      dateEl.textContent = 'Dernière mise à jour : ' + updatedAt;
    }
    if (backEl) {
      backEl.setAttribute('href', '../index.html');
      if (!String(backEl.textContent || '').trim()) {
        backEl.textContent = '← Retour à l’accueil';
      }
    }
    if (contactEl && !String(contactEl.innerHTML || '').trim()) {
      contactEl.innerHTML = renderContactBlock();
    }

    if (showToc && tocEl) {
      var headings = Array.prototype.slice.call(
        document.querySelectorAll('.legal-content h2[id]')
      );
      if (headings.length) {
        tocEl.innerHTML =
          '<nav class="legal-toc" aria-label="Sommaire">' +
          '<p class="legal-toc__title">Sommaire</p><ol>' +
          headings
            .map(function (h) {
              return (
                '<li><a href="#' +
                escapeHtml(h.id) +
                '">' +
                escapeHtml(String(h.textContent || '').trim()) +
                '</a></li>'
              );
            })
            .join('') +
          '</ol></nav>';
      }
    }

    document.documentElement.classList.add('legal-page-ready');
  }

  global.mountLegalPageLayout = mountLegalPageLayout;
  global.renderContactBlock = renderContactBlock;
})(typeof window !== 'undefined' ? window : this);
