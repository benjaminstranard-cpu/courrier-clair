/* Courrier Clair : lecture gratuite d'une lettre, sans IA en ligne.
   Reconnaît l'expéditeur, le genre de courrier, les dates, les heures et les montants,
   puis donne une explication simple préparée à l'avance pour chaque genre de courrier. */
(function () {
  const MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
  const pad = n => String(n).padStart(2, "0");

  const EXPEDITEURS = [
    [/m[ée]decin[- ]conseil/i, "Ta mutuelle, service du médecin-conseil"],
    [/mutualit|mutuelle|solidaris|partenamut|helan|libre mutualit|mutualit[ée] neutre|\bmloz\b|\bmc\b/i, "Ta mutuelle"],
    [/\binami\b|\briziv\b/i, "L'INAMI (assurance maladie-invalidité)"],
    [/spf finances|avertissement[- ]extrait de r[ôo]le|\bimp[ôo]ts?\b|myminfin/i, "Le SPF Finances (les impôts)"],
    [/\bonem\b|\brva\b|capac|ch[ôo]mage/i, "L'ONEM ou ta caisse de chômage"],
    [/\bcpas\b|\bocmw\b/i, "Le CPAS"],
    [/huissier/i, "Un huissier de justice"],
    [/administration communale|\bcommune de\b|\bville de\b|coll[èe]ge communal/i, "Ta commune"],
    [/aviq|iriscare|\bphare\b/i, "Un service pour les personnes handicapées (AVIQ, Iriscare ou PHARE)"],
    [/spf s[ée]curit[ée] sociale|handicap\.belgium/i, "Le SPF Sécurité sociale (personnes handicapées)"],
    [/h[ôo]pital|clinique|\bchu\b/i, "Un hôpital"],
    [/bailleur|\bloyer\b|propri[ée]taire|soci[ée]t[ée] de logement/i, "Ton propriétaire ou ta société de logement"],
    [/vivaqua|\bswde\b|engie|luminus|totalenergies|proximus|telenet|\bvoo\b|orange belgium|fournisseur d'[ée]nergie/i, "Un fournisseur (énergie, eau ou téléphone)"],
    [/tribunal|greffe|justice de paix/i, "Un tribunal"]
  ];

  /* Genres de courrier, du plus grave au plus courant. Le premier qui correspond gagne. */
  const GENRES = [
    {
      re: /huissier|signification|commandement de payer|saisie/i, urgence: "haute",
      titre: "Courrier d'huissier",
      resume: "Un huissier (une personne chargée par la justice de récupérer de l'argent) t'écrit. C'est sérieux, mais il existe presque toujours une solution si tu réagis vite.",
      a_faire: ["Ne jette pas la lettre et ne la laisse pas de côté.", "Vérifie si la somme demandée est correcte.", "Appelle l'huissier pour demander un plan de paiement (payer en plusieurs fois).", "Demande de l'aide au CPAS ou à un service de médiation de dettes, c'est gratuit."],
      si_rien: "Des frais s'ajoutent et l'huissier peut saisir une partie de tes biens ou de tes revenus.",
      aide: ["Le CPAS de ta commune (service de médiation de dettes)", "Un service d'aide juridique de première ligne (gratuit)"]
    },
    {
      re: /mise en demeure|dernier rappel|ultime rappel|recouvrement/i, urgence: "haute",
      titre: "Dernier rappel avant des frais",
      resume: "On te réclame de l'argent pour la dernière fois avant de passer à une procédure plus lourde (avec des frais en plus).",
      a_faire: ["Vérifie si tu dois vraiment cette somme.", "Si oui, paie avant la date limite, ou appelle pour demander de payer en plusieurs fois.", "Si non, réponds par écrit en expliquant pourquoi et garde une copie."],
      si_rien: "Le dossier peut être envoyé à un huissier ou à un bureau de recouvrement, avec des frais en plus.",
      aide: ["Le CPAS de ta commune (médiation de dettes)", "Le service social de ta mutuelle"]
    },
    {
      re: /m[ée]decin[- ]conseil|convocation|vous [êe]tes convoqu|vous pr[ée]senter|examen m[ée]dical/i, urgence: "haute",
      titre: "Convocation à un rendez-vous",
      resume: "On te demande de venir à un rendez-vous. Si c'est le médecin-conseil de ta mutuelle, il veut faire le point sur ta santé et ton incapacité de travail (c'est lui qui décide si tu reçois toujours tes indemnités).",
      a_faire: ["Note la date et l'heure dans ton agenda.", "Si tu ne peux pas y aller, préviens AVANT le rendez-vous (téléphone ou e-mail) et demande une autre date.", "Prépare tes papiers médicaux récents (rapport de ton médecin ou psychiatre, liste des médicaments).", "Prends ta carte d'identité."],
      documents: ["Carte d'identité", "Rapports médicaux récents", "Liste de tes médicaments", "Cette lettre"],
      si_rien: "Si tu ne vas pas au rendez-vous sans prévenir, tes indemnités peuvent être suspendues.",
      aide: ["Le service social de ta mutuelle", "Ton médecin traitant ou ton psychiatre"]
    },
    {
      re: /avertissement[- ]extrait de r[ôo]le|d[ée]claration d'imp[ôo]t|imp[ôo]t des personnes physiques|enr[ôo]lement/i, urgence: "moyenne",
      titre: "Courrier des impôts",
      resume: "Le SPF Finances t'écrit au sujet de tes impôts. Ce courrier dit soit combien tu dois payer, soit combien on va te rembourser, soit ce que tu dois déclarer.",
      a_faire: ["Regarde si le montant est à payer ou à recevoir.", "S'il faut payer, note la date limite et utilise la communication structurée (+++…+++).", "Si tu ne comprends pas ou si le montant te semble faux, prends rendez-vous gratuitement au SPF Finances (0257 257 57)."],
      si_rien: "S'il y a un montant à payer, des intérêts de retard s'ajoutent.",
      aide: ["Le SPF Finances, aide gratuite : 0257 257 57", "Le service social de ta mutuelle ou le CPAS"]
    },
    {
      re: /(veuillez|merci de|nous vous prions de).{0,60}(renvoyer|compl[ée]ter|transmettre|faire parvenir|nous envoyer|fournir)|questionnaire|formulaire .{0,30}(compl[ée]ter|joint)|documents? manquants?|pi[èe]ces? justificatives?/i, urgence: "moyenne",
      titre: "On te demande des documents",
      resume: "L'organisme a besoin d'informations ou de documents de ta part pour continuer ton dossier.",
      a_faire: ["Regarde exactement quels documents sont demandés.", "Remplis le formulaire s'il y en a un, et signe-le.", "Renvoie tout avant la date limite (garde une copie ou une photo).", "Si tu n'y arrives pas seul, demande de l'aide au service social."],
      si_rien: "Ton dossier peut être bloqué, et un paiement (indemnité, allocation, remboursement) peut être retardé ou arrêté.",
      aide: ["Le service social de l'organisme qui t'écrit", "Le CPAS de ta commune"]
    },
    {
      re: /d[ée]cision|nous avons d[ée]cid[ée]|refus|n'est pas accord[ée]|vous est accord[ée]|recours|contester/i, urgence: "moyenne",
      titre: "Une décision sur ton dossier",
      resume: "L'organisme t'annonce une décision (un accord, un refus ou un changement). Lis bien : la lettre dit souvent comment la contester si tu n'es pas d'accord, et dans quel délai.",
      a_faire: ["Regarde si c'est une bonne ou une mauvaise nouvelle pour toi.", "Si tu n'es pas d'accord, cherche dans la lettre le mot « recours » : il y a un délai (souvent 3 mois pour la sécurité sociale).", "Demande de l'aide pour un recours : c'est gratuit et c'est ton droit."],
      si_rien: "Si tu n'es pas d'accord et que tu laisses passer le délai de recours, la décision devient définitive.",
      aide: ["Le service social de ta mutuelle", "Un service d'aide juridique de première ligne (gratuit)", "Ton syndicat, si tu es affilié"]
    },
    {
      re: /rappel|n'avons pas (encore )?re[çc]u|sauf erreur de notre part|reste impay[ée]/i, urgence: "moyenne",
      titre: "Rappel de paiement",
      resume: "On te rappelle qu'un paiement n'a pas encore été reçu.",
      a_faire: ["Vérifie si tu as déjà payé (regarde ton compte en banque).", "Si tu as payé, réponds avec la preuve de paiement.", "Sinon, paie avant la date limite ou demande un plan de paiement."],
      si_rien: "Des frais de rappel peuvent s'ajouter, puis le dossier peut aller chez un huissier.",
      aide: ["Le CPAS de ta commune (médiation de dettes)"]
    },
    {
      re: /facture|montant (à|a) payer|veuillez (verser|payer)|virement|communication structur[ée]e|\+\+\+/i, urgence: "moyenne",
      titre: "Une facture à payer",
      resume: "On te demande de payer une somme. La lettre donne le montant, le numéro de compte et la date limite.",
      a_faire: ["Vérifie que la facture est bien pour toi et que le montant est correct.", "Paie avant la date limite, avec la communication indiquée (+++…+++).", "Si c'est trop cher d'un coup, appelle pour demander de payer en plusieurs fois."],
      si_rien: "Tu recevras un rappel, souvent avec des frais en plus.",
      aide: ["Le CPAS de ta commune si tu ne peux pas payer"]
    },
    {
      re: /indemnit[ée]s?|allocations?|paiement|versement|nous vous informons|information/i, urgence: "basse",
      titre: "Une information sur ton dossier",
      resume: "L'organisme t'informe de quelque chose (un paiement, un changement, une règle). En général, tu n'as rien à faire, sauf si une date ou une demande est écrite.",
      a_faire: ["Lis s'il y a une date ou une demande précise.", "Garde la lettre dans ton classeur de papiers."],
      si_rien: "En général rien, si la lettre ne te demande rien.",
      aide: ["Le service social de l'organisme qui t'écrit"]
    }
  ];

  function norm(t) { return t.replace(/\r/g, "").replace(/[ \t]+/g, " "); }

  function trouverDates(text, today) {
    const out = [];
    const add = (y, m, d, idx, len) => {
      if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return;
      if (y < 100) y += 2000;
      const iso = y + "-" + pad(m) + "-" + pad(d);
      out.push({ iso, idx, len });
    };
    let m;
    const reNum = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
    while ((m = reNum.exec(text))) add(+m[3], +m[2], +m[1], m.index, m[0].length);
    const reTxt = /\b(\d{1,2})(?:er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+(\d{4}))?/gi;
    while ((m = reTxt.exec(text))) {
      const mois = MOIS[m[2].toLowerCase()] || MOIS[m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
      let y = m[3] ? +m[3] : today.getFullYear();
      if (!m[3]) { const tent = new Date(y, mois - 1, +m[1]); if (tent < today) y++; }
      add(y, mois, +m[1], m.index, m[0].length);
    }
    return out;
  }

  function heureProche(text, idx, len) {
    const zone = text.slice(idx + len, idx + len + 40);
    const m = zone.match(/(?:à|a|vers|de)?\s*(\d{1,2})\s?(?:h|:|heures?)\s?(\d{2})?/i);
    if (!m) return "";
    const h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h > 23 || mi > 59) return "";
    return pad(h) + ":" + pad(mi);
  }

  function analyser(texte, today) {
    const text = norm(texte || "");
    const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
    const lower = text.toLowerCase();

    let expediteur = "";
    for (const [re, nom] of EXPEDITEURS) if (re.test(text)) { expediteur = nom; break; }
    const genre = GENRES.find(g => g.re.test(text)) || {
      urgence: "basse", titre: "Courrier", resume: "Je n'ai pas reconnu le genre de cette lettre. Lis les dates et les montants trouvés ci-dessous, et demande de l'aide si tu as un doute.",
      a_faire: ["Cherche s'il y a une date limite ou une demande.", "Si tu ne comprends pas, montre la lettre au service social de ta mutuelle ou au CPAS."],
      si_rien: "", aide: ["Le service social de ta mutuelle", "Le CPAS de ta commune"]
    };

    /* Dates : on garde celles d'aujourd'hui ou plus tard, et on devine si c'est un rendez-vous ou une date limite. */
    const seen = new Set();
    const echeances = [];
    for (const d of trouverDates(text, t0)) {
      const dt = new Date(d.iso + "T00:00:00");
      if (isNaN(dt) || dt < t0 || dt - t0 > 2 * 365 * 86400000) continue;
      const avant = lower.slice(Math.max(0, d.idx - 90), d.idx);
      const apres = lower.slice(d.idx, d.idx + d.len + 50);
      const heure = heureProche(text, d.idx, d.len);
      let g = "", quoi = "";
      if (/rendez-vous|convoqu|vous pr[ée]senter|examen|consultation|audience|s[ée]ance/.test(avant + apres) || heure) { g = "rdv"; quoi = /m[ée]decin[- ]conseil/.test(lower) ? "Rendez-vous médecin-conseil" : "Rendez-vous"; }
      else if (/avant le|au plus tard|jusqu'au|d[ée]lai|endéans|endeans|[ée]ch[ée]ance|date limite|pour le/.test(avant)) { g = "echeance"; quoi = /pay|vers|montant|facture/.test(avant + apres) ? "Payer avant cette date" : /renvo|compl[ée]t|transmett|parvenir|fourni|document|questionnaire/.test(lower) ? "Renvoyer les documents" : "Date limite"; }
      else continue;
      const key = d.iso + g;
      if (seen.has(key)) continue; seen.add(key);
      echeances.push({ date: d.iso, heure, quoi, genre: g, lieu: "" });
    }
    echeances.sort((a, b) => a.date.localeCompare(b.date));

    /* Urgence : plus haute si une date limite arrive dans moins de 10 jours. */
    let urgence = genre.urgence;
    if (echeances.some(e => (new Date(e.date + "T00:00:00") - t0) / 86400000 < 10) && urgence !== "haute") urgence = urgence === "basse" ? "moyenne" : "haute";

    const montants = [...text.matchAll(/(?:€|eur(?:os?)?)\s?(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)|(\d{1,3}(?:[ .]\d{3})*,\d{2})\s?(?:€|eur)/gi)].map(m => (m[1] || m[2]).trim() + " €");
    const montant = montants.length ? montants[0] : "";

    const doute = text.trim().length < 80
      ? "Très peu de texte a été lu. Reprends une photo plus nette, à plat et bien éclairée."
      : !echeances.length && trouverDates(text, t0).length ? "J'ai vu des dates dans la lettre mais je n'ai pas compris à quoi elles servent : relis-les." : "";

    /* Référence du dossier, pour la recopier dans la réponse. */
    const refM = text.match(/(?:n[°o]\.?\s*(?:de\s+)?dossier|notre\s+r[ée]f(?:[ée]rence)?|r[ée]f[ée]rence|r[ée]f\.)\s*:?\s*([A-Z0-9][A-Z0-9\/\-.]{2,24})/i);
    const reference = refM ? refM[1].replace(/[.\-\/]+$/, "") : "";

    /* Adresses e-mail et numéros de téléphone écrits sur la lettre. La lecture des photos ajoute parfois des espaces autour du @. */
    const emails = [...new Set([...text.matchAll(/[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9-]+(?:\s?\.\s?[A-Za-z0-9-]+)*\s?\.\s?[A-Za-z]{2,}/g)]
      .map(m => m[0].replace(/\s/g, "").toLowerCase().replace(/[.,;]+$/, "")))].slice(0, 4);
    const telephones = [...new Set([...text.matchAll(/(?:\+32\s?(?:\(0\)\s?)?|(?<![\dA-Z])0)\d(?:[\s./-]?\d){7,8}(?![\d])/g)]
      .map(m => m[0].replace(/^\+32\s?(?:\(0\)\s?)?/, "0").replace(/[./-]/g, " ").replace(/\s+/g, " ").trim())
      .filter(n => /^0\d{8,9}$/.test(n.replace(/\s/g, "")))
      // Écrit sans espaces : on l'aère. Sinon, on garde le découpage de la lettre.
      .map(n => /\s/.test(n) ? n : n.length === 10 ? n.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4") : n.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")))].slice(0, 3);

    return {
      reference, emails, telephones,
      expediteur, titre: genre.titre, resume: genre.resume, urgence, echeances,
      a_faire: genre.a_faire, documents: genre.documents || [], montant,
      si_rien: genre.si_rien, aide: genre.aide, doute
    };
  }

  window.CourrierClair = { analyser };
})();
