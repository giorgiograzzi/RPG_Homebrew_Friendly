import type { Lang } from "../i18n";

// Dicitura CC-BY dell'SRD 5.2.1, copiata dalla prima pagina di ciascun PDF (docs/srd). Stessa dicitura in ATTRIBUTION.md.
export const SRD_NOTICE: Record<Lang, string> = {
  en: "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
  it: "Quest'opera include materiale tratto dal System Reference Document 5.2.1 (\"SRD 5.2.1\") di Wizards of the Coast LLC, disponibile all'indirizzo https://www.dndbeyond.com/srd. Il SRD 5.2.1 è concesso in licenza ai sensi della licenza di attribuzione 4.0 Internazionale di Creative Commons, disponibile all'indirizzo https://creativecommons.org/licenses/by/4.0/legalcode.",
};

// Avviso «non ufficiale»: va sempre accanto alla dicitura (app, PDF, README, ATTRIBUTION.md)
export const DISCLAIMER: Record<Lang, string> = {
  en: "Placet del Master is an unofficial, fan-made app. It is not affiliated with, endorsed or sponsored by Wizards of the Coast.",
  it: "Placet del Master è un'app non ufficiale, creata da appassionati. Non è affiliata, approvata né sponsorizzata da Wizards of the Coast.",
};
export const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/legalcode";
