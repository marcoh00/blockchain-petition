# Technischer Prototyp für Petitionen auf der Blockchain

Die vorliegende Sammlung stellt einen Prototyp für ein Petitionssystem auf der Blockchain dar.
Folgende Komponenten sind enthalten:

## Client

Web-Frontend für Nutzer.
Verbindet sich mit einer vorliegenden Wallet und generiert IDP- und Perioden-spezifische Schlüssel.
Kann mit einem `Registry`-Contract interagieren, um alle Details des verwendeten Petitionssystems zu lernen.
Interagiert im Folgenden mit `IDP`- und `Petition`-Contracts um gültige Unterschriften zu erzeugen.

## IDP

Identity Provider.
Identifiziert Nutzer und fügt ihre öffentlichen Schlüssel einem Merkle-Tree hinzu, der regelmäßig auf die Blockchain geschrieben wird.
Stellt Nutzern Credentials in Form von Merkle-Beweisen aus, die es ihnen ermöglichen, an Petitionen teilzunehmen.

IDPs sind per Defitinion vertrauenswürdig: Fehlverhalten der IDPs führt dazu, dass (echte oder durch IDP vorgegebene) Nutzer mehrfach abstimmen können.
Weigern IDPs sich, Credentials auszustellen, können sie einzelne Nutzer von der Teilnahme am System ausschließen.
Sobald der Merkle-Tree in die Blockchain geschrieben und der zugehörige Beweis übermittelt wurde, können IDPs die Credentials nicht länger zurückziehen.
IDPs können nicht nachvollziehen, welche Petitionen durch Nutzer unterschrieben wurden.

## Smart Contract-Plattform

Smart Contracts zur Datenhaltung für IDP, Registry, Petition.

## ZoKrates-Programm zur Erstellung von ZK-SNARKs

Das Projekt verwendet [ZoKrates](https://zokrates.github.io) zur Erstellung von Zero-Knowledge-Beweisen, die die korrekte Ausführung von Programmen der ZoKrates-Sprache beweisen können (s.u.).

# Protokoll

Die Zeit wird auf Basis der Block-Zeitstempel in Perioden aufgeteilt.
Der IDP-Contract legt fest, wie lange diese Perioden sind.

Alle angegebenen Schritte müssen für eine neue Abstimmungsperiode erneut ausgeführt werden.
Eine Petition ist einer Abstimmungsperiode fest zugeordnet.

1.  `Client -> (ID, K_pub) -> IDP`
    ```
    ID = [implementierungsspezifisch, zB SSI- oder eIDAS-basiert]
    K_priv = rnd()
    K_pub = PRF(K_priv)
    ```

    IDP prüft:
    - `ID` hat sich für die aktuelle Abstimmungsperiode noch nicht identifiziert (die Möglichkeit, mehrere Eintragungen pro ID und Abstimmungsperiode vorzunehmen entspricht der Möglichkeit, mehrfach abzustimmen)

2.  `IDP -> (Merkle-Root inkl. K_pub) -> IDP-SC`

    `IDP -> (Merkle-Proof, Index) -> Client`

    IDP erzeugt in festen Zeitabständen einen Merkle-Baum über verifizierte Identifier. Der Root-Hash (`rt`) wird auf die Blockchain geschrieben, der Client erhält zusätzlich einen Merkle-Beweis über die Inkludierung seines `K_pub` und den Index, mit dem `rt` aus der Blockchain erhalten werden kann.

3.  `Client -> (H_pers, Index, ZK) -> Petition-SC`

    Client erzeugt einen Hashwert über die Petitions-ID und den öffentlichen Schlüssel.

    ```
    rt = (IDP-SC).get(Index)
    H_pers = h(ID_Petition, K_priv)
    ZK = ZK-SNARK(public rt, public H_pers, public ID_Petition, private K_priv, private K_pub, private directionSelector, private merkleproof)
    ```

    Der ZK-Beweis prüft folgende Bedingungen:
     - `K_pub = PRF(K_priv)` (d.h. `K_priv` ist bekannt und ist das Pre-Image von `K_pub`)
    - `H_pers` ist korrekt berechnet worden
    - `rt` enthält `K_pub` (mit Hilfe von `merkleproof`)

    Der Petitions-SC prüft:
    - `rt` ist im `IDP`-Smart Contract am angegebenen Index abrufbar
    - `ZK` ist gültig
    - `H_pers` ist nicht in der Liste der bisherigen Unterschriften enthalten

4.  Die Gesamtanzahl der Unterschriften entspricht der Größe des Arrays über alle `H_pers` der Abstimmungsperiode

# Installation

Eine aktuelle Version von [nodejs](https://nodejs.org) wird benötigt.

## Smart Contract Platform

Installation der Abhängigkeiten
```
npm install
```

Start des Development-Servers

```
npx hardhat node
```

Deployment der Smart Contracts

```
npx hardhat run --network localhost scripts/deploy.ts
```

Hinzufügen von Test-Petitionen

```
npx hardhat run --network localhost scripts/testpetitions.ts
```

## IDP

Installation der Abhängigkeiten
```
npm install
```

Einstellungen werden aktuell über Konstanten in `shared/addr.ts` vorgenommen:
```
const port = 65535;
const account = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const privkey = '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0';
const api = 'ws://127.0.0.1:8545';
const contract = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const databasefile = `/home/mhuens2m/build/petition/idp/dist/database.db`;
```

Start des Servers
```
npm run start
```

## Client

Installation der Abhängigkeiten
```
npm install
```

Start des Webpack-Development-Servers
```
npm run dev
```

## Frontend

Der Client ist nach dem Start des Webpack-Servers standardmäßig über [http://localhost:8080](http://localhost:8080) aufrufbar.
Zur Verwendung ist ein web3-kompatibles Browser-Plugin wie z.B. [MetaMask](https://metamask.io) erforderlich.
Damit die gesamte Funktionalität genutzt werden kann, muss die Development-Blockchain als "Network" eingetragen werden.
Standardmäßig ist diese über `localhost:8545` erreichbar und besitzt die Chain ID `31337`.
Um Transaktionen tätigen zu können, muss zudem ein Account importiert werden, der Kryptowährung besitzt.
Entsprechende Private Keys werden beim Start des Blockchain-Development Servers ausgegeben (siehe "Smart Contract Platform").
