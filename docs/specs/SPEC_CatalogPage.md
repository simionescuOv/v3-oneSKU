# SPEC — Pagina Catalog (oneSku)

> Document pentru agentul din Claude Code. Conține tot ce s-a stabilit despre pagina Catalog.
> Citește mai întâi `ONESKU_ARCHITECTURE.md` pentru stack, convenții și terminologie.
> Implementează direct în schela existentă, respectând §8 (AppShell, bottom-design) din arhitectură.

---

## 0. Context

Catalog-ul este modulul de gestiune a produselor. La acest pas implementăm **organizarea ierarhică a categoriilor** (foldere + categorii) și operațiile CRUD asupra lor. Schema categoriei și produsele propriu-zise sunt funcționalități separate, ulterioare.

**Reține separarea fundamentală (din arhitectură):** Catalog = navigare pe categorii (model de gestiune). Categoriile sunt frunze; folderele formează ierarhia.

---

## 1. Modelul de date

Arbore de noduri. Două tipuri de nod:

- **folder** — organizare pură, nu conține produse. Poate conține alte foldere ȘI categorii (ierarhie pe N niveluri).
- **category** — frunză. Conține produse (la acest pas, doar un counter mock). NU poate conține foldere sau alte categorii.

```
Node = {
  id: string,
  type: 'folder' | 'category',
  name: string,
  parentId: string | null,   // null = la rădăcină
  products?: number          // doar pentru category (mock count deocamdată)
}
```

Starea trăiește în store-ul Zustand (consum prin store, ca toate datele — vezi promptul de pornire). Mock data inițial: câteva foldere și categorii pe 2-3 niveluri.

---

## 2. Stări și navigare

### 2.1 Empty state (catalog complet gol)
- Ecran centrat cu text scurt + un buton CTA: „Adaugă prima categorie".
- Exemplu de copy: „Catalogul e gol. Adaugă prima categorie ca să începi. Ex: Telefoane & tablete."
- Butonul deschide picker-ul de adăugare categorie (vezi §4.1).

