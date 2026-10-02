import type { Lang } from "../i18n";

// Privacy Policy e Cookie Policy, nelle due lingue. Descrivono ciò che l'app fa davvero: tutto resta sul dispositivo,
// niente analytics, niente pubblicità, niente cookie, nessun servizio di terzi caricato dall'app.
// SE si aggiunge qualcosa che raccoglie dati o usa cookie (statistiche, font esterni, login...): aggiornare questi testi
// E il banner (src/ui/CookieBanner.tsx), che oggi è solo informativo perché esistono solo archivi tecnici.
// Questi testi non sono una consulenza legale: vanno fatti rivedere da un professionista prima di un uso commerciale.

export interface Section { h: string; p?: string[]; ul?: string[]; table?: { head: string[]; rows: string[][] } }
export interface Policy { title: string; updated: string; intro: string[]; sections: Section[] }
export type PolicyKind = "privacy" | "cookies";

export const CONTROLLER = { name: "Giorgio Grazzi", email: "giorgiograzzi1987@gmail.com" };
export const POLICY_UPDATED = "2026-10-02";

// Archivi del browser usati dall'app: stessa tabella nella Privacy e nella Cookie Policy
const storageTable = (l: Lang): Section["table"] => l === "it" ? {
  head: ["Nome", "Dove", "A cosa serve", "Durata"],
  rows: [
    ["srd-personaggi (IndexedDB)", "Browser del tuo dispositivo", "Personaggi, homebrew e impostazioni dell'app (mano preferita, regole opzionali, promemoria backup)", "Finché non li elimini tu o non cancelli i dati del sito"],
    ["lang (localStorage)", "Browser del tuo dispositivo", "Ricorda la lingua scelta (italiano o inglese)", "Finché non cambi scelta o cancelli i dati del sito"],
    ["theme (localStorage)", "Browser del tuo dispositivo", "Ricorda l'aspetto scelto (chiaro, scuro, automatico)", "Finché non cambi scelta o cancelli i dati del sito"],
    ["hb-draft:… (localStorage)", "Browser del tuo dispositivo", "Bozza dell'homebrew che stai scrivendo, così non la perdi se chiudi l'app", "Fino al salvataggio o all'annullamento della bozza"],
    ["cookie-notice (localStorage)", "Browser del tuo dispositivo", "Ricorda che hai letto l'avviso sui cookie, per non mostrartelo di nuovo", "Finché non lo reimposti o cancelli i dati del sito"],
    ["reloaded (sessionStorage)", "Browser del tuo dispositivo", "Rete di sicurezza dopo un aggiornamento: evita di ricaricare la pagina più di una volta", "Solo la sessione di navigazione"],
    ["Cache del service worker", "Browser del tuo dispositivo", "Copia dei file dell'app (pagine, codice, dati di gioco, icone) per farla funzionare anche senza rete", "Fino al prossimo aggiornamento dell'app o alla cancellazione dei dati del sito"],
  ],
} : {
  head: ["Name", "Where", "What it is for", "Duration"],
  rows: [
    ["srd-personaggi (IndexedDB)", "Your device's browser", "Characters, homebrew and app settings (preferred hand, optional rules, backup reminder)", "Until you delete them or clear the site data"],
    ["lang (localStorage)", "Your device's browser", "Remembers the language you chose (Italian or English)", "Until you change it or clear the site data"],
    ["theme (localStorage)", "Your device's browser", "Remembers the appearance you chose (light, dark, automatic)", "Until you change it or clear the site data"],
    ["hb-draft:… (localStorage)", "Your device's browser", "Draft of the homebrew you are writing, so you do not lose it if you close the app", "Until the draft is saved or discarded"],
    ["cookie-notice (localStorage)", "Your device's browser", "Remembers that you read the cookie notice, so it is not shown again", "Until you reset it or clear the site data"],
    ["reloaded (sessionStorage)", "Your device's browser", "Safety net after an update: avoids reloading the page more than once", "The browsing session only"],
    ["Service worker cache", "Your device's browser", "Copy of the app files (pages, code, game data, icons) so it also works without a network", "Until the next app update or until site data is cleared"],
  ],
};

