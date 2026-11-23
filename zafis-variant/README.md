# Zafis — Zahrada v rovnováze

Samostatná zkušební varianta webu Zafis, výrazně inspirovaná repozitářem [mara420/NOv-1](https://github.com/mara420/NOv-1), původní šablonou Prismic Farbe. Předchozí varianta Zafis Garden Lab je zachována samostatně.

## Co je převzaté z NOv-1

- Kompozice se stálou 3D scénou vlevo a úzkým textovým sloupcem vpravo.
- Pískově šedý podklad `#dcd8d3`, černá, zelený akcent `#00e67b`, Inter a Geist Mono.
- Dlouhé kapitoly, rotace prostorové scény během posouvání a uvolnění prostoru pro fotografie.
- Asymetrická mřížka fotografií 3:2, hranaté ovládací prvky a velká typografie.

Referenční commit: `e29381843f395d4936ff4f4cc33062ed2d81393f`. Konkrétní podklady: `app/assets/css/index.css`, `app/components/TScene.vue`, `app/slices/Text/index.vue`, `app/slices/Product/index.vue`, `app/slices/Picture/index.vue`. Podrobné atribuce jsou v `dist/CREDITS.md`; původní licence je přiložena.

## Co vzniklo pro Zafis

Vlastní procedurální 3D model zahrady, trávník, kamenná cesta, závlaha a zahradní světlo. Režimy **Voda / Život / Světlo** mění scénu; posouvání ji otáčí. Všechny texty, kontaktní část a fotografie se vztahují k Zafis. Filmový obchod z původní šablony se nepoužívá.

Stránka je statická a nevyžaduje Prismic, Stripe, Nuxt ani vzdálené API. Three.js, fonty i obrázky jsou přiložené lokálně. Při nedostupnosti WebGL se spustí náhradní prostorová zahrada vykreslovaná přes Canvas2D. Krajním záložním zobrazením je fotografie; obsah a kontakty zůstávají dostupné.

## Soubory

- `dist/index.html` — obsah stránky
- `dist/style.css` — vzhled a mobilní rozložení
- `dist/js/app.js` — navigace, scroll a příprava poptávky
- `dist/js/garden-scene.js` — vlastní 3D zahrada
- `dist/js/garden-fallback.js` — prostorová zahrada pro zařízení bez WebGL
- `dist/assets/` — fotografie a fonty
- `.openai/hosting.json` — konfigurace tohoto soukromého náhledu

## Lokální spuštění

V této složce spusťte:

```sh
python3 -m http.server 8080 --directory dist
```

Pak otevřete `http://localhost:8080`. Pro 3D scénu použijte webový server, nikoli otevření HTML přes `file://`.

## Kontakt ve zkušebním webu

Formulář pouze připraví text e-mailu. Uživatel si jej prohlédne, otevře v e-mailovém programu a odešle sám. Stránka nic automaticky neodesílá a neukládá osobní údaje na server. Pro skutečný sběr poptávek lze později doplnit backend.

## Přístupnost a výkon

- Mobilní menu, klávesnicová navigace, nadpisy a popisy formuláře.
- Přepínače scény mají stav `aria-pressed` a změny formuláře používají živé hlášení.
- Systémové omezení animací a ruční pauza; při neaktivní scéně se vykreslování omezuje.
- Lokální zmenšené fonty, WebP fotografie, omezená hustota pixelů canvasu.

Žádné klientské reference, čísla úspor nebo obchodní výsledky nejsou vymyšlené. Fotografie popisují služby a nejsou označené jako konkrétní zakázky.
