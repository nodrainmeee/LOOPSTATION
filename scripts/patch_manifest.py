"""Adds the permissions LoopStation needs to the generated Android manifest.
Run from the project root after `npx cap add android` (npm run android:add does it for you)."""
import pathlib
import sys

path = pathlib.Path("android/app/src/main/AndroidManifest.xml")
if not path.exists():
    sys.exit("AndroidManifest.xml not found - run `npx cap add android` first")

wanted = {
    "android.permission.INTERNET": "",
    "android.permission.RECORD_AUDIO": "",
    "android.permission.MODIFY_AUDIO_SETTINGS": "",
    "android.permission.WAKE_LOCK": "",
    "android.permission.READ_EXTERNAL_STORAGE": ' android:maxSdkVersion="32"',
    "android.permission.WRITE_EXTERNAL_STORAGE": ' android:maxSdkVersion="29"',
}
text = path.read_text()
add = ""
for name, extra in wanted.items():
    if f'android:name="{name}"' not in text:
        add += f'    <uses-permission android:name="{name}"{extra} />\n'
if add:
    idx = text.rfind("</manifest>")
    text = text[:idx] + add + text[idx:]
    path.write_text(text)
    print("Added permissions:\n" + add)
else:
    print("Manifest already has all permissions")
