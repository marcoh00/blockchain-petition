### Installation von Zokrates
1. `curl -LSfs get.zokrat.es | sh`
2. Das Installationsskript gibt zum Installationsende einen Befehl zur Erweiterung der `$PATH` Variable aus. Um das Programm `Zokrates` Systemweit aufrufbar zu machen, sollte der Befehl in das rc-File der benutzten Shell eingetragen werden.

### Ein Zokrates-Beweisskript compilieren und den Solidity-Verifikationsvertrag exportieren. - Am Beispiel von zk/stimmrechtsbeweis.zok
1. `cd zk/`
2. compilieren
    1. `zokrates compile --input stimmrechtsbeweis.zok --output stimmrechtsbeweis`
3. Schlüsselmaterial erzeugen (verification.key und proving.key)
    1. `zokrates setup --input stimmrechtsbeweis --backend ark --proving-scheme gm17`
4. Verifikationsvertrag exportieren
    1. `zokrates export-verifier --output StimmrechtsbeweisVerifier.sol --proving-scheme gm17`
    2. Der exportierte Verifikationsvertrag liegt im aktuellen Verzeichnis: `StimmrechtsbeweisVerifier.sol`

### Einen Stimmrechtsbeweis mit `zokrates` generieren
1. `cd zk/`
2. Witness-Datei (Datei aller Ein- und Ausgaben) erzeugen:
    1.  `zokrates compute-witness --input stimmrechtsbeweis -a BEWEISARGUMENTE`
    2.  `BEWEISARGUMENTE := public u32[8] rt, public u32[8] H_pers, public u32[8] ID_Petition, private u32[8] K_priv, private u32[8] K_pub, private bool[3] directionSelector,  private u32[3][8] merkleproof`
    3. Kodierung der BEWEISARGUMENTE
        1.  Jedes Argument ist durch **Leerzeichen separiert**. 
        2.  Integer-Argumente müssen **dezimal-codiert** übergeben werden
        3.  Ist ein Argument ein eindimensionales Array,  muss jedes Element **nacheinander**, durch **Leerzeichen separiert** übergeben werden.
        4.  Multidimensionale Arrays, bspw.  `[[1,2,3],[a,b,c]]` werden so übergeben: `1 2 3 a b c`
        5.  `private bool[3] directionSelector` gibt für jedes Element von `merkleproof` an, ob sich dieser "Partner" links von der aktuellen Position im Baum befindet.
3. Beweis erzeugen
    1. `zokrates generate-proof --input stimmrechtsbeweis --backend ark --proving-scheme gm17`
        1. Ausgabe ist die Datei `proof.json`, bestehend aus drei Punkten auf der benutzten Kurve

### Einen Stimmrechtsbeweis mit `zokrates` verifizieren
1. `cd zk/`
2. `zokrates verify --backend ark --proving-scheme gm17`
    1. Es wird standardmäßig die Beweisdatei `proof.json` eingelesen
    2. Analog dazu wird der Verifikationsschlüssel aus der Datei `verification.key` gelesen.
