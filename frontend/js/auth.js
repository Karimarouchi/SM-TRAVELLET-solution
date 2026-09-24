(function () {
  const API_URL = localStorage.getItem('smtravel_api') || 'http://localhost:3001';
  const SESSION_KEY = 'smtravel_session';
  const USERS_KEY = 'smtravel_users';
  const inFrontend = /\/frontend(\/|$)/.test(location.pathname);

  const paths = {
    home: inFrontend ? '../index.html' : 'index.html',
    login: inFrontend ? 'login.html' : 'frontend/login.html',
    register: inFrontend ? 'inscription.html' : 'frontend/inscription.html',
    espace: inFrontend ? 'espace.html' : 'frontend/espace.html'
  };

  const DEMO_USER = {
    id: 'demo-amira',
    prenom: 'Amira',
    nom: 'Ben Ali',
    email: 'demo@smtravel.fr',
    dateNaissance: '2000-05-15',
    password: 'Demo2024!'
  };

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function readLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function writeLocalUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async function ensureDemoUser() {
    const users = readLocalUsers();
    if (users.some((user) => user.email === DEMO_USER.email)) return;
    users.push({
      id: DEMO_USER.id,
      prenom: DEMO_USER.prenom,
      nom: DEMO_USER.nom,
      email: DEMO_USER.email,
      dateNaissance: DEMO_USER.dateNaissance,
      hash: await sha256(DEMO_USER.password),
      createdAt: new Date().toISOString()
    });
    writeLocalUsers(users);
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function publicUser(user) {
    return {
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      dateNaissance: user.dateNaissance
    };
  }

  function isAdultEnough(dateNaissance) {
    const birth = new Date(dateNaissance);
    if (Number.isNaN(birth.getTime())) return false;
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() - 16);
    return birth <= limit;
  }

  async function api(pathname, options) {
    const session = getSession();
    const headers = { 'Content-Type': 'application/json', ...(options && options.headers) };
    if (session && session.token) headers.Authorization = 'Bearer ' + session.token;
    const response = await fetch(API_URL + pathname, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
    return data;
  }

  async function loginLocal(email, password) {
    await ensureDemoUser();
    const users = readLocalUsers();
    const user = users.find((item) => item.email === email);
    const hash = await sha256(password);
    if (!user || user.hash !== hash) throw new Error('Email ou mot de passe incorrect.');
    const session = { token: 'local-' + user.id, user: publicUser(user), source: 'local' };
    setSession(session);
    return session;
  }

  async function registerLocal(payload) {
    await ensureDemoUser();
    const users = readLocalUsers();
    if (users.some((user) => user.email === payload.email)) {
      throw new Error('Un compte existe déjà avec cet email.');
    }
    const user = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'u-' + Date.now(),
      prenom: payload.prenom,
      nom: payload.nom,
      email: payload.email,
      dateNaissance: payload.dateNaissance,
      hash: await sha256(payload.password),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeLocalUsers(users);
    const session = { token: 'local-' + user.id, user: publicUser(user), source: 'local' };
    setSession(session);
    return session;
  }

  window.SmTravelAuth = {
    paths,
    demo: DEMO_USER,
    getSession,
    async login(email, password) {
      email = String(email || '').trim().toLowerCase();
      password = String(password || '');
      if (!email || !password) throw new Error('Renseignez votre email et votre mot de passe.');
      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        const session = { token: data.token, user: data.user, source: 'api' };
        setSession(session);
        return session;
      } catch (error) {
        if (error instanceof TypeError) return loginLocal(email, password);
        throw error;
      }
    },
    async register(form) {
      const payload = {
        nom: String(form.nom || '').trim(),
        prenom: String(form.prenom || '').trim(),
        email: String(form.email || '').trim().toLowerCase(),
        dateNaissance: String(form.dateNaissance || '').trim(),
        password: String(form.password || ''),
        passwordConfirm: String(form.passwordConfirm || '')
      };

      if (payload.prenom.length < 2) throw new Error('Le prénom doit contenir au moins 2 caractères.');
      if (payload.nom.length < 2) throw new Error('Le nom doit contenir au moins 2 caractères.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('Adresse email invalide.');
      if (!isAdultEnough(payload.dateNaissance)) throw new Error('Vous devez avoir au moins 16 ans.');
      if (payload.password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
      if (payload.password !== payload.passwordConfirm) throw new Error('Les mots de passe ne correspondent pas.');

      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const session = { token: data.token, user: data.user, source: 'api' };
        setSession(session);
        return session;
      } catch (error) {
        if (error instanceof TypeError) return registerLocal(payload);
        throw error;
      }
    },
    async logout() {
      const session = getSession();
      if (session && session.source === 'api') {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
      }
      clearSession();
    },
    requireAuth() {
      const session = getSession();
      if (!session || !session.user) {
        location.replace(paths.login);
        return null;
      }
      return session;
    },
    redirectIfLoggedIn() {
      if (getSession()) location.replace(paths.espace);
    },
    renderNav() {
      const session = getSession();
      const desktop = document.getElementById('navAuth');
      const mobile = document.getElementById('mobileAuth');
      if (!desktop && !mobile) return;

      if (session && session.user) {
        if (desktop) {
          desktop.innerHTML =
            '<a href="' + paths.espace + '" class="nav-auth-btn hidden md:inline-flex items-center gap-2 border-2 border-white/80 text-white hover:bg-white hover:text-brand font-semibold text-sm px-5 py-2.5 rounded-full transition-all">' +
            'Mon espace<span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>';
        }
        if (mobile) {
          mobile.innerHTML =
            '<a href="' + paths.espace + '" class="mobile-menu-cta">Mon espace</a>';
        }
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    ensureDemoUser();
    window.SmTravelAuth.renderNav();
    if (typeof window.updateNavbar === 'function') window.updateNavbar();
  });
})();
