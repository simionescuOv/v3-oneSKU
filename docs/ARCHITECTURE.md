# oneSku — Document de arhitectură (context briefing)

> Acest document servește ca punct de pornire pentru o discuție nouă.
> Conține tot ce s-a stabilit până acum. Continuarea discuției va adăuga/corecta secțiunile marcate cu `[TBD]`.

---

## 1. Ce este oneSku

Aplicație SaaS WMS + e-commerce targetând **business-uri românești mici** care vând prin canale informale (WhatsApp, Telegram, față în față). Utilizatorul principal este tenantul — proprietarul unui mic business care gestionează stocuri și vânzări.

---

## 2. Stack tehnic confirmat

| Layer | Tehnologie |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| State management | Zustand cu persistență Supabase |
| Iconografie | Lucide-react |
| Import/Export | SheetJS |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Deploy target | PWA (primary), browser web |

**Exclus explicit:** shadcn/ui, Next.js.

---

## 3. Navigare principală — meniu lateral (hamburger)

Meniul lateral conține secțiunile principale ale aplicației:

| Secțiune | Rol |
|---|---|
| **Account** | Setări cont tenant |
| **Catalog** | Gestiunea produselor, categoriilor, schemelor, tags |
| **StockHub** | Gestiunea spațiilor de stoc (fostele Spaces/Stockrooms) |
| **Storefront** | Vitrina publică (Space special cu link public) |
| **Dashboard** | Rapoarte, statistici |
| **Settings** | Configurări aplicație |

---

## 4. Ierarhia datelor (data model)

```
Tenant
└── Catalog
    ├── Tag Vocabulary (global, cross-category)
    │   └── Tag Groups → Tag Values
    └── Categories (ierarhice, arbore)
        └── Category
            ├── Product Schema (atribute dinamice JSONB)
            └── Products
                ├── Attributes (din schema categoriei)
                ├── Tags (din Tag Vocabulary global)
                └── Variants / SKUs
                    └── (definiție; stocul NU e aici — vezi StockHub)
StockHub
├── Space 1..N  (deține stocul efectiv, populat prin tranzacții)
│   └── Stock per produs/variantă + flag allow_negative_stock
└── Storefront (Space special cu layer public)
    └── Public link (fără autentificare)
Cart / Tranzacții (motorul de mișcare a stocului: sursă → destinație)
Users / Roles  [TBD]
Orders         [TBD]
```

---

## 5. Modulul Catalog

### 5.1 Categorii

- Structură **ierarhică** (arbore de categorii), definită de tenant
- Tenantul creează, editează, grupează categorii
- Se poate intra într-o categorie → afișează lista de produse din acea categorie

### 5.2 Schema categoriei

Fiecare categorie are o **schemă dinamică de atribute** definită de tenant. Tipuri de atribute:

| Tip | Comportament |
|---|---|
| Text | Valoare liberă, unică per produs |
| Single choice list | Alegi o valoare dintr-o listă; poți adăuga valori noi în listă |

> **Notă:** `Multiple choice list` a fost eliminat ca tip de atribut — funcționalitatea sa este acoperită de sistemul de Tags (§5.4).
> **Notă:** `Tags` NU este un field type în schema categoriei. Este un sistem separat, global, descris la §5.4.

### 5.3 Produse

- Lista de produse per categorie
- Fiecare produs are atributele definite în schema categoriei
- Adăugare produs-cu-produs SAU import din Excel (schema se poate genera din structura tabelului)
- Filtrare produse după valorile atributelor schemei (OR în cadrul unui atribut, AND între atribute)
- Produsele pot avea **Variante/SKU** (concept first-class)

### 5.4 Tag Vocabulary — sistem global de tags

**Conceptul cheie:** Tags nu sunt un atribut din schema categoriei. Sunt un **vocabular controlat la nivel de catalog**, aplicabil pe orice produs din orice categorie.