const PRIVACY_IT: Policy = {
  title: "Informativa sulla privacy",
  updated: "Ultimo aggiornamento: 2 ottobre 2026",
  intro: [
    "Questa informativa spiega come Placet del Master (di seguito «l'App») tratta i dati personali, ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 («GDPR») e del D.Lgs. 196/2003 (Codice privacy) come modificato dal D.Lgs. 101/2018.",
    "In sintesi: l'App funziona sul tuo dispositivo. Personaggi, homebrew e impostazioni restano nel tuo browser e non vengono inviati a nessun server, non esiste un account, non usiamo statistiche, pubblicità o strumenti di profilazione e l'App non imposta cookie.",
  ],
  sections: [
    { h: "1. Titolare del trattamento", p: [
      `Il titolare del trattamento è ${CONTROLLER.name}, che sviluppa e pubblica l'App come progetto di appassionati, non commerciale.`,
      `Contatto per qualsiasi richiesta sulla privacy: ${CONTROLLER.email}.`,
      "Non è stato nominato un Responsabile della protezione dei dati (DPO), perché non ricorrono i casi in cui la nomina è obbligatoria (art. 37 GDPR).",
    ] },
    { h: "2. Quali dati tratta l'App", p: ["L'App è progettata per non raccogliere dati personali. Distinguiamo tre situazioni."],
      ul: [
        "Dati che inserisci tu nell'App (nomi dei personaggi, caratteristiche, note, descrizioni, contenuti homebrew, impostazioni): sono salvati solo nel browser del tuo dispositivo (IndexedDB e localStorage). Non li riceviamo, non li vediamo e non possiamo recuperarli. Sono sotto il tuo controllo esclusivo, quindi per questi dati l'App non agisce come titolare: è soltanto uno strumento che li conserva per te sul tuo dispositivo.",
        "Dati di navigazione: quando apri l'App il tuo browser contatta il server che la ospita, il quale, come ogni server web, può registrare automaticamente indirizzo IP, data e ora della richiesta, indirizzo richiesto, esito, quantità di dati trasferiti e tipo di browser e sistema operativo (user agent). Il Referrer non viene inviato (impostazione «no-referrer»). Questi registri tecnici servono alla sicurezza e al buon funzionamento del servizio, non vengono usati per identificarti né per profilarti e non vengono incrociati con altri dati.",
        "Messaggi che ci invii: se scrivi a " + CONTROLLER.email + ", trattiamo il tuo indirizzo e-mail e il contenuto del messaggio solo per risponderti.",
      ] },
    { h: "3. Dati che l'App non raccoglie", ul: [
      "Nessun account, registrazione, login o profilo.",
      "Nessuno strumento di statistica o analisi (come Google Analytics), nessun pixel, nessuna pubblicità, nessun social plugin.",
      "Nessuna geolocalizzazione, nessun accesso a fotocamera o microfono (il browser è anche istruito a rifiutarli).",
      "Nessun cookie, nemmeno tecnico, impostato dall'App.",
      "Nessun font, script o immagine caricati da servizi esterni: tutto ciò che serve è nell'App stessa.",
      "Nessuna categoria particolare di dati (art. 9 GDPR) e nessun dato di minori è richiesto o cercato: ti chiediamo di non inserire nell'App dati personali di terzi o dati sensibili, perché non servono a giocare.",
    ] },
    { h: "4. Finalità e basi giuridiche", table: { head: ["Finalità", "Base giuridica"], rows: [
      ["Fornirti l'App e farla funzionare (compresa la conservazione sul tuo dispositivo di personaggi e impostazioni)", "Esecuzione del servizio che hai richiesto (art. 6.1.b GDPR) e, per gli archivi tecnici sul dispositivo, esenzione dal consenso per i soli strumenti strettamente necessari (art. 122 Codice privacy)"],
      ["Sicurezza del server e registri tecnici di accesso", "Legittimo interesse del titolare alla sicurezza e al corretto funzionamento del servizio (art. 6.1.f GDPR)"],
      ["Rispondere ai messaggi che ci invii", "Esecuzione di misure precontrattuali o richiesta dell'interessato (art. 6.1.b GDPR) e legittimo interesse a rispondere (art. 6.1.f GDPR)"],
      ["Adempiere a obblighi di legge o difendere un diritto in sede giudiziaria", "Obbligo legale (art. 6.1.c GDPR) e legittimo interesse (art. 6.1.f GDPR)"],
    ] } },
    { h: "5. Conservazione e backup", p: [
      "I dati che inserisci nell'App restano nel tuo browser finché non li elimini (dall'App, o cancellando i dati del sito dalle impostazioni del browser). Se disinstalli l'App o svuoti i dati del browser, i personaggi non salvati in un backup sono persi: non possiamo ripristinarli.",
      "La funzione «Esporta backup» e la scheda PDF generano un file che viene creato sul tuo dispositivo e scaricato da te: non passa da noi. Dove lo conservi o lo condividi (cloud, e-mail, messaggistica) dipende da te e dalle regole di quei servizi.",
      "I registri tecnici del server sono conservati per il tempo strettamente necessario alla sicurezza, di norma non oltre 30 giorni, salvo esigenze di accertamento di illeciti. I messaggi e-mail sono conservati per il tempo necessario a rispondere e a gestire la richiesta, poi cancellati, salvo obblighi di legge.",
    ] },
    { h: "6. Destinatari e trasferimenti", p: [
      "Non vendiamo né cediamo dati a nessuno e non li usiamo per marketing.",
      "I dati di navigazione possono essere trattati dai fornitori tecnici che ospitano l'App o instradano il traffico (hosting, reti di distribuzione dei contenuti, servizi di sicurezza di rete), che agiscono come responsabili del trattamento o titolari autonomi per i propri obblighi di sicurezza, e dai consulenti informatici che ci assistono, vincolati alla riservatezza. Per i messaggi e-mail il fornitore del servizio di posta (Google) agisce secondo le proprie condizioni.",
      "Se un fornitore è fuori dallo Spazio economico europeo, il trasferimento avviene solo con garanzie adeguate (decisione di adeguatezza, come il Data Privacy Framework UE-USA, o clausole contrattuali standard della Commissione europea).",
      "I contenuti SRD mostrati nell'App sono incorporati nell'App stessa. I link esterni (per esempio alla licenza Creative Commons) si aprono solo se li selezioni: da quel momento valgono le informative di quei siti, di cui non siamo responsabili.",
    ] },
    { h: "7. I tuoi diritti", p: [
      "In base agli artt. 15-22 del GDPR puoi chiedere, riguardo ai dati che trattiamo su di te (per esempio registri o e-mail):",
    ], ul: [
      "accesso ai dati e una copia (art. 15);",
      "rettifica dei dati inesatti o integrazione (art. 16);",
      "cancellazione, il «diritto all'oblio» (art. 17);",
      "limitazione del trattamento (art. 18);",
      "portabilità dei dati forniti (art. 20);",
      "opposizione al trattamento fondato sul legittimo interesse (art. 21);",
      "revoca di un consenso eventualmente dato, senza effetto sul trattamento già avvenuto (art. 7.3).",
    ] },
    { h: "", p: [
      `Per esercitare i diritti scrivi a ${CONTROLLER.email}: rispondiamo senza ingiustificato ritardo e comunque entro un mese, prorogabile di due in casi complessi (art. 12 GDPR). Potremmo chiederti informazioni per verificare la tua identità.`,
      "I dati che stanno solo sul tuo dispositivo li gestisci direttamente tu: per cancellarli usa le funzioni dell'App o la cancellazione dei dati del sito nel browser.",
      "Se ritieni che il trattamento violi la normativa, hai diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it, Piazza Venezia 11, Roma) o all'autorità del tuo Stato di residenza, e di rivolgerti all'autorità giudiziaria.",
    ] },
    { h: "8. Natura del conferimento", p: ["Non c'è alcun obbligo di fornirci dati per usare l'App. I dati di navigazione sono generati automaticamente dal funzionamento di internet. Scrivendoci per e-mail ci fornisci i dati necessari a risponderti: senza, non possiamo farlo."] },
    { h: "9. Nessuna decisione automatizzata", p: ["Non effettuiamo profilazione né decisioni basate unicamente su trattamenti automatizzati ai sensi dell'art. 22 GDPR."] },
    { h: "10. Sicurezza", p: [
      "Adottiamo misure ragionevoli: l'App è un insieme di file statici, senza database né area riservata sul server, e il server invia intestazioni di sicurezza (per esempio X-Content-Type-Options, X-Frame-Options, Referrer-Policy e Permissions-Policy). Per proteggere i tuoi dati tieni aggiornati dispositivo e browser, usa il blocco schermo e fai backup regolari.",
      "Nessuna misura è infallibile; se dovessimo accorgerci di una violazione dei dati personali, la gestiremo come previsto dagli artt. 33 e 34 GDPR.",
    ] },
    { h: "11. Minori", p: ["L'App non è rivolta a bambini e non raccoglie intenzionalmente dati di minori. Se hai meno di 14 anni, usala con il consenso e la supervisione di un genitore (in Italia, art. 2-quinquies del Codice privacy)."] },
    { h: "12. Cookie e archivi del browser", p: ["Per i dettagli su cookie e archivi locali (IndexedDB, localStorage, cache) vedi la Cookie Policy. In sintesi, l'App non imposta cookie e usa solo archivi tecnici sul tuo dispositivo."], table: storageTable("it") },
    { h: "13. Modifiche a questa informativa", p: ["Possiamo aggiornare questa informativa, per esempio se cambiano l'App o la normativa. La data in cima indica l'ultima versione; le modifiche sostanziali saranno segnalate nell'App. Se in futuro l'App introducesse strumenti che raccolgono dati (statistiche, servizi esterni), li attiveremo solo dopo averti informato e, quando la legge lo richiede, dopo il tuo consenso."] },
  ],
};

