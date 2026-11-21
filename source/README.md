# Paired MicFX + Equalizer APO development source

The archive **MicFX_APO_Paired_Apps_Source_v0.8.tar.xz** has been uploaded here by the assistant. It contains the source, tests, and scripts from the v0.8 paired-app package, omitting the original Windows Equalizer APO executable and installer-only assets. The original Qt .ui files are retrieved at build time from the public Equalizer APO source repository.

The workflow in `.github/workflows/apo-paired-ios.yml` expands this archive and attempts unsigned iOS builds.

No user upload is required. **Do not upload an Endcord IPA, signing certificates, or passwords to this public repository.** A completed source upload is not an installable iPhone build; cross-compilation, signing entitlements, and Discord/Spotify audio integration still require validation.