### 2.2 Vizualizarea normală (varianta B — carduri)
- După prima categorie, ecranul afișează **carduri** într-un grid (2 coloane pe mobil).
- Se afișează la nivelul curent: **folderele** (cu icon de folder) ȘI **categoriile negrupate** (cu icon de tag/categorie), la același nivel vizual.
- Foldere afișate înaintea categoriilor.
- Card categorie: nume + nr. produse (ex: „24 produse"). Card folder: nume + etichetă „Folder".
- Stil de referință: carduri eMAG mobil (vezi imaginea din discuție). Deocamdată carduri simple cu icon; imaginile pe card vin mai târziu.

### 2.3 Navigare
- **Tap pe folder** → intri în folder, vezi conținutul lui (subfoldere + categorii).
- **Tap pe categorie** → deschide lista de produse (altă funcționalitate; deocamdată placeholder/toast).
- **Săgeată stânga-sus** (în TopBar) → urcă la părinte.
- **Gestul de back** (Android / browser `popstate`) → același efect ca săgeata: urcă la părinte, NU închide aplicația. Trebuie să funcționeze și gestul, și săgeata.
- **Breadcrumb** în TopBar (Acasă / Folder / Subfolder), cu noduri tappabile pentru salt direct.

---

## 3. CRITIC — Layout, BottomBar și tastatură

> Acesta a fost punctul cel mai problematic în planificare. Citește cu atenție.

### 3.1 Reguli de layout (din §8 arhitectură — bottom-design)
- Container rădăcină: `height: 100dvh`, `display:flex; flex-direction:column; overflow:hidden`.
- **TopBar**: `flex-shrink:0`, fix sus.
- **MainContent** (zona de carduri): `flex:1; overflow-y:auto` — singura zonă scrollabilă.
- **BottomBar**: `flex-shrink:0`, jos. Conține bara de căutare + buton add + buton meniu.
- Toate elementele interactive majore în jumătatea inferioară (utilizare cu o mână).

### 3.2 Bara de căutare — REGULĂ ABSOLUTĂ
- Bara de căutare este **ÎNTOTDEAUNA** în BottomBar, jos. Niciodată în altă parte.
- **Niciun bottom-sheet / dialog NU are input de căutare propriu.** Când un sheet afișează o listă căutabilă (categorii, foldere, destinații de mutare), filtrarea acelei liste se face tastând în **bara din BottomBar**. Query-ul barei filtrează live conținutul sheet-ului (vezi §8.4 arhitectură).
- Excepție: câmpuri care NU sunt căutare (ex: input de redenumire) pot sta în sheet — acelea nu sunt căutare.
- Bara de căutare e contextuală: placeholder-ul se schimbă după context („Caută categorie sau folder...", „Caută sau scrie o categorie nouă", „Folder nou sau existent", „Caută folder destinație").

### 3.3 Comportament cu tastatura — CERINȚA CARE NU A FUNCȚIONAT
**Problema de rezolvat:** când tastatura virtuală se deschide, BottomBar-ul trebuie să rămână ancorat **deasupra** tastaturii, iar utilizatorul trebuie să poată **scrola** ca să ajungă la TOATĂ pagina (inclusiv partea de sus). Tastatura NU trebuie să arunce conținutul de sus în afara ecranului fără posibilitate de a-l accesa.

**Comportamentul dorit (referință: orice aplicație de chat web — input jos, ancorat deasupra tastaturii, conținutul rămâne scrollabil):**
- Pe device real / PWA, `100dvh` + flex column face BottomBar-ul (`flex-shrink:0`) să stea lipit deasupra tastaturii automat când viewportul se micșorează. MainContent (`flex:1`) rămâne scrollabil.
- Pe Android unde viewportul NU se redimensionează (tastatura suprapune), folosește `window.visualViewport` ca sursă de adevăr pentru înălțimea disponibilă: ascultă `resize`/`scroll` pe `visualViewport` și ajustează înălțimea containerului la `visualViewport.height` (NU prin `translateY` manual pe bară — acea abordare a eșuat).

**Ce NU se face (am încercat și a eșuat):**
- NU pune `translateY` manual pe BottomBar în funcție de un offset de tastatură calculat. A rupt scroll-ul și a aruncat topul paginii afară.
- NU complica cu spacer-e artificiale de tip `minHeight: calc(100% + 60vh)`. Nu rezolvă problema reală.

**Recomandare de implementare (de validat pe device real):**
1. Pornește de la flex pur: `100dvh`, column, MainContent `flex:1 overflow-y-auto`, BottomBar `flex-shrink:0`. Pe iOS Safari și PWA modern asta e suficient.
2. Adaugă un hook `useViewportHeight` care setează înălțimea containerului rădăcină la `visualViewport.height` (cu listener pe `resize` și `scroll`), ca fallback robust pe Android. Aplică înălțimea pe container, lasă flex-ul să facă restul. Astfel scroll-ul în MainContent rămâne funcțional și topul e mereu accesibil.
3. Testează montat ca PWA pe device fizic, NU în preview-ul izolat. (Notă: planificarea s-a făcut în artifact, care în iframe nu reproduce fidel tastatura reală — implementarea finală trebuie validată pe telefon.)

### 3.4 Bottom-sheet (dialog) — §8.4 arhitectură
- Orice dialog/modal se deschide ca **bottom-sheet**: pornește de deasupra BottomBar-ului, se extinde până la max ~90% din înălțime.
- Cu bară de search activă pentru sheet → bara din BottomBar filtrează conținutul sheet-ului.
- Sheet-ul stă deasupra BottomBar-ului (nu îl acoperă), iar BottomBar-ul rămâne ancorat deasupra tastaturii.

---

## 4. Adăugare categorie

### 4.1 Mecanism
- Prima categorie: din butonul CTA al empty state.
- Următoarele: din **bara de căutare** (BottomBar) sau din butonul `+` de lângă ea, ambele deschid picker-ul „select or create".
- Picker-ul: cauți printre categoriile existente (vezi §6 căutare). Dacă numele NU există → apare rândul „+ Adaugă «query»". Confirmarea creează categoria în nivelul curent (parentId = folderul curent, sau null la rădăcină).
- Single select: la alegere/creare, picker-ul se închide imediat și trimite rezultatul.
- Anti-duplicare: nu permite două categorii cu același nume (case-insensitive).

---

## 5. Organizarea ierarhiei

### 5.1 Grupare (creează ierarhie)
- Acțiune din **meniul contextual** (butonul meniu din BottomBar): „Grupare".
- Disponibilă **DOAR la rădăcină**, și DOAR pentru elementele care nu sunt deja într-un folder (elemente de la rădăcină). Dacă nu ești la rădăcină, opțiunea e dezactivată cu hint.
- Flux:
  1. Intri în **mod selecție**: cardurile de la rădăcină capătă un indicator de selecție (checkbox). Tap pe card = selectează/deselectează (nu mai navighează).
  2. BottomBar devine action-bar: „N selectate" + buton „Grupează" (activ doar la ≥2 selectate).
  3. „Grupează" → deschide picker de denumire (select-or-create pe folderele existente de la rădăcină): scrii un nume nou de folder SAU alegi unul existent. Căutarea se face din bara de jos (vezi §3.2).
  4. La confirmare: elementele selectate primesc parentId = id-ul folderului (nou creat sau existent). Ies din mod selecție.

### 5.2 Mutare (reorganizează ierarhia existentă)
- Acțiune din meniul contextual: „Mutare". Disponibilă pe orice nivel.
- Se pot muta **atât categorii cât și foldere întregi**.
- Flux:
  1. Mod selecție (ca la grupare, dar pe orice nivel). SAU se poate iniția cu un singur element preselectat din meniul per-card (vezi §7).
  2. Action-bar: „N selectate" + „Alege destinația".
  3. Deschide picker de destinație: listă de foldere valide + opțiunea **„Rădăcină"** (scoate din orice folder). Căutare din bara de jos.
  4. **Anti-ciclu (CRITIC):** picker-ul de destinație TREBUIE să excludă elementul mutat ȘI tot subarborele lui (nu poți muta un folder în el însuși sau într-un descendent al lui).
  5. La confirmare: elementele primesc noul parentId.

### 5.3 Folder gol
- Când un folder rămâne fără conținut (după mutare/ștergere), afișează un mesaj prin care utilizatorul alege: **păstrează** folderul gol SAU **șterge-l**.

---

## 6. Căutarea (algoritm) — refolosibil în toată aplicația

> Aceeași logică de căutare se va folosi peste tot (categorii, tags, spaces). De implementat ca utilitar reutilizabil. Vezi și `SPEC_MultiSelectPicker.md` pentru varianta de picker.

### 6.1 Tokenizare și matching
- Query-ul se sparge în tokeni după spații: `"t c"` → `["t","c"]`.
- Fiecare token trebuie să matcheze **un cuvânt diferit** din element, la **începutul cuvântului** (prefix de cuvânt). Toți tokenii trebuie satisfăcuți (**AND**).
- Exemplu: query `"t c"`:
  - „Televizor color" → MATCH (t→Televizor, c→color)
  - „acum trebuia ceva" → MATCH (t→trebuia, c→ceva)
  - „Televizor mare" → NU (c nu matchează nimic)

### 6.2 Prioritizare (2 niveluri)
- Prioritate 1: token care matchează la **începutul elementului** (primul cuvânt).
- Prioritate 2: token care matchează la începutul unui cuvânt **intern** (nu primul).
- Rezultatele cu match pe prefixul elementului apar înaintea celor cu match doar pe cuvânt intern.

### 6.3 Picker „select or create" (flaguri)
Un singur hook generic cu flaguri (vezi `SPEC_MultiSelectPicker.md`):
- `multiSelect: false` → alegi 1 element → exit imediat + trimite rezultatul.
- `multiSelect: true` → selectezi N elemente (pills) → confirmare explicită (Salvare); onChange doar la Salvare.
- `allowCreate: true` → când nu există match exact, apare rândul „+ Adaugă «query»". Funcționează în ambele moduri.
- `allowCreate: false` → doar căutare/selecție, fără creare.
- **Două forme de UI** care consumă același hook:
  - **inline** — în contextul barei de căutare (ex: adăugare categorie din BottomBar);
  - **dialog** — bottom-sheet (ex: tags la editarea unui produs).
  Hook-ul nu știe unde se randează; doar expune stare + handlers.
- Regula `options` (lista globală) trăiește în părinte (vezi `SPEC_MultiSelectPicker.md`), ca să supraviețuiască între deschideri.

---

## 7. Editare și ștergere

### 7.1 Acces la acțiuni per element
- **Long-press pe un card** (sau echivalent) → bottom-sheet cu acțiuni pentru acel element: Editează denumirea, Mută, Șterge.

### 7.2 Editare
- Foldere și categorii: redenumire. Input de nume în sheet (NU e căutare, deci poate sta în sheet — vezi §3.2 excepție).

### 7.3 Ștergere categorie — cu Coș de gunoi (Trash)
- O categorie poate avea multe produse; ștergerea accidentală e costisitoare → soft delete.
- La ștergere: categoria (cu tot conținutul ei) merge în **Coș de gunoi**, NU dispare definitiv.
- Din Coș: **Restaurare** sau **Ștergere definitivă**.
- **La restaurare, categoria revine la RĂDĂCINĂ** (nu în folderul de origine).
- Undo rapid: la ștergere, un toast cu „Anulează" câteva secunde (restaurează imediat).
- Coșul e accesibil din meniul contextual al Catalog-ului.

### 7.4 Ștergere folder — directă
- Folderele sunt doar organizare, nu conțin produse → NU trec prin Coș.
- La ștergere, conținutul folderului (subfoldere + categorii) **urcă la părintele folderului** (promovare), ca să nu se piardă nimic.
- Confirmare dacă folderul nu e gol.

---

## 8. Meniu contextual (BottomBar → buton meniu)

Conține acțiunile la nivel de Catalog:
- Adaugă categorie
- Grupare (dezactivat dacă nu ești la rădăcină)
- Mutare
- Coș de gunoi (cu nr. de categorii din coș)

---

## 9. Rezumat operații

| Operație | De unde | Restricții |
|---|---|---|
| Adaugă categorie | bara de căutare / `+` / CTA empty state | anti-duplicare nume |
| Grupare | meniu contextual | doar la rădăcină, ≥2 elemente negrupate |
| Mutare | meniu contextual / meniu per-card | categorii + foldere; anti-ciclu (exclude self+descendenți); destinație = folder sau rădăcină |
| Editare nume | long-press card | foldere + categorii |
| Ștergere categorie | long-press card | → Coș; restaurare la rădăcină; undo în toast |
| Ștergere folder | long-press card | directă; conținut promovat la părinte; confirmare dacă nu e gol |
| Folder gol | automat după golire | mesaj păstrează/șterge |

---

## 10. Checklist de validare (pe device real / PWA)

- [ ] BottomBar rămâne ancorat deasupra tastaturii când aceasta e deschisă.
- [ ] Cu tastatura deschisă, MainContent rămâne scrollabil și partea de sus a paginii e accesibilă (NU e aruncată definitiv în afara ecranului).
- [ ] Căutarea funcționează DOAR din bara de jos; sheet-urile nu au input de search propriu.
- [ ] Query-ul barei filtrează live conținutul sheet-ului deschis.
- [ ] Gestul de back și săgeata sus urcă la părinte (nu închid aplicația).
- [ ] Empty state → CTA → prima categorie.
- [ ] Grupare doar la rădăcină, ≥2 selectate.
- [ ] Mutare cu anti-ciclu (folderul mutat nu apare ca destinație pentru el însuși/descendenți).
- [ ] Ștergere categorie → Coș → restaurare la rădăcină.
- [ ] Ștergere folder → conținut promovat la părinte.
- [ ] Algoritm căutare: tokeni multipli, AND, prefix-first (test: „t c" pe „Televizor color").
- [ ] Dark theme, mobile-first, 100dvh/100svh, consum date prin store Zustand.