const PRIVACY_EN: Policy = {
  title: "Privacy Policy",
  updated: "Last updated: 2 October 2026",
  intro: [
    "This policy explains how Placet del Master (the «App») handles personal data, under Articles 13 and 14 of Regulation (EU) 2016/679 («GDPR») and the Italian Privacy Code (Legislative Decree 196/2003, as amended by Legislative Decree 101/2018).",
    "In short: the App runs on your device. Characters, homebrew and settings stay in your browser and are not sent to any server, there is no account, we use no analytics, advertising or profiling tools, and the App sets no cookies.",
  ],
  sections: [
    { h: "1. Data controller", p: [
      `The data controller is ${CONTROLLER.name}, who develops and publishes the App as a non-commercial hobby project.`,
      `Contact for any privacy request: ${CONTROLLER.email}.`,
      "No Data Protection Officer (DPO) has been appointed, because none of the cases where appointment is mandatory applies (Art. 37 GDPR).",
    ] },
    { h: "2. What data the App handles", p: ["The App is designed not to collect personal data. There are three situations."],
      ul: [
        "Data you enter in the App (character names, stats, notes, descriptions, homebrew content, settings): saved only in your device's browser (IndexedDB and localStorage). We do not receive it, cannot see it and cannot recover it. It is under your exclusive control, so for this data the App does not act as a controller: it is only a tool that keeps it for you on your own device.",
        "Browsing data: when you open the App your browser contacts the server that hosts it, which, like any web server, may automatically log your IP address, the date and time of the request, the address requested, the outcome, the amount of data transferred and the browser and operating system type (user agent). No Referrer is sent (the «no-referrer» setting). These technical logs serve security and the proper functioning of the service, are not used to identify or profile you and are not combined with other data.",
        "Messages you send us: if you write to " + CONTROLLER.email + ", we process your e-mail address and the content of your message only to reply to you.",
      ] },
    { h: "3. Data the App does not collect", ul: [
      "No account, registration, login or profile.",
      "No statistics or analytics tool (such as Google Analytics), no pixels, no advertising, no social plugins.",
      "No geolocation, no access to camera or microphone (the browser is also instructed to refuse them).",
      "No cookies at all, not even technical ones, set by the App.",
      "No fonts, scripts or images loaded from external services: everything needed is inside the App itself.",
      "No special categories of data (Art. 9 GDPR) and no children's data are requested or sought: please do not enter other people's personal data or sensitive data in the App, as they are not needed to play.",
    ] },
    { h: "4. Purposes and legal bases", table: { head: ["Purpose", "Legal basis"], rows: [
      ["Providing you with the App and making it work (including keeping characters and settings on your device)", "Performance of the service you requested (Art. 6.1.b GDPR) and, for technical storage on the device, consent exemption for strictly necessary tools only (Art. 122 Italian Privacy Code)"],
      ["Server security and technical access logs", "Legitimate interest of the controller in security and proper functioning of the service (Art. 6.1.f GDPR)"],
      ["Replying to the messages you send us", "Steps at your request (Art. 6.1.b GDPR) and legitimate interest in replying (Art. 6.1.f GDPR)"],
      ["Complying with legal obligations or defending a legal claim", "Legal obligation (Art. 6.1.c GDPR) and legitimate interest (Art. 6.1.f GDPR)"],
    ] } },
    { h: "5. Retention and backups", p: [
      "Data you enter in the App stays in your browser until you delete it (from the App, or by clearing the site data in your browser settings). If you uninstall the App or clear the browser data, characters not saved in a backup are lost: we cannot restore them.",
      "The «Export backup» function and the PDF sheet create a file on your device that you download: it does not pass through us. Where you keep or share it (cloud, e-mail, messaging) is up to you and the rules of those services.",
      "Technical server logs are kept for as long as strictly necessary for security, normally no more than 30 days, unless needed to establish wrongdoing. E-mail messages are kept for as long as needed to reply and handle the request, then deleted, unless the law requires otherwise.",
    ] },
    { h: "6. Recipients and transfers", p: [
      "We do not sell or give data to anyone and do not use it for marketing.",
      "Browsing data may be processed by the technical providers that host the App or route its traffic (hosting, content delivery networks, network security services), acting as processors or as independent controllers for their own security obligations, and by IT consultants assisting us, bound by confidentiality. For e-mail messages, the mail provider (Google) acts under its own terms.",
      "If a provider is outside the European Economic Area, the transfer takes place only with adequate safeguards (an adequacy decision, such as the EU-US Data Privacy Framework, or the European Commission's standard contractual clauses).",
      "The SRD content shown in the App is built into the App itself. External links (for example to the Creative Commons license) open only if you select them: from that moment those sites' policies apply, and we are not responsible for them.",
    ] },
    { h: "7. Your rights", p: [
      "Under Articles 15-22 GDPR you can ask, about the data we process about you (for example logs or e-mails), for:",
    ], ul: [
      "access to the data and a copy (Art. 15);",
      "rectification of inaccurate data or completion (Art. 16);",
      "erasure, the «right to be forgotten» (Art. 17);",
      "restriction of processing (Art. 18);",
      "portability of the data you provided (Art. 20);",
      "objection to processing based on legitimate interest (Art. 21);",
      "withdrawal of any consent given, without affecting processing already carried out (Art. 7.3).",
    ] },
    { h: "", p: [
      `To exercise your rights write to ${CONTROLLER.email}: we reply without undue delay and in any case within one month, extendable by two in complex cases (Art. 12 GDPR). We may ask you for information to verify your identity.`,
      "Data that exists only on your device is managed directly by you: to delete it use the App's functions or clear the site data in your browser.",
      "If you believe the processing breaches the law, you have the right to lodge a complaint with the Italian Data Protection Authority, the Garante per la protezione dei dati personali (www.garanteprivacy.it, Piazza Venezia 11, Rome), or with the authority of your country of residence, and to go to court.",
    ] },
    { h: "8. Whether providing data is mandatory", p: ["You are under no obligation to give us data to use the App. Browsing data is generated automatically by how the internet works. By writing to us by e-mail you provide the data needed to reply: without it, we cannot do so."] },
    { h: "9. No automated decisions", p: ["We do not carry out profiling or decisions based solely on automated processing under Art. 22 GDPR."] },
    { h: "10. Security", p: [
      "We take reasonable measures: the App is a set of static files, with no database or restricted area on the server, and the server sends security headers (for example X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy). To protect your data keep your device and browser up to date, use a screen lock and make regular backups.",
      "No measure is infallible; if we become aware of a personal data breach, we will handle it as required by Articles 33 and 34 GDPR.",
    ] },
    { h: "11. Children", p: ["The App is not aimed at children and does not knowingly collect children's data. If you are under 14, use it with a parent's consent and supervision (in Italy, Art. 2-quinquies of the Privacy Code)."] },
    { h: "12. Cookies and browser storage", p: ["For details on cookies and local storage (IndexedDB, localStorage, cache) see the Cookie Policy. In short, the App sets no cookies and uses only technical storage on your device."], table: storageTable("en") },
    { h: "13. Changes to this policy", p: ["We may update this policy, for example if the App or the law changes. The date at the top shows the latest version; material changes will be flagged in the App. If the App ever introduces tools that collect data (statistics, external services), we will turn them on only after informing you and, where the law requires, after your consent."] },
  ],
};

