# LoopStation Worship

Loop station for live worship: step-sequencer loops that play continuously until you press Stop, a metronome with BPM −/+/slider/tap, gongs, hi-hats and African percussion (including the **gangan** talking drum), microphone recording of your own beats, stem separation, and a private storage space inside the app.

Stack: plain HTML/JS (Web Audio API) wrapped for Android with Capacitor, plus a small Python server for stem separation.

## 1. Build the Android app

Requirements: Node.js, Android Studio (with an SDK), Python 3.

```bash
npm run setup          # installs Capacitor (core, android, filesystem, cli)
npm run android:add    # creates android/, adds permissions to the manifest, syncs www/
npm run android:open   # opens Android Studio -> Run on a phone / Build APK
```
After editing anything in `www/`: `npm run android:sync`.
Quick test in a desktop browser: `npm run serve` (storage then uses IndexedDB instead of the phone's private folder).

## 2. Stem separation server (the "Separate" tab)

Demucs is too heavy to run inside a phone web view, so separation runs on a computer on the same Wi-Fi (a GPU is much faster than a CPU).

```bash
cd server
pip install -r requirements.txt
LOOP_TOKEN=choose-a-secret uvicorn server:app --host 0.0.0.0 --port 8000
```
In the app: Separate → server address `http://<computer-ip>:8000`, token, pick a song, **Separate**. Stems are downloaded to the app's storage and open in the stem player (volume + mute per stem).
Models: `htdemucs_6s` = vocals, drums, bass, guitar, piano, other; `htdemucs` = vocals, drums, bass, other. Plain HTTP on a local network is not encrypted — use a token and a network you trust.

## 3. How things work

- **Loops**: tap a step to cycle off → normal → accent. 8/12/16/24/32 steps per 4-beat bar. A look-ahead scheduler on the audio clock keeps the loop gap-free; it only stops when you press Stop. BPM changes apply live.
- **Instruments dropdown**: gongs, hi-hats, African percussion (gangan ×5 variants, djembe ×3, conga ×2, shekere, agogo ×2), kit. All sounds are **synthesized in code** — no recordings are bundled. Import real recordings ("Import audio sample") and they appear under *My samples*.
- **Record**: *Record synced loop* captures N bars exactly on the loop's bar grid (count-in optional) and adds it as a looping track. Use headphones and adjust *Latency offset* if the take sounds early/late (record a clap on the click to calibrate). *One-shot sample* records any sound into your sample list.
- **Export**: "Export loop (WAV)" renders the pattern + recorded takes to a WAV in the library (backing track).
- **Storage**: `LoopStation/{samples,loops,projects,recordings,separated}` in the app's private data directory.
- **Permissions**: on first launch the app asks for the microphone and calls the storage-permission request. Per the Capacitor Filesystem docs, the READ/WRITE_EXTERNAL_STORAGE permissions only matter for `Directory.Documents`/`ExternalStorage` on Android 10 and older; the app-private `Directory.Data` used here needs no permission, so on Android 11+ you will normally see only the microphone prompt.

## 4. Known limitations (read before Sunday)

- **Not tested on a real phone or in a browser.** What was checked: JavaScript and Python syntax, the WAV encoder, and the scheduler's step/bar/clip-phase arithmetic (with a stub audio context). **Not run:** actual audio output, microphone capture, Capacitor storage on a device, and the server (FastAPI/Demucs could not be installed where the code was written). Expect to fix small bugs, and do a full rehearsal before Sunday.
- Recorded takes change **pitch** if you change BPM after recording (playback-rate scaling; no time-stretching).
- Gangan/djembe sounds are synthetic approximations. Real samples will sound better.
- Stem quality comes from Demucs; the 6-stem model is described by its authors as experimental (guitar "okay", piano with bleed/artifacts).
- Stem player uses one `<audio>` element per stem, re-aligned every 1.5 s; very small drift is possible.
- Android may suspend audio if the app is backgrounded or the screen locks; keep it in the foreground (a screen wake-lock is requested when supported).

## Sources
- Capacitor Filesystem (permissions, Directory.Data): https://capacitorjs.com/docs/apis/filesystem and https://capawesome.io/blog/android-scoped-storage-in-capacitor-apps/
- Demucs 6-stem model and CLI: https://github.com/facebookresearch/demucs , https://pypi.org/project/stem-separator/
- Upstream notes on htdemucs_6s quality: https://huggingface.co/schism-audio/htdemucs-6s-mlx
