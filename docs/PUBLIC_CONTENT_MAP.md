# Public Content Map

The official public campaign name is **Vriksha Bandhan**. This map records how the supplied campaign content was adapted to the verified product rather than copied as unsupported claims.

| Source copy | Page | Implemented copy | Reason for adaptation |
|---|---|---|---|
| Vriksha Bandhan | Home, Join, Movement, legal, staff, email, certificate and export | Vriksha Bandhan | Locked official public name. |
| Protect the protector | Home hero | “It’s time to protect the protector.” | Exact approved hero line; duplicate protection headlines were removed. |
| Tie a Rakhi to a Tree | Home and global navigation | “Tie a Rakhi to a Tree” → `/join` | Gives the campaign one clear primary action. |
| 983 Tree Tracker | Home and Movement | Live `[current] of [target] VRIKSHA PROMISES` | Values stay derived from campaign settings and published eligible records; no hard-coded current count. |
| 983 Trees. 983 Promises. One Greener Mumbai. | Home and Join | Same campaign promise | Approved campaign statement, shown once per decision context. |
| This Raksha Bandhan, protect those who protect us | Join About | “Trees protect us every day. This Raksha Bandhan, Mirchi is inviting Mumbai to return that promise of protection — by tying a Rakhi to a tree and making that promise visible.” | Shortened and avoids unsupported environmental metrics. |
| A Rakhi. A promise of protection. | Join About | Same concept | Supported by the campaign action. |
| An Identity. Every tree gets a name and a story. | Join About | “An Identity. Every tree becomes part of the movement.” | The MVP does not collect a tree name or story. |
| A Protector. Every tree gets a guardian. | Join About | “A Guardian. Every approved promise receives a Vriksha Guardian identity.” | Matches moderation, Guardian allocation and certificate behavior. |
| Join; Find a tree; Tie a Rakhi; Click a picture; Upload & inspire others | Join | Five compact numbered steps | Moves the only participation explanation beside the form. |
| Adopt a tree | Join | “Find a tree” and “make a promise of protection” | Avoids legal ownership or formal adoption implications. |
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
