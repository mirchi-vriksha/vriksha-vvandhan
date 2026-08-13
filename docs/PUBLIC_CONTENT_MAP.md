# Public Content Map

The official public campaign name is **Vriksha Bandhan**. This map records how the supplied campaign content was adapted to the verified product rather than copied as unsupported claims.

| Source copy | Page | Implemented copy | Reason for adaptation |
|---|---|---|---|
| Vriksha Bandhan | Home, Join, Movement, legal, staff, email, certificate and export | Vriksha Bandhan | Locked official public name. |
| Celebrate the ones who have always been there | Home hero | “It’s time to celebrate the ones who’ve always been there for us.” | Exact revised hero line; duplicate campaign headlines remain removed. |
| Tie a Rakhi to a Tree | Home and global navigation | “Tie a Rakhi to a Tree” → `/join` | Gives the campaign one clear primary action. |
| 983 Tree Tracker | Home and Movement | Live `[current] of [target] TREES CELEBRATED` | Values stay derived from campaign settings and published eligible records; no hard-coded current count. |
| 983 Trees. One Frequency. Infinite Gratitude. | Home and Join | Same campaign promise | Revised campaign statement, shown once per decision context. |
| A Rakhi. A Gesture of Gratitude. | Join About | Revised movement introduction | Frames participation as celebration and gratitude. |
| 98.3 Mirchi begins the movement | Join About | The Mirchi Movement block | Keeps the on-ground 983-tree commitment explicit. |
| Turn Gratitude Into a Green Bond. | Join | Guardian page headline | Connects the public submission action to the Guardian identity. |
| A Rakhi. A gesture of appreciation. | Join About | Same concept | Supported by the campaign action. |
| An Identity. A tree worth celebrating. | Join About | Same concept | Avoids claiming that the MVP collects a tree name or story. |
| A Guardian. Someone who chooses to honour the bond. | Join About | Same concept | Matches moderation, Guardian allocation and certificate behavior. |
| Join; Find a tree; Tie a Rakhi; Click a picture; Upload & inspire others | Join | Five compact numbered steps | Moves the only participation explanation beside the form. |
| Choose a tree to celebrate | Join | “Find a tree” and “choose a tree to celebrate” | Avoids legal ownership or formal adoption implications. |
| Campaign gallery | Home and Movement | Existing Promise Reel on Home; approved entries on Movement Wall | Avoids a duplicate homepage gallery and keeps public entries authoritative. |
| Ped Ka Paigaam | Removed from public site | Not implemented | Not supported by the approved current content source. |

## Homepage section audit

| Previous section | Decision | Final location / reason |
|---|---|---|
| Hero, live counter and Promise Reel | KEEP | Concise Home campaign overview. |
| Campaign Story | MERGE / REMOVE | Approved meaning condensed into Join About. |
| Movement Pillars | MOVE | Three supported concepts moved to Join. |
| Four-step participation and certificate preview | REPLACE / MOVE | Replaced by the approved five compact steps on Join. |
| First Rakhi Moment | REMOVE | Development-era editorial filler. |
| Digital/on-ground campaign channels | REMOVE | Not required for the three-job public IA. |
| Second Movement preview gallery | REMOVE | Duplicated the Promise Reel and `/movement`. |
| Ped Ka Paigaam | REMOVE | No approved source in the current content document. |
| Final CTA | MERGE | One compact campaign promise and Movement link below the reel. |

## Global brand rename

The former public spelling was removed from rendered pages, metadata, accessibility labels, staff UI, Supabase recovery email, transactional email, certificate pixels/PDF metadata, Excel title/filename, tests and current documentation.

Technical and historical occurrences intentionally preserved:

- Repository: `mirchi-vriksha/vriksha-vvandhan` — deployed source-control identifier.
- npm package: `vriksha-vvandhan-campaign` — internal package identifier.
- Supabase local/staging project IDs: `vriksha-vvandhan` and `vriksha-vvandhan-staging` — deployed infrastructure.
- Hosted staging URL: `vriksha-vvandhan.vercel.app` — deployed origin used by recovery configuration.
- Load-test User-Agent values — internal historical observability identifiers.
- Original deck filename and quoted source-deck spelling — provenance only, explicitly labelled historical.
- Tests and this migration map may mention the former spelling solely to assert its absence or explain the rename.

No database table, column, enum, function, migration, Storage bucket, API route, environment variable, audit action or Guardian number was renamed.