**Structura:**
- **Tag Groups** — echivalentul unui "atribut global" (ex: "Sezon", "Colecție", "Campanie")
- **Tag Values** — valorile din acel grup (ex: "Vară 2025", "Lichidare stoc")

**Comportament la adăugare tag pe produs:**
- Selectezi din vocabulary-ul existent cu **prefix search** (anti-duplicare)
- Sau creezi un tag nou → se salvează automat în vocabulary-ul global
- Per produs: **multi-select** (mai multe tags din grupuri diferite)

**Rol funcțional:**
- Filtrare **cross-category** — filtrezi tot catalogul după un tag, indiferent de categoria produsului
- Logică filtrare: OR în cadrul unui Tag Group, AND între Tag Groups
- Tag Groups sunt organizatorice și funcționale simultan

---

## 6. StockHub

StockHub este modulul de gestiune a spațiilor de stoc. Conține unul sau mai multe **Spaces** — fiecare Space reprezentând un loc fizic sau logic unde există stoc (depozit, locație fizică sau logică).

### 6.1 Catalog vs. Space — separarea fundamentală

- **Catalog** — sursa unică de adevăr a produselor. **NU conține stoc.** E doar definiția produselor (ce produse există, cu ce atribute).
- **Space** — proiecție selectivă a Catalogului care **deține stocul efectiv** (câte bucăți și unde).

> Catalogul descrie *ce* produse există; Spaces spun *câte* bucăți sunt și unde. **Stocul există exclusiv în Spaces.**

### 6.2 Space ca mini-catalog dinamic — CONFIRMAT

Un Space este un **mini-catalog dinamic** — o oglindă selectivă a Catalogului principal, filtrată prin prisma fluxurilor de stoc care au tranzitat locația.

**Populare exclusiv prin tranzacții:**
- O locație nu conține inițial nicio informație
- Un produs „intră" într-un Space doar când o tranzacție îl aduce acolo (locația a fost desemnată Sursă sau Destinație într-un transfer — față de Catalog sau față de altă locație)
- La prima sosire a unui produs într-un Space în care nu exista, produsul este **clonat automat** în schema acelui Space și i se alocă cantitatea drept stoc inițial
- Conținutul unui Space e rezultatul istoricului de tranzacții care l-au alimentat

**Păstrarea apartenenței la categorii (la nivel de date):**
- Produsele tranzacționate își păstrează apartenența la categoriile de origine din Catalog
- Această apartenență e folosită ca **dimensiune de filtrare** în Space, NU ca nivel de navigare (vezi §6.3 și §6.4)
- Coșul (Cart) poate fi inițiat din contextul fiecărei categorii, atât în Catalog cât și într-un Space

### 6.3 Cele două tab-uri ale unui Space: Stoc și Flux

Pagina unui Space are un toggle între două vizualizări (vezi imagini MVP):

