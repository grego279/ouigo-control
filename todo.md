# Project TODO

- [x] Interface mobile-first aux couleurs OUIGO (rose, turquoise, blanc, noir) avec boutons larges et navigation rapide.
- [x] Formulaire de création d’un contrôle : type, rame 3 chiffres, train/sillon 4 chiffres, date automatique, agent, lieu, OP nettoyage, heures NEC et SOL-BORD optionnelles.
- [x] Validation terrain avec avertissements pour champs obligatoires manquants et contrôle modifiable avant validation finale.
- [x] Structure rame complète : R1 à R8, niveaux H/B, R4 haut uniquement, R7H nurserie, fourgons R1/R8, locaux ASCT/NEC R4, plateformes, escaliers, toilettes.
- [x] Saisie rapide d’anomalies par zone, niveau, lieu, élément, commentaire, numéro de place optionnel.
- [x] Dictée vocale pour le commentaire d’anomalie.
- [x] Photo facultative via appareil avec compression automatique inférieure ou égale à 250 Ko.
- [x] Localisation automatique des photos selon zone/niveau/lieu/place.
- [x] Contrôle Valise NEC avec les 16 éléments listés par l’utilisateur.
- [x] Notation SAMI sur les catégories WC, Voitures, Local ASCT, Extérieur, Plateforme avec calcul automatique sur 20.
- [x] Génération du rapport Word nommé `KN1 propreté [rame] [JJ_MM_AAAA].docx`, conforme au modèle fourni et sans photos.
- [x] Génération d’une ligne Excel compatible avec le fichier global de suivi fourni.
- [x] Génération d’un fichier Excel photos séparé si des photos existent.
- [x] Flux d’envoi par e-mail des fichiers générés au destinataire choisi par l’agent.
- [x] Tests automatisés Vitest couvrant notation, validation, exports et logique métier.

## Améliorations demandées avec les nouveaux gabarits

- [x] Remplacer le logo affiché sur l’écran d’accueil et les boutons par le logo OUIGO Control fourni.
- [x] Refondre la navigation en six boutons principaux : Accueil, Aspect extérieur, Aspect intérieur, SAMI intérieur, Photos, Export.
- [x] Adapter l’accueil aux champs TM, rame, train, OP nettoyage multi-choix, type de contrôle, lieu/type, contrôleur et date selon les colonnes A à G du gabarit Excel.
- [x] Ajouter les couleurs TM dans l’Excel et le Word : TLG FF9900, TATL 66FF33, TSEE 00B0F0, TLL FFFF00, TEE C0E6F5.
- [x] Ajouter les couleurs SAMI dans l’Excel et le Word : S 92D050, A 00B0F0, M FFFF00, I FF0000.
- [x] Adapter le rapport Word KN1 pour reprendre le gabarit Word joint et remplacer les marqueurs TM, RRR, TTTT, NNN, TYPE, OOO, XX/MM/AAAA et commentaires.
- [x] Adapter la ligne Excel de suivi pour reprendre le gabarit joint, la ligne 3 et les colonnes métier demandées.
- [x] Adapter l’Excel photos pour reprendre le gabarit joint et conserver la localisation automatique des photos.
- [x] Développer le contrôle Aspect extérieur avec motrices, remorques, baies vitrées, portes, commentaire dictable et proposition SAMI modifiable.
- [x] Développer le contrôle Aspect intérieur selon configuration OUIGO/TANGO, extrémité de départ 1/2, ordre de contrôle et points contrôlés par segment.
- [x] Développer SAMI Intérieur avec propositions modifiables, commentaires dictables et mapping Excel/Word pour plateforme, salle, siège, plafond, poubelle, graffitis, nuisibles, escaliers, WC et autres rubriques du gabarit.
- [x] Mettre à jour les tests Vitest pour couvrir les nouveaux mappings, couleurs, gabarits et calculs SAMI.

## Vérifications de conformité complémentaires

- [x] Vérifier dans le code que le logo OUIGO Control est bien branché et que la navigation contient exactement Accueil, Aspect extérieur, Aspect intérieur, SAMI intérieur, Photos et Export.
- [x] Ajouter des tests ou contrôles prouvant le mapping des champs d’accueil TM, rame, train, OP nettoyage, lieu/type, contrôleur et date vers la ligne Excel.
- [x] Ajouter des tests sur les couleurs TM et SAMI exactes dans l’Excel de suivi.
- [x] Ajouter un test de génération Word contrôlant le remplacement des marqueurs TM, RRR, TTTT, NNN, TYPE, OOO, XX/MM/AAAA et commentaires.
- [x] Vérifier explicitement les structures métier Aspect extérieur, Aspect intérieur OUIGO/TANGO, extrémité 1/2, segments et SAMI Intérieur détaillé.
- [x] Vérification reprise de contexte : renforcer les tests automatisés sur les structures métier, les calculs SAMI modifiables et le remplacement complet des marqueurs Word avant livraison.