const COOKIES_IT: Policy = {
  title: "Cookie Policy",
  updated: "Ultimo aggiornamento: 2 ottobre 2026",
  intro: [
    "Questa Cookie Policy spiega quali cookie e quali tecnologie simili usa Placet del Master (l'«App»), in conformità all'art. 122 del Codice privacy (D.Lgs. 196/2003), alla Direttiva 2002/58/CE (ePrivacy), al GDPR e alle «Linee guida cookie e altri strumenti di tracciamento» del Garante per la protezione dei dati personali (10 giugno 2021).",
    "In sintesi: l'App non imposta alcun cookie e non usa cookie di profilazione, di analisi o di terze parti. Usa soltanto archivi tecnici del browser (IndexedDB, localStorage, cache) necessari a farla funzionare e a ricordare le tue scelte. Per questi strumenti la legge non richiede il consenso: per questo il banner è solo informativo.",
  ],
  sections: [
    { h: "1. Che cosa sono i cookie e gli strumenti simili", p: [
      "I cookie sono piccoli file di testo che un sito invia al tuo browser, dove vengono memorizzati e poi restituiti al sito a ogni visita. Strumenti simili sono gli archivi del browser come localStorage, sessionStorage e IndexedDB, e le cache dei service worker, che permettono a un sito di salvare dati sul dispositivo.",
      "Si distinguono in strumenti tecnici (necessari al funzionamento o a un servizio che hai richiesto, per i quali basta l'informativa) e strumenti non tecnici, come analisi e profilazione (che richiedono il tuo consenso preventivo).",
    ] },
    { h: "2. Che cosa usa l'App", p: ["L'App non imposta cookie. Usa invece i seguenti archivi, tutti tecnici, tutti sul tuo dispositivo e mai inviati a un server:"], table: storageTable("it") },
    { h: "3. Che cosa l'App non usa", ul: [
      "Cookie di profilazione o pubblicitari.",
      "Cookie e strumenti di analisi o statistica (propri o di terzi, come Google Analytics).",
      "Cookie di terze parti, social plugin, pixel di tracciamento, fingerprinting.",
      "Servizi esterni incorporati (mappe, video, font ospitati altrove).",
    ] },
    { h: "4. Base giuridica e consenso", p: [
      "Gli archivi elencati sopra sono strettamente necessari a fornire il servizio che hai richiesto (art. 122, comma 1, Codice privacy): per questo non occorre il tuo consenso, ma solo questa informativa. Il banner che vedi al primo accesso è dunque informativo: non offre «accetta» o «rifiuta» perché non c'è nulla di non necessario da accettare o rifiutare.",
      "Se in futuro l'App introducesse strumenti non tecnici, li attiverebbe solo dopo il tuo consenso esplicito, con un banner che permette di accettare, rifiutare e cambiare idea in ogni momento con la stessa facilità, e aggiornerebbe questa informativa.",
    ] },
    { h: "5. Cookie del server e dei fornitori di rete", p: [
      "L'App in sé non imposta cookie. Il servizio che la ospita o instrada il traffico (per esempio una rete di distribuzione dei contenuti o un servizio anti-abuso) potrebbe però impostare cookie tecnici di sicurezza o di bilanciamento del carico, indispensabili a proteggere il servizio e a farlo funzionare, per i quali non serve il consenso. Se ciò avviene, sono cookie tecnici di terze parti, senza finalità di profilazione, con durata breve.",
    ] },
    { h: "6. Come gestire o cancellare i dati dal browser", p: [
      "Puoi in ogni momento bloccare o cancellare cookie e dati dei siti dalle impostazioni del tuo browser. Attenzione: cancellare i dati del sito dell'App elimina anche i personaggi e l'homebrew salvati sul dispositivo, e la lingua e l'aspetto scelti. Esporta prima un backup (menu → Esporta backup).",
    ], ul: [
      "Chrome: Impostazioni → Privacy e sicurezza → Cookie e altri dati dei siti.",
      "Safari (iPhone, iPad, Mac): Impostazioni → Safari (o Safari → Impostazioni → Privacy) → Gestisci dati dei siti web.",
      "Firefox: Impostazioni → Privacy e sicurezza → Cookie e dati dei siti web.",
      "Edge: Impostazioni → Cookie e autorizzazioni sito → Gestisci ed elimina cookie e dati del sito.",
    ] },
    { h: "7. L'avviso sui cookie", p: [
      "Quando chiudi il banner con «Ho capito», l'App salva sul dispositivo un'unica informazione tecnica (cookie-notice) per non mostrartelo ancora. Puoi rivederlo in qualsiasi momento da Impostazioni → Privacy e cookie → «Mostra di nuovo l'avviso sui cookie».",
    ] },
    { h: "8. Titolare e contatti", p: [
      `Titolare del trattamento: ${CONTROLLER.name} · ${CONTROLLER.email}. Per tutto ciò che riguarda i dati personali vedi l'Informativa sulla privacy, compresi i tuoi diritti e il reclamo al Garante.`,
    ] },
    { h: "9. Modifiche", p: ["Possiamo aggiornare questa Cookie Policy: la data in cima indica l'ultima versione. Se cambiano gli strumenti usati, lo segnaleremo nell'App."] },
  ],
};

