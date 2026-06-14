# Fiche Gameplay 05 : Les Statistiques du Joueur

Ce document répertorie et définit de manière exhaustive toutes les statistiques du jeu. Ces statistiques influencent les calculs de combat, de déplacement et de survie. Elles sont catégorisées en trois axes : Protection, Attaque, et Utilitaire.

---

## 1. Catégorie : Protection

Ces statistiques servent à atténuer, éviter ou rejeter les dégâts et afflictions reçus des ennemis.

| Statistique | Nom Interne | Description Fonctionnelle |
| :--- | :--- | :--- |
| **Armure** | `ARMOR` | Diminue la quantité de dégâts physiques subis. Calculée en réduction brute ou en pourcentage réducteur. |
| **Volonté** | `WILLPOWER` | Diminue la quantité de dégâts élémentaires subis. Représente la résistance magique innée. |
| **Esquive** | `EVASION` | Pourcentage de chance d'éviter totalement un coup. Opposée à la *Chance de toucher* de l'attaquant. |
| **Parade** | `PARRY` | Pourcentage de chance de bloquer/dévier un coup, annulant les dégâts ou les réduisant drastiquement selon la configuration de l'arme équipée. Opposée à la *Chance de toucher*. |
| **Résistance Élémentaire** | `ELEMENTAL_RESIST` | Réduit l'efficacité ou annule complètement les effets d'états élémentaires (Gel, Brûlure, Électrisation). |
| **Résistance Physique** | `PHYSICAL_RESIST` | Réduit l'efficacité ou annule complètement les effets d'états physiques (Poison, Saignement, Étourdissement/Stun, Ralentissement). |

---

## 2. Catégorie : Attaque

Ces statistiques augmentent le potentiel offensif direct et indirect des armes et compétences du joueur.

| Statistique | Nom Interne | Description Fonctionnelle |
| :--- | :--- | :--- |
| **Dégâts Physiques** | `PHYSICAL_DAMAGE` | Augmente le montant des dégâts physiques directs infligés par les armes/compétences. |
| **Dégâts Élémentaires** | `ELEMENTAL_DAMAGE` | Augmente le montant des dégâts élémentaires directs (Feu, Froid, Foudre...) infligés. |
| **Affliction Physique** | `PHYSICAL_AFFLICTION` | Augmente les dégâts sur la durée (DoT) physiques appliqués aux cibles (ex: Poison, Saignement). |
| **Affliction Élémentaire** | `ELEMENTAL_AFFLICTION` | Augmente les dégâts sur la durée (DoT) élémentaires appliqués aux cibles (ex: Brûlure, Gel prolongé). |
| **Chance de Coup Critique** | `CRIT_CHANCE` | Pourcentage de chance qu'une attaque inflige un coup critique (dégâts multipliés). |
| **Dégâts de Coup Critique** | `CRIT_DAMAGE` | Multiplicateur de dégâts appliqué lors d'un coup critique (ex: +50% de dégâts de base). |
| **Chance de Toucher** | `HIT_CHANCE` | Capacité à toucher un ennemi. Contrebalance l'Esquive et la Parade du monstre ciblé. |
| **Pénétration Physique** | `PHYSICAL_PENETRATION` | Ignore une portion brute ou un pourcentage de l'armure/résistance physique de l'ennemi. |
| **Pénétration Élémentaire** | `ELEMENTAL_PENETRATION` | Ignore une portion brute ou un pourcentage de la volonté/résistance élémentaire de l'ennemi. |

---

## 3. Catégorie : Utilitaire

Ces statistiques gèrent le confort de jeu, la gestion des ressources, le mouvement et la récupération.

| Statistique | Nom Interne | Description Fonctionnelle |
| :--- | :--- | :--- |
| **Bonus au Soin** | `HEALING_BONUS` | Augmente le montant des points de vie restaurés par les compétences de soin actives ou les effets régénérants. |
| **Vie Maximum** | `MAX_HEALTH` | Quantité maximale de points de vie du personnage. Zéro PV provoque le K.O. |
| **Mana Maximum** | `MAX_MANA` | Quantité maximale de points de mana servant à lancer l'Ultime ou des compétences actives gourmandes. |
| **Régénération de Vie** | `HEALTH_REGEN` | Quantité de points de vie restaurés passivement par seconde. |
| **Régénération de Mana** | `MANA_REGEN` | Quantité de points de mana restaurés passivement par seconde. |
| **Bouclier Élémentaire** | `ELEMENTAL_SHIELD` | Bouclier d'énergie temporaire qui absorbe les dégâts entrants à la place de la barre de vie. |
| **Régénération Bouclier** | `SHIELD_REGEN` | Taux de régénération par seconde du bouclier élémentaire lorsque le personnage n'a pas subi de dégâts depuis X secondes. |
| **Vitesse de Déplacement** | `MOVEMENT_SPEED` | Vitesse de déplacement physique de la forme géométrique à l'écran. |
| **Vitesse de Récupération** | `COOLDOWN_RECOVERY` | Réduit les temps de recharge (Cooldown) des compétences actives et du Dash. |