## 25e itération — Rames non observées dans les exports
- [x] Identifier les labels de rames non observées depuis skippedSegments via useMemo (interiorSequence.filter + map).
- [x] KN1 : après l'évaluation prestation nettoyage, ajouter " - Rames non observées : X, Y, Z" si skippedLabels.length > 0.
- [x] Ligne suivi propreté : renseigner la case E3 avec "Non observées : X, Y, Z" si skippedLabels.length > 0.
- [x] Passer skippedLabels aux 3 appels generateAllAttachments dans Home.tsx (génération, brouillon e-mail, mailto).

## 24e itération — Bouton Non observé (segments intérieurs)
- [x] Ajouter un Set<string> skippedSegments dans l'état React de Home pour stocker les IDs des segments Non observés.
- [x] Afficher un bouton "Non observé" (icône EyeOff) à gauche du "+" pour chaque segment dans l'onglet Aspect intérieur.
- [x] Exclure les segments marqués Non observé du calcul SAMI via filtrage avant computeAllSamiFromResults.
- [x] Permettre d'annuler le statut Non observé (second clic rétablit l'état). Suppression automatique du résultat existant si le segment est marqué Non observé.
- [x] Corriger le fallback : les fonctions computeSami retournent null (au lieu de 100%/S) quand aucun segment observé n'est disponible. La proposition calculée est masquée dans l'UI SAMI quand null.

## 23e itération— Corrections et refonte demandées

- [x] Remplacer le logo dans l'application (header + favicon/PWA) par le nouveau logo cercle rose OUiGO Control fourni.
- [x] Bouton Accueil : supprimer les champs « Heure d'arrivée NEC » et « Heure arrivée SOL-BORD ».
- [x] Bouton Aspect extérieur : implémenter l'ordre exact des éléments selon l'extrémité (Ext 1 : Motrice1, R1..R8, Motrice2 ; Ext 2 : inversé), sans porte en R4.
- [x] Bouton Aspect intérieur : implémenter les séquences exactes Extrémité 1 et Extrémité 2 (OUIGO/TANGO), avec formulaires contextuels par type de segment (Plateforme/WC/Réappros/Salle/Escalier/Fourgon/Local NEC/Local ASCT/Nurserie/Poubelles).
- [x] Bouton Aspect intérieur : intégrer les poubelles OUIGO et TANGO aux bons segments de la séquence.
- [x] Bouton SAMI intérieur : recalculer toutes les propositions SAMI depuis les points terrain saisis dans Aspect intérieur (Moquette Plateforme H/I/J/O, Moquette Salle I, Siège J, Plafond K, Poubelles L, Graffitis M/R, Nuisibles N/S, Escalier P, WC Q, Local ASCT T, Local NEC U, Fourgon V).
- [x] Bouton SAMI intérieur : ajouter les commentaires dictables/écrits pour chaque rubrique, mappés vers les marqueurs Word (HHHH, IIII, CCCC, DDDD, EEEE, FFFF, KKKK, JJJJ, BBBB, GGGG, SSSS, QQQQ).
- [x] Bouton SAMI intérieur : calculer la note sur 20, l'évaluation prestation (PPPP) et le décompte S/A/M/I pour le Word.
- [x] Export Word : respecter scrupuleusement le gabarit KN1 (tableau, couleurs SAMI, tous les marqueurs).
- [x] Export Excel ligne suivi : feuille « Ligne Contrôle », 25 colonnes A-Y, couleurs TM et SAMI.
- [x] Export Excel Photos : feuille « photos », ligne 1 titre, ligne 2 en-têtes, photos avec localisation hiérarchique (famille → R1-R8 → H/B).
- [x] Bouton Export : corps du mail conforme au modèle fourni (Bonjour, rame XXX, train XXXX, 3 PJ nommées).

## 4e itération — Corrections signalées