const COOKIES_EN: Policy = {
  title: "Cookie Policy",
  updated: "Last updated: 2 October 2026",
  intro: [
    "This Cookie Policy explains which cookies and similar technologies Placet del Master (the «App») uses, in line with Art. 122 of the Italian Privacy Code (Legislative Decree 196/2003), Directive 2002/58/EC (ePrivacy), the GDPR and the Italian Data Protection Authority's «Guidelines on cookies and other tracking tools» (10 June 2021).",
    "In short: the App sets no cookies and uses no profiling, analytics or third-party cookies. It only uses technical browser storage (IndexedDB, localStorage, cache) needed to make it work and remember your choices. The law does not require consent for these tools: that is why the banner is informational only.",
  ],
  sections: [
    { h: "1. What cookies and similar tools are", p: [
      "Cookies are small text files a website sends to your browser, which stores them and sends them back to the site on each visit. Similar tools are browser storage such as localStorage, sessionStorage and IndexedDB, and service worker caches, which let a site save data on your device.",
      "They are divided into technical tools (necessary for operation or for a service you requested, for which a notice is enough) and non-technical ones, such as analytics and profiling (which require your prior consent).",
    ] },
    { h: "2. What the App uses", p: ["The App sets no cookies. It uses the following storage instead, all technical, all on your device and never sent to a server:"], table: storageTable("en") },
    { h: "3. What the App does not use", ul: [
      "Profiling or advertising cookies.",
      "Analytics or statistics cookies and tools (first- or third-party, such as Google Analytics).",
      "Third-party cookies, social plugins, tracking pixels, fingerprinting.",
      "Embedded external services (maps, videos, fonts hosted elsewhere).",
    ] },
    { h: "4. Legal basis and consent", p: [
      "The storage listed above is strictly necessary to provide the service you requested (Art. 122(1) Italian Privacy Code): for this reason your consent is not needed, only this notice. The banner you see on first visit is therefore informational: it has no «accept» or «reject» because there is nothing non-essential to accept or reject.",
      "If in future the App introduced non-technical tools, it would turn them on only after your explicit consent, with a banner that lets you accept, reject and change your mind at any time as easily, and would update this policy.",
    ] },
    { h: "5. Server and network provider cookies", p: [
      "The App itself sets no cookies. The service that hosts it or routes its traffic (for example a content delivery network or an anti-abuse service) might however set technical security or load-balancing cookies, essential to protect and run the service, for which consent is not needed. If this happens, they are third-party technical cookies, with no profiling purpose and a short lifetime.",
    ] },
    { h: "6. How to manage or delete data in your browser", p: [
      "You can block or delete cookies and site data at any time from your browser settings. Note: clearing the App's site data also deletes the characters and homebrew saved on the device, and the language and appearance you chose. Export a backup first (menu → Export backup).",
    ], ul: [
      "Chrome: Settings → Privacy and security → Cookies and other site data.",
      "Safari (iPhone, iPad, Mac): Settings → Safari (or Safari → Settings → Privacy) → Manage Website Data.",
      "Firefox: Settings → Privacy & Security → Cookies and Site Data.",
      "Edge: Settings → Cookies and site permissions → Manage and delete cookies and site data.",
    ] },
    { h: "7. The cookie notice", p: [
      "When you close the banner with «Got it», the App saves a single technical item on your device (cookie-notice) so it does not show it again. You can see it again at any time from Settings → Privacy and cookies → «Show the cookie notice again».",
    ] },
    { h: "8. Controller and contact", p: [
      `Data controller: ${CONTROLLER.name} · ${CONTROLLER.email}. For everything about personal data see the Privacy Policy, including your rights and the right to complain to the supervisory authority.`,
    ] },
    { h: "9. Changes", p: ["We may update this Cookie Policy: the date at the top shows the latest version. If the tools used change, we will flag it in the App."] },
  ],
};

export const POLICIES: Record<PolicyKind, Record<Lang, Policy>> = {
  privacy: { it: PRIVACY_IT, en: PRIVACY_EN },
  cookies: { it: COOKIES_IT, en: COOKIES_EN },
};
