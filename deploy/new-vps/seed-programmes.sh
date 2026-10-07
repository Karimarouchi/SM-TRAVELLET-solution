#!/usr/bin/env bash
# (Facultatif) Charge les programmes d'études par défaut du site vitrine
# (Italie, Allemagne, Hongrie…) dans une base NEUVE. Sans eux, la section
# « Programmes » de la vitrine est vide jusqu'à ce que vous les créiez dans
# l'application (Vitrine > Programmes).
#
#   sudo bash deploy/new-vps/seed-programmes.sh
#
# Refuse de s'exécuter si des programmes existent déjà (le script d'origine
# vide la table avant de la remplir).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

set -a
# shellcheck source=/dev/null
source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' .env)
set +a

COUNT="$(docker exec sm-travel-postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-sm_travel}" -tAc 'SELECT count(*) FROM programmes')"
if [[ "${COUNT}" != "0" ]]; then
  echo "La base contient déjà ${COUNT} programme(s) : rien n'est modifié."
  exit 0
fi

NETWORK="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' sm-travel-postgres)"
docker run --rm --network "${NETWORK}" \
  -v "${ROOT_DIR}:/work" -w /work/backend \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-sm_travel}" \
  -e JWT_SECRET=seed-only \
  node:20-alpine sh -c 'npm ci --omit=dev --silent && node seed-programmes.js'
