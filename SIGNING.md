# Podpísané vydania pre Windows a Android

Podpis overuje vydavateľa a integritu balíka. Nenahrádza kontrolu kódu ani
nezaručuje odstránenie všetkých upozornení SmartScreen, Smart App Control,
antivírusu alebo Play Protect. Presné hlásenie blokovania určuje ďalší postup.

## Aktuálne buildy a nové vydania

- **Windows desktop** vytvára nepodpísané testovacie EXE.
- **Android APK** vytvára debug APK s vývojovým podpisom a identifikátorom
  `sk.bucala.filmy.debug`. Nie je to distribučné vydanie.
- **Signed release** sa spúšťa manuálne iba z `main`, vytvára podpísané Windows
  EXE a/alebo Android release APK/AAB. Bez potrebných kľúčov zlyhá; nenahradí
  podpísané vydanie nepodpísaným. Artefakty obsahujú aj SHA-256 kontrolné súčty.
  Workflow nič automaticky nezverejňuje v obchode ani v GitHub Releases.

## Windows: dôveryhodný podpis

Windows potrebuje **Code Signing certifikát od dôveryhodnej certifikačnej
autority** alebo overenú cloudovú službu (napr. Microsoft Artifact Signing).
Self-signed certifikát pre verejnú distribúciu nestačí. Nový platný podpis môže
stále vyvolať SmartScreen upozornenie, kým vydavateľ alebo súbor nemá reputáciu.
Pri antivírusovej detekcii treba preskúmať konkrétny nález a prípadný false
positive nahlásiť výrobcovi, nie odporúčať vypnutie ochrany.

Pripravený workflow používa Electron Builder s **PFX/P12 certifikátom**:

| Secret v prostredí `release-signing` | Obsah |
| --- | --- |
| `WINDOWS_CERTIFICATE_BASE64` | Base64 celého PFX/P12 vrátane súkromného kľúča |
| `WINDOWS_CERTIFICATE_PASSWORD` | Heslo certifikátu |

Base64 nie je šifrovanie. Súbor aj heslo patria do GitHub Actions Secrets, nie
do repozitára, issue, logu ani chatu. Kľúč musí byť platný na Code Signing a jeho
certifikačný reťazec musí byť dôveryhodný pre Windows.

Nové verejné certifikáty často vyžadujú hardvérový token/HSM alebo cloudový
podpis a nedajú sa exportovať do PFX. **Tento workflow takú službu zatiaľ
neintegruje.** Pri výbere poskytovateľa treba doplniť jeho podpisovací krok;
nevytvárať vlastný PFX ako náhradu verejne dôveryhodného certifikátu.

Build vyžaduje podpis cez `forceCodeSigning`, overí timestamp a platnú
Authenticode signatúru inštalátora, portable EXE aj vnútorného `Filmy.exe`.
Timestamp umožňuje overovať podpis aj po vypršaní podpisového certifikátu.

## Android: trvalý release kľúč

**Lokálne Android Studio:** GitHub secrets nie sú potrebné. Otvor celý projekt
a použi **Build → Generate Signed App Bundle or APK → APK** so svojím bezpečným
keystore. Podrobný postup: [ANDROID_STUDIO.md](ANDROID_STUDIO.md).

Android APK musí byť podpísaný. Pre distribúciu sa používa **vlastný trvalý
release keystore**, nie nový debug kľúč pri každom CI behu. Nie je potrebné
kupovať Windows-style certifikát od verejnej certifikačnej autority.

Ak už aplikácia má release kľúč, použite ten istý. Ak ho nemá, vytvorte ho na
dôveryhodnom lokálnom počítači (príkaz si vypýta heslo a identitu vydavateľa):

```bash
keytool -genkeypair -v -keystore filmy-release.jks -alias filmy \
  -keyalg RSA -keysize 3072 -validity 10000
```

Uschovajte šifrovanú záložnú kópiu kľúča aj jeho hesiel. Strata kľúča môže
znemožniť aktualizácie priamo distribuovaného APK. Pri Google Play sa odporúča
Play App Signing: Google spravuje app signing kľúč a AAB sa odosiela s upload
kľúčom. APK v tomto workflow je podpísaný lokálnym kľúčom; nemusí byť
aktualizačne kompatibilný s APK z Play, ak Play používa iný app signing kľúč.

| Secret v prostredí `release-signing` | Obsah |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 celého keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Heslo keystore |
| `ANDROID_KEY_ALIAS` | Alias kľúča, napr. `filmy` |
| `ANDROID_KEY_PASSWORD` | Heslo súkromného kľúča |

Release workflow dekóduje kľúč iba do dočasného adresára runnera, po použití ho
zmaže a neukladá Gradle cache z podpisového buildu. Overí APK cez `apksigner`,
porovná odtlačok podpisu s release kľúčom, skontroluje vypnuté debugging a overí
JAR podpis AAB. Android WebView nepovoľuje prístup k `file://`; zabalené webové
súbory sa naďalej načítavajú cez HTTPS `WebViewAssetLoader`.

Pre lokálny release build nastavte tieto premenné cez svoj správca tajomstiev
alebo lokálne prostredie; hodnoty ani heslá neukladajte do príkazovej histórie:
`ANDROID_KEYSTORE_PATH` (absolútna cesta), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `FILMY_RELEASE_VERSION` a
`FILMY_ANDROID_VERSION_CODE`. Potom spustite:

```bash
./gradlew :android-app:assembleRelease :android-app:bundleRelease --no-configuration-cache
```

Predchádzajúce debug APK používali tiež `sk.bucala.filmy`. Release s iným kľúčom
ich **nemôže aktualizovať**. Najprv exportujte lokálne dáta cez aplikáciu, potom
odinštalujte staré debug APK a nainštalujte release. Nové debug buildy majú
príponu `.debug`, takže môžu existovať vedľa release verzie.

Podpísané sideload APK môže stále vyžadovať povolenie inštalácie z konkrétneho
zdroja a kontrolu Play Protect. Distribúcia cez Google Play vyžaduje aj účet
vývojára, splnenie pravidiel obchodu a aktuálny cieľový Android API level;
aktuálny `targetSdk = 35` treba pred odoslaním porovnať s platnými požiadavkami
Google Play. Samotný podpis nie je schválenie obchodu.

## Nastavenie a spustenie

1. V GitHub **Settings → Environments** vytvorte `release-signing`. Povoľte
   deployment iba z `main` a podľa možností zapnite required reviewers.
2. Do tohto prostredia pridajte vyššie uvedené secrets iba pre platformu,
   ktorú chcete zostaviť. Bežné PR/push buildy ich nepoužívajú.
3. **Actions → Signed release → Run workflow**, vetva `main`.
4. Vyberte platformu a verziu `major.minor.patch`. Pre Android zadajte
   `android_version_code` vyšší než pri každom predchádzajúcom vydaní.
5. Po úspešnej kontrole podpisov stiahnite `filmy-windows-signed-<verzia>` alebo
   `filmy-android-signed-<verzia>`. Otestujte inštaláciu aj aktualizáciu na
   cieľových zariadeniach pred distribúciou.

Bez nastavených certifikátov/kľúčov zatiaľ **nevznikne podpísané vydanie**.