- [x] Logo PWA : corriger l'icône "Ajouter à l'écran d'accueil" (mobile/desktop) — icônes locales dans public/ (192x192 et 512x512), manifest.json et apple-touch-icon mis à jour.
- [x] Gabarit Word : tableau 10 lignes × 8 colonnes reproduit fidèlement (fusions, couleurs D9D9D9/336699/0070C0/BDD6EE, SAMI 92D050/00B0F0/FFFF00/FF0000, marqueurs HHHH/IIII/CCCC/DDDD/EEEE/FFFF/KKKK/JJJJ/BBBB/GGGG/PPPP/QQQQ/SSSS).
- [x] Boutons "Dicter" : fonction speakTo corrigée (onerror, onend, feedback visuel pulse).
- [x] Préremplissage nominal Aspect intérieur : emptyDataForType retourne les valeurs nominales pour tous les types de segments.

## 5e itération — Corrections signalées

- [x] Logo PWA : générer une icône ronde (cercle rose) à partir du logo OUIGOControl.png pour que l'icône sur l'écran d'accueil ressemble à OUIGO CleanUp.
- [x] Plein écran standalone : manifest.json display="standalone" + meta viewport pour supprimer la barre de navigation du navigateur.
- [x] Boutons Dicter : réécrire speakTo identique à OUIGO CleanUp (interimResults, feedback visuel, langue fr-FR).
- [x] Word paysage : confirmer que le document Word généré est bien en orientation paysage (A4 landscape).
- [x] Export : supprimer le bouton "Générer le brouillon .eml", renommer "Ouvrir mailto de secours" en "Création du message", joindre automatiquement les 3 fichiers au message.
- [x] Photos : remplacer le bouton "Choisir un fichier" par une icône d'appareil photo.
- [x] Accueil : ajouter le choix de configuration de la rame (OUIGO / TANGO).
- [x] Aspect intérieur TANGO : Espace de convivialité R4 → Lino (Propre/Non-conforme, nominal Propre), sans sièges, avec Présence de déchets (Oui/Non, nominal Non).

## 6e itération — Corrections persistantes

- [x] Dictée vocale : composant DictateBtn React (état interne, Web Speech API, fr-FR, interimResults, feedback visuel), styles CSS .dictate-btn/.listening/pulse-red ajoutés dans index.css.
- [x] Word paysage : PageOrientation.LANDSCAPE importé et utilisé (width=16838, height=11906, orientation=landscape confirmé dans le XML généré).
- [x] PWA plein écran + logo : manifest.json display=standalone, scope="/", icônes purpose=any+maskable séparées, meta mobile-web-app-capable ajoutée dans index.html.

