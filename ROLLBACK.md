# Rozklad V2 rollback procedure

This document describes the rollback plan; it does not authorize a deployment or a rollback by itself.

## Preconditions and release markers

- Before any V2 cutover, record the actual GitHub Pages source branch/folder and the currently served commit.
- Create and record the release tags `stable-r0zklad-pre-cutover` on `teachersergiy-wq/r0zklad` main and `v2-pre-merge` on `teachersergiy-wq/Rozklad` main. These tags are currently pending.
- Keep the development branch `gpt/v2-tz-2026-09-19`; do not delete it.
- Keep the legacy site and database available during the human-defined observation period.
- Never run a final resync from legacy into V2; that decision was cancelled.

## Roll back the website

1. Obtain explicit human approval before changing GitHub Pages.
2. In `teachersergiy-wq/Rozklad` and `teachersergiy-wq/r0zklad`, open **Settings → Pages → Build and deployment** and inspect the currently selected branch and folder.
3. Record the current setting before changing anything. Set Pages to the approved legacy source (`r0zklad` main and its published folder) only if the human explicitly instructs this and confirms the site URL.
4. Verify the public site loads, the teacher workflow is usable, and the student legacy links resolve as expected. Do not assume the Pages setting is currently on any specific branch until it is checked in GitHub.

## Disable the legacy-to-V2 bridge

1. In `teachersergiy-wq/r0zklad/student-schedule.js`, change the single switch near the beginning from `const REDIRECT_TO_V2 = true;` to `const REDIRECT_TO_V2 = false;`.
2. Commit the change to `main` only after explicit human instruction.
3. Verify an old student URL remains on the legacy page and the original legacy RPC flow works. If the bridge is disabled, new V2 student links continue to point at V2; this switch only affects old URLs that still use the legacy page.

## Data recovery limitations

- A website rollback does **not** move V2 data back into the legacy database.
- Lessons, requests, payments, or other changes made only in V2 after cutover must be recovered from verified V2 backups/snapshots and handled deliberately. Do not overwrite V2 or legacy data automatically.
- The automated backup workflow must run only in a private backup destination. The unsafe workflow that committed full JSON backups into public `Rozklad` was removed from the PR branch and must not be restored there.
- Before restoring a backup, verify its timestamp, schema/format version, record counts, and restore procedure against a separate snapshot. Do not restore until a human explicitly approves the exact backup and target.

## Do not do automatically

- Do not merge PR #1.
- Do not change GitHub Pages settings.
- Do not rotate or revoke tokens until the live legacy-link bridge test is completed, unless a security incident requires immediate revocation.
- Do not delete `r0zklad` or `public.schedules`.
- Do not start Stage B or perform a legacy-to-V2 resync.
