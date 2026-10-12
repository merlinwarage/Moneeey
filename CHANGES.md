# Changes

full v2 javítások:

- SQLite migráció a cashflows.note oszlophoz meglévő adatbázis esetén.
- Az új cashflow, állampapír és eszköz tételek azonnal megjelennek a listákban oldalfrissítés nélkül.

full v3 bővítések:

- Negyedéves és éves előrejelzés chartok.
- Gazdagabb teljes nézet az évesített bevétel/kiadás/cashflow elemekkel.
- Állampapír kifizetési naptár.
- Szebb összeg-megjelenítés pill stílussal a listákban.

full v4 finomítások:

- Állampapír kifizetési naptár ismétlődő kuponeseményekkel, típus alapú negyedéves/féléves/éves logikával.
- Modernebb, lapos összeg pill UI.
- Ikonos, letisztult törlés gombok.

full v5 finomítások:

- Magyar állampapír kifizetési naptár kuponlépcsőkkel, első kupon dátum számítással a lejáratból visszafelé.
- Lapított, modernebb amount pill stílus.
- Ikonos, sík törlés gomb kiemelkedés nélkül.

full v6 finomítások:

- Állampapír űrlapon kamat újrabefektetése kapcsoló.
- Saját újrabefektetési kamat százalék mező.
- Az újrabefektetési hozam globálisan beleszámít a kötvényhozam alapú KPI-kba és előrejelzésekbe.

full v7 finomítások:

- A Cashflow, Állampapírok és Eszközök listák elemei szerkeszthetők.
- Külön PUT végpontok frissítéshez a backendben.
- A listaelemek szerkesztés ikonja előtölti a megfelelő űrlapot és frissítés módra vált.

full v8 finomítások:

- A kamat újrabefektetés hozamhatása kuponfrekvencia szerint számolódik.
- Az állampapír kifizetési naptár összegei újrabefektetéssel is nőnek.
- Az éves kupon KPI külön jelzi az újrabefektetés extra részét.

full v9 finomítások:

- A szerkesztés a listaikon helyett a form blokkhoz került.
- A listaelemek teljes sora kattintható szerkesztésre, a törlés külön megmarad.
- A formban külön szerkesztési sáv és Mégse gomb jelent meg.

full v10 javítások:

- A listaelemek markupja ténylegesen megkapta a data-edit-kind és data-id attribútumokat.
- A sorra kattintás most valóban aktiválja a szerkesztést.
- A törlés visszaállt ikon gombra a listákban.
