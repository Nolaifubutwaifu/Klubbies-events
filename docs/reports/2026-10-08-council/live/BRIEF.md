# Klubbies Events review council, round 3: the live app on a real iPhone

Same council as the 8 Oct static review (Maya, Viktor, Ines, Sam; same lenses, same temperaments, same rules).
This time the evidence is the LIVE app: the iOS wrapper (a WKWebView around https://events.klubbies.app)
running on an iPhone 11 Pro (iOS 27), mirrored through Device Hub, signed in as the organiser of the one
real event "Rasmus trip" (1 album "Mt barney", 25 photos, 13 iPhone .mov videos, 2 attendees, Free plan).

Repo: /Users/maximilianumschaden/Desktop/EVERYTHING WITH CODE/klubbies-events (Next.js 16, React 19,
Tailwind 4, Supabase; iOS wrapper in ios/KlubbiesEvents). Read-only for you: do NOT edit repo files.

## Read first
1. The static council's consensus: docs/reports/2026-10-08-review-council.md (and skim the round1/round2
   files in docs/reports/2026-10-08-council/ for your own earlier findings).
2. The walk log: WALK.md in this folder (what was tapped and what happened, with timings).
3. The screenshots: shots/ in this folder (named NN-what-it-shows.jpg). Open the ones relevant to your lens
   with the Read tool; look at them, don't just trust the file names.
4. Open the code behind anything you report (file:line), including ios/KlubbiesEvents/*.swift for wrapper
   behaviour.

## What round 3 is for
- CONFIRM or REFUTE the 8 Oct findings against what the phone actually shows (say which IDs, with the
  screenshot as evidence).
- Find NEW issues that only show up live: layout on a 375pt-wide phone, safe areas, the WebView wrapper,
  real data (iPhone .mov videos, failed uploads, a Free plan near its cap), timings, copy that reads wrong
  with real names.
- The owner reported: "a friend says downloading videos doesn't work". Every member must address this
  from their lens (what the user sees, root cause in code, fix).

## Output
Write `round3-<yourname>.md` in this folder: a 3 line verdict, then
- "Confirmed from the phone": 8 Oct IDs you saw live, one line each with the screenshot name.
- "Not reproduced / wrong": 8 Oct IDs the phone contradicts, with evidence.
- New findings numbered <INITIAL>L-1, <INITIAL>L-2 ... (ML-, VL-, IL-, SL-), each:
  ### ML-1 Title
  - Where: screenshot(s), file:line, user type, flow
  - Heuristic / severity (Nielsen 0-4) / effort (S/M/L):
  - Problem:
  - Fix: (concrete: what to change, where)
- "My top 10 for the fix list": ranked across ALL IDs (8 Oct and live), one line of reasoning each.
Aim for 6 to 12 strong new findings. Stay in character. Reply with a 5 line summary when done.
