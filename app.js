(() => {
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const MON3 = ["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"];
  const DOW = ["lun","mar","mer","jeu","ven","sam","dim"];
  const DOWL = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const longDate = s => { const d = parseISO(s); return DOWL[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]; };
  const daysFrom = s => Math.round((parseISO(s) - TODAY) / 86400000);
  const rel = s => { const n = daysFrom(s); if (n === 0) return "aujourd'hui"; if (n === 1) return "demain"; if (n === -1) return "hier"; return n > 0 ? "dans " + n + " jours" : "il y a " + (-n) + " jours"; };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  /* ---------- Agenda, gardé sur l'appareil ---------- */
  const LS = "courrier-clair-events";
  let events = lsGet(LS, []);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function saveEvents() { if (!lsSet(LS, events)) flash("Ton navigateur ne garde pas les données (mode privé ?). L'agenda sera perdu en fermant.", true); }
  function addEvent(ev) {
    events.push({ id: newId(), time: "", from: "", note: "", ...ev, created: Date.now() });
    saveEvents(); render(); return true;
  }
  function delEvent(id) { events = events.filter(e => e.id !== id); saveEvents(); render(); }

  /* Lien qui ouvre Google Agenda avec l'événement déjà rempli. */
  function gcalUrl(e) {
    let dates;
    if (e.time) {
      const [h, m] = e.time.split(":").map(Number);
      const s = parseISO(e.date); s.setHours(h, m);
      const f = new Date(s.getTime() + 3600000);
      const fmt = d => iso(d).replace(/-/g, "") + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
      dates = fmt(s) + "/" + fmt(f);
    } else dates = e.date.replace(/-/g, "") + "/" + addDays(e.date, 1).replace(/-/g, "");
    const p = new URLSearchParams({ action: "TEMPLATE", text: (e.kind === "echeance" ? "Date limite : " : "") + e.title, dates, details: [e.from, e.note].filter(Boolean).join(" — "), ctz: "Europe/Brussels" });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }

  let view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  let selected = null;
  const sorted = () => [...events].sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));

  function render() {
    renderCal(); renderList();
    const upcoming = events.filter(e => daysFrom(e.date) >= 0).length;
    $("#tabCount").textContent = upcoming ? "(" + upcoming + ")" : "";
    $("#exportBtn").hidden = !events.length;
    $("#notifBtn").hidden = !events.length || !("Notification" in window) || Notification.permission !== "default";
  }

  function renderCal() {
    $("#calTitle").textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
    const shift = (view.getDay() + 6) % 7;
    const start = new Date(view); start.setDate(1 - shift);
    const byDay = {}; for (const e of sorted()) (byDay[e.date] ||= []).push(e);
    let html = DOW.map(d => `<div class="dow">${d}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (i === 35 && d.getMonth() !== view.getMonth()) break;
      const k = iso(d), evs = byDay[k] || [];
      const cls = ["day", d.getMonth() !== view.getMonth() && "out", k === iso(TODAY) && "today", k === selected && "sel"].filter(Boolean).join(" ");
      const label = d.getDate() + " " + MONTHS[d.getMonth()] + (evs.length ? ", " + evs.length + " élément" + (evs.length > 1 ? "s" : "") : "");
      html += `<button class="${cls}" data-day="${k}" aria-label="${label}"><span class="n">${d.getDate()}</span>` +
        evs.slice(0, 2).map(e => `<span class="ev ${e.kind}">${e.time ? e.time + " " : ""}${esc(e.title)}</span>`).join("") +
        (evs.length > 2 ? `<span class="more">+${evs.length - 2}</span>` : "") +
        `<span class="dots">${evs.slice(0, 4).map(e => `<i class="${e.kind}"></i>`).join("")}</span></button>`;
    }
    $("#cal").innerHTML = html;
  }

  function renderList() {
    let items, title;
    if (selected) { items = sorted().filter(e => e.date === selected); title = longDate(selected); }
    else { items = sorted().filter(e => daysFrom(e.date) >= -3).slice(0, 15); title = "À venir"; }
    $("#listTitle").innerHTML = esc(title) + (selected ? ` · <button class="small ghost" id="showAll" type="button">tout voir</button>` : "");
    if (!items.length) {
      $("#list").innerHTML = `<p class="empty">${selected ? "Rien ce jour-là." : "Rien de prévu pour l'instant. Scanne une lettre ou ajoute un rendez-vous à la main."}</p>`;
      return;
    }
    $("#list").innerHTML = items.map(e => {
      const n = daysFrom(e.date);
      const r = `<span class="${n < 0 ? "late" : n <= 3 ? "soon" : ""}">${rel(e.date)}</span>`;
      return `<div class="item ${e.kind}"><span class="bar"></span><div><p><b>${esc(e.title)}</b></p>
        <p class="when">${longDate(e.date)}${e.time ? " à " + e.time.replace(":", "h") : ""} · ${r}${e.from ? " · " + esc(e.from) : ""}</p>
        ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
        <a class="gcal" href="${gcalUrl(e)}" target="_blank" rel="noopener">+ Google Agenda</a></div>
        <button class="small ghost" data-del="${e.id}">Retirer</button></div>`;
    }).join("");
  }

  $("#cal").addEventListener("click", ev => {
    const b = ev.target.closest("[data-day]"); if (!b) return;
    selected = selected === b.dataset.day ? null : b.dataset.day;
    $("#fDate").value = selected || "";
    render();
  });
  $("#listTitle").addEventListener("click", ev => { if (ev.target.id === "showAll") { selected = null; render(); } });
  $("#list").addEventListener("click", ev => {
    const b = ev.target.closest("[data-del]"); if (!b) return;
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sûr ?"; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "Retirer"; } }, 3000); return; }
    delEvent(b.dataset.del);
  });
  $("#prev").onclick = () => { view.setMonth(view.getMonth() - 1); renderCal(); };
  $("#next").onclick = () => { view.setMonth(view.getMonth() + 1); renderCal(); };
  $("#todayBtn").onclick = () => { view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); selected = null; render(); };
  $("#addForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const kind = document.querySelector('input[name="kind"]:checked').value;
    addEvent({ title: $("#fTitle").value.trim(), date: $("#fDate").value, time: $("#fTime").value, kind });
    const d = parseISO($("#fDate").value); view = new Date(d.getFullYear(), d.getMonth(), 1);
    $("#fTitle").value = ""; $("#fTime").value = ""; render(); flash("Ajouté à ton agenda.");
  });

  /* ---------- Export .ics ---------- */
  $("#exportBtn").onclick = () => {
    const icsEsc = s => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Courrier Clair//FR", "CALSCALE:GREGORIAN"];
    for (const e of sorted().filter(e => daysFrom(e.date) >= 0)) {
      const d = e.date.replace(/-/g, "");
      L.push("BEGIN:VEVENT", "UID:" + e.id + "@courrier-clair", "DTSTAMP:" + stamp);
      if (e.time) {
        const [h, m] = e.time.split(":").map(Number); const end = parseISO(e.date); end.setHours(h + 1, m);
        L.push("DTSTART:" + d + "T" + e.time.replace(":", "") + "00", "DTEND:" + iso(end).replace(/-/g, "") + "T" + pad(end.getHours()) + pad(end.getMinutes()) + "00");
      } else L.push("DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + addDays(e.date, 1).replace(/-/g, ""));
      L.push("SUMMARY:" + icsEsc((e.kind === "echeance" ? "Date limite : " : "") + e.title));
      if (e.note || e.from) L.push("DESCRIPTION:" + icsEsc([e.from, e.note].filter(Boolean).join(" — ")));
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(e.title), "TRIGGER:-P1D", "END:VALARM", "END:VEVENT");
    }
    L.push("END:VCALENDAR");
    const url = URL.createObjectURL(new Blob([L.join("\r\n") + "\r\n"], { type: "text/calendar" }));
    const a = document.createElement("a"); a.href = url; a.download = "mon-agenda-courrier-clair.ics"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    flash("Fichier téléchargé. Dans Google Agenda sur ordinateur : Paramètres › Importer, puis choisis ce fichier.");
  };

  /* ---------- Rappels (quand l'application est ouverte) ---------- */
  async function notifyDue() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const done = lsGet("courrier-clair-notified", {});
    const todayKey = iso(TODAY);
    for (const e of events) {
      const n = daysFrom(e.date);
      if (n < 0 || n > 1 || done[e.id + todayKey]) continue;
      const body = (n === 0 ? "Aujourd'hui" : "Demain") + (e.time ? " à " + e.time.replace(":", "h") : "") + (e.from ? " · " + e.from : "");
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) await reg.showNotification(e.title, { body, icon: "icon-192.png", tag: e.id });
        else new Notification(e.title, { body });
        done[e.id + todayKey] = 1;
      } catch {}
    }
    lsSet("courrier-clair-notified", done);
  }
  $("#notifBtn").onclick = async () => {
    const p = await Notification.requestPermission();
    render();
    if (p === "granted") { flash("Rappels activés : Courrier Clair te prévient la veille et le jour même quand tu l'ouvres."); notifyDue(); }
  };

  /* ---------- Onglets (téléphone) ---------- */
  function tab(which) {
    $("#tabLetter").setAttribute("aria-selected", which === "letter");
    $("#tabCal").setAttribute("aria-selected", which === "cal");
    document.querySelectorAll("[data-pane]").forEach(p => p.toggleAttribute("data-off", p.dataset.pane !== which));
  }
  $("#tabLetter").onclick = () => tab("letter");
  $("#tabCal").onclick = () => tab("cal");
  tab("letter");

  /* ---------- Photos ---------- */
  let files = [];
  const drop = $("#drop");
  function addFiles(list) { for (const f of list) if (f.type.startsWith("image/") && files.length < 4) files.push(f); renderThumbs(); }
  function renderThumbs() {
    const t = $("#thumbs"); t.innerHTML = "";
    files.forEach((f, i) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img"); img.alt = "Page " + (i + 1); img.src = URL.createObjectURL(f);
      const b = document.createElement("button"); b.type = "button"; b.textContent = "×"; b.setAttribute("aria-label", "Retirer la page " + (i + 1));
      b.onclick = () => { files.splice(i, 1); renderThumbs(); };
      fig.append(img, b); t.append(fig);
    });
  }
  $("#file").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); });

  /* ---------- Messages ---------- */
  const status = $("#status");
  let busy = false;
  function flash(msg, err) { status.hidden = false; status.textContent = msg; status.classList.toggle("err", !!err); clearTimeout(flash.t); flash.t = setTimeout(() => { if (!busy) status.hidden = true; }, 7000); }
  const bar = $("#progress"), barI = bar.querySelector("i");
  const setProgress = p => { bar.hidden = p == null; barI.style.width = Math.round((p || 0) * 100) + "%"; };

  /* ---------- Lecture gratuite (sur l'appareil) ---------- */
  async function lireImages(imgs) {
    if (!window.Tesseract) throw new Error("ocr_absent");
    let texte = "";
    for (let i = 0; i < imgs.length; i++) {
      const { data } = await Tesseract.recognize(imgs[i], "fra", {
        logger: m => {
          if (m.status === "recognizing text") { setProgress((i + m.progress) / imgs.length); status.textContent = `Je lis la page ${i + 1} sur ${imgs.length}…`; }
          else if (/loading|initializ/.test(m.status) && i === 0) status.textContent = "Je prépare la lecture (la première fois, ça prend un peu plus de temps)…";
        }
      });
      texte += "\n" + data.text;
    }
    return texte;
  }

  /* ---------- Explication détaillée avec Claude (clé de l'utilisateur) ---------- */
  const KEY = "courrier-clair-cle";
  $("#apiKey").value = lsGet(KEY, "");
  $("#saveKey").onclick = () => { lsSet(KEY, $("#apiKey").value.trim()); flash($("#apiKey").value.trim() ? "Clé enregistrée sur cet appareil." : "Aucune clé."); };
  $("#forgetKey").onclick = () => { $("#apiKey").value = ""; lsSet(KEY, ""); flash("Clé effacée."); };

  const PROMPT = today => `Tu es Courrier Clair. Une personne qui vit en Belgique a reçu ce courrier officiel (mutuelle, INAMI, commune, SPF Finances, ONEM, CPAS, propriétaire, hôpital…). Elle est peut-être malade, stressée ou lit mal le français.
Explique-le en français très simple : phrases courtes, tutoiement, aucun jargon (si un mot administratif est inévitable, explique-le entre parenthèses). Ne fais pas peur, mais dis clairement ce qui est important.
Nous sommes le ${today}. Une date sans année est la prochaine occurrence de cette date.
N'invente rien. Si une date, une heure ou un montant n'est pas écrit, ne l'ajoute pas. Si une partie est illisible, dis-le dans "doute".
Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{"expediteur":"qui écrit, court","titre":"de quoi il s'agit, 7 mots max","resume":"2 ou 3 phrases simples","urgence":"haute|moyenne|basse","echeances":[{"date":"AAAA-MM-JJ","heure":"HH:MM ou vide","quoi":"court","genre":"rdv|echeance","lieu":"adresse courte ou vide"}],"a_faire":["étapes concrètes, max 5"],"documents":["à préparer"],"montant":"ou vide","si_rien":"une phrase","aide":["qui peut aider gratuitement"],"doute":"ou vide"}`;

  const toBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });

  async function demanderClaude(key, imgs, text) {
    const today = DOWL[TODAY.getDay()] + " " + TODAY.getDate() + " " + MONTHS[TODAY.getMonth()] + " " + TODAY.getFullYear() + " (" + iso(TODAY) + ")";
    const content = [];
    for (const f of imgs) content.push({ type: "image", source: { type: "base64", media_type: f.type || "image/jpeg", data: await toBase64(f) } });
    content.push({ type: "text", text: PROMPT(today) + (text ? "\n\nTexte du courrier :\n<<<\n" + text + "\n>>>" : "\n\nLe courrier est sur les photos jointes, une par page, dans l'ordre.") });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2026-10-21",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 16000, output_config: { effort: "low" }, fallbacks: "default", messages: [{ role: "user", content }] })
    });
    if (r.status === 401) throw new Error("cle");
    if (r.status === 429) throw new Error("limite");
    if (!r.ok) throw new Error("http");
    const data = await r.json();
    if (data.stop_reason === "refusal") throw new Error("refus");
    const out = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const s = out.indexOf("{"), e = out.lastIndexOf("}");
    if (s < 0 || e < s) throw new Error("json");
    return JSON.parse(out.slice(s, e + 1));
  }

  /* ---------- Affichage de l'explication ---------- */
  function showResult(r, opts = {}) {
    const u = ["haute", "moyenne", "basse"].includes(r.urgence) ? r.urgence : "moyenne";
    const uLabel = { haute: "Urgent", moyenne: "À faire bientôt", basse: "Pour information" }[u];
    const dates = (Array.isArray(r.echeances) ? r.echeances : []).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e?.date || ""));
    const list = (a, tag) => Array.isArray(a) && a.length ? `<${tag}>${a.map(x => `<li>${esc(x)}</li>`).join("")}</${tag}>` : "";
    const el = $("#result");
    el.innerHTML = `
      <div class="res-head"><div>
        ${opts.example ? `<span class="example">Exemple : lettre fictive</span>` : `<span class="badge">${opts.claude ? "Expliqué par Claude" : "Lecture gratuite"}</span>`}
        <h2 style="margin-top:6px">${esc(r.titre || "Ta lettre")}</h2>
        <p class="from">${esc(r.expediteur || "")}</p></div>
        <span class="pill u-${u}">${uLabel}</span></div>
      <p class="summary">${esc(r.resume || "")}</p>
      ${r.montant ? `<p><b>Montant :</b> ${esc(r.montant)}</p>` : ""}
      ${dates.length ? `<div class="block"><h3>Les dates</h3><div class="dates">${dates.map((d, i) => {
        const dt = parseISO(d.date);
        return `<div class="date"><div class="d"><b>${dt.getDate()}</b><span>${MON3[dt.getMonth()]}</span></div>
          <div><p><b>${esc(d.quoi || "Date importante")}</b></p><small>${longDate(d.date)}${d.heure ? " à " + esc(d.heure.replace(":", "h")) : ""} · ${rel(d.date)}${d.lieu ? " · " + esc(d.lieu) : ""}</small></div>
          <button class="small" data-add="${i}">+ Agenda</button></div>`; }).join("")}</div>
        <div class="row"><button class="primary" id="addAll">Tout mettre dans mon agenda</button>
        <label class="check"><input type="checkbox" id="remind" checked> Me rappeler 3 jours avant</label></div></div>` :
        (opts.example ? "" : `<p class="note">Aucune date à venir trouvée. Si la lettre en contient une, ajoute-la à la main dans l'agenda.</p>`)}
      ${r.a_faire?.length ? `<div class="block"><h3>Ce que tu dois faire</h3>${list(r.a_faire, "ol")}</div>` : ""}
      ${r.documents?.length ? `<div class="block"><h3>À préparer</h3>${list(r.documents, "ul")}</div>` : ""}
      ${r.si_rien ? `<p class="warn"><b>Si tu ne fais rien :</b> ${esc(r.si_rien)}</p>` : ""}
      ${r.aide?.length ? `<div class="block"><h3>Qui peut t'aider</h3>${list(r.aide, "ul")}</div>` : ""}
      ${r.doute ? `<p class="note"><b>Pas sûr :</b> ${esc(r.doute)}</p>` : ""}
      ${opts.texte ? `<details><summary>Voir le texte lu sur la photo</summary><p class="textbox">${esc(opts.texte.trim())}</p></details>` : ""}
      <p class="note">Vérifie toujours auprès de l'organisme qui t'a écrit.</p>`;
    const from = r.expediteur || "";
    function addOne(i, btn) {
      const d = dates[i];
      addEvent({ title: d.quoi || r.titre || "Courrier", date: d.date, time: d.heure || "", kind: d.genre === "rdv" ? "rdv" : "echeance", from, note: d.lieu || "" });
      if ($("#remind")?.checked && daysFrom(d.date) > 3)
        addEvent({ title: "Rappel : " + (d.quoi || r.titre), date: addDays(d.date, -3), kind: "rappel", from, note: "Dans 3 jours : " + longDate(d.date) });
      if (btn) btn.outerHTML = `<span class="added">Ajouté ✓</span>`;
    }
    el.querySelectorAll("[data-add]").forEach(b => b.onclick = () => addOne(+b.dataset.add, b));
    const all = $("#addAll");
    if (all) all.onclick = () => {
      all.disabled = true;
      [...el.querySelectorAll("[data-add]")].forEach(b => addOne(+b.dataset.add, b));
      all.textContent = "Dans ton agenda ✓";
      const d = parseISO(dates[0].date); view = new Date(d.getFullYear(), d.getMonth(), 1); render();
      flash("C'est dans ton agenda.");
    };
  }

  $("#analyze").onclick = async () => {
    const text = $("#pasted").value.trim();
    if (!files.length && !text) { flash("Ajoute d'abord une photo de ta lettre, ou colle son texte.", true); return; }
    const key = lsGet(KEY, "");
    busy = true; $("#analyze").disabled = true;
    status.hidden = false; status.classList.remove("err");
    try {
      if (key) {
        status.textContent = "Claude lit ta lettre… (ça peut prendre une minute)";
        const r = await demanderClaude(key, files, text);
        showResult(r, { claude: true });
      } else {
        let texte = text;
        if (files.length) { setProgress(0); texte = (texte ? texte + "\n" : "") + await lireImages(files); }
        const r = CourrierClair.analyser(texte, TODAY);
        showResult(r, { texte: files.length ? texte : "" });
      }
      status.hidden = true;
      $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      const msg = {
        ocr_absent: "La lecture des photos n'a pas pu se charger. Vérifie ta connexion internet (nécessaire la première fois), ou colle le texte.",
        cle: "La clé Claude n'est pas valable. Vérifie-la, ou efface-la pour utiliser la lecture gratuite.",
        limite: "Trop de demandes à Claude d'un coup. Attends une minute.",
        refus: "Claude n'a pas pu expliquer cette lettre.",
        json: "La réponse de Claude était incomplète. Réessaie.",
        http: "Claude n'a pas répondu. Réessaie dans un instant."
      }[e?.message] || "La lecture n'a pas marché. Réessaie avec une photo plus nette, ou colle le texte.";
      flash(msg, true);
    } finally {
      busy = false; $("#analyze").disabled = false; setProgress(null);
    }
  };

  /* ---------- Exemple affiché au premier lancement ---------- */
  const EXAMPLE = {
    expediteur: "Ta mutuelle, service du médecin-conseil",
    titre: "Convocation chez le médecin-conseil",
    resume: "La mutuelle veut faire le point sur ton incapacité de travail. Tu dois aller voir son médecin-conseil (le médecin qui décide si tu reçois toujours tes indemnités) et renvoyer un questionnaire avant le rendez-vous.",
    urgence: "haute",
    echeances: [
      { date: addDays(iso(TODAY), 9), heure: "", quoi: "Renvoyer le questionnaire rempli", genre: "echeance", lieu: "" },
      { date: addDays(iso(TODAY), 14), heure: "09:30", quoi: "Rendez-vous médecin-conseil", genre: "rdv", lieu: "Bureau régional de la mutuelle" }
    ],
    a_faire: ["Remplis le questionnaire joint à la lettre.", "Renvoie-le avant la date limite.", "Demande à ton psychiatre un rapport écrit récent.", "Va au rendez-vous avec ta carte d'identité."],
    documents: ["Carte d'identité", "Rapport récent de ton médecin ou psychiatre", "Liste de tes médicaments"],
    si_rien: "Si tu ne vas pas au rendez-vous sans prévenir, tes indemnités peuvent être suspendues.",
    aide: ["Le service social de ta mutuelle", "Ton médecin traitant"]
  };
  showResult(EXAMPLE, { example: true });
  render();
  notifyDue();

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
