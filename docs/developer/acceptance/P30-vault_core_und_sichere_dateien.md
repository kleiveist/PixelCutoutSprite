# P30 · Vault-Core und sichere Dateitransaktionen

Datum: 2026-09-09
Status: Frontend-Gates grün; Rust-Implementierung vorhanden, in dieser Sitzung nicht kompilierbar
Anforderungen: R-G07, R-D01, R-D05, R-D06, R-D09, R-C01

## Ergebnis

[`ActiveVaultProvider.tsx`](../../../frontend/src/shared/vault/ActiveVaultProvider.tsx) bindet
`vaultId`, `sessionId`, monotone `sessionGeneration`, Modus und SaveQueue an den aktiven Kontext.
Späte Ergebnisse müssen dieselbe Session und Generation tragen. Der vorhandene native Vault-Lock
bleibt der einzige Writer-Lock.

[`workspace/mod.rs`](../../../src-tauri/src/workspace/mod.rs) ergänzt:

- `.PixelStudio/vault.json` und `.PixelPrompt` nur nach erfolgreicher Prüfung eines autorisierten
  schreibbaren Vaults; unbekannte Metadaten werden nicht überschrieben;
- portable relative Pfade, Geräte-/Traversal-/Symlink-Sperren und begrenzte reguläre Dateien;
- CAS über erwartete Revision und SHA-256, Create-only-Semantik und erneute Prüfung direkt vor
  Veröffentlichung;
- Staging auf demselben Dateisystem und ein Journal mit `prepared`, `applying`, `committed` und
  Recovery nach jedem Publish-Schritt;
- hashgesicherte, wiederholbare Relokation für selbst verwaltete Dateien.

Die Mehrdatei-Veröffentlichung wird bewusst nicht als global atomar bezeichnet. Das Journal macht
einen unterbrochenen Satz nach Recovery vollständig alt oder vollständig neu; fremd veränderte
Mitglieder führen zum Konflikt.

[`SaveQueue.ts`](../../../frontend/src/shared/storage/SaveQueue.ts) serialisiert asynchrone Writes,
führt Debounce-Puffer vor einem Flush aus und hält Fehler für Vault-Wechsel sichtbar. App-Wechsel,
Vault-Wechsel/-Schließen und ein nativer Window-Close-Request nutzen dieselbe Queue. Bei
fehlgeschlagenem Close-Flush bleibt das Fenster offen.

## Sicherheits-/Fehlernachweise

- [`SaveQueue.test.ts`](../../../frontend/src/shared/storage/SaveQueue.test.ts): Serialisierung,
  verzögertes Ergebnis aus alter Session, fehlgeschlagener Flush und Debounce-Vorbereitung.
- [`nativeCloseFlush.test.ts`](../../../frontend/src/shared/storage/nativeCloseFlush.test.ts):
  prevent-close → flush → destroy sowie fail-closed bei Datenträgerfehler.
- Rust-Tests in `workspace/mod.rs`: unbekannte Metadaten, Traversal/Gerätename, externer CAS-
  Konflikt, unterbrochener Dateisatz, Recovery im Backup-Fenster und wiederholbare Relokation.
- Bestehende `VaultLock`-/Transaktionstests bleiben im Testgraph; produktive Commands lösen den
  Root ausschließlich aus der erfassten Session/Generation auf.

## Blocker

`cargo` und `rustc` fehlen. Daher sind insbesondere echte Lock-, Dateisystem-, Crash- und
Plattformtests in dieser Sitzung **nicht ausgeführt**. Die Frontend-Tests ersetzen diese Nachweise
nicht.
