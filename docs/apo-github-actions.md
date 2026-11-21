# MicFX + Equalizer APO iOS via GitHub Actions

This workflow builds unsigned development artifacts using macOS + Xcode hosted by GitHub; no personal Mac is required. It does **not** produce signed, ready-to-install apps.

## Current artifacts

- **Original-APO-Qt-iOS-Controller-UNSIGNED**: builds the stand-alone controller directly from this branch's `apo-ios/` source and the original Equalizer APO `PreampFilterGUI.ui` and `BiQuadFilterGUI.ui` forms. It does not require the v0.8 source ZIP. This first controller is not the complete original Windows Configuration Editor, and is not yet validated on iPhone.
- Existing MicFX dylib is built from `cvrzx/music-bridge` and uploaded as `Existing-MicFX-dylib-unsigned`.
- The additional v0.8 paired-app job is activated when the source archive `source/MicFX_APO_Paired_Apps_Source_v0.8.zip` exists in this branch. It builds experimental native source plus an iOS controller using **real Equalizer APO Qt Designer .ui files** from upstream. The full original Windows APO editor has not been ported.
- Download artifacts from **Actions → MicFX + Equalizer APO iOS → build run → Artifacts**.

## Upload the paired source archive

1. Download `MicFX_APO_Paired_Apps_Source_v0.8.zip` from this ChatGPT conversation (about 1 MB).
2. Open the `feature/apo-ios-github-actions` branch of `cvrzx/micfx`, and use **Add file → Upload files** to put that ZIP under `source/`. Commit to the feature branch, **not main**.
3. The push triggers a new GitHub Actions run. Download the paired artifacts if both jobs pass; if not, open job logs to diagnose the compilation error.

Do **not** upload the 194 MB Endcord IPA, private signing certificates, mobileprovision files, or passwords to this public repository.

## Limitations

Both the Discord mod and Equalizer APO controller need to be signed with provisioning profiles authorizing the same App Group (`group.f172ad8c5e5f97bc.1`). Downloaded unsigned artifacts are not installable in Feather as-is. The existing Endcord IPA remains unmodified by this workflow; injection, re-signing, and device testing are separate steps.

The stock Spotify app does not share decoded PCM via this App Group, so Spotify capture is **not implemented**. Discord may send mono mic audio, even if stereo routing occurs inside MicFX. Actual mic EQ chain hot-swap and MP3 call recording still require end-to-end implementation and testing.

Equalizer APO source and assets are GPL-2.0-or-later; source notices must be preserved. This is an independent experiment, not an official Equalizer APO or Discord build.
