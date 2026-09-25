// En production, la vitrine vit à la racine du domaine (l'app tourne sous
// /app/, voir docker-compose.yml / la config nginx de l'hôte). En dev, elle
// reste servie via le plugin vitrinePlugin() de vite.config.ts, sous /vitrine/.
export const VITRINE_URL = import.meta.env.VITE_VITRINE_URL || (import.meta.env.DEV ? "/vitrine/" : "/");