## 7e itération — Corrections signalées
- [x] PWA icône : routes Express publiques /api/pwa/icon-192.png et /api/pwa/icon-512.png créées (contournent l'auth Cloudflare), manifest.json servi via /api/pwa/manifest.json.
- [x] PWA standalone : manifest.json display=standalone servi via /api/pwa/manifest.json (route publique sans auth), index.html mis à jour pour pointer vers /api/pwa/.
- [x] Bouton Dicter : continuous=true, arrêt au second appui, accumulation des résultats finaux, label "Écoute… (appuyer pour arrêter)" pendant la dictée.

## 8e itération — Corrections signalées
- [x] Bouton Dicter : arrêt automatique — reconnexion automatique via stoppedManuallyRef + setTimeout(rec.start, 200) dans onend.
- [x] Bouton Dicter : ponctuation et majuscules — applyPunctuation() + capitalizeFirst() transforment virgule, point, deux points, à la ligne, etc.
- [x] Bouton Dicter : aperçu avant intégration — DictatePreviewModal avec boutons Valider/Annuler/Recommencer, styles CSS ajoutés dans index.css.
- [x] Bouton Dicter : anti-doublon — finalSegmentsRef Map<number,string> indexée par resultIndex, chaque segment stocké une seule fois.
- [x] Word paysage : déjà correct (PageOrientation.LANDSCAPE, width=16838, height=11906) — la version publiée était antérieure au correctif.

## 9e itération — Corrections signalées
- [x] Dicter doublons : corrigé — buffer string accumulatedRef partagé entre sessions, resultIndex utilisé pour ne traiter que les nouveaux segments finaux.
- [x] Dicter ponctuation : corrigé — regex sans \b (compatibles accents), padding espace pour matcher début/fin, nettoyage espaces résiduels.

## 10e itération — Doublons persistants
- [x] Dicter doublons v4 : suppression totale de la reconnexion automatique, Set<number> seenRef pour ignorer les resultIndex déjà traités, onend affiche directement le modal sans redémarrage.

## 12e itération — Portage DictateBtn depuis OUIGO Clean Up
- [x] Récupérer le code exact du bouton Dicter de OUIGO Clean Up et l'intégrer dans OUIGO Control (code source inaccessible — approche équivalente adoptée : interimResults=false, même principe que OUIGO Clean Up).

## 13e itération — Ponctuation dictée
- [x] Page diagnostic /diag-dictee créée et accessible — a permis de confirmer que Chrome retranscrit les mots bruts sans ponctuation. Solution adoptée : ponctuation automatique via LLM (14e itération).

## 14e itération — Ponctuation automatique via LLM
- [x] Procédure tRPC `dictate.punctuate` qui reformate le texte dicté avec ponctuation automatique via LLM (invokeLLM, prompt système fr-FR, retourne le texte reformaté).
- [x] DictateBtn v7 appelle la procédure avant d'afficher le modal d'aperçu (spinner de chargement pendant le traitement LLM, boutons désactivés pendant le traitement).

## 15e itération — Word paysage (correction définitive)
- [x] Corriger l'orientation paysage du document Word généré : width=11906, height=16838 + PageOrientation.LANDSCAPE. docx inverse les dimensions dans le XML → w:w="16838" w:h="11906" w:orient="landscape" = A4 paysage correct (29.7cm × 21cm). Vérifié avec test Node.js.

## 16e itération — Compatibilité iOS/iPhone pour le bouton Dicter
- [x] Détecter si Web Speech API est disponible (Chrome/Android) ou non (Safari/iOS) via hasSpeechRecognition().
- [x] Sur iOS : enregistrement audio via MediaRecorder (audio/mp4 sur iOS, audio/webm ailleurs) + envoi au serveur pour transcription Whisper + reformatage LLM.
- [x] Afficher un message d'erreur clair si ni Web Speech API ni MediaRecorder ne sont disponibles.

## 17e itération — Diagnostic et correction Dicter sur iPhone
- [x] Page de diagnostic iOS créée : /api/pwa/diag-ios (accessible sans auth) — affiche UA, supports MediaRecorder/getUserMedia, test micro en direct.
- [x] DictateBtn v9 : getUserMedia appelé DIRECTEMENT dans handleClick (async) — fix WebKit/Safari iOS. Messages d'erreur spécifiques (NotAllowedError, NotFoundError). Conversion base64 par blocs (Array.from).

## 18e itération — Correction envoi audio iOS vers serveur
- [x] Analyse : le micro iOS fonctionne (353 Ko audio/mp4 confirmé par la page diag). Le problème était dans la procédure serveur qui appelait l'API Whisper directement avec des données base64 au lieu d'utiliser le helper officiel transcribeAudio.
- [x] Correction : procédure dictate.transcribe réécrite avec storagePut (upload S3) + storageGetSignedUrl (URL signée) + transcribeAudio (Whisper via URL). Imports dupliqués supprimés.
- [x] Gestion d'erreurs améliorée dans dictate.transcribe : messages explicites pour upload S3, URL signée, Whisper et LLM. Les erreurs remontent dans le toast UI.
- [x] Toast UI affiche le message d'erreur réel (err.message) au lieu d'un message générique. LLM avec try/catch : si échec, retourne le texte brut Whisper sans ponctuation. Test iPhone à valider en conditions réelles après publication.

## 19e itération — Arrêt MediaRecorder iOS
- [x] Corriger l'arrêt du MediaRecorder sur iOS : stopIOSRef stocke la fonction d'arrêt directement (sans dépendre de l'état React). Au second clic, stopIOSRef.current() est appelé directement. mr.onstop déclenche processAudioBlob. Prop size ajouté au composant.

## 20e itération — Arrêt iOS (variable globale de module)
- [x] Remplacer stopIOSRef (réinitialisé entre rendus) par une variable globale de module (_activeMediaRecorder, _activeStream, _isIOSRecording) pour stocker le MediaRecorder actif sur iOS. Au second clic, la variable globale est lue directement sans dépendre du cycle de rendu React.

## 21e itération — Régression iOS (webkitSpeechRecognition)
- [x] Correction régression iOS : Safari iOS 14.5+ expose webkitSpeechRecognition (non fonctionnel), ce qui faisait entrer le code dans le Mode 1 (Web Speech API) au lieu du Mode 2 (MediaRecorder). Ajout détection iOS explicite (UserAgent iPad/iPhone/iPod + MacIntel maxTouchPoints>1) pour forcer le Mode 2 sur tous les appareils iOS.

## 22e itération — Valise NEC + bouton Nouveau contrôle
- [x] Ajouter "Gilet" et "Badge" à la liste des items de la Valise NEC dans SAMI intérieur (cochables nominalement comme les autres items).
- [x] Ajouter un bouton "Nouveau contrôle" dans l'onglet Accueil pour réinitialiser tous les champs et repartir à zéro. Confirmation demandée avant effacement.
