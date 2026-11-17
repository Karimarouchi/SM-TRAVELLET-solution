/* Vitrine SM Edu Travel : français / anglais / arabe.
 *
 * Le français reste le texte écrit dans index.html (référencement, repli si ce fichier ne charge pas).
 * En anglais ou en arabe, chaque texte de la page est remplacé par sa traduction, retrouvée dans le
 * dictionnaire ROWS (clé = le texte français, [français, anglais, arabe]). Les textes saisis par
 * l'équipe (programmes, avis) qui n'y figurent pas restent tels quels.
 *
 * Pour ajouter ou corriger une traduction : modifier la ligne correspondante de ROWS, rien d'autre.
 * Dans le code de la page, window.vt("texte français") renvoie la traduction du texte (ou le texte). */
(function () {
  'use strict';

  var STORAGE_KEY = 'smtravel_vitrine_lang';
  var LANGS = ['fr', 'en', 'ar'];

  /* ───────────────────────────── Dictionnaire ───────────────────────────── */
  var ROWS = [
    /* Écran d'accueil et navigation */
    ["Agence d'accompagnement aux études à l'étranger", "Study abroad support agency", "وكالة مرافقة الدراسة في الخارج"],
    ["✈ Entrer sur le site", "✈ Enter the site", "✈ الدخول إلى الموقع"],
    ["Accueil", "Home", "الرئيسية"],
    ["Programmes", "Programs", "البرامج"],
    ["Services", "Services", "الخدمات"],
    ["Méthode", "Method", "منهجيتنا"],
    ["À propos", "About", "من نحن"],
    ["FAQ", "FAQ", "الأسئلة الشائعة"],
    ["Connexion", "Log in", "تسجيل الدخول"],
    ["S'inscrire", "Sign up", "إنشاء حساب"],
    ["Navigation", "Navigation", "التنقل"],
    ["Menu", "Menu", "القائمة"],
    ["Langue", "Language", "اللغة"],

    /* Page d'accueil */
    ["Étudier à l'étranger avec SM Edu Travel", "Study abroad with SM Edu Travel", "الدراسة في الخارج مع SM Edu Travel"],
    ["Étudier à l'étranger", "Study abroad", "الدراسة في الخارج"],
    ["avec", "with", "مع"],
    ["Nous vous accompagnons dans vos projets d'études à l'international avec expertise et passion.", "We support you in your international study projects with expertise and passion.", "نرافقكم في مشاريعكم الدراسية الدولية بخبرة وشغف."],
    ["Démarrer mon dossier", "Start my application", "ابدأ ملفي"],
    ["WhatsApp direct", "WhatsApp direct", "واتساب مباشر"],

    /* Programmes */
    ["Destinations d'excellence", "Destinations of excellence", "وجهات التميّز"],
    ["Les Programmes Populaires", "Popular Programs", "البرامج الأكثر طلبًا"],
    ["Rechercher un pays…", "Search for a country…", "ابحث عن بلد…"],
    ["Tous les niveaux", "All levels", "كل المستويات"],
    ["Licence", "Bachelor's", "الإجازة"],
    ["Master", "Master's", "الماجستير"],
    ["Aucun programme trouvé", "No program found", "لم يتم العثور على أي برنامج"],
    ["Essayez un autre pays ou un autre niveau d'études.", "Try another country or study level.", "جرّب بلدًا آخر أو مستوى دراسيًا آخر."],
    ["Voir tous les programmes disponibles", "See all available programs", "عرض كل البرامج المتاحة"],
    ["Voir les détails", "View details", "عرض التفاصيل"],
    ["Bientôt ouvert", "Opening soon", "يُفتح قريبًا"],
    ["Disponible", "Available", "متاح"],
    ["Prochainement", "Coming soon", "قريبًا"],
    ["Prochainement disponible", "Coming soon", "قريبًا"],
    ["Planifié", "Planned", "مبرمج"],

    /* Services */
    ["Ce que nous offrons", "What we offer", "ما نقدّمه"],
    ["Les Services Populaires", "Popular Services", "خدماتنا الأكثر طلبًا"],
    ["Des services variés conçus pour transformer votre expérience d'études à l'étranger.", "A range of services designed to transform your study-abroad experience.", "خدمات متنوعة صُمّمت لتحويل تجربتكم الدراسية في الخارج."],
    ["Traitement de dossier de Visa", "Visa application processing", "معالجة ملف التأشيرة"],
    ["Notre équipe d'experts gère l'intégralité de votre dossier visa avec 98% de taux d'acceptation et un traitement express disponible.", "Our team of experts handles your entire visa file with a 98% acceptance rate and express processing available.", "يتولى فريق خبرائنا ملف تأشيرتكم بالكامل بنسبة قبول 98% مع إمكانية المعالجة السريعة."],
    ["Consultation Stratégique", "Strategic Consultation", "استشارة استراتيجية"],
    ["Analyse personnalisée de votre profil pour identifier les meilleures destinations et programmes. Réseau dans 40+ pays.", "A personalized analysis of your profile to identify the best destinations and programs. Network in 40+ countries.", "تحليل مخصّص لملفكم لتحديد أفضل الوجهات والبرامج. شبكة علاقات في أكثر من 40 دولة."],
    ["Prendre rendez-vous", "Book an appointment", "احجز موعدًا"],
    ["Accueil à l'Aéroport", "Airport Welcome", "الاستقبال في المطار"],
    ["Chauffeurs bilingues, gestion des bagages et transfert vers votre logement. Suivi des vols en temps réel, 24h/24.", "Bilingual drivers, luggage handling and transfer to your accommodation. Real-time flight tracking, 24/7.", "سائقون ثنائيو اللغة، والتكفّل بالأمتعة والتوصيل إلى سكنكم. متابعة الرحلات لحظة بلحظة على مدار الساعة."],

    /* Méthode */
    ["Notre méthode", "Our method", "منهجيتنا"],
    ["Comment ça marche ?", "How does it work?", "كيف يعمل ذلك؟"],
    ["Un accompagnement structuré et transparent, de votre premier contact jusqu'à votre premier cours à l'étranger.", "Structured, transparent support, from your first contact to your first class abroad.", "مرافقة منظّمة وشفافة، من أول تواصل معنا إلى أول حصة دراسية لكم في الخارج."],
    ["Analyse de profil", "Profile analysis", "تحليل الملف"],
    ["Étude de votre dossier, objectifs et budget.", "Review of your file, goals and budget.", "دراسة ملفكم وأهدافكم وميزانيتكم."],
    ["Choix du programme", "Choosing the program", "اختيار البرنامج"],
    ["Pays, université et cursus adaptés à votre projet.", "Country, university and course suited to your project.", "البلد والجامعة والمسار المناسبون لمشروعكم."],
    ["Candidature", "Application", "التقديم"],
    ["Dossier complet soumis aux établissements retenus.", "Complete file submitted to the selected institutions.", "تقديم الملف كاملًا إلى المؤسسات المختارة."],
    ["Préparation visa", "Visa preparation", "تحضير التأشيرة"],
    ["Constitution du dossier visa — 98% de réussite.", "Visa file preparation — 98% success rate.", "إعداد ملف التأشيرة — بنسبة نجاح 98%."],
    ["Départ & installation", "Departure & settling in", "السفر والاستقرار"],
    ["Accueil aéroport, logement et suivi sur place.", "Airport welcome, housing and on-site support.", "الاستقبال في المطار والسكن والمتابعة في عين المكان."],
    ["Étude de votre dossier académique, objectifs et budget pour identifier les meilleures options.", "Review of your academic file, goals and budget to identify the best options.", "دراسة ملفكم الأكاديمي وأهدافكم وميزانيتكم لتحديد أفضل الخيارات."],
    ["Sélection du pays, de l'université et du cursus adapté à votre projet personnel.", "Selection of the country, university and course suited to your personal project.", "اختيار البلد والجامعة والمسار الأنسب لمشروعكم الشخصي."],
    ["Candidature & admission", "Application & admission", "التقديم والقبول"],
    ["Dossier complet préparé et soumis aux établissements retenus.", "Complete file prepared and submitted to the selected institutions.", "إعداد الملف كاملًا وتقديمه إلى المؤسسات المختارة."],
    ["Préparation du visa", "Visa preparation", "تحضير التأشيرة"],
    ["Constitution du dossier visa avec notre expertise — 98% de réussite.", "Visa file prepared with our expertise — 98% success rate.", "إعداد ملف التأشيرة بخبرتنا — بنسبة نجاح 98%."],
    ["Accueil à l'aéroport, aide au logement et suivi continu dans le pays de destination.", "Airport welcome, housing assistance and ongoing support in the destination country.", "الاستقبال في المطار والمساعدة في السكن والمتابعة المستمرة في بلد الوجهة."],

    /* À propos */
    ["Nos valeurs", "Our values", "قيمنا"],
    ["Pourquoi choisir SM Edu Travel ?", "Why choose SM Edu Travel?", "لماذا تختارون SM Edu Travel؟"],
    ["Plus qu'une simple agence, nous sommes votre concierge académique global, assurant chaque étape de votre transition vers l'inconnu.", "More than a simple agency, we are your global academic concierge, guiding every step of your move into the unknown.", "أكثر من مجرد وكالة، نحن مرافقكم الأكاديمي الشامل، نواكبكم في كل خطوة من انتقالكم نحو المجهول."],
    ["500+ universités", "500+ universities", "+500 جامعة"],
    ["Expertise Mondiale", "Global Expertise", "خبرة عالمية"],
    ["Accès direct à plus de 500 universités partenaires à travers l'Europe, l'Amérique et l'Asie.", "Direct access to more than 500 partner universities across Europe, America and Asia.", "وصول مباشر إلى أكثر من 500 جامعة شريكة في أوروبا وأمريكا وآسيا."],
    ["98% de réussite", "98% success rate", "نسبة نجاح 98%"],
    ["Fiabilité Totale", "Total Reliability", "موثوقية تامة"],
    ["Accompagnement administratif et visa sécurisé avec un taux de réussite de 98%.", "Administrative support and secure visa handling with a 98% success rate.", "مرافقة إدارية وتأشيرة مضمونة بنسبة نجاح 98%."],
    ["Stratégie carrière", "Career strategy", "استراتيجية مهنية"],
    ["Accélération de Carrière", "Career Acceleration", "تسريع المسار المهني"],
    ["Conseils stratégiques pour aligner vos études avec les besoins du marché global.", "Strategic advice to align your studies with global market needs.", "نصائح استراتيجية لمواءمة دراستكم مع احتياجات السوق العالمية."],
    ["Communauté active", "Active community", "مجتمع نشط"],
    ["Réseau d'Alumni", "Alumni Network", "شبكة الخرّيجين"],
    ["Rejoignez une communauté vibrante de nomades modernes et de leaders de demain.", "Join a vibrant community of modern nomads and tomorrow's leaders.", "انضمّوا إلى مجتمع نابض بالحياة من رحّالة العصر وقادة الغد."],

    /* Témoignages */
    ["Témoignages", "Testimonials", "آراء الطلبة"],
    ["Avis de nos clients", "Our clients' reviews", "آراء عملائنا"],
    ["Des étudiants tunisiens accompagnés par SM Edu Travel dans leurs projets d’études à l’étranger.", "Tunisian students supported by SM Edu Travel in their study-abroad projects.", "طلبة تونسيون رافقتهم SM Edu Travel في مشاريعهم الدراسية في الخارج."],
    ["Étudiant", "Student", "طالب"],

    /* FAQ */
    ["Questions fréquentes", "Frequently asked questions", "الأسئلة الشائعة"],
    ["Vos questions, nos réponses", "Your questions, our answers", "أسئلتكم وأجوبتنا"],
    ["Tout ce que vous devez savoir avant de nous contacter. Une autre question ? Écrivez-nous directement.", "Everything you need to know before contacting us. Another question? Write to us directly.", "كل ما تحتاجون إلى معرفته قبل التواصل معنا. لديكم سؤال آخر؟ راسلونا مباشرة."],
    ["Comment démarrer mon projet d'études à l'étranger avec SM Edu Travel ?", "How do I start my study-abroad project with SM Edu Travel?", "كيف أبدأ مشروع دراستي في الخارج مع SM Edu Travel؟"],
    ["Commencez par remplir notre formulaire de contact ou contactez-nous directement sur WhatsApp. Un conseiller analysera votre profil (niveau d'études, budget, destination souhaitée) et vous proposera un plan d'action personnalisé dans les plus brefs délais.", "Start by filling in our contact form or contact us directly on WhatsApp. An advisor will analyze your profile (study level, budget, desired destination) and propose a personalized action plan as soon as possible.", "ابدؤوا بملء نموذج الاتصال الخاص بنا أو تواصلوا معنا مباشرة عبر واتساب. سيحلّل أحد المستشارين ملفكم (المستوى الدراسي، الميزانية، الوجهة المرغوبة) ويقترح عليكم خطة عمل مخصّصة في أقرب الآجال."],
    ["Dois-je fournir un compte bloqué pour étudier en Lettonie ?", "Do I need to provide a blocked account to study in Latvia?", "هل يجب أن أقدّم حسابًا مصرفيًا مجمّدًا للدراسة في لاتفيا؟"],
    ["Non — c'est l'un des grands avantages de la Lettonie par rapport à d'autres destinations Schengen. La Lettonie ne demande pas de compte bloqué pour l'obtention du visa étudiant. Nos conseillers vous expliquent les exigences exactes selon votre situation.", "No — this is one of Latvia's great advantages over other Schengen destinations. Latvia does not require a blocked account to obtain a student visa. Our advisors will explain the exact requirements for your situation.", "لا — وهذه من أبرز مزايا لاتفيا مقارنةً بوجهات أخرى في فضاء شنغن. فلاتفيا لا تشترط حسابًا مصرفيًا مجمّدًا للحصول على تأشيرة الطالب. يشرح لكم مستشارونا المتطلبات الدقيقة بحسب وضعكم."],
    ["Repère actualisé 2024 — vérifiez toujours les conditions officielles avant dépôt.", "Updated 2024 guideline — always check the official conditions before applying.", "معلومة محدّثة لسنة 2024 — تحقّقوا دائمًا من الشروط الرسمية قبل تقديم الملف."],
    ["Quel est le taux de réussite de SM Edu Travel pour les visas étudiants ?", "What is SM Edu Travel's success rate for student visas?", "ما هي نسبة نجاح SM Edu Travel في تأشيرات الطلبة؟"],
    ["Notre taux d'acceptation dépasse 98%. Ce résultat s'explique par une préparation rigoureuse de chaque dossier, une vérification systématique de toutes les pièces requises et une connaissance approfondie des critères examinés par les consulats.", "Our acceptance rate exceeds 98%. This result comes from rigorous preparation of each file, systematic verification of all required documents and in-depth knowledge of the criteria examined by consulates.", "تتجاوز نسبة القبول لدينا 98%. ويعود ذلك إلى التحضير الدقيق لكل ملف، والتحقق المنهجي من جميع الوثائق المطلوبة، والمعرفة العميقة بالمعايير التي تدرسها القنصليات."],
    ["Quel est le budget minimum pour étudier en Europe ?", "What is the minimum budget to study in Europe?", "ما هي الميزانية الدنيا للدراسة في أوروبا؟"],
    ["Le budget varie selon le pays. En Lettonie, comptez entre 6 000 et 11 000 € par an tout compris (frais de scolarité + logement + vie courante). En Autriche, les frais universitaires démarrent à 750 €/semestre. Nos conseillers vous aident à trouver la destination qui correspond à votre enveloppe budgétaire.", "The budget varies by country. In Latvia, expect between €6,000 and €11,000 per year all-inclusive (tuition + housing + living costs). In Austria, university fees start at €750/semester. Our advisors help you find the destination that fits your budget.", "تختلف الميزانية بحسب البلد. ففي لاتفيا، قدّروا ما بين 6000 و11000 يورو سنويًا شاملةً كل شيء (رسوم الدراسة + السكن + المعيشة اليومية). وفي النمسا، تبدأ الرسوم الجامعية من 750 يورو للفصل الدراسي. يساعدكم مستشارونا على إيجاد الوجهة التي تناسب ميزانيتكم."],
    ["Puis-je travailler pendant mes études en Europe ?", "Can I work while studying in Europe?", "هل يمكنني العمل أثناء دراستي في أوروبا؟"],
    ["Dans la plupart des pays européens, les étudiants étrangers sont autorisés à travailler à temps partiel (généralement 20 h/semaine). Les règles varient selon le pays et le type de visa. SM Edu Travel vous informe des règles en vigueur dans votre pays de destination et vous aide à anticiper votre budget.", "In most European countries, international students are allowed to work part-time (generally 20 h/week). Rules vary by country and visa type. SM Edu Travel informs you of the rules in force in your destination country and helps you plan your budget.", "في معظم الدول الأوروبية، يُسمح للطلبة الأجانب بالعمل بدوام جزئي (عادةً 20 ساعة في الأسبوع). وتختلف القواعد بحسب البلد ونوع التأشيرة. تُعلمكم SM Edu Travel بالقواعد المعمول بها في بلد وجهتكم وتساعدكم على التخطيط لميزانيتكم."],
    ["Combien de temps prend l'obtention d'un visa étudiant ?", "How long does it take to obtain a student visa?", "كم تستغرق مدة الحصول على تأشيرة الطالب؟"],
    ["Le délai moyen est de 3 à 8 semaines selon le consulat et la période de l'année. Nous vous recommandons de commencer les démarches au moins 3 mois avant votre rentrée souhaitée. SM Edu Travel optimise la constitution de votre dossier pour réduire les risques de retard ou de refus.", "The average time is 3 to 8 weeks depending on the consulate and the time of year. We recommend starting the process at least 3 months before your desired start date. SM Edu Travel optimizes the preparation of your file to reduce the risk of delay or refusal.", "المدة المتوسطة من 3 إلى 8 أسابيع بحسب القنصلية وفترة السنة. ننصحكم بالبدء في الإجراءات قبل 3 أشهر على الأقل من الدخول الدراسي المرغوب. تعمل SM Edu Travel على تحسين إعداد ملفكم للحدّ من مخاطر التأخير أو الرفض."],
    ["Vous avez une question spécifique à votre situation ?", "Do you have a question specific to your situation?", "هل لديكم سؤال خاص بوضعكم؟"],
    ["Posez-nous votre question", "Ask us your question", "اطرحوا علينا سؤالكم"],

    /* Appel à l'action et pied de page */
    ["Commençons ensemble", "Let's get started together", "لنبدأ معًا"],
    ["Prêt à transformer", "Ready to transform", "هل أنتم مستعدون لتغيير"],
    ["votre avenir ?", "your future?", "مستقبلكم؟"],
    ["Des étudiants de Tunisie font confiance à SM Edu Travel chaque année. Votre projet d'études à l'étranger commence par un simple échange.", "Students from Tunisia trust SM Edu Travel every year. Your study-abroad project begins with a simple conversation.", "يثق طلبة من تونس في SM Edu Travel كل عام. يبدأ مشروع دراستكم في الخارج بحوار بسيط."],
    ["Évaluer mon dossier", "Assess my application", "تقييم ملفي"],
    ["Votre agence experte en orientation internationale : visa, admission, logement et accueil aéroport, de A à Z.", "Your expert agency in international guidance: visa, admission, housing and airport welcome, from A to Z.", "وكالتكم الخبيرة في التوجيه الدولي: التأشيرة والقبول والسكن والاستقبال في المطار، من الألف إلى الياء."],
    ["Contact", "Contact", "اتصل بنا"],
    ["4 Bis Rue du Mali, 4ᵉ étage, bureau n°4,", "4 Bis Rue du Mali, 4th floor, office no. 4,", "4 مكرر نهج مالي، الطابق الرابع، المكتب رقم 4،"],
    ["Jeanne d'Arc, Tunis 1002", "Jeanne d'Arc, Tunis 1002", "جان دارك، تونس 1002"],
    ["© 2026 SM Edu Travel — SM services & consulting. Tous droits réservés.", "© 2026 SM Edu Travel — SM services & consulting. All rights reserved.", "© 2026 SM Edu Travel — SM services & consulting. جميع الحقوق محفوظة."],
    ["Retour en haut", "Back to top", "العودة إلى الأعلى"],

    /* Référencement (titre et descriptions) */
    ["SM Edu Travel – Agence d'accompagnement aux études à l'étranger | Tunisie", "SM Edu Travel – Study abroad support agency | Tunisia", "SM Edu Travel – وكالة مرافقة الدراسة في الخارج | تونس"],
    ["SM Edu Travel vous accompagne de A à Z pour étudier en Europe : visa, admission, logement, accueil aéroport. 98% de réussite visa. Contactez-nous à Tunis.", "SM Edu Travel supports you from A to Z to study in Europe: visa, admission, housing, airport welcome. 98% visa success rate. Contact us in Tunis.", "ترافقكم SM Edu Travel من الألف إلى الياء للدراسة في أوروبا: التأشيرة والقبول والسكن والاستقبال في المطار. نسبة نجاح 98% في التأشيرات. تواصلوا معنا في تونس."],
    ["SM Edu Travel – Études à l'étranger", "SM Edu Travel – Study abroad", "SM Edu Travel – الدراسة في الخارج"],
    ["Votre agence experte en orientation internationale depuis 2020.", "Your expert agency in international guidance since 2020.", "وكالتكم الخبيرة في التوجيه الدولي منذ 2020."],

    /* Messages WhatsApp préremplis */
    ["Bonjour SM Edu Travel, je souhaite évaluer mon dossier pour étudier à l'étranger.", "Hello SM Edu Travel, I would like to have my application assessed to study abroad.", "مرحبًا SM Edu Travel، أرغب في تقييم ملفي للدراسة في الخارج."],
    ["Bonjour SM Edu Travel, je souhaite des informations pour le traitement de mon dossier de Visa.", "Hello SM Edu Travel, I would like information about processing my visa application.", "مرحبًا SM Edu Travel، أرغب في الحصول على معلومات حول معالجة ملف التأشيرة الخاص بي."],
    ["Bonjour SM Edu Travel, je souhaite prendre rendez-vous pour une consultation.", "Hello SM Edu Travel, I would like to book an appointment for a consultation.", "مرحبًا SM Edu Travel، أرغب في حجز موعد لاستشارة."],
    ["Bonjour SM Edu Travel, je souhaite des informations pour l'accueil à l'aéroport.", "Hello SM Edu Travel, I would like information about the airport welcome service.", "مرحبًا SM Edu Travel، أرغب في الحصول على معلومات حول خدمة الاستقبال في المطار."],
    ["Bonjour SM Edu Travel, je voudrais évaluer mon dossier.", "Hello SM Edu Travel, I would like to have my application assessed.", "مرحبًا SM Edu Travel، أودّ تقييم ملفي."],
    ["Bonjour SM Edu Travel, je souhaite des informations sur un programme.", "Hello SM Edu Travel, I would like information about a program.", "مرحبًا SM Edu Travel، أرغب في الحصول على معلومات حول أحد البرامج."],

    /* Pays */
    ["Italia", "Italy", "إيطاليا"],
    ["Italie", "Italy", "إيطاليا"],
    ["Allemagne", "Germany", "ألمانيا"],
    ["Hongrie", "Hungary", "المجر"],
    ["Lithuania", "Lithuania", "ليتوانيا"],
    ["Lituanie", "Lithuania", "ليتوانيا"],
    ["Poland", "Poland", "بولندا"],
    ["Pologne", "Poland", "بولندا"],
    ["Slovakia", "Slovakia", "سلوفاكيا"],
    ["Slovaquie", "Slovakia", "سلوفاكيا"],
    ["Romania", "Romania", "رومانيا"],
    ["Roumanie", "Romania", "رومانيا"],
    ["Malta", "Malta", "مالطا"],
    ["Malte", "Malta", "مالطا"],
    ["Bulgaria", "Bulgaria", "بلغاريا"],
    ["Bulgarie", "Bulgaria", "بلغاريا"],
    ["Lettonie", "Latvia", "لاتفيا"],
    ["Autriche", "Austria", "النمسا"],
    ["France", "France", "فرنسا"],
    ["Belgique", "Belgium", "بلجيكا"],
    ["Espagne", "Spain", "إسبانيا"],
    ["Turquie", "Turkey", "تركيا"],
    ["Chypre", "Cyprus", "قبرص"],
    ["Canada", "Canada", "كندا"],
    ["🇮🇹 Italie", "🇮🇹 Italy", "🇮🇹 إيطاليا"],
    ["🇩🇪 Allemagne", "🇩🇪 Germany", "🇩🇪 ألمانيا"],
    ["🇭🇺 Hongrie", "🇭🇺 Hungary", "🇭🇺 المجر"],
    ["🇱🇹 Lituanie", "🇱🇹 Lithuania", "🇱🇹 ليتوانيا"],
    ["🇵🇱 Pologne", "🇵🇱 Poland", "🇵🇱 بولندا"],
    ["🇸🇰 Slovaquie", "🇸🇰 Slovakia", "🇸🇰 سلوفاكيا"],
    ["🇷🇴 Roumanie", "🇷🇴 Romania", "🇷🇴 رومانيا"],

    /* Niveaux et fiches des destinations */
    ["English course", "English course", "دورة لغة إنجليزية"],
    ["Préparatoire", "Preparatory", "تحضيري"],
    ["English Language Courses", "English Language Courses", "دورات اللغة الإنجليزية"],
    ["Diplôme de Licence", "Bachelor's degree", "شهادة الإجازة"],
    ["Diplôme de Master", "Master's degree", "شهادة الماجستير"],
    ["Langue d'enseignement", "Language of instruction", "لغة التدريس"],
    ["Frais d'études", "Tuition fees", "رسوم الدراسة"],
    ["Période d'inscription", "Registration period", "فترة التسجيل"],
    ["Statut", "Status", "الحالة"],
    ["Bourses & Avantages", "Scholarships & Benefits", "المنح والمزايا"],
    ["Nous contacter", "Contact us", "تواصلوا معنا"],
    ["Fermer", "Close", "إغلاق"],
    ["Inscription ouverte", "Registration open", "التسجيل مفتوح"],
    ["Italien ou Anglais", "Italian or English", "الإيطالية أو الإنجليزية"],
    ["Allemand ou Anglais", "German or English", "الألمانية أو الإنجليزية"],
    ["Anglais", "English", "الإنجليزية"],
    ["Anglais ou Slovaque", "English or Slovak", "الإنجليزية أو السلوفاكية"],
    ["Français, Anglais ou Roumain", "French, English or Romanian", "الفرنسية أو الإنجليزية أو الرومانية"],
    ["Sur demande (variable selon l'université)", "On request (varies by university)", "عند الطلب (يختلف حسب الجامعة)"],
    ["Session Septembre : Du 01/01 au 15/07", "September session: from 01/01 to 15/07", "دورة سبتمبر: من 01/01 إلى 15/07"],
    ["Du 01/05 au 30/06", "From 01/05 to 30/06", "من 01/05 إلى 30/06"],
    ["Session Septembre : 01/01 au 15/07 / Session Février : 15/08 au 15/12", "September session: 01/01 to 15/07 / February session: 15/08 to 15/12", "دورة سبتمبر: من 01/01 إلى 15/07 / دورة فبراير: من 15/08 إلى 15/12"],
    ["01/01 au 15/07 (Session Septembre)", "01/01 to 15/07 (September session)", "من 01/01 إلى 15/07 (دورة سبتمبر)"],
    ["Session Septembre : Du 01/01 au 31/05 / Session Février : Du 15/07 au 15/12", "September session: from 01/01 to 31/05 / February session: from 15/07 to 15/12", "دورة سبتمبر: من 01/01 إلى 31/05 / دورة فبراير: من 15/07 إلى 15/12"],
    ["Session Septembre : Du 01/01 au 31/05", "September session: from 01/01 to 31/05", "دورة سبتمبر: من 01/01 إلى 31/05"],
    ["Du 01/05 au 10/07", "From 01/05 to 10/07", "من 01/05 إلى 10/07"],
    ["Du 01/10 au 31/12", "From 01/10 to 31/12", "من 01/10 إلى 31/12"],
    ["Sélection selon profil (Sur demande)", "Selection based on profile (on request)", "الانتقاء حسب الملف (عند الطلب)"],
    ["Selon la période de recrutement", "Depending on the recruitment period", "حسب فترة الاستقطاب"],

    /* Descriptions des programmes (fiches et cartes) */
    ["Pour les étudiants titulaires d’un diplôme de Baccalauréat et souhaitant poursuivre leurs études en Licence, l’Italie propose une grande diversité de programmes universitaires enseignés en italien ou en anglais.", "For students holding a Baccalaureate and wishing to continue their studies at Bachelor's level, Italy offers a wide variety of university programs taught in Italian or English.", "للطلبة الحاصلين على شهادة الباكالوريا الراغبين في مواصلة دراستهم في مرحلة الإجازة، تقدّم إيطاليا تنوعًا كبيرًا من البرامج الجامعية التي تُدرَّس بالإيطالية أو بالإنجليزية."],
    ["Pour les étudiants titulaires d’un diplôme de Licence et souhaitant poursuivre leurs études en Master, l’Italie propose des programmes variés dans plusieurs domaines, avec des formations disponibles en italien ou en anglais selon l’université choisie.", "For students holding a Bachelor's degree and wishing to continue at Master's level, Italy offers varied programs across several fields, with courses available in Italian or English depending on the chosen university.", "للطلبة الحاصلين على شهادة الإجازة الراغبين في مواصلة دراستهم في مرحلة الماجستير، تقدّم إيطاليا برامج متنوعة في عدة مجالات، مع تكوينات متاحة بالإيطالية أو الإنجليزية حسب الجامعة المختارة."],
    ["L'Allemagne propose un projet académique ambitieux avec une excellente qualité d'enseignement. Idéal pour les profils rigoureux souhaitant intégrer des universités de renommée mondiale.", "Germany offers an ambitious academic project with excellent teaching quality. Ideal for rigorous profiles wishing to join world-renowned universities.", "تقدّم ألمانيا مشروعًا أكاديميًا طموحًا بجودة تعليم ممتازة. مثالي للملفات المتميّزة الراغبة في الالتحاق بجامعات ذات شهرة عالمية."],
    ["Pour les étudiants souhaitant améliorer leur niveau d’anglais avant d’intégrer un parcours universitaire, la Hongrie propose des cours de langue anglaise adaptés aux étudiants internationaux. Ce programme permet de renforcer les compétences linguistiques et de mieux préparer la suite du parcours académique.", "For students who want to improve their English before entering a university program, Hungary offers English language courses adapted to international students. This program strengthens language skills and better prepares for the rest of the academic path.", "للطلبة الراغبين في تحسين مستواهم في اللغة الإنجليزية قبل الالتحاق بمسار جامعي، تقدّم المجر دورات في اللغة الإنجليزية مناسبة للطلبة الدوليين. يتيح هذا البرنامج تعزيز المهارات اللغوية والاستعداد بشكل أفضل لبقية المسار الأكاديمي."],
    ["Pour les étudiants titulaires d’un diplôme de Baccalauréat et souhaitant poursuivre leurs études en Licence, la Pologne propose plusieurs programmes enseignés en anglais, dans un cadre académique européen accessible et structuré.", "For students holding a Baccalaureate and wishing to continue at Bachelor's level, Poland offers several programs taught in English, in an accessible and structured European academic setting.", "للطلبة الحاصلين على الباكالوريا الراغبين في مواصلة دراستهم في مرحلة الإجازة، تقدّم بولندا عدة برامج تُدرَّس بالإنجليزية في إطار أكاديمي أوروبي ميسّر ومنظّم."],
    ["Pour les étudiants titulaires d’un diplôme de Licence et souhaitant poursuivre leurs études en Master, la Hongrie offre des programmes enseignés en anglais, avec des parcours adaptés à plusieurs spécialités académiques.", "For students holding a Bachelor's degree and wishing to continue at Master's level, Hungary offers programs taught in English, with paths suited to several academic specialties.", "للطلبة الحاصلين على شهادة الإجازة الراغبين في مواصلة دراستهم في مرحلة الماجستير، تقدّم المجر برامج تُدرَّس بالإنجليزية بمسارات تناسب عدة تخصصات أكاديمية."],
    ["Pour les étudiants titulaires d’un diplôme de Baccalauréat et souhaitant poursuivre leurs études en Licence, la Lituanie propose plusieurs programmes enseignés en anglais dans un environnement académique européen.", "For students holding a Baccalaureate and wishing to continue at Bachelor's level, Lithuania offers several programs taught in English in a European academic environment.", "للطلبة الحاصلين على الباكالوريا الراغبين في مواصلة دراستهم في مرحلة الإجازة، تقدّم ليتوانيا عدة برامج تُدرَّس بالإنجليزية في بيئة أكاديمية أوروبية."],
    ["Pour les étudiants titulaires d’un diplôme de Licence et souhaitant poursuivre leurs études en Master, la Lituanie propose des programmes enseignés en anglais dans plusieurs domaines de spécialisation.", "For students holding a Bachelor's degree and wishing to continue at Master's level, Lithuania offers programs taught in English across several fields of specialization.", "للطلبة الحاصلين على شهادة الإجازة الراغبين في مواصلة دراستهم في مرحلة الماجستير، تقدّم ليتوانيا برامج تُدرَّس بالإنجليزية في عدة مجالات تخصص."],
    ["Pour les étudiants titulaires d’un diplôme de Baccalauréat et souhaitant poursuivre leurs études en Licence, la Pologne propose des programmes enseignés en anglais dans un cadre académique européen, avec un accompagnement adapté au profil de l’étudiant.", "For students holding a Baccalaureate and wishing to continue at Bachelor's level, Poland offers programs taught in English in a European academic setting, with support adapted to each student's profile.", "للطلبة الحاصلين على الباكالوريا الراغبين في مواصلة دراستهم في مرحلة الإجازة، تقدّم بولندا برامج تُدرَّس بالإنجليزية في إطار أكاديمي أوروبي، مع مرافقة تناسب ملف كل طالب."],
    ["Pour les étudiants titulaires d’un diplôme de Licence et souhaitant poursuivre leurs études en Master, la Pologne propose des programmes enseignés en anglais, adaptés aux étudiants souhaitant renforcer leur spécialisation dans un environnement académique international.", "For students holding a Bachelor's degree and wishing to continue at Master's level, Poland offers programs taught in English, suited to students who want to strengthen their specialization in an international academic environment.", "للطلبة الحاصلين على شهادة الإجازة الراغبين في مواصلة دراستهم في مرحلة الماجستير، تقدّم بولندا برامج تُدرَّس بالإنجليزية، مناسبة للطلبة الراغبين في تعزيز تخصصهم في بيئة أكاديمية دولية."],
    ["La Slovaquie offre aux étudiants internationaux la possibilité de poursuivre leurs études en Licence ou en Master dans un environnement académique européen. Le choix du programme se fait selon le profil de l’étudiant, la filière souhaitée et les conditions d’admission de chaque université.", "Slovakia offers international students the chance to continue their studies at Bachelor's or Master's level in a European academic environment. The choice of program depends on the student's profile, the desired field and each university's admission conditions.", "تتيح سلوفاكيا للطلبة الدوليين فرصة مواصلة دراستهم في مرحلة الإجازة أو الماجستير في بيئة أكاديمية أوروبية. ويتم اختيار البرنامج حسب ملف الطالب والتخصص المرغوب وشروط القبول في كل جامعة."],
    ["La Roumanie offre aux étudiants internationaux un cadre d’études structuré au cœur de l’Europe de l’Est. Les programmes sont accessibles selon le profil de l’étudiant, la filière choisie et les conditions d’admission de chaque université.", "Romania offers international students a structured study environment in the heart of Eastern Europe. Programs are accessible depending on the student's profile, the chosen field and each university's admission conditions.", "تقدّم رومانيا للطلبة الدوليين إطار دراسة منظّمًا في قلب أوروبا الشرقية. وتتاح البرامج حسب ملف الطالب والتخصص المختار وشروط القبول في كل جامعة."],
    ["L’Italie offre un cadre académique reconnu en Europe, avec plusieurs parcours universitaires adaptés aux étudiants internationaux. Le programme permet de construire un dossier solide selon le profil, le niveau linguistique et le projet d’études.", "Italy offers a recognized academic environment in Europe, with several university paths adapted to international students. The program lets you build a solid file according to your profile, language level and study project.", "تقدّم إيطاليا إطارًا أكاديميًا معترفًا به في أوروبا، مع عدة مسارات جامعية تناسب الطلبة الدوليين. يتيح البرنامج بناء ملف قوي بحسب الملف الشخصي والمستوى اللغوي ومشروع الدراسة."],
    ["Le Master en Italie permet aux étudiants de renforcer leur parcours académique dans un environnement européen reconnu. Les programmes offrent une continuité logique après la Licence et permettent de valoriser le profil pour la suite des études ou du projet professionnel.", "The Master's in Italy lets students strengthen their academic path in a recognized European environment. The programs offer a logical continuation after the Bachelor's and help enhance your profile for further studies or your career project.", "يتيح الماجستير في إيطاليا للطلبة تعزيز مسارهم الأكاديمي في بيئة أوروبية معترف بها. وتوفّر البرامج استمرارية منطقية بعد الإجازة وتساعد على تثمين الملف لمواصلة الدراسة أو لخدمة المشروع المهني."],
    ["Compte bloqué requis : ~11 904 € par an.", "Blocked account required: ~€11,904 per year.", "الحساب المصرفي المجمّد مطلوب: حوالي 11904 يورو سنويًا."],
    ["Ce programme est destiné aux étudiants ayant au minimum un niveau A2 en anglais. Il permet de développer les compétences linguistiques dans un environnement international et de mieux préparer l’intégration à un parcours universitaire en Hongrie.", "This program is intended for students with at least an A2 level in English. It helps develop language skills in an international environment and better prepares integration into a university program in Hungary.", "هذا البرنامج موجّه للطلبة الذين لديهم مستوى A2 على الأقل في اللغة الإنجليزية. يساعد على تطوير المهارات اللغوية في بيئة دولية وعلى التحضير بشكل أفضل للالتحاق بمسار جامعي في المجر."],
    ["Les diplômes délivrés en Hongrie sont reconnus dans l’Union Européenne. Les étudiants bénéficient d’un cadre d’études international, avec des programmes adaptés aux profils souhaitant étudier en anglais.", "Degrees awarded in Hungary are recognized in the European Union. Students benefit from an international study environment, with programs adapted to profiles wishing to study in English.", "الشهادات الممنوحة في المجر معترف بها في الاتحاد الأوروبي. يستفيد الطلبة من إطار دراسي دولي، مع برامج تناسب الملفات الراغبة في الدراسة بالإنجليزية."],
    ["Le Master en Hongrie permet aux étudiants de poursuivre leur spécialisation dans un environnement européen et international, avec des diplômes reconnus et des programmes conçus pour les étudiants étrangers.", "The Master's in Hungary lets students pursue their specialization in a European and international environment, with recognized degrees and programs designed for foreign students.", "يتيح الماجستير في المجر للطلبة مواصلة تخصصهم في بيئة أوروبية ودولية، بشهادات معترف بها وبرامج مصمّمة للطلبة الأجانب."],
    ["Un niveau minimum B2 en anglais est obligatoire pour intégrer un programme de Licence.Ce programme permet aux étudiants de poursuivre leurs études dans un cadre international, avec des diplômes reconnus en Europe.", "A minimum B2 level in English is required to enter a Bachelor's program. This program lets students continue their studies in an international setting, with degrees recognized in Europe.", "مستوى B2 على الأقل في اللغة الإنجليزية إلزامي للالتحاق ببرنامج الإجازة. يتيح هذا البرنامج للطلبة مواصلة دراستهم في إطار دولي، بشهادات معترف بها في أوروبا."],
    ["Ce programme permet aux étudiants d’intégrer un parcours universitaire en anglais dans un environnement international, avec une procédure claire et un accompagnement personnalisé selon le projet d’études.", "This program lets students join a university path taught in English in an international environment, with a clear procedure and personalized support tailored to the study project.", "يتيح هذا البرنامج للطلبة الالتحاق بمسار جامعي بالإنجليزية في بيئة دولية، مع إجراءات واضحة ومرافقة شخصية حسب مشروع الدراسة."],
    ["Le Master en Pologne permet aux étudiants de poursuivre leur parcours académique en anglais, de développer leurs compétences dans leur domaine de spécialisation et de préparer la suite de leur projet professionnel ou universitaire.", "The Master's in Poland lets students continue their academic path in English, develop their skills in their field of specialization and prepare the next step of their professional or university project.", "يتيح الماجستير في بولندا للطلبة مواصلة مسارهم الأكاديمي بالإنجليزية، وتطوير مهاراتهم في مجال تخصصهم، والاستعداد للخطوة التالية من مشروعهم المهني أو الجامعي."],
    ["Un accompagnement personnalisé est proposé pour orienter chaque étudiant vers le programme le plus adapté à son profil, à son niveau académique et à son projet d’études.", "Personalized support is offered to guide each student toward the program best suited to their profile, academic level and study project.", "تُقدَّم مرافقة شخصية لتوجيه كل طالب نحو البرنامج الأنسب لملفه ومستواه الأكاديمي ومشروع دراسته."],
    ["La Roumanie propose plusieurs filières francophones et internationales, avec un accompagnement adapté pour aider chaque étudiant à choisir le parcours le plus cohérent avec son profil et son projet académique..", "Romania offers several French-language and international programs, with support to help each student choose the path most consistent with their profile and academic project..", "تقدّم رومانيا عدة مسارات بالفرنسية ومسارات دولية، مع مرافقة تساعد كل طالب على اختيار المسار الأنسب لملفه ولمشروعه الأكاديمي.."],
    ["L’Italie propose une grande diversité de programmes universitaires en Licence et Master, avec des parcours accessibles en italien ou en anglais, dans un cadre académique reconnu en Europe.", "Italy offers a wide variety of university programs at Bachelor's and Master's level, with paths available in Italian or English, in an academic setting recognized in Europe.", "تقدّم إيطاليا تنوعًا كبيرًا من البرامج الجامعية في مرحلتي الإجازة والماجستير، بمسارات متاحة بالإيطالية أو بالإنجليزية، في إطار أكاديمي معترف به في أوروبا."],
    ["Allemagne 🇩🇪 pour un projet académique ambitieux, une orientation sérieuse et une prise en charge professionnelle de votre dossier.", "Germany 🇩🇪 for an ambitious academic project, serious guidance and professional handling of your file.", "ألمانيا 🇩🇪 لمشروع أكاديمي طموح، وتوجيه جاد، ومعالجة احترافية لملفكم."],
    ["La Hongrie propose des programmes enseignés en anglais, avec une procédure claire, un accompagnement personnalisé et des parcours adaptés aux étudiants internationaux.", "Hungary offers programs taught in English, with a clear procedure, personalized support and paths adapted to international students.", "تقدّم المجر برامج تُدرَّس بالإنجليزية، مع إجراءات واضحة ومرافقة شخصية ومسارات تناسب الطلبة الدوليين."],
    ["La Lituanie propose des programmes enseignés en anglais, avec des parcours préparatoires, Licence et Master adaptés aux étudiants internationaux.", "Lithuania offers programs taught in English, with preparatory, Bachelor's and Master's paths adapted to international students.", "تقدّم ليتوانيا برامج تُدرَّس بالإنجليزية، بمسارات تحضيرية ومسارات الإجازة والماجستير تناسب الطلبة الدوليين."],
    ["La Pologne propose des programmes enseignés en anglais, avec un parcours structuré et un accompagnement adapté au niveau et au projet d’études de chaque étudiant.", "Poland offers programs taught in English, with a structured path and support adapted to each student's level and study project.", "تقدّم بولندا برامج تُدرَّس بالإنجليزية، بمسار منظّم ومرافقة تناسب مستوى كل طالب ومشروع دراسته."],
    ["La Slovaquie proposera bientôt des programmes en Licence et Master, avec une orientation personnalisée selon votre profil, votre niveau et votre projet d’études.", "Slovakia will soon offer Bachelor's and Master's programs, with personalized guidance based on your profile, level and study project.", "ستقدّم سلوفاكيا قريبًا برامج في مرحلتي الإجازة والماجستير، مع توجيه شخصي حسب ملفكم ومستواكم ومشروع دراستكم."],
    ["La Roumanie proposera bientôt des programmes en Licence et Master dans un cadre académique structuré, avec plusieurs filières en français, en anglais ou en roumain.", "Romania will soon offer Bachelor's and Master's programs in a structured academic setting, with several tracks in French, English or Romanian.", "ستقدّم رومانيا قريبًا برامج في مرحلتي الإجازة والماجستير في إطار أكاديمي منظّم، مع عدة مسارات بالفرنسية أو الإنجليزية أو الرومانية."],
    ["Malte proposera bientôt des programmes universitaires en anglais, dans un cadre européen dynamique, adapté aux étudiants internationaux.", "Malta will soon offer university programs in English, in a dynamic European setting suited to international students.", "ستقدّم مالطا قريبًا برامج جامعية بالإنجليزية، في إطار أوروبي ديناميكي يناسب الطلبة الدوليين."],
    ["La Bulgarie proposera bientôt des programmes en Licence et Master, avec un accompagnement adapté au profil et au projet d’études de chaque étudiant.", "Bulgaria will soon offer Bachelor's and Master's programs, with support adapted to each student's profile and study project.", "ستقدّم بلغاريا قريبًا برامج في مرحلتي الإجازة والماجستير، مع مرافقة تناسب ملف كل طالب ومشروع دراسته."],

    /* Assistant de discussion */
    ["En ligne", "Online", "متصل"],
    ["Écrivez votre message…", "Type your message…", "اكتب رسالتك…"],
    ["Ouvrir le chat", "Open chat", "فتح الدردشة"],
    ["Plus d'options", "More options", "المزيد من الخيارات"],
    ["Envoyer", "Send", "إرسال"],
    ["🌍 Meilleurs pays pour étudier", "🌍 Best countries to study in", "🌍 أفضل الدول للدراسة"],
    ["💶 Pays le moins cher", "💶 Cheapest country", "💶 البلد الأقل تكلفة"],
    ["🛂 Visa étudiant facile", "🛂 Easy student visa", "🛂 تأشيرة طالب سهلة"],
    ["🏦 Compte bloqué", "🏦 Blocked account", "🏦 الحساب المجمّد"],
    ["🌍 Meilleurs pays", "🌍 Best countries", "🌍 أفضل الدول"],
    ["💶 Pays moins cher", "💶 Cheapest country", "💶 البلد الأقل تكلفة"],
    ["🎯 Mon profil", "🎯 My profile", "🎯 ملفي"],
    ["📞 Contact", "📞 Contact", "📞 اتصال"],
    ["👋 Bonjour ! Je suis le <strong>conseiller virtuel de SM Edu Travel</strong>.<br>Je peux répondre à vos questions sur les études à l'étranger. Comment puis-je vous aider ?", "👋 Hello! I'm the <strong>virtual advisor of SM Edu Travel</strong>.<br>I can answer your questions about studying abroad. How can I help you?", "👋 مرحبًا! أنا <strong>المستشار الافتراضي لـ SM Edu Travel</strong>.<br>يمكنني الإجابة عن أسئلتكم حول الدراسة في الخارج. كيف يمكنني مساعدتكم؟"],
    ["👋 Bonjour ! Je suis le <strong>conseiller virtuel de SM Edu Travel</strong>.<br>Nous vous accompagnons pour vos études à l'étranger.<br>Quel est votre dernier diplôme, et quel pays vous intéresse ?", "👋 Hello! I'm the <strong>virtual advisor of SM Edu Travel</strong>.<br>We support you with your studies abroad.<br>What is your latest degree, and which country interests you?", "👋 مرحبًا! أنا <strong>المستشار الافتراضي لـ SM Edu Travel</strong>.<br>نرافقكم في دراستكم في الخارج.<br>ما هي آخر شهادة حصلتم عليها، وأي بلد يهمّكم؟"],
    ["Pour clarifier votre projet, appelez-nous au <strong>+216 54 819 879</strong>, écrivez sur WhatsApp au <strong>+216 56 819 899</strong>, ou venez au bureau à Tunis.", "To clarify your project, call us at <strong>+216 54 819 879</strong>, message us on WhatsApp at <strong>+216 56 819 899</strong>, or visit our office in Tunis.", "لتوضيح مشروعكم، اتصلوا بنا على <strong>+216 54 819 879</strong>، أو راسلونا عبر واتساب على <strong>+216 56 819 899</strong>، أو زورونا في مكتبنا بتونس."]
  ];

  /* ───────────────────────────── Outils ───────────────────────────── */
  // Clé de recherche : espaces et apostrophes typographiques normalisés.
  function norm(value) {
    return String(value).replace(/[  ]/g, ' ').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  }

  var DICT = Object.create(null);
  ROWS.forEach(function (row) {
    DICT[norm(row[0])] = { en: row[1], ar: row[2] };
  });

  function readLang() {
    try {
      var asked = new URLSearchParams(window.location.search).get('lang');
      if (asked && LANGS.indexOf(asked) !== -1) {
        try { localStorage.setItem(STORAGE_KEY, asked); } catch (e) { /* stockage indisponible */ }
        return asked;
      }
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) { /* stockage indisponible : français */ }
    return 'fr';
  }

  var lang = readLang();
  var root = document.documentElement;

  function applyDirection() {
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }
  // Tout de suite, avant le premier affichage : pas de page qui « saute » de gauche à droite.
  applyDirection();

  function lookup(fr, l) {
    var hit = DICT[norm(fr)];
    return hit ? hit[l] : null;
  }

  // Textes composés (« Programme Italie », « Italie • Licence / Master », date prévue…).
  var PATTERNS = [
    {
      re: /^Programme (.+)$/,
      fn: function (m, l) {
        var country = lookup(m[1], l);
        if (country === null) return null;
        return l === 'ar' ? 'برنامج ' + country : country + ' Program';
      }
    },
    {
      re: /^(.*) • Prévu pour le (\d{2}\/\d{2}\/\d{4})$/,
      fn: function (m, l) {
        var head = translate(m[1], l);
        return (head === null ? m[1] : head) + ' • ' + (l === 'ar' ? 'مبرمج بتاريخ ' : 'Planned for ') + m[2];
      }
    },
    {
      re: /^(.*) • Prévu pour (.+)$/,
      fn: function (m, l) {
        var head = translate(m[1], l);
        var when = translate(m[2], l);
        return (head === null ? m[1] : head) + ' • ' + (l === 'ar' ? 'مبرمج: ' : 'Planned: ') + (when === null ? m[2] : when);
      }
    }
  ];
  var SEPARATORS = [' • ', ' · ', ' / '];

  // Traduction d'un texte français, ou null s'il n'y en a pas.
  function translate(text, l) {
    var key = norm(text);
    if (!key) return null;
    var hit = DICT[key];
    if (hit) return hit[l];
    var i;
    for (i = 0; i < PATTERNS.length; i += 1) {
      var m = PATTERNS[i].re.exec(key);
      if (m) {
        var out = PATTERNS[i].fn(m, l);
        if (out !== null && out !== undefined) return out;
      }
    }
    for (i = 0; i < SEPARATORS.length; i += 1) {
      var sep = SEPARATORS[i];
      if (key.indexOf(sep) === -1) continue;
      var changed = false;
      var joined = key.split(sep).map(function (part) {
        var t = translate(part, l);
        if (t === null) return part;
        changed = true;
        return t;
      }).join(sep);
      if (changed) return joined;
    }
    return null;
  }

  window.vt = function (fr) {
    if (lang === 'fr') return fr;
    var t = translate(fr, lang);
    return t === null ? fr : t;
  };
  window.vLang = function () { return lang; };

  /* ───────────────────────────── Application à la page ───────────────────────────── */
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1 };
  var started = false;

  function keepSpacing(source, translated) {
    return source.match(/^\s*/)[0] + translated + source.match(/\s*$/)[0];
  }

  function inExcludedZone(node) {
    var el = node.nodeType === 1 ? node : node.parentNode;
    return !!(el && el.closest && el.closest('[data-no-i18n]'));
  }

  function translateTextNode(node) {
    var parent = node.parentNode;
    if (!parent || SKIP[parent.nodeName] || inExcludedZone(node)) return;
    var current = node.nodeValue;
    // Texte réécrit par la page entre-temps (compteur, saisie progressive…) : c'est la nouvelle source.
    if (node.__vi !== undefined && current !== node.__vi.out) node.__vi = undefined;
    if (node.__vi === undefined) node.__vi = { fr: current, out: current };
    var out = node.__vi.fr;
    if (lang !== 'fr') {
      var t = translate(out, lang);
      if (t !== null) out = keepSpacing(out, t);
    }
    if (out !== current) node.nodeValue = out;
    node.__vi.out = out;
  }

  var ATTRS = ['placeholder', 'alt', 'aria-label', 'title'];
  function translateAttrs(el) {
    var names = el.nodeName === 'META' ? ['content'] : ATTRS;
    if (inExcludedZone(el)) return;
    for (var i = 0; i < names.length; i += 1) {
      var name = names[i];
      var value = el.getAttribute(name);
      if (value === null) continue;
      var store = el.__viA || (el.__viA = {});
      var rec = store[name];
      if (rec && value !== rec.out) rec = null;
      if (!rec) rec = store[name] = { fr: value, out: value };
      var out = rec.fr;
      if (lang !== 'fr') {
        var t = translate(out, lang);
        if (t !== null) out = t;
      }
      if (out !== value) el.setAttribute(name, out);
      rec.out = out;
    }
  }

  // Message prérempli des liens WhatsApp (?text=…) : traduit lui aussi.
  function translateLink(a) {
    var href = a.getAttribute('href');
    if (!href || href.indexOf('wa.me/') === -1) return;
    var rec = a.__viH;
    if (rec && href !== rec.out) rec = null;
    if (!rec) rec = a.__viH = { fr: href, out: href };
    var out = rec.fr;
    if (lang !== 'fr') {
      var at = rec.fr.indexOf('?text=');
      if (at !== -1) {
        try {
          var t = translate(decodeURIComponent(rec.fr.slice(at + 6)), lang);
          if (t !== null) out = rec.fr.slice(0, at + 6) + encodeURIComponent(t);
        } catch (e) { /* lien mal formé : inchangé */ }
      }
    }
    if (out !== href) a.setAttribute('href', out);
    rec.out = out;
  }

  // Les flèches « vers l'avant » pointent vers la gauche en arabe.
  var FLIP = { arrow_forward: 1, arrow_right_alt: 1, chevron_right: 1, navigate_next: 1, arrow_back: 1, chevron_left: 1, navigate_before: 1 };
  function flipIcon(el) {
    if (!FLIP[el.textContent.trim()]) return;
    el.style.scale = lang === 'ar' ? '-1 1' : '';
  }

  function walk(node) {
    if (node.nodeType === 3) { translateTextNode(node); return; }
    if (node.nodeType !== 1 || SKIP[node.nodeName]) return;
    translateAttrs(node);
    if (node.nodeName === 'A') translateLink(node);
    if (node.classList && node.classList.contains('material-symbols-outlined')) flipIcon(node);
    for (var child = node.firstChild; child; child = child.nextSibling) walk(child);
  }

  function retranslateAll() {
    walk(document.documentElement);
  }

  function ensureArabicFont() {
    if (lang !== 'ar' || document.getElementById('vi-font-ar')) return;
    var link = document.createElement('link');
    link.id = 'vi-font-ar';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function markSwitch() {
    document.querySelectorAll('[data-lang]').forEach(function (button) {
      var active = button.getAttribute('data-lang') === lang;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
    });
  }

  function setLang(next) {
    if (LANGS.indexOf(next) === -1 || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* stockage indisponible */ }
    applyDirection();
    ensureArabicFont();
    retranslateAll();
    markSwitch();
    window.dispatchEvent(new CustomEvent('vitrine:lang', { detail: { lang: lang } }));
  }
  window.vSetLang = setLang;

  // Contenu ajouté après coup (cartes des programmes, avis, fenêtre des destinations…).
  var observer = new MutationObserver(function (records) {
    if (!started) return;
    records.forEach(function (record) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(walk);
      } else if (record.type === 'characterData') {
        translateTextNode(record.target);
      } else if (record.type === 'attributes') {
        translateAttrs(record.target);
        if (record.target.nodeName === 'A') translateLink(record.target);
      }
    });
    // Nos propres écritures ne doivent pas relancer l'observateur.
    observer.takeRecords();
  });

  function start() {
    if (started) return;
    started = true;
    ensureArabicFont();
    retranslateAll();
    markSwitch();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'alt', 'aria-label', 'title', 'href']
    });
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-lang]');
    if (button) setLang(button.getAttribute('data-lang'));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
