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
    $("#tabLetters")?.setAttribute("aria-selected", which === "lettres");
    $("#tabCal").setAttribute("aria-selected", which === "cal");
    document.querySelectorAll("[data-pane]").forEach(p => p.toggleAttribute("data-off", p.dataset.pane !== which));
  }
  $("#tabLetter").onclick = () => tab("letter");
  if ($("#tabLetters")) $("#tabLetters").onclick = () => tab("lettres");
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
  /* Les photos de téléphone sont énormes : on les réduit avant de les lire, sinon le téléphone peut bloquer. */
  async function reduire(file, max = 1800) {
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      const ctx = c.getContext("2d");
      ctx.filter = "grayscale(1) contrast(1.15)";
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close?.();
      return await new Promise(res => c.toBlob(b => res(b || file), "image/jpeg", 0.9));
    } catch { return file; }
  }
  async function lireImages(imgs) {
    if (!window.Tesseract) throw new Error("ocr_absent");
    let texte = "";
    for (let i = 0; i < imgs.length; i++) {
      status.textContent = `Je prépare la page ${i + 1}…`;
      const img = await reduire(imgs[i]);
      const { data } = await Tesseract.recognize(img, "fra", {
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
{"expediteur":"qui écrit, court","reference":"numéro de dossier ou référence écrit sur la lettre, ou vide","emails":["adresses e-mail écrites sur la lettre, exactement"],"telephones":["numéros de téléphone écrits sur la lettre"],"titre":"de quoi il s'agit, 7 mots max","resume":"2 ou 3 phrases simples","urgence":"haute|moyenne|basse","echeances":[{"date":"AAAA-MM-JJ","heure":"HH:MM ou vide","quoi":"court","genre":"rdv|echeance","lieu":"adresse courte ou vide"}],"a_faire":["étapes concrètes, max 5"],"documents":["à préparer"],"montant":"ou vide","si_rien":"une phrase","aide":["qui peut aider gratuitement"],"doute":"ou vide"}`;

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
      ${(r.emails?.length || r.telephones?.length) ? `<div class="block"><h3>Pour les contacter</h3><div class="contacts">
        ${(r.emails || []).map(m => `<div class="contact"><span>📧 <a href="mailto:${esc(m)}">${esc(m)}</a></span><button class="small" type="button" data-copy="${esc(m)}">Copier</button></div>`).join("")}
        ${(r.telephones || []).map(t => `<div class="contact"><span>📞 <a href="tel:${esc(t.replace(/\s/g, ""))}">${esc(t)}</a></span><button class="small" type="button" data-copy="${esc(t)}">Copier</button></div>`).join("")}
        </div><p class="note">Trouvé sur la lettre. Vérifie que c'est bien écrit pareil sur le papier.</p></div>` : ""}
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
      <div class="actions">
        <button class="primary" id="replyBtn" type="button">✉️ Répondre à cette lettre</button>
        ${opts.example ? "" : opts.saved ? `<span class="added">Dans Mes lettres ✓</span>` : `<button id="keepBtn" type="button">📁 Garder dans Mes lettres</button>`}
      </div>
      <div id="composer"></div>
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
    current = { r, opts, letterId: opts.letterId || null };
    el.querySelectorAll("[data-copy]").forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copié ✓"; } catch { flash(b.dataset.copy); }
    });
    $("#replyBtn").onclick = () => openComposer();
    const kb = $("#keepBtn");
    if (kb) kb.onclick = () => { keepLetter(); kb.outerHTML = `<span class="added">Dans Mes lettres ✓</span>`; flash("Gardée dans Mes lettres."); };
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

  /* ---------- Répondre à cette lettre ---------- */
  let current = null;
  const ME = "courrier-clair-moi";
  const dateFr = s => { const d = parseISO(s); return d.getDate() + (d.getDate() === 1 ? "er" : "") + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); };
  const REPLIES = {
    rdv_ok: "Je confirme que je viendrai au rendez-vous",
    rdv_change: "Je ne peux pas venir : je demande une autre date",
    docs: "J'envoie les documents demandés",
    delai: "Je demande plus de temps",
    explication: "Je ne comprends pas : je demande une explication",
    desaccord: "Je ne suis pas d'accord avec la décision",
    plan: "Je demande à payer en plusieurs fois",
    paye: "J'ai déjà payé"
  };
  function suggested(r) {
    const t = (r.titre || "") + " " + (r.resume || "");
    if (/convocation|rendez-vous/i.test(t)) return ["rdv_ok", "rdv_change", "explication"];
    if (/documents?/i.test(t)) return ["docs", "delai", "explication"];
    if (/d[ée]cision/i.test(t)) return ["desaccord", "explication"];
    if (/huissier|rappel|paiement|facture|payer/i.test(t)) return ["plan", "paye", "explication"];
    if (/imp[ôo]ts/i.test(t)) return ["explication", "plan"];
    return ["explication", "docs", "delai"];
  }
  function openComposer(type) {
    const r = current.r;
    const sug = suggested(r);
    type = type || sug[0];
    const me = lsGet(ME, {});
    const rdv = (r.echeances || []).find(e => e.genre === "rdv");
    const ech = (r.echeances || []).find(e => e.genre !== "rdv");
    const box = $("#composer");
    const others = Object.keys(REPLIES).filter(k => !sug.includes(k));
    box.innerHTML = `
      <div class="composer">
        <h3>Ta réponse</h3>
        <label class="lbl">Ce que tu veux dire
          <select id="rType">${sug.concat(others).map((k, i) => `${i === sug.length ? `<option disabled>──────────</option>` : ""}<option value="${k}" ${k === type ? "selected" : ""}>${REPLIES[k]}</option>`).join("")}</select>
        </label>
        <div class="fgrid" id="rFields">${fieldsFor(type, r, rdv, ech)}</div>
        <details class="me" ${me.nom ? "" : "open"}><summary>Mes coordonnées ${me.nom ? `(${esc(me.nom)})` : "(à remplir une fois)"}</summary>
          <div class="fgrid">
            <label class="lbl">Nom et prénom<input id="mNom" value="${esc(me.nom || "")}" autocomplete="name"></label>
            <label class="lbl">Rue et numéro<input id="mRue" value="${esc(me.rue || "")}" autocomplete="street-address"></label>
            <label class="lbl">Code postal et commune<input id="mVille" value="${esc(me.ville || "")}" placeholder="5000 Namur"></label>
            <label class="lbl">Téléphone ou e-mail (facultatif)<input id="mContact" value="${esc(me.contact || "")}"></label>
            <label class="lbl">Accorder les mots au
              <select id="mGenre"><option value="n">neutre</option><option value="m" ${me.genre === "m" ? "selected" : ""}>masculin</option><option value="f" ${me.genre === "f" ? "selected" : ""}>féminin</option></select></label>
          </div>
          <p class="note">Gardé seulement sur cet appareil, pour tes prochaines réponses.</p>
        </details>
        <label class="lbl">La lettre (tu peux la modifier)<textarea id="rText" class="letter" spellcheck="true"></textarea></label>
        <div class="row">
          <button class="primary" id="rPrint" type="button">🖨️ Imprimer</button>
          <button id="rCopy" type="button">📋 Copier</button>
          <button id="rMail" type="button">📧 E-mail</button>
          <button id="rSent" type="button">✅ Je l'ai envoyée</button>
        </div>
        <details class="other" id="rOther"><summary>✍️ Signer la lettre dans Signaplume</summary>
          <ol class="steps-mini">
            <li><button type="button" class="small primary" id="rShare">📄 Ouvrir la lettre dans Signaplume</button><br>Courrier Clair en fait un PDF. Dans le menu, choisis <b>Signaplume</b>. S'il n'y est pas, touche « Plus », ou choisis « Enregistrer dans Fichiers » puis ouvre le fichier dans Signaplume.</li>
            <li>Dans Signaplume, <b>signe</b> la lettre, puis <b>Partager › Enregistrer dans Fichiers</b>.</li>
            <li>Reviens ici et ajoute le PDF signé :</li>
          </ol>
          <div class="row"><label class="btn small primary filebtn">📎 Ajouter le PDF signé<input type="file" id="rPdf" accept="application/pdf,image/*"></label>
            <button type="button" class="small ghost" id="rPaste">📋 Coller un texte modifié</button></div>
          <p class="note" id="rPdfInfo">Le PDF signé est gardé avec cette lettre, dans « Mes lettres ».</p>
          <p class="note">Courrier Clair garde ta lettre finale avec cette lettre dans « Mes lettres ».</p>
        </details>
        <p class="tip" id="rTip"></p>
      </div>`;
    let edited = false;
    const fill = () => {
      const t = $("#rType").value;
      const me2 = { nom: $("#mNom").value.trim(), rue: $("#mRue").value.trim(), ville: $("#mVille").value.trim(), contact: $("#mContact").value.trim(), genre: $("#mGenre").value };
      lsSet(ME, me2);
      if (!edited) $("#rText").value = letterText(t, readFields(), me2, r);
      $("#rTip").innerHTML = tipFor(t);
    };
    $("#rType").onchange = () => { edited = false; $("#rFields").innerHTML = fieldsFor($("#rType").value, r, rdv, ech); fill(); };
    box.oninput = e => { if (e.target.id === "rText") edited = true; else if (e.target.closest(".fgrid, .me")) { edited = false; fill(); } };
    box.onchange = e => { if (e.target.id !== "rType" && e.target.closest("#rFields, .me")) { edited = false; fill(); } };
    $("#rShare").onclick = async () => {
      const b = $("#rShare"); b.disabled = true; b.textContent = "📄 Je prépare le PDF…";
      try {
        const text = $("#rText").value;
        const objet = ((text.match(/^Concerne : (.*)$/m) || [])[1] || "Lettre").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "").slice(0, 40);
        const file = new File([await letterPdf(text)], `${objet}_${iso(TODAY)}.pdf`, { type: "application/pdf" });
        lsSet("courrier-clair-brouillon", { id: ensureLetter(), at: Date.now() });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: file.name }); } catch (e) { if (e?.name !== "AbortError") throw e; }
        } else {
          const url = URL.createObjectURL(file), a = document.createElement("a");
          a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
          flash("PDF téléchargé. Ouvre-le avec Signaplume, signe-le, puis reviens ici pour l'ajouter.");
        }
      } catch { flash("Je n'ai pas pu préparer le PDF. Vérifie ta connexion internet (nécessaire la première fois) et réessaie.", true); }
      b.disabled = false; b.textContent = "📄 Ouvrir la lettre dans Signaplume";
    };
    $("#rPaste").onclick = async () => {
      let t = "";
      try { t = await navigator.clipboard.readText(); } catch { }
      if (!t.trim()) { flash("Je ne trouve rien à coller. Copie d'abord ta lettre finale dans ton app, puis réessaie (ou colle-la directement dans la grande case).", true); $("#rText").focus(); return; }
      $("#rText").value = t; edited = true;
      const id = ensureLetter(), L = letters.find(x => x.id === id);
      if (L) { L.finale = t; saveLetters(); }
      $("#rOther").open = false;
      flash("Ta lettre finale est revenue ✓ Tu peux l'imprimer, l'envoyer par e-mail ou la copier.");
      $("#rText").scrollIntoView({ behavior: "smooth", block: "center" });
    };
    $("#rPdf").onchange = async e => {
      const file = e.target.files[0]; e.target.value = "";
      if (!file) return;
      const id = ensureLetter();
      if (!id) { flash("C'est la lettre d'exemple : scanne d'abord une vraie lettre pour y joindre ton PDF.", true); return; }
      if (file.size > 25e6) { flash("Ce fichier est trop gros (plus de 25 Mo).", true); return; }
      try {
        await pdfPut(id, file);
        const L = letters.find(x => x.id === id);
        if (L) { L.pdf = { name: file.name, size: file.size, type: file.type }; saveLetters(); }
        $("#rPdfInfo").innerHTML = `📄 <b>${esc(file.name)}</b> est gardé avec cette lettre ✓ Tu le retrouves dans « Mes lettres ».`;
        flash("PDF reçu et gardé avec ta lettre ✓");
      } catch { flash("Je n'ai pas pu garder ce fichier sur cet appareil (mode privé ?).", true); }
    };
    { const L = current.letterId && letters.find(x => x.id === current.letterId); if (L?.pdf) $("#rPdfInfo").innerHTML = `📄 <b>${esc(L.pdf.name)}</b> est déjà gardé avec cette lettre.`; }
    $("#rPrint").onclick = () => printLetter($("#rText").value);
    $("#rCopy").onclick = async () => { try { await navigator.clipboard.writeText($("#rText").value); flash("Lettre copiée. Colle-la dans un e-mail ou un document."); } catch { $("#rText").select(); flash("Sélectionne le texte et copie-le."); } };
    $("#rMail").onclick = () => {
      const body = $("#rText").value, subj = (body.match(/^Concerne : (.*)$/m) || [])[1] || "Votre courrier";
      const to = ($("#fMail")?.value || "").trim();
      if (!to) flash("Aucune adresse e-mail : écris-la dans « Leur e-mail », ou ajoute-la dans ton application d'e-mail.");
      location.href = "mailto:" + encodeURIComponent(to).replace("%40", "@") + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
    };
    $("#rSent").onclick = () => {
      const id = ensureLetter();
      const L = letters.find(x => x.id === id);
      if (L) { L.reponses = [...(L.reponses || []), { type: $("#rType").value, label: REPLIES[$("#rType").value], date: iso(TODAY) }]; if (L.statut === "a_faire") L.statut = "repondu"; saveLetters(); }
      $("#rSent").outerHTML = `<span class="added">${id ? "Notée dans Mes lettres ✓" : "C'est l'exemple : rien n'est gardé"}</span>`;
      flash("Bien joué ! C'est noté dans Mes lettres. Quand tout est réglé, coche « C'est réglé ».");
      cheer(false);
    };
    fill();
    const saved = current.letterId && letters.find(x => x.id === current.letterId)?.finale;
    if (saved) { $("#rText").value = saved; edited = true; }
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const hFr = h => h.replace(/^0(\d)/, "$1").replace(":", "h");
  /* Retour depuis l'autre app : on rappelle de coller la lettre finale. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const b = lsGet("courrier-clair-brouillon", null);
    if (!b || Date.now() - b.at > 3 * 3600e3 || !$("#rOther")) return;
    $("#rOther").open = true;
    $("#rPdf").closest("label").scrollIntoView({ behavior: "smooth", block: "center" });
    flash("Re-bonjour ! Ta lettre est signée ? Enregistre-la dans Fichiers depuis Signaplume, puis appuie sur « Ajouter le PDF signé ».");
    lsSet("courrier-clair-brouillon", null);
  });
  function fieldsFor(t, r, rdv, ech) {
    const f = (id, label, html) => `<label class="lbl">${label}${html.replace("<X", `<input id="${id}"`)}</label>`;
    const common = f("fDest", "À qui", `<X value="${esc(cap((r.expediteur || "").replace(/^(Ta|Ton|Le|La|Un|Une) |^L'/, "")))}">`) +
      f("fRef", "Référence ou n° de dossier", `<X value="${esc(r.reference || "")}" placeholder="écrite sur la lettre">`) +
      f("fRecu", "Date de leur lettre (facultatif)", `<X type="date">`) +
      f("fMail", "Leur e-mail (pour envoyer par e-mail)", `<X type="email" value="${esc(r.emails?.[0] || "")}" placeholder="trouvé sur la lettre, ou à écrire">`);
    const docs = (r.documents || []).join("\n");
    const extra = {
      rdv_ok: f("fDate", "Date du rendez-vous", `<X type="date" value="${rdv?.date || ""}">`) + f("fHeure", "Heure", `<X type="time" value="${rdv?.heure || ""}">`),
      rdv_change: f("fDate", "Date du rendez-vous", `<X type="date" value="${rdv?.date || ""}">`) + f("fHeure", "Heure", `<X type="time" value="${rdv?.heure || ""}">`) +
        `<label class="lbl">Pourquoi je ne peux pas venir<select id="fMotif"><option value="sante">Mon état de santé (certificat joint)</option><option value="rdv">J'ai un autre rendez-vous médical ce jour-là</option><option value="trajet">Je ne peux pas faire le trajet seul·e ce jour-là</option><option value="autre">Une autre raison (à écrire)</option></select></label>` +
        f("fAutre", "Autre raison (facultatif)", `<X>`),
      docs: `<label class="lbl full">Documents que j'envoie (un par ligne)<textarea id="fDocs" rows="3">${esc(docs)}</textarea></label>`,
      delai: f("fAction", "Ce qu'on me demande de faire", `<X value="${esc(ech?.quoi ? ech.quoi.toLowerCase() : "renvoyer les documents demandés")}">`) +
        f("fJusqua", "Je demande jusqu'au", `<X type="date" value="${addDays(ech?.date || iso(TODAY), 21)}">`) + f("fRaison", "Pourquoi (facultatif)", `<X value="mon état de santé">`),
      explication: `<label class="lbl full">Ce que je ne comprends pas (facultatif)<textarea id="fQuestion" rows="3" placeholder="Ex. : pourquoi mon indemnité change, ce que je dois faire exactement…"></textarea></label>`,
      desaccord: `<label class="lbl full">Pourquoi je ne suis pas d'accord<textarea id="fRaisons" rows="3" placeholder="Ex. : mon état de santé ne s'est pas amélioré, mon psychiatre peut le confirmer."></textarea></label>`,
      plan: f("fMontant", "Montant total", `<X value="${esc(r.montant || "")}">`) + f("fMois", "Je peux payer par mois", `<X value="" placeholder="ex. 30 €">`) + f("fDebut", "À partir du", `<X type="date" value="${addDays(iso(TODAY), 14)}">`),
      paye: f("fMontant", "Montant", `<X value="${esc(r.montant || "")}">`) + f("fPaye", "Payé le", `<X type="date">`)
    }[t] || "";
    return common + extra;
  }
  function readFields() {
    const v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
    return { dest: v("fDest"), ref: v("fRef"), recu: v("fRecu"), date: v("fDate"), heure: v("fHeure"), motif: v("fMotif"), autre: v("fAutre"), docs: v("fDocs"),
      action: v("fAction"), jusqua: v("fJusqua"), raison: v("fRaison"), question: v("fQuestion"), raisons: v("fRaisons"), montant: v("fMontant"), mois: v("fMois"), debut: v("fDebut"), paye: v("fPaye") };
  }
  function letterText(t, f, me, r) {
    const g = (m, fe) => me.genre === "f" ? fe : me.genre === "m" ? m : m + "·" + fe.slice(m.length);
    const leur = f.recu ? `votre courrier du ${dateFr(f.recu)}` : "votre courrier";
    const rdvTxt = (f.date ? `du ${dateFr(f.date)}` : "prévu") + (f.heure ? ` à ${hFr(f.heure)}` : "");
    const docs = f.docs.split("\n").map(s => s.trim()).filter(Boolean);
    let objet = "", corps = "", annexes = [];
    switch (t) {
      case "rdv_ok":
        objet = "Confirmation de ma présence au rendez-vous";
        corps = `J'ai bien reçu ${leur} et je vous confirme ma présence au rendez-vous ${rdvTxt}.`;
        break;
      case "rdv_change": {
        const why = { sante: "en raison de mon état de santé. Vous trouverez ci-joint un certificat médical", rdv: "car j'ai déjà un rendez-vous médical ce jour-là", trajet: "car je ne suis pas en mesure de faire le trajet seul" + g("", "e") + " ce jour-là", autre: f.autre ? "pour la raison suivante : " + f.autre : "pour une raison indépendante de ma volonté" }[f.motif || "sante"];
        objet = "Demande de report du rendez-vous";
        corps = `J'ai bien reçu ${leur} me convoquant au rendez-vous ${rdvTxt}.\n\nMalheureusement, je ne pourrai pas m'y présenter ${why}.\n\nJe tiens à être présent${g("", "e")} et je vous demande de bien vouloir me proposer une nouvelle date.${me.contact ? ` Vous pouvez me joindre au ${me.contact}.` : ""}`;
        if (f.motif === "sante") annexes = ["Certificat médical"];
        break;
      }
      case "docs":
        objet = "Envoi des documents demandés";
        corps = `Suite à ${leur}, je vous prie de trouver ci-joint les documents demandés${docs.length ? " :\n" + docs.map(d => "- " + d).join("\n") : "."}\n\nJe vous remercie de bien vouloir me faire savoir si d'autres éléments sont nécessaires.`;
        annexes = docs;
        break;
      case "delai":
        objet = "Demande de délai supplémentaire";
        corps = `Suite à ${leur}, je vous informe que je ne suis pas en mesure de ${f.action || "répondre"} dans le délai demandé${f.raison ? ", en raison de " + f.raison : ""}.\n\nJe vous demande donc de bien vouloir m'accorder un délai supplémentaire${f.jusqua ? " jusqu'au " + dateFr(f.jusqua) : ""}.`;
        break;
      case "explication":
        objet = "Demande d'explication";
        corps = `J'ai bien reçu ${leur}, mais je ne suis pas certain${g("", "e")} d'en comprendre tout le contenu.${f.question ? "\n\nPlus précisément : " + f.question : ""}\n\nPourriez-vous m'expliquer, avec des mots simples, ce que cette lettre signifie pour moi et ce que je dois faire ?${me.contact ? ` Vous pouvez aussi me joindre au ${me.contact}.` : ""}`;
        break;
      case "desaccord":
        objet = "Contestation de votre décision – demande de réexamen";
        corps = `J'ai bien reçu ${leur} m'informant de votre décision. Je ne suis pas d'accord avec cette décision${f.raisons ? " pour les raisons suivantes :\n\n" + f.raisons : "."}\n\nJe vous demande de bien vouloir réexaminer mon dossier. Je peux vous transmettre tout document médical utile.\n\nJe vous informe également que je me réserve le droit d'introduire un recours dans le délai légal.`;
        break;
      case "plan":
        objet = "Demande de plan de paiement";
        corps = `J'ai bien reçu ${leur}${f.montant ? ` concernant un montant de ${f.montant}` : ""}.\n\nMa situation financière actuelle ne me permet pas de payer cette somme en une seule fois. Je vous propose de la régler par paiements mensuels${f.mois ? " de " + f.mois : ""}${f.debut ? ", à partir du " + dateFr(f.debut) : ""}.\n\nJe vous remercie de bien vouloir me confirmer votre accord.`;
        break;
      case "paye":
        objet = "Montant déjà payé";
        corps = `J'ai bien reçu ${leur}${f.montant ? ` concernant un montant de ${f.montant}` : ""}.\n\nJe vous informe que ce montant a déjà été payé${f.paye ? " le " + dateFr(f.paye) : ""}. Vous trouverez ci-joint la preuve de paiement.\n\nJe vous remercie de bien vouloir vérifier et mettre mon dossier à jour.`;
        annexes = ["Preuve de paiement"];
        break;
    }
    const lieu = (me.ville || "").replace(/^\d{4}\s*/, "");
    return [
      me.nom || "[Ton nom et prénom]", me.rue || "[Ta rue et numéro]", me.ville || "[Code postal et commune]", me.contact || null, "",
      f.dest || "[À qui tu écris]", "",
      `${lieu || "[Commune]"}, le ${dateFr(iso(TODAY))}`, "",
      "Concerne : " + objet, f.ref ? "Référence : " + f.ref : null, "",
      "Madame, Monsieur,", "",
      corps, "",
      "Je vous remercie pour votre compréhension et reste à votre disposition pour toute information.", "",
      "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", "", "",
      me.nom || "[Ton nom]", "(signature)",
      annexes.length ? "\nAnnexes :\n" + annexes.map(a => "- " + a).join("\n") : null
    ].filter(x => x !== null).join("\n");
  }
  function tipFor(t) {
    const base = "Garde toujours une copie ou une photo de ta lettre, et de ce que tu envoies.";
    return {
      rdv_change: "📞 Préviens aussi <b>par téléphone</b>, et envoie cette lettre <b>avant</b> le rendez-vous. Avec une raison de santé, joins un certificat médical. " + base,
      delai: "Envoie cette demande <b>avant</b> la date limite, par e-mail ou en recommandé. " + base,
      desaccord: "⚠️ Cette lettre demande de <b>réexaminer</b> ton dossier, mais elle <b>ne remplace pas un recours officiel</b>. La façon de contester et le délai (souvent <b>3 mois</b>, devant le tribunal du travail pour la mutuelle, l'INAMI, l'ONEM ou le CPAS) sont écrits dans ta lettre. Demande vite de l'aide gratuite : service social de ta mutuelle, ton syndicat ou un bureau d'aide juridique. " + base,
      plan: "Propose un montant que tu peux vraiment payer chaque mois. Le CPAS peut t'aider gratuitement (médiation de dettes). " + base,
      docs: "Envoie des <b>copies</b>, jamais les originaux. " + base
    }[t] || base;
  }
  /* La lettre en PDF A4, pour la signer dans Signaplume. jsPDF est chargé seulement quand on en a besoin. */
  let jsPdfLoading = null;
  function loadJsPdf() {
    if (window.jspdf) return Promise.resolve();
    return jsPdfLoading ||= new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.onload = ok; s.onerror = () => { jsPdfLoading = null; ko(new Error("jspdf")); };
      document.head.append(s);
    });
  }
  async function letterPdf(text) {
    await loadJsPdf();
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const M = 22, W = 210 - 2 * M, LH = 5.6, bottom = 297 - 20;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    let y = 25;
    const clean = s => s.replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, "");
    for (const para of clean(text).split("\n")) {
      const lines = para.trim() ? doc.splitTextToSize(para, W) : [""];
      for (const line of lines) {
        if (y > bottom) { doc.addPage(); y = 25; }
        if (/^Concerne :/.test(line)) { doc.setFont("helvetica", "bold"); doc.text(line, M, y); doc.setFont("helvetica", "normal"); }
        else doc.text(line, M, y);
        y += LH;
      }
    }
    doc.setProperties({ title: (text.match(/^Concerne : (.*)$/m) || [])[1] || "Lettre", creator: "Courrier Clair" });
    return doc.output("blob");
  }
  function printLetter(text) {
    let area = $("#printArea");
    if (!area) { area = document.createElement("div"); area.id = "printArea"; document.body.append(area); }
    area.textContent = text;
    document.documentElement.classList.add("print-letter");
    const done = () => { document.documentElement.classList.remove("print-letter"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
    setTimeout(done, 1500);
  }

  /* ---------- Mes lettres : le suivi, et une petite fête quand c'est réglé ---------- */
  const LL = "courrier-clair-lettres";
  let letters = lsGet(LL, []);
  function saveLetters() { lsSet(LL, letters); renderLetters(); }
  /* PDF signés : gardés sur l'appareil (IndexedDB), un par lettre. */
  const idb = () => new Promise((ok, ko) => {
    const rq = indexedDB.open("courrier-clair", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("pdfs");
    rq.onsuccess = () => ok(rq.result); rq.onerror = () => ko(rq.error);
  });
  async function pdfOp(mode, fn) {
    const db = await idb();
    return new Promise((ok, ko) => { const tx = db.transaction("pdfs", mode); const rq = fn(tx.objectStore("pdfs")); tx.oncomplete = () => ok(rq?.result); tx.onerror = () => ko(tx.error); });
  }
  const pdfPut = (id, file) => pdfOp("readwrite", s => s.put({ name: file.name, type: file.type, blob: file }, id));
  const pdfGet = id => pdfOp("readonly", s => s.get(id));
  const pdfDel = id => pdfOp("readwrite", s => s.delete(id)).catch(() => { });
  async function pdfOpen(id) {
    const p = await pdfGet(id).catch(() => null);
    if (!p) { flash("Je ne retrouve plus ce fichier sur cet appareil.", true); return; }
    const url = URL.createObjectURL(new Blob([p.blob], { type: p.type || "application/pdf" }));
    const w = window.open(url, "_blank");
    if (!w) { const a = document.createElement("a"); a.href = url; a.download = p.name; document.body.append(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function pdfShare(id) {
    const p = await pdfGet(id).catch(() => null);
    if (!p) { flash("Je ne retrouve plus ce fichier sur cet appareil.", true); return; }
    const f = new File([p.blob], p.name, { type: p.type || "application/pdf" });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: p.name }); } catch { } }
    else { pdfOpen(id); flash("Ton appareil ne peut pas partager directement : le PDF s'ouvre, utilise son bouton Partager ou Imprimer."); }
  }

  /* La lettre d'exemple n'est jamais gardée dans Mes lettres. */
  function ensureLetter() { return current.opts.example ? null : (current.letterId || keepLetter()); }
  function keepLetter() {
    if (current.letterId) return current.letterId;
    const r = current.r;
    const L = { id: newId(), recu: iso(TODAY), statut: "a_faire", reponses: [],
      r: { expediteur: r.expediteur, reference: r.reference || "", emails: r.emails || [], telephones: r.telephones || [], titre: r.titre, resume: r.resume, urgence: r.urgence, echeances: r.echeances || [], a_faire: r.a_faire || [], documents: r.documents || [], montant: r.montant || "", si_rien: r.si_rien || "", aide: r.aide || [] } };
    letters.unshift(L); current.letterId = L.id; saveLetters();
    return L.id;
  }
  const STAT = { a_faire: ["À faire", "u-moyenne"], repondu: ["Répondu", "u-info"], regle: ["Réglé ✓", "u-basse"] };
  function renderLetters() {
    const box = $("#letters"); if (!box) return;
    const n = { a_faire: 0, repondu: 0, regle: 0 }; letters.forEach(l => n[l.statut]++);
    const total = letters.length, pct = total ? Math.round(n.regle / total * 100) : 0;
    $("#lettersCount").textContent = n.a_faire + n.repondu ? "(" + (n.a_faire + n.repondu) + ")" : "";
    $("#lettersHead").innerHTML = total ? `
      <div class="score"><div class="ring" style="--p:${pct}"><b>${n.regle}</b><small>réglée${n.regle > 1 ? "s" : ""}</small></div>
      <p>${n.regle ? `<b>${n.regle} lettre${n.regle > 1 ? "s" : ""} réglée${n.regle > 1 ? "s" : ""}</b>. ` : ""}${n.a_faire ? `${n.a_faire} à faire. ` : ""}${n.repondu ? `${n.repondu} en attente de réponse.` : ""}${!n.a_faire && !n.repondu ? "Tout est en ordre. 🌿" : ""}</p></div>` : "";
    renderCarnet();
    if (!total) { box.innerHTML = `<p class="empty">Aucune lettre gardée. Après avoir scanné une lettre, appuie sur « 📁 Garder dans Mes lettres » pour suivre ce qu'il reste à faire.</p>`; return; }
    const order = { a_faire: 0, repondu: 1, regle: 2 };
    box.innerHTML = [...letters].sort((a, b) => order[a.statut] - order[b.statut] || b.recu.localeCompare(a.recu)).map(l => {
      const next = (l.r.echeances || []).filter(e => daysFrom(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
      const [lab, cls] = STAT[l.statut];
      return `<div class="lettre ${l.statut}">
        <div class="res-head"><div><p><b>${esc(l.r.titre)}</b></p><p class="when">${esc(l.r.expediteur || "")} · reçue le ${dateFr(l.recu)}${l.r.reference ? " · réf. " + esc(l.r.reference) : ""}</p></div>
        <span class="pill ${cls}">${lab}</span></div>
        ${next && l.statut !== "regle" ? `<p class="when">Prochaine date : <b>${esc(next.quoi)}</b>, ${longDate(next.date)} · <span class="${daysFrom(next.date) <= 3 ? "soon" : ""}">${rel(next.date)}</span></p>` : ""}
        ${l.reponses?.length ? `<p class="when">✉️ ${l.reponses.map(x => esc(x.label) + " (" + dateFr(x.date) + ")").join(" · ")}</p>` : ""}
        ${l.pdf ? `<div class="contact"><span>📄 ${esc(l.pdf.name)}</span><span class="row"><button class="small" data-pdf="${l.id}" type="button">Ouvrir</button><button class="small" data-pdfshare="${l.id}" type="button">📤 Partager</button></span></div>` : ""}
        <div class="row">
          <button class="small" data-open="${l.id}" type="button">Revoir</button>
          ${l.statut !== "regle" ? `<button class="small" data-reply="${l.id}" type="button">✉️ Répondre</button><button class="small primary" data-done="${l.id}" type="button">C'est réglé ✓</button>` : `<button class="small ghost" data-undo="${l.id}" type="button">Pas encore réglé</button>`}
          <button class="small ghost" data-rm="${l.id}" type="button">Retirer</button>
        </div></div>`;
    }).join("");
  }
  /* Tous les e-mails (et téléphones) trouvés dans les lettres gardées, regroupés par organisme. */
  function renderCarnet() {
    const box = $("#carnet"); if (!box) return;
    const groups = new Map();
    for (const l of letters) {
      const who = l.r.expediteur || "Autre";
      const g = groups.get(who) || { emails: new Set(), tels: new Set(), n: 0 };
      (l.r.emails || []).forEach(m => g.emails.add(m)); (l.r.telephones || []).forEach(t => g.tels.add(t)); g.n++;
      groups.set(who, g);
    }
    const all = [...new Set([...groups.values()].flatMap(g => [...g.emails]))];
    const withData = [...groups].filter(([, g]) => g.emails.size || g.tels.size);
    box.hidden = !withData.length;
    if (!withData.length) return;
    $("#carnetTitle").textContent = `📧 Tous les e-mails (${all.length})`;
    $("#carnetList").innerHTML = withData.map(([who, g]) => `<div class="cgroup"><p><b>${esc(who)}</b> <small class="when">· ${g.n} lettre${g.n > 1 ? "s" : ""}</small></p>
        ${[...g.emails].map(m => `<div class="contact"><span>📧 <a href="mailto:${esc(m)}">${esc(m)}</a></span><button class="small" type="button" data-copy="${esc(m)}">Copier</button></div>`).join("")}
        ${[...g.tels].map(t => `<div class="contact"><span>📞 <a href="tel:${esc(t.replace(/\s/g, ""))}">${esc(t)}</a></span><button class="small" type="button" data-copy="${esc(t)}">Copier</button></div>`).join("")}
      </div>`).join("") + (all.length > 1 ? `<div class="row"><button class="small" type="button" data-copy="${esc(all.join(", "))}">📋 Copier tous les e-mails</button></div>` : "");
  }
  document.addEventListener("click", async ev => {
    const b = ev.target.closest("#carnet [data-copy]"); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); const t = b.textContent; b.textContent = "Copié ✓"; setTimeout(() => { if (b.isConnected) b.textContent = t; }, 1500); } catch { flash(b.dataset.copy); }
  });
  function reopen(id, reply) {
    const L = letters.find(x => x.id === id); if (!L) return;
    tab("letter");
    showResult(L.r, { saved: true, letterId: id });
    if (reply) openComposer(); else $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-open],[data-reply],[data-done],[data-undo],[data-rm],[data-pdf],[data-pdfshare]"); if (!b || !b.closest("#letters")) return;
    if (b.dataset.pdf) return pdfOpen(b.dataset.pdf);
    if (b.dataset.pdfshare) return pdfShare(b.dataset.pdfshare);
    const id = b.dataset.open || b.dataset.reply || b.dataset.done || b.dataset.undo || b.dataset.rm;
    const L = letters.find(x => x.id === id); if (!L) return;
    if (b.dataset.open) return reopen(id, false);
    if (b.dataset.reply) return reopen(id, true);
    if (b.dataset.done) { L.statut = "regle"; L.regle = iso(TODAY); saveLetters(); cheer(true); return; }
    if (b.dataset.undo) { L.statut = L.reponses?.length ? "repondu" : "a_faire"; saveLetters(); return; }
    if (b.dataset.rm) {
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sûr ?"; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "Retirer"; } }, 3000); return; }
      letters = letters.filter(x => x.id !== id); saveLetters(); pdfDel(id);
    }
  });
  const BRAVO = ["Bravo ! Une lettre de moins 🎉", "C'est réglé. Tu peux être fier·e de toi ✨", "Bien joué ! Une chose de moins dans la tête 🌿", "Et une de plus ! Tu avances 💪", "Super. Ça, c'est fait ✅"];
  function cheer(big) {
    const msg = big ? BRAVO[Math.floor(Math.random() * BRAVO.length)] : "Envoyée ! Une étape de faite ✉️";
    document.querySelectorAll(".toast").forEach(x => x.remove());
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
    document.body.append(t); setTimeout(() => t.remove(), 3200);
    if (!big || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#1f6f78", "#ffe066", "#f59e5b", "#6fcf97", "#5cc1c9", "#f87171"];
    const layer = document.createElement("div"); layer.className = "confetti"; layer.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 90; i++) {
      const p = document.createElement("i");
      p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * .35}s;animation-duration:${1.6 + Math.random() * 1.4}s;--x:${(Math.random() - .5) * 220}px;--r:${Math.random() * 900}deg;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;border-radius:${Math.random() > .6 ? "50%" : "2px"}`;
      layer.append(p);
    }
    document.body.append(layer); setTimeout(() => layer.remove(), 3500);
  }

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
  renderLetters();
  notifyDue();

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
