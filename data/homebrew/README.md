# Homebrew

Qui ci sono i pacchetti di esempio e un modello. I contenuti ufficiali dell'app sono solo quelli dell'SRD 5.2 (CC-BY-4.0): tutto il resto lo aggiungi tu come homebrew, dalla schermata **Homebrew**.

| File | Cosa contiene |
|---|---|
| `esempio-specie.json` | una specie inventata (Figli della Cenere) con scelta di un dono |
| `esempio-background.json` | un background inventato con il suo talento di Origine |
| `esempio-classe.json` | una classe da mezzo incantatore, una sottoclasse e sei incantesimi inventati |
| `template.jsonc` | modello commentato da copiare e riempire |

Tutto il contenuto degli esempi è inventato per questo progetto: non deriva da altri manuali.

## Come aggiungere i tuoi contenuti
1. **Dall'app**: Homebrew → *Nuova voce* (specie, background, classi, sottoclassi, talenti, armi, armature, oggetti, incantesimi, linguaggi, tipi di danno, condizioni). Le voci attive compaiono nella creazione del personaggio come i dati di gioco.
2. **Da un pacchetto**: Homebrew → *Importa*: scegli un file `.json`, incolla il testo o aggiungi un esempio. Con *Esporta* condividi le tue voci con altri.
3. **Dai file**: copia `template.jsonc`, riempilo e importalo. Le voci non valide sono scartate con il motivo; quelle valide entrano comunque.

## Regole
- Gli id iniziano con `hb_` e non possono coincidere con quelli dei dati di gioco.
- L'ordine di valutazione è: classi prima delle sottoclassi, talenti prima dei background. Una sottoclasse può riferirsi a una classe dello stesso pacchetto.
- Gli effetti usano le stesse `op` del motore (`sense`, `resistance`, `speedBonus`, `acBonus`, `grantSpell`...): gli esempi mostrano quelle più comuni.
- I personaggi che usano contenuti homebrew li portano con sé nel backup; se mancano su un altro dispositivo l'app avvisa con l'elenco.
