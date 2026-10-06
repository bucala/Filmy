# Vytvorenie APK v Android Studio

Projekt sa dá otvoriť priamo po stiahnutí z GitHubu. Na lokálne zostavenie
**nepotrebuješ GitHub Actions, GitHub signing secrets, Node.js ani ručne
inštalovaný Gradle**. Gradle wrapper je súčasťou repozitára.

## 1. Stiahni a otvor celý projekt

1. Na GitHube otvor vetvu `main`, klikni **Code → Download ZIP** a ZIP rozbaľ.
   Prípadne repozitár naklonuj.
2. V Android Studio zvoľ **Open** a vyber rozbalený koreň `Filmy-main`
   (pri klonovaní `Filmy`). Musí obsahovať `settings.gradle.kts`, `gradlew`
   a priečinok `android-app`.
3. **Neotváraj samostatne `android/` ani `android-app/`.** `android/` obsahuje
   dokumentáciu a historickú TWA konfiguráciu, nie hlavný projekt.
4. Počkaj na dokončenie **Gradle Sync**. Prvé načítanie potrebuje internet
   na stiahnutie Gradlu a závislostí.

## 2. Skontroluj SDK a JDK

V **Tools → SDK Manager** nainštaluj:

- **Android SDK Platform 35**,
- **Android SDK Build-Tools 35.0.0** (v SDK Tools zapni **Show Package Details**),
- **Android SDK Platform-Tools**.

V **Settings → Build, Execution, Deployment → Build Tools → Gradle**
ponechaj Gradle z wrappera a ako **Gradle JDK** použi zabudované JDK Android
Studio (JDK 17 alebo 21). Projekt používa Gradle 8.10.2 a Android Gradle
Plugin 8.7.3. Ak IDE ponúkne zmenu ich verzií, na prvé zostavenie ju netreba.

Android Studio vytvorí vlastný `local.properties` s cestou k tvojmu SDK.
Tento súbor nepatrí do Gitu.

## 3. Najjednoduchšie APK na vlastné testovanie

1. V **Build Variants** vyber pre modul `android-app` variant **debug**.
2. V menu **Build** zvoľ **Build APK(s)** (v novších verziách
   **Generate App Bundles or APKs → Generate APKs**).
3. Hotové APK nájdeš tu:

   ```text
   android-app/build/outputs/apk/debug/android-app-debug.apk
   ```

Debug APK je automaticky podpísané vývojovým kľúčom a má identifikátor
`sk.bucala.filmy.debug`. Nevyžaduje vlastný keystore a môže byť nainštalované
vedľa release aplikácie.

Rovnaký build spustíš v termináli v koreni projektu:

```powershell
# Windows / PowerShell
.\gradlew.bat :android-app:assembleDebug
```

```bash
# Linux / macOS
chmod +x gradlew
./gradlew :android-app:assembleDebug
```

## 4. Podpísané release APK cez Android Studio

1. V koreňovom `gradle.properties` nastav `FILMY_RELEASE_VERSION`
   (napr. `1.0.1`) a zvýš `FILMY_ANDROID_VERSION_CODE` pre každé nové vydanie.
2. Zvoľ **Build → Generate Signed App Bundle or APK → APK**.
3. Vyber modul `android-app`.
4. Vyber svoj existujúci bezpečný release keystore. Ak aplikácia ešte nemá
   release kľúč, cez **Create new** vytvor nový **mimo priečinka projektu**.
5. Zadaj heslo keystore, skutočný alias kľúča a heslo kľúča priamo v sprievodcovi.
   Do `gradle.properties` ani zdrojových súborov tieto hodnoty nepíš.
6. Vyber variant **release** a dokonči zostavenie.
7. Použi cestu oznámenú Android Studio po zostavení. Bežný Gradle výstup je:

   ```text
   android-app/build/outputs/apk/release/android-app-release.apk
   ```

Sprievodca odovzdá podpis Gradlu iba pre daný build. GitHub secrets ani
premenné `ANDROID_*` nepotrebuješ. Konfiguračná cache je predvolene vypnutá,
aby sa do nej neukladali podpisové údaje. Nepodpísaný release build projekt
zámerne odmietne; použi sprievodcu alebo debug variant.

Release aplikácia má identifikátor `sk.bucala.filmy`. Pre jej budúce aktualizácie
uchovaj ten istý keystore a bezpečné zálohy. Už zverejnený alebo uniknutý kľúč
nepoužívaj pre nové vydanie bez vyriešenia jeho výmeny. Staršie debug APK
s rovnakým identifikátorom môže byť potrebné po exporte dát odinštalovať.
Podrobnosti: [SIGNING.md](SIGNING.md).

## Čo sa zabalí do APK

Gradle automaticky skopíruje HTML, CSS, vloženú databázu, ikony a všetky
`src/**/*.js` moduly do Android assets. Nič nemusíš kopírovať ručne ani
sťahovať z Vercelu. Minimálna verzia zariadenia je Android 7.0 (API 24).
Nové metadáta, GitHub sync a internetové trailery naďalej potrebujú internet.
