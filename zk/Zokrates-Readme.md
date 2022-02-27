### Installation von Zokrates
1. `curl -LSfs get.zokrat.es | sh`
2. Das Installationsskript gibt zum Installationsende einen Befehl zur Erweiterung der `$PATH` Variable aus. Um das Programm `Zokrates` Systemweit aufrufbar zu machen, sollte der Befehl in das rc-File der benutzten Shell eingetragen werden.

### Ein Zokrates-Beweisskript compilieren und den Solidity-Verifikationsvertrag exportieren. - Am Beispiel von zk/stimmrechtsbeweis.zok
1. `cd zk/`
2. compilieren
    1. `zokrates compile --input stimmrechtsbeweis.zok --output stimmrechtsbeweis`
3. Schlüsselmaterial erzeugen
    1. `zokrates setup --input stimmrechtsbeweis --backend ark --proving-scheme gm17`
4. Verifikationsvertrag exportieren
    1. `zokrates export-verifier --proving-scheme gm17`
    2. Der exportierte Verifikationsvertrag liegt im aktuellen Verzeichnis: `verifier.sol`
