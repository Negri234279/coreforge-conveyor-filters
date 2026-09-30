# Scripts de items de Rust

Herramientas para mantener el catálogo de items de la app (`src/data/items.json` +
sus iconos en `public/items/`) sincronizado con los bundles del juego.

## Modelo de datos

- **`src/data/items.json`** — array de items. Cada entrada tiene solo los campos que
  usa la app:
  ```jsonc
  { "id": 1, "itemId": 1840570710, "shortname": "abovegroundpool",
    "name": "Above Ground Pool", "category": "Fun", "imagePath": "abovegroundpool" }
  ```
  - `id` — secuencial, se asigna solo al añadir.
  - `itemId` / `shortname` / `name` / `category` — vienen del JSON del juego
    (`itemid` / `shortname` / `Name` / `Category`).
  - `imagePath` — nombre base del icono (normalmente == `shortname`).
- **Iconos** — WebP en `public/items/{medium,tiny}/<imagePath>.webp`.
  - Solo se sirven **2 tamaños**: `medium` (80px, `itemImage()`) y `tiny` (24px, tabla
    de admin). `full` y `small` se eliminaron por no usarse.
  - La app resuelve con `itemImage()`, que hace `imagePath ?? shortname` (un item sin
    `imagePath` cae al `shortname`).
- **Carpeta `tmp/`** — está en `.gitignore`. Todas las salidas intermedias
  (`tmp/rust-item-diff`, `tmp/orphan-items`, `tmp/manual-items`) viven ahí y no se
  suben nunca.

Rutas por defecto de los bundles del juego (Windows / Steam):

```
Staging : C:\Program Files (x86)\Steam\steamapps\common\RustStaging\Bundles\items
Live     : C:\Program Files (x86)\Steam\steamapps\common\Rust\Bundles\items
```

---

## Scripts y comandos npm

| npm                          | Script                       | Qué hace                                                        |
| ---------------------------- | ---------------------------- | --------------------------------------------------------------- |
| `npm run items:diff`         | `diff-rust-items.mjs`        | Compara Staging vs Live → copia los items nuevos/cambiados       |
| `npm run items:import`       | `optimize-diff-items.mjs`    | Mete una carpeta de items en `items.json` + genera iconos        |
| `npm run items:update`       | (diff && import)             | Flujo completo: diff seguido de import                           |
| `npm run items:recover-orphans` | `recover-orphan-items.mjs` | Reúne el JSON de iconos huérfanos para poder recuperarlos        |
| `npm run items:verify`       | `verify-item-images.mjs`     | Comprueba que cada item tiene su icono; lista huérfanas          |
| `npm run optimize:items`     | `optimize-items.mjs`         | (Base) Genera iconos desde `public/items-raw`                    |

> Para pasar flags a través de npm usa `--`, p. ej. `npm run items:import -- --dry-run`.

---

### `diff-rust-items.mjs` — comparar Staging vs Live

Compara los dos bundles y copia a `tmp/rust-item-diff/` lo que difiere:

- `new/` — el `.json` existe en Staging pero no en Live.
- `changed/` — existe en ambos pero **difiere el JSON _o_ los bytes del PNG** (detecta
  re-skins/re-render de iconos con el mismo JSON).
- Los que solo están en Live se reportan como `removed` (no se copian).

Cada ejecución **borra y regenera** `tmp/rust-item-diff` (idempotente). Escribe también
`summary.json` con las listas completas.

```sh
node scripts/diff-rust-items.mjs
node scripts/diff-rust-items.mjs --dry-run
node scripts/diff-rust-items.mjs --staging="D:/.../items" --live="E:/.../items" --out="tmp/x"
```

| Flag         | Default                          |
| ------------ | -------------------------------- |
| `--staging=` | ruta Staging                     |
| `--live=`    | ruta Live                        |
| `--out=`     | `tmp/rust-item-diff`             |
| `--dry-run`  | no escribe nada                  |

---

### `optimize-diff-items.mjs` — importar a items.json + iconos

Dada una carpeta con pares `<shortname>.json` + `<shortname>.png`:

1. Genera los iconos `medium` + `tiny` en `public/items/` (sobrescribe en su sitio).
2. Hace _merge_ en `items.json`:
   - `shortname` existente → **actualiza** (conserva el `id`).
   - `shortname` nuevo → **añade** con el siguiente `id`.
3. Aplica la **lista de exclusión** (ver abajo).

La carpeta fuente se detecta así: si tiene subcarpetas `new/`/`changed/` (formato del
diff) las procesa; si no, trata la carpeta como plana. **Idempotente**: reejecutar deja
el mismo resultado (match por `shortname`, sin duplicar).

```sh
node scripts/optimize-diff-items.mjs                       # usa tmp/rust-item-diff
node scripts/optimize-diff-items.mjs tmp/manual-items      # carpeta plana propia
node scripts/optimize-diff-items.mjs tmp/orphan-items --dry-run
node scripts/optimize-diff-items.mjs --quality=90
```

| Flag          | Default                     |
| ------------- | --------------------------- |
| `[srcDir]`    | `tmp/rust-item-diff`        |
| `--items=`    | `src/data/items.json`       |
| `--out=`      | `public/items`              |
| `--excluded=` | `scripts/item-excluded.json`|
| `--quality=`  | `85`                        |
| `--dry-run`   | no escribe nada             |

---

### `recover-orphan-items.mjs` — recuperar iconos huérfanos

