#!/usr/bin/env bash
# Copie le site vitrine (index.html, images, pages légales…) dans le dossier
# servi par nginx. On ne publie QUE ces fichiers : jamais le dossier du projet
# entier (backend/.env et les secrets y sont).
#
# Lancé par 02-start-app.sh et update.sh ; peut aussi l'être seul :
#   sudo bash deploy/new-vps/publish-vitrine.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="/var/www/smtravel-vitrine"

mkdir -p "${TARGET}"

for item in index.html paiement.html tailwind.css robots.txt sitemap.xml \
            IMAGE js css SONG mentions-legales politique-confidentialite \
            politique-cookies politique-annulation-remboursement conditions-generales-de-vente; do
  if [[ -e "${ROOT_DIR}/${item}" ]]; then
    rsync -a --delete "${ROOT_DIR}/${item}" "${TARGET}/"
  else
    echo "   (absent, ignoré : ${item})"
  fi
done

chown -R www-data:www-data "${TARGET}" 2>/dev/null || true
echo "Vitrine publiée dans ${TARGET}"
