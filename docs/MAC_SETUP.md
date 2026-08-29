# Borrowing a Mac to make App Store assets

Apple requires iPhone screenshots taken on iOS. Simulators only run on macOS, and
Maestro drives simulators only — **it does not officially support physical
iPhones**. So a Mac is not a convenience here, it is the whole path.

This is the setup for doing that on someone else's laptop without making a mess
of it. Written for Tyler's daughter's college MacBook, on the understanding that
it stays her machine.

---

## Read this before installing anything

**Check free disk space first.** Xcode is roughly 10–15 GB, and each simulator
runtime adds around 7 GB. Budget **25 GB free**, and stop if there is less than
40 GB — a student laptop that fills up mid-semester is a real cost, and finding
that out halfway through an install is worse than not starting.

```
About This Mac -> More Info -> Storage
```

Under 40 GB free? Stop and say so. The alternatives are a rented cloud Mac
(MacStadium, AWS EC2 Mac — real money, hourly) or borrowing a different machine.
Neither is worse than filling her disk.

**What actually gets installed**, so the answer to "what is this doing to my
laptop" is honest:

| | |
|---|---|
| Xcode | A normal app in `/Applications`. Delete it to reclaim everything |
| Command Line Tools | Compilers. No background processes |
| Homebrew | Package manager in `/opt/homebrew` |
| maestro, idb-companion, node, cocoapods | Command-line tools. Nothing autostarts |

**Nothing runs in the background. No login items, no daemons, no menu-bar
icons.** Simulators exist only while a command is running, and quit when it
ends. Every bit of it uninstalls cleanly.

---

## Stage 1 — Xcode (her part, then leave it overnight)

The only step that needs her account, and the only slow one.

1. Open the **App Store**, search **Xcode**, click **Get**.
2. Leave the laptop **plugged in, lid open, on wifi**. It is a very large
   download.

That is the whole of her involvement unless you want remote access (Stage 6).

**Stop here until it finishes.** Everything below assumes Xcode is installed.

---

## Stage 2 — First launch

Open Xcode once from Applications, accept the licence, and let it install the
additional components it asks for. Then, in Terminal:

```sh
xcode-select --install
```

If it says the tools are already installed, that is fine. Then:

```sh
sudo xcodebuild -license accept
```

**Stop and confirm both finished.**

---

## Stage 3 — The tools

Homebrew first:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It prints two commands at the end to add itself to the shell. **Run those** —
it tells you exactly what they are, and they differ by machine.

Then:

```sh
brew install node cocoapods maestro
```

Then the piece Maestro needs to talk to simulators:

```sh
brew tap facebook/fb
brew install facebook/fb/idb-companion
```

Check it all landed:

```sh
node --version && maestro --version && pod --version
```

**Stop and paste that output.**

---

## Stage 4 — Get TaxTrail running in a simulator

```sh
git clone https://github.com/Fluke211/TaxTrail.git
cd TaxTrail/mobile
npm ci
```

Then build it into a simulator. **The first run takes 10–20 minutes** — it
compiles the native project and installs CocoaPods dependencies:

```sh
npx expo run:ios --device "iPhone 16 Pro Max"
```

The device matters: Apple requires a **6.9-inch** screenshot set, and the
16 Pro Max is that class at **1320 × 2868**. If that name is not available,
list what is:

```sh
xcrun simctl list devices available | grep -i "pro max"
```

Accepted 6.9" sizes are 1260×2736, 1290×2796 and 1320×2868 — any Pro Max in
that group works.

---

## Stage 5 — The thing that surprises everyone

**The iOS Simulator has no camera.** The capture flow cannot be driven there at
all, so screenshots come through the photo-library import path instead.

Load receipt images into the simulator first:

1. Boot the simulator.
2. **Drag receipt image files onto the simulator window.** They land in Photos.
3. In TaxTrail, use **Choose from photo library** rather than the camera.

This is also why the real corpus still has to come from a physical phone —
simulator runs prove the UI, never the scanner.

### Taking the shots

Exact device resolution, no scaling, no cropping:

```sh
xcrun simctl io booted screenshot ~/Desktop/shot1.png
```

PNG in RGB with no alpha is what Apple wants, which is what this produces.

### The preview video

App Previews are **15–30 seconds** at the same dimensions as the screenshots.

```sh
xcrun simctl io booted recordVideo ~/Desktop/preview.mov
```

Ctrl-C stops it. Apple is fussy about the encoding, so it will need a pass
through ffmpeg (`brew install ffmpeg`) before upload.

### Maestro

Maestro replaces doing the above by hand, so the shots are identical every time
you retake them — which matters, because you will retake them.

```sh
maestro test flows/screenshots.yaml
```

**The flows do not exist yet.** I will write them once a simulator is confirmed
working; they are plain YAML and need no decisions from you.

---

## Stage 6 — Optional: letting me drive it over wifi

Only if she is comfortable. It is one switch:

```
System Settings -> General -> Sharing -> Remote Login   (on)
```

That is macOS's built-in SSH. It adds nothing and installs nothing, and **she
can turn it off at any time** — the switch is the whole feature.

Find the address:

```sh
scutil --get LocalHostName
```

Then from your machine: `ssh <her-user>@<that-name>.local`

Worth agreeing out loud rather than assuming: sessions only while she is not
using it, she can flip the switch off whenever she likes, and nothing gets
installed after this without asking. The etiquette matters more than the config
here — it is her machine for school, and borrowing it on stated terms is a
different thing from quietly making it infrastructure.

---

## Undoing all of it

```sh
brew uninstall maestro idb-companion node cocoapods
brew untap facebook/fb
```

Then drag **Xcode** from Applications to the Trash, which reclaims the bulk of
the space. Homebrew removal instructions are on brew.sh. Turn **Remote Login**
back off. Nothing persists.

---

## What this costs

| | |
|---|---|
| Her attention | ~5 minutes, plus an overnight download |
| Disk | ~25 GB, fully reclaimable |
| Your time | ~1 hour after Xcode lands |
| Money | Nothing |

Sources: [Maestro iOS docs](https://docs.maestro.dev/get-started/supported-platform/ios) ·
[App Store screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)