- **Stoc** — **listă plată de produse, sortată după relevanță** (ca un magazin online), NU grupată pe foldere de categorii. Categoria apare doar ca **metadata pe card** (ex: „Electronicele · 2.499 RON"). Header cu rezumat („6 produse · 8 unități"). Search contextual („Caută produs în stoc..."). Filtrarea pe categorii se face din dialogul de filtrare (vezi §6.4)
- **Flux** — istoricul tranzacțiilor locației (vezi §6.5). Tab-ul afișează un badge cu numărul de tranzacții/intrări relevante

### 6.4 Modelul de navigare în StockHub — categoria ca filtru, nu ca folder

**Decizie de arhitectură importantă.** Ierarhia de categorii tip foldere (grupare tematică) se **construiește și se gestionează în Catalog**, pe pagina de categorii. În StockHub, această ierarhie **nu apare ca navigare cu foldere** — trăiește în **dialogul de filtrare**.

**Comportament la intrarea într-un Space:**
- Vezi direct produsele din Space, sortate după relevanță
- Pentru a îngusta pe categorie (sau alte criterii), deschizi dialogul de filtrare

**Dialogul de filtrare (model eMAG):**
- Coloană stânga: dimensiunile de filtrare (Categorie, Preț, Disponibilitate etc.)
- Coloană dreapta: opțiunile dimensiunii selectate; pentru Categorie — arborele de categorii, căutabil („Caută categorie")

**Rațiunea deciziei:**
- Se evită navigarea cu foldere **imbricate de două ori**: foldere-de-spaces → intri într-un space → iar foldere-de-categorii
- Când spaces devin multe, tenantul va avea nevoie să **organizeze și spaces-urile pe foldere** (la landing-ul StockHub). Folderele rămân instrument de *organizare*, nu de *navigare în produse*

> **Contrast Catalog vs. StockHub:**
> - **Catalog** — navigare pe categorii: intri într-o categorie ca să-i editezi schema și produsele (model de gestiune)
> - **StockHub** — produse-first: intri într-un Space, vezi produse, filtrezi pe categorie din dialog (model de consultare/operare stoc)

### 6.5 Tab Flux — istoricul tranzacțiilor (registru per locație)

Tab-ul „Flux" din pagina unei locații e registrul complet al mișcărilor de marfă care au implicat acea locație. Servește la trasabilitate și monitorizarea intrărilor/ieșirilor.

**Interfață în stil chat (WhatsApp-style):**
Feed vertical de blocuri agregate, organizate după direcția mișcării:

| Direcție | Aliniere | Marcaj vizual |
|---|---|---|
| **Inbound** (Destinație / Intrări) | aliniat **STÂNGA** | linie verticală **VERDE** în **dreapta** textului |
| **Outbound** (Sursă / Ieșiri) | aliniat **DREAPTA** | linie verticală **ROȘIE** în **stânga** textului |

Fiecare bloc afișează: tipul (INTRARE/IEȘIRE), originea/destinația (ex: „din exterior" = Catalog, „← depoo" = altă locație), data/ora, lista de produse cu cantitatea cu semn (+/−), și un sumar (ex: „+5 bucăți · 4 articole"). Listele lungi se truncează („+1 produs ...").

**Logica de agregare:**
- **Base dataset (`trnz-data`):** array de tranzacții filtrat pentru locația curentă
- **View by > Daily:** produse grupate prin `product_id`, cantitate = `SUM(quantities)` per bloc/interval
- **Dual-Block System:** dacă într-un interval locația a fost și Sursă și Destinație, se generează **două blocuri distincte**
- **Netting Mode (toggle „Balanță"):** scade ieșirile din intrări → afișează un singur bloc de „Rulaj Net"

**UX:**
- **Sticky header:** data/intervalul (ex: „Săptămâna 14") rămâne fixat sus la scroll
- **Sumar configurabil** la finalul fiecărui bloc: utilizatorul alege ce indicatori vede (Total cantitate, Valoare totală, Media ponderată a prețului, nr. SKU-uri unice)
- **Constrângeri meniu filtre:**
  - `Interval` (orizont de timp) ≥ `View by` (granularitate)
  - Tip: `Source` (Outbound) / `Destination` (Inbound) — minim unul activ
- **Atribute afișate:** Categorie, Preț Mediu Ponderat, Cost, Unități de măsură

### 6.6 Modelul de stoc — CONFIRMAT

**Stoc independent per Space.** Fiecare Space deține propriul stoc per produs/variantă. Nu există un „stoc global" stocat separat — orice agregare globală e suma Space-urilor. Mișcările între Space-uri sunt transferuri (scădere la sursă, adunare la destinație).

### 6.7 Stoc negativ — flag de comportament, nu de permisiune — CONFIRMAT

Fiecare Space are un flag `allow_negative_stock`, setat **o singură dată la crearea spațiului**.

**Punct cheie:** flag-ul NU controlează ce e permis tehnic. **Nicio tranzacție nu este blocată vreodată, în niciun spațiu.** Realitatea fizică are prioritate față de cea înregistrată — pot exista faptic mai multe produse decât în evidență, iar tranzacția trebuie să se poată întâmpla oricum.

Flag-ul controlează doar dacă stocul negativ e o **stare așteptată** sau o **anomalie de semnalat**:

| Flag | Comportament |
|---|---|
| `allow_negative_stock = false` (spațiu normal) | Negativul e permis tehnic, dar **evidențiat ca anomalie** |
| `allow_negative_stock = true` | Negativul e starea normală a spațiului. Nu se semnalează nimic. (Util pentru spații care urmăresc cumulat marfa dintr-o origine — soldul negativ *este* registrul.) |

### 6.8 Principiul anomaliilor: prevenit, nu blocat

Stările anormale (negativ într-un spațiu normal, sau orice sold care contrazice realitatea așteptată) sunt tratate uniform:

1. **Permise** — tranzacția trece întotdeauna
2. **Prevenite** — utilizatorul e avertizat înainte/în timpul operațiunii că rezultatul va fi anormal
3. **Evidențiate** — anomalia e înregistrată și apare ca **notificare care așteaptă rezolvare**, într-un loc dedicat, ca utilizatorul să cerceteze

> Sistemul nu împiedică operațiunea reală — îi dă utilizatorului contextul și un fir de urmărit. *(Mecanica concretă a notificărilor se detaliază separat.)*

### 6.9 Storefront — Space special

- Moștenește comportamentul unui Space (deține stoc propriu)
- Are în plus un **layer de prezentare**: override-uri de afișare (denumiri publice, descrieri, imagini), câmpuri vizibile publicului
- **Link public** accesibil fără autentificare
- Detalii despre layer-ul de prezentare → `[TBD]`

---

## 7. Tranzacții — Coșul ca motor de mișcare a stocului

Stocul se mișcă **exclusiv prin tranzacții generate din coșul de comandă (Cart)**. Coșul e un instrument universal de transfer, indiferent dacă sursa e Catalogul sau un Space.

### 7.1 Structura unei tranzacții

Fiecare tranzacție definește două puncte:

- **Sursă (Source)** — de unde pleacă marfa
- **Destinație (Destination)** — unde ajunge marfa

La procesare: cantitățile din coș se **scad din sursă** și se **adaugă în destinație**.

### 7.2 Reguli pe tipuri

| Sursă | Comportament |
|---|---|
| **Catalog** | Catalogul nu are stoc → e doar un punct de „alegere produse". Acțiunea generează o tranzacție de **aprovizionare** către un Space destinație. |
| **Space** | **Transfer** de stoc dintr-un Space în altul: scădere din sursă, creștere în destinație. |

**Destinația = doar Space.** Catalogul este **exclus** ca destinație. Marfa ajunge mereu într-un Space.

### 7.3 Clonarea automată la prima apariție

Un produs adăugat în coș poate să nu existe încă în Space-ul sursă sau destinație selectat. Sistemul tratează asta automat și **simetric**:

- **Produs existent în locație** → se modifică doar cantitatea
- **Produs inexistent în locație** → produsul e **clonat** în schema acelui Space, apoi i se alocă cantitatea din coș drept stoc inițial

Asta se aplică la ambele capete: dacă produsul lipsește din Space-ul sursă, e clonat și acolo, nu doar la destinație.

### 7.4 Rezumatul fluxului

```
Catalog (definiții, fără stoc)
   │  alegere produse → Cart
   ▼
Cart (sursă + destinație + cantități)
   │  procesare tranzacție (niciodată blocată)
   ▼
Sursă: scădere stoc        Destinație (doar Space): adunare stoc
(clonare dacă lipsește)    (clonare dacă lipsește)
   │
   ▼
Sold anormal? → permis, dar semnalat ca notificare de rezolvat
```

---

## 8. UX / Layout

### 8.1 Principii generale

- **Mobile-first**, PWA ca target principal (operatori de depozit, utilizatori mobil)
- **Dark theme by default**
- CSS: `100dvh` / `100svh` pentru stabilitate layout

### 8.2 AppShell

```
┌─────────────────────────┐
│         TopBar          │  ← fixat sus
├─────────────────────────┤
│                         │
│      MainContent        │  ← scrollabil
│                         │
├─────────────────────────┤
│  [Search Bar] [Menu]    │  ← BottomBar fixat jos
└─────────────────────────┘
```

- `BottomBar`: ascundere la scroll în jos, reapariție la scroll în sus (CSS transform pe containerul `MainContent`, nu pe `window`)

### 8.3 Filosofia Bottom-design

Toate elementele interactive majore sunt plasate în **jumătatea inferioară a ecranului** — optimizat pentru utilizare cu o singură mână, eliminând necesitatea de a întinde degetul spre zona superioară.

**Bara de căutare (Search Bar):**
- Contextuală — focusul se schimbă automat pe elementele paginii curente
- Ancorată deasupra tastaturii virtuale când aceasta e activă
- Input configurat să blocheze bara de Autofill Android:

```jsx
<input
  type="search"
  name="search"
  id="search"
  autoComplete="off"
  enterKeyHint="search"
  data-lpignore="true"
  data-1p-ignore="true"
/>
```

**Meniu contextual (lângă Search Bar, în dreapta):**
- Iconița și opțiunile se schimbă dinamic în funcție de pagina curentă
- Apăsarea deschide un meniu lateral (stânga sau dreapta, context-dependent)

### 8.4 Bottom-sheet (Dialog)

Orice dialog/modal se deschide ca **bottom-sheet**:
- Pornește de deasupra BottomBar-ului
- Se extinde până la 90% din înălțimea ecranului
- **Cu căutare activă:** bara de search din BottomBar filtrează datele din interiorul bottom-sheet-ului
- **Fără căutare:** bara de search se ascunde automat pe durata afișării bottom-sheet-ului

### 8.5 Convenție de comunicare la dictare (NU specificație)

> Această secțiune **nu descrie arhitectura**. Sunt termeni scurți pe care Bibicu îi folosește în conversație (prin dictare vocală în română) ca să se refere rapid la elemente UI, fără a fi nevoit să pronunțe termeni englezești care încurcă speech-to-text.

Când Bibicu spune, în conversație:

| Termen folosit | Se referă la |
|---|---|
| „căutare" | Search bar din BottomBar |
| „meniu" | Meniul lateral activat la apăsarea iconului |
| „dialog" | Bottom-sheet |

---

## 9. Users / Roles

`[TBD]`

---

## 10. Orders

`[TBD]` — Notă deschisă: rezervarea stocului la plasarea comenzii vs la confirmarea de admin.

---

## 11. Workflow de dezvoltare

| Instrument | Rol |
|---|---|
| Claude.ai (chat nou per funcționalitate) | Planificare, arhitectură, validare vizuală în artifacts |
| Claude Code CLI | Implementare în proiect, montare componente |
| `ARCHITECTURE.md` | Document persistent, actualizat după fiecare funcționalitate |
| `STATUS.md` | Actualizat de Claude Code după fiecare sesiune |

**Fluxul per funcționalitate:**
1. Descriere funcționalitate în Claude.ai
2. Construire + validare artifact (iterații până e corect)
3. Scriere `SPEC_NumeComponenta.md`
4. Trimitere în Claude Code: SPEC + fișiere `.jsx/.js` din artifact + context proiect
5. Claude Code montează în proiect
6. Actualizare `STATUS.md` + `ARCHITECTURE.md`

---

*Ultima actualizare: StockHub — adăugat modelul de navigare „categoria ca filtru, nu ca folder" (§6.4): produse-first sortate după relevanță, ierarhia de categorii trăiește în dialogul de filtrare (stil eMAG), foldere doar pentru organizare. Catalog rămâne navigare-pe-categorii pentru gestiune. Tab Flux detaliat (§6.5). Model stoc (§6.6–6.8). §7 Tranzacții. Rămân deschise: §6.9 layer prezentare Storefront, §9 Users/Roles, §10 Orders.*
