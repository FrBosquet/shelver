# Shared Steam logos

Source: [Steam's official store SVG](https://store.akamai.steamstatic.com/public/shared/images/header/logo_steam.svg?t=962016), retrieved 2026-10-09. Branding reference: [Valve's Steam branding guidelines](https://partner.steamgames.com/doc/marketing/branding).

The logo files preserve the source's symbol, wordmark and registered-mark vector paths. White and black variants follow Valve's inverse and positive colors. The symbol files contain the first three paths from that same SVG. The viewBox removes unused right padding, and the SVGs have explicit integer intrinsic dimensions. XML declarations, external DTD references and editor metadata are omitted; the artwork has no external dependencies.

The marks belong to Valve. They are bundled as reusable artwork, not licensed under Shelver's source-code license. See the linked Valve guidelines for usage and attribution.

`logoLibrary.ts` registers immutable versioned IDs. Templates reference these assets; they do not keep a separate copy per cover. The logo library is available in every editor, works offline and includes the referenced SVG bytes in `.coverproject` backups. Keep these version 1 assets stable when adding further logos or versions.