Un **huérfano** es un icono en `public/items` que ningún item de `items.json` referencia.
Este script, para cada huérfano, busca su `<nombre>.json` en el bundle (Staging y luego
Live) y lo copia (con su `.png`) a `tmp/orphan-items/`. **No escribe en `items.json`** —
eso lo hace luego el import, para que revises antes.

- Reporta los huérfanos **sin JSON** en ningún bundle (imágenes obsoletas, candidatas a
  borrar, no a añadir).
- Salta los que estén en la lista de exclusión.

```sh
node scripts/recover-orphan-items.mjs
node scripts/optimize-diff-items.mjs tmp/orphan-items --dry-run   # revisar
node scripts/optimize-diff-items.mjs tmp/orphan-items             # añadir de verdad
```

| Flag          | Default                     |
| ------------- | --------------------------- |
| `--items=`    | `src/data/items.json`       |
| `--dir=`      | `public/items`              |
| `--staging=`  | ruta Staging                |
| `--live=`     | ruta Live                   |
| `--excluded=` | `scripts/item-excluded.json`|
| `--out=`      | `tmp/orphan-items`          |

---

### `verify-item-images.mjs` — verificar iconos

Recorre `items.json` y, replicando `itemImage()` (`imagePath ?? shortname`), comprueba
que cada item tenga icono en **`medium` y `tiny`**.

- **✗ missing images** — item con icono ausente → **exit 1**.
- **ℹ shortname-fallback** — items sin `imagePath` que resuelven por `shortname` (OK).
- **⚠ orphan images** — iconos en disco sin item (no falla, salvo `--strict`).
- Avisa si un `shortname` excluido sigue en `items.json`.

```sh
npm run items:verify
npm run items:verify -- --strict     # falla también con huérfanas
```

| Flag          | Default                     |
| ------------- | --------------------------- |
| `--items=`    | `src/data/items.json`       |
| `--dir=`      | `public/items`              |
| `--excluded=` | `scripts/item-excluded.json`|
| `--strict`    | falla si hay huérfanas      |

---

## Lista de exclusión — `scripts/item-excluded.json`

Shortnames que **existen en el dump del juego pero NO son items filtrables en el
conveyor**: redirect-skins de DLC que el juego colapsa al item base (p. ej.
`hazmat.plague`, `hat.*mask`, `rocket.launcher.rpg7`), entidades solo-mundo, etc.

```jsonc
{ "notFilterable": ["hazmat.plague", "hat.dragonmask", "rocket.launcher.rpg7"] }
```

Efecto en los scripts:

- **`optimize-diff-items.mjs`**: los **salta** en la fuente (nunca los añade/genera),
  los **elimina de `items.json`** si estaban, y **purga sus iconos** de disco
  (recorriendo la lista contra el filesystem, aunque ya no estén en el JSON).
- **`recover-orphan-items.mjs`** y **`verify-item-images.mjs`**: los **ignoran**.

> No hay un campo fiable en el dump para distinguir redirect-skins (el juego usa
> `isRedirectOf`, que no se exporta). Por eso la lista es **curación manual**: cuando
> detectes un duplicado DLC que no va en filtros, añádelo aquí.

---

## Recetas (flujos vistos en esta sesión)

### 1. Actualización de Rust (hay update nuevo)

```sh
npm run items:update      # diff (Staging vs Live) + import de new/ y changed/
npm run items:verify      # confirmar que no hay iconos rotos
```

### 2. Añadir items sueltos que faltan (existen igual en Staging y Live)

El diff no los ve (no hay diferencia Staging↔Live). Se importan a mano:

```sh
mkdir -p tmp/manual-items
STG="C:/Program Files (x86)/Steam/steamapps/common/RustStaging/Bundles/items"
cp "$STG/frankensteinmask.json" "$STG/frankensteinmask.png" tmp/manual-items/
node scripts/optimize-diff-items.mjs tmp/manual-items
```

### 3. Recuperar iconos huérfanos (imágenes sin item)

```sh
npm run items:recover-orphans                              # reúne en tmp/orphan-items
node scripts/optimize-diff-items.mjs tmp/orphan-items --dry-run   # revisar
node scripts/optimize-diff-items.mjs tmp/orphan-items            # añadir
npm run items:verify
```

### 4. Borrar items metidos por error / redirect-skins de DLC

Añade sus `shortname` a `scripts/item-excluded.json` y reejecuta el import contra
cualquier carpeta con fuentes — se eliminan del JSON y se borran sus iconos:

```sh
# 1. editar scripts/item-excluded.json → añadir a "notFilterable"
# 2. reejecutar el import
node scripts/optimize-diff-items.mjs tmp/orphan-items
# 3. confirmar
npm run items:verify
```

### 5. Comprobar la salud del catálogo

```sh
npm run items:verify
```

---

## Notas

- **Idempotencia**: `diff` regenera `tmp/rust-item-diff` en cada corrida; `import`
  hace match por `shortname` (no duplica); `verify` solo lee. Todos se pueden repetir.
- **Nada destructivo en las fuentes**: los bundles de Steam y las carpetas de `tmp`
  solo se leen (salvo las de salida, que se regeneran). Solo se escriben `items.json` y
  `public/items/`.
- **Limpieza**: las carpetas `tmp/*` se pueden borrar cuando acabes (`rm -rf tmp/...`),
  no afectan a nada.
