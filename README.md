# Technischer Prototyp für Petitionen auf der Blockchain

Die vorliegende Sammlung stellt einen Prototyp für ein Petitionssystem auf der Blockchain dar.
Folgende Komponenten sind enthalten:

## Client

Web-Frontend für Nutzer.
Verbindet sich mit einer vorliegenden Wallet und generiert IDP- und Perioden-spezifische Schlüssel.
Kann mit einem `Registry`-Contract interagieren, um alle Details des verwendeten Petitionssystems zu lernen.
Interagiert im Folgenden mit `IDP`- und `Petition`-Contracts um gültige Unterschriften zu erzeugen.

## IDP

## Smart Contract-Plattform

## ZoKrates-Programm zur Erstellung von ZK-SNARKs

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
    ZK = ZK-SNARK(public rt, public H_pers, public ID_Petition, private K_priv, private K_pub, private merkleproof)
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